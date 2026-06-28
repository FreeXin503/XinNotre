import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import authMiddleware from '../middleware/auth.js';
import {
  createPenpalThread,
  listPenpalThreads,
  postPenpalMessage,
  getPenpalLetters
} from '../controllers/penpalController.js';

const router = Router();

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true
});

router.post('/threads', authMiddleware, createPenpalThread);
router.get('/threads', authMiddleware, listPenpalThreads);
router.post('/threads/:id/messages', authMiddleware, aiLimiter, postPenpalMessage);
router.get('/threads/:id/letters', authMiddleware, getPenpalLetters);

export default router;
