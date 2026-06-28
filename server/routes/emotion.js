import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import authMiddleware from '../middleware/auth.js';
import { analyzeEmotion, getEmotionWeekly } from '../controllers/emotionController.js';

const router = Router();

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true
});

router.post('/analyze', authMiddleware, aiLimiter, analyzeEmotion);
router.get('/weekly', authMiddleware, getEmotionWeekly);

export default router;
