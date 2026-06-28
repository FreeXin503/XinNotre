import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import authMiddleware from '../middleware/auth.js';
import { startAnnotation as emotionStartAnnotation, getWeatherGrid, getClimateDiagnosis } from '../controllers/emotionWeatherController.js';

const router = Router();

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true
});

// Mount this router at '/' — routes span /annotation and /weather prefixes
router.post('/annotation/emotion', authMiddleware, aiLimiter, emotionStartAnnotation);
router.get('/weather/grid', authMiddleware, getWeatherGrid);
router.post('/weather/diagnosis', authMiddleware, aiLimiter, getClimateDiagnosis);

export default router;
