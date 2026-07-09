import type { PreviewData, ImportResult, ImportProgress } from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Upload a CSV file for preview (no AI processing).
 */
export async function uploadCSV(file: File): Promise<PreviewData> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/api/import/upload`, {
    method: 'POST',
    body: formData,
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Upload failed');
  }
  return json.data as PreviewData;
}

/**
 * Confirm import — triggers AI extraction.
 */
export async function confirmImport(sessionId: string): Promise<ImportResult> {
  const res = await fetch(`${API_BASE}/api/import/confirm/${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Import processing failed');
  }
  return json.data as ImportResult;
}

/**
 * Get live import progress while AI extraction is running.
 */
export async function getImportProgress(sessionId: string): Promise<ImportProgress> {
  const res = await fetch(`${API_BASE}/api/import/progress/${sessionId}`);

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Progress not found');
  }
  return json.data as ImportProgress;
}

/**
 * Get a previously processed import session.
 */
export async function getImportSession(sessionId: string): Promise<ImportResult> {
  const res = await fetch(`${API_BASE}/api/import/${sessionId}`);

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Session not found');
  }
  return json.data as ImportResult;
}
