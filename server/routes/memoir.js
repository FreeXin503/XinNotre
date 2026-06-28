import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import authMiddleware from '../middleware/auth.js';
import {
  generateMemoir,
  listMemoirs,
  editChapter,
  publishMemoir,
  exportMemoirPdf
} from '../controllers/memoirController.js';

const router = Router();

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true
});

router.post('/generate', authMiddleware, aiLimiter, generateMemoir);
router.get('/', authMiddleware, listMemoirs);
router.put('/:memoirId/chapters/:seq', authMiddleware, editChapter);
router.post('/:id/publish', authMiddleware, publishMemoir);
router.get('/:id/export', authMiddleware, exportMemoirPdf);

export default router;
