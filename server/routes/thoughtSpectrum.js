import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import authMiddleware from '../middleware/auth.js';
import {
  generateThoughtSpectrum,
  listThoughtSpectrum,
  getTopicEvolution,
  manageTopics
} from '../controllers/thoughtSpectrumController.js';

const router = Router();

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true
});

router.post('/generate', authMiddleware, aiLimiter, generateThoughtSpectrum);
router.get('/history', authMiddleware, listThoughtSpectrum);
router.get('/evolution', authMiddleware, getTopicEvolution);
router.post('/topics', authMiddleware, manageTopics);

export default router;
