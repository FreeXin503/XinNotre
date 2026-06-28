import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import authMiddleware from '../middleware/auth.js';
import { generateReport, getReportHistory } from '../controllers/reportController.js';
import { exportReportPdf } from '../controllers/pdfController.js';
import { shareReport } from '../controllers/shareController.js';

const router = Router();

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true
});

router.post('/generate', authMiddleware, aiLimiter, generateReport);
router.get('/history', authMiddleware, getReportHistory);
router.get('/:id/pdf', authMiddleware, exportReportPdf);
router.post('/:id/share', authMiddleware, shareReport);

export default router;
