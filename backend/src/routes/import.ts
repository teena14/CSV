import { Router } from 'express';
import {
  upload,
  handleUpload,
  handleConfirm,
  handleGetProgress,
  handleGetSession,
} from '../controllers/importController';

const router = Router();

router.post('/upload', upload.single('file'), handleUpload);
router.post('/confirm/:sessionId', handleConfirm);
router.get('/progress/:sessionId', handleGetProgress);
router.get('/:sessionId', handleGetSession);

export default router;
