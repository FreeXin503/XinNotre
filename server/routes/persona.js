import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import authMiddleware from '../middleware/auth.js';
import { generatePersona, listPersonas, getPersonaDiff } from '../controllers/personaController.js';

const router = Router();

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true
});

router.post('/generate', authMiddleware, aiLimiter, generatePersona);
router.get('/history', authMiddleware, listPersonas);
router.get('/diff', authMiddleware, getPersonaDiff);

export default router;
