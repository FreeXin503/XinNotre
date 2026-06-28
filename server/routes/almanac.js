import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import authMiddleware from '../middleware/auth.js';
import { publishAlmanac, downloadAlmanacPdf, listAlmanacs } from '../controllers/almanacController.js';

const router = Router();

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true
});

router.post('/publish', authMiddleware, aiLimiter, publishAlmanac);
router.post('/pdf/:id', authMiddleware, downloadAlmanacPdf);
router.get('/list', authMiddleware, listAlmanacs);

export default router;
