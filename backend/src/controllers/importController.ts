import { Request, Response } from 'express';
import multer from 'multer';
import { uploadAndPreview, confirmImport, getImportSession, getImportProgress } from '../services/importService';
import { AppError } from '../utils/AppError';

// Multer config — memory storage, CSV only, max 10MB
// Note: Windows browsers often send 'application/octet-stream' for CSV files,
// so we rely on file extension as the primary check.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'text/csv',
      'application/csv',
      'text/plain',
      'application/vnd.ms-excel',
      'application/octet-stream', // Windows fallback
    ];
    const isCSVByExt = file.originalname.toLowerCase().endsWith('.csv');
    const isCSVByMime = allowedMimes.includes(file.mimetype);
    if (isCSVByExt || isCSVByMime) {
      cb(null, true);
    } else {
      cb(new Error(`Only CSV files are allowed. Received: ${file.mimetype}`));
    }
  },
});

/**
 * POST /api/import/upload
 * Accept CSV, parse it, return preview (no AI).
 */
export async function handleUpload(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded. Please provide a CSV file.' });
      return;
    }

    const result = await uploadAndPreview(req.file.buffer, req.file.originalname);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse CSV';
    console.error('[Upload Error]', message);
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    res.status(statusCode).json({ error: message });
  }
}

/**
 * POST /api/import/confirm/:sessionId
 * Trigger AI extraction for a previously uploaded session.
 */
export async function handleConfirm(req: Request, res: Response): Promise<void> {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required.' });
      return;
    }

    const result = await confirmImport(sessionId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process import';
    console.error('[Confirm Error]', message);
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    res.status(statusCode).json({ error: message });
  }
}

/**
 * GET /api/import/:sessionId
 * Retrieve results for a completed import session.
 */
export async function handleGetSession(req: Request, res: Response): Promise<void> {
  try {
    const { sessionId } = req.params;
    const result = await getImportSession(sessionId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Session not found';
    console.error('[GetSession Error]', message);
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    res.status(statusCode).json({ error: message });
  }
}

/**
 * GET /api/import/progress/:sessionId
 * Retrieve live batch progress for an import session.
 */
export async function handleGetProgress(req: Request, res: Response): Promise<void> {
  try {
    const { sessionId } = req.params;
    const result = await getImportProgress(sessionId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Progress not found';
    console.error('[GetProgress Error]', message);
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    res.status(statusCode).json({ error: message });
  }
}
