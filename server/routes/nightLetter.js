import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import authMiddleware from '../middleware/auth.js';
import {
  listNightLetterPersonas,
  listNightLetterThreads,
  getNightLetters,
  triggerNightLetter,
  replyToNightLetter
} from '../controllers/nightLetterController.js';

const router = Router();

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true
});

router.get('/personas', authMiddleware, listNightLetterPersonas);
router.get('/threads', authMiddleware, listNightLetterThreads);
router.get('/threads/:id/letters', authMiddleware, getNightLetters);
router.post('/check', authMiddleware, aiLimiter, triggerNightLetter);
router.post('/threads/:id/reply', authMiddleware, aiLimiter, replyToNightLetter);

export default router;
