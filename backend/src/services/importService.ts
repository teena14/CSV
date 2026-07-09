import mongoose from 'mongoose';
import { ImportSessionModel } from '../models/ImportSession';
import { parseCSV } from './csvService';
import { extractCRMRecords } from './aiService';
import type { PreviewResponse, ImportResponse, ImportProgressResponse, CRMRecord, SkippedRecord } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../utils/AppError';

// ─── In-Memory Session Store (fallback when MongoDB is unavailable) ────────────
interface InMemorySession {
  _id: string;
  filename: string;
  originalHeaders: string[];
  totalRows: number;
  rawRows: Record<string, string>[];
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  batchesDone: number;
  totalBatches: number;
  processingError: string;
  records: CRMRecord[];
  skippedRecords: SkippedRecord[];
  successCount: number;
  skippedCount: number;
  processedAt: Date;
}

const memoryStore = new Map<string, InMemorySession>();

function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

// ─── Session Read/Write Helpers ────────────────────────────────────────────────

async function createSession(data: Omit<InMemorySession, '_id' | 'processedAt'>): Promise<InMemorySession> {
  if (isMongoConnected()) {
    const doc = await ImportSessionModel.create({
      ...data,
      processedAt: new Date(),
    });
    return {
      _id: doc._id.toString(),
      filename: doc.filename,
      originalHeaders: doc.originalHeaders as string[],
      totalRows: doc.totalRows,
      rawRows: doc.rawRows as Record<string, string>[],
      processingStatus: doc.processingStatus,
      batchesDone: doc.batchesDone,
      totalBatches: doc.totalBatches,
      processingError: doc.processingError,
      records: doc.records as CRMRecord[],
      skippedRecords: doc.skippedRecords as SkippedRecord[],
      successCount: doc.successCount,
      skippedCount: doc.skippedCount,
      processedAt: doc.processedAt,
    };
  }

  // Fallback: in-memory
  const session: InMemorySession = {
    _id: uuidv4(),
    ...data,
    processedAt: new Date(),
  };
  memoryStore.set(session._id, session);
  console.log(`📝 Session stored in memory (MongoDB unavailable): ${session._id}`);
  return session;
}

async function findSession(sessionId: string): Promise<InMemorySession | null> {
  if (isMongoConnected()) {
    const doc = await ImportSessionModel.findById(sessionId);
    if (!doc) return null;
    return {
      _id: doc._id.toString(),
      filename: doc.filename,
      originalHeaders: doc.originalHeaders as string[],
      totalRows: doc.totalRows,
      rawRows: doc.rawRows as Record<string, string>[],
      processingStatus: doc.processingStatus,
      batchesDone: doc.batchesDone,
      totalBatches: doc.totalBatches,
      processingError: doc.processingError,
      records: doc.records as CRMRecord[],
      skippedRecords: doc.skippedRecords as SkippedRecord[],
      successCount: doc.successCount,
      skippedCount: doc.skippedCount,
      processedAt: doc.processedAt,
    };
  }

  // Fallback: in-memory
  return memoryStore.get(sessionId) ?? null;
}

async function updateSession(sessionId: string, updates: Partial<InMemorySession>): Promise<void> {
  if (isMongoConnected()) {
    await ImportSessionModel.findByIdAndUpdate(sessionId, updates);
    return;
  }

  // Fallback: in-memory
  const existing = memoryStore.get(sessionId);
  if (existing) {
    memoryStore.set(sessionId, { ...existing, ...updates });
  }
}

// ─── Public Service Functions ──────────────────────────────────────────────────

/**
 * Upload & parse CSV — return preview without AI processing.
 */
export async function uploadAndPreview(
  buffer: Buffer,
  filename: string
): Promise<PreviewResponse> {
  const { headers, rows } = parseCSV(buffer);

  if (rows.length === 0) {
    throw new AppError('CSV file is empty or has no valid data rows.', 400);
  }

  if (headers.length === 0) {
    throw new AppError('Could not detect CSV headers. Please ensure the first row contains column names.', 400);
  }

  const session = await createSession({
    filename,
    originalHeaders: headers,
    totalRows: rows.length,
    rawRows: rows,
    processingStatus: 'pending',
    batchesDone: 0,
    totalBatches: Math.ceil(rows.length / 10),
    processingError: '',
    records: [],
    skippedRecords: [],
    successCount: 0,
    skippedCount: 0,
  });

  return {
    sessionId: session._id,
    filename,
    headers,
    rows,
    totalRows: rows.length,
    preview: rows.slice(0, 10),
  };
}

/**
 * Confirm import — run AI extraction and save results.
 */
export async function confirmImport(sessionId: string): Promise<ImportResponse> {
  const session = await findSession(sessionId);
  if (!session) {
    throw new AppError(`Import session not found: ${sessionId}`, 404);
  }

  const { originalHeaders: headers, rawRows } = session;

  if (!rawRows || rawRows.length === 0) {
    throw new AppError('No rows found in session. Please upload the file again.', 400);
  }

  const totalBatches = Math.ceil(rawRows.length / 10);

  await updateSession(sessionId, {
    processingStatus: 'processing',
    batchesDone: 0,
    totalBatches,
    processingError: '',
    records: [],
    skippedRecords: [],
    successCount: 0,
    skippedCount: 0,
    processedAt: new Date(),
  });

  try {
    const { records, skippedRecords } = await extractCRMRecords(
      headers,
      rawRows,
      async (batchIndex, total) => {
        await updateSession(sessionId, {
          processingStatus: 'processing',
          batchesDone: batchIndex,
          totalBatches: total,
        });
      }
    );

    await updateSession(sessionId, {
      processingStatus: 'completed',
      batchesDone: totalBatches,
      totalBatches,
      processingError: '',
      records,
      skippedRecords,
      successCount: records.length,
      skippedCount: skippedRecords.length,
      processedAt: new Date(),
    });

    return {
      sessionId,
      records,
      skippedRecords,
      successCount: records.length,
      skippedCount: skippedRecords.length,
      totalRows: session.totalRows,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import processing failed';
    await updateSession(sessionId, {
      processingStatus: 'failed',
      processingError: message,
      processedAt: new Date(),
    });
    throw error;
  }
}

/**
 * Get a previously processed import session.
 */
export async function getImportSession(sessionId: string): Promise<ImportResponse> {
  const session = await findSession(sessionId);
  if (!session) {
    throw new AppError(`Import session not found: ${sessionId}`, 404);
  }

  return {
    sessionId,
    records: session.records,
    skippedRecords: session.skippedRecords,
    successCount: session.successCount,
    skippedCount: session.skippedCount,
    totalRows: session.totalRows,
  };
}

/**
 * Get live progress for an import session.
 */
export async function getImportProgress(sessionId: string): Promise<ImportProgressResponse> {
  const session = await findSession(sessionId);
  if (!session) {
    throw new AppError(`Import session not found: ${sessionId}`, 404);
  }

  return {
    sessionId,
    status: session.processingStatus,
    batchesDone: session.batchesDone,
    totalBatches: session.totalBatches || Math.ceil(session.totalRows / 10),
    totalRows: session.totalRows,
    successCount: session.successCount,
    skippedCount: session.skippedCount,
    error: session.processingError || undefined,
  };
}
