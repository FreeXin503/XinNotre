import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import authMiddleware from '../middleware/auth.js';
import { syncPush, getSyncHistory } from '../controllers/syncController.js';

const router = Router();

const syncLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: { error: 'Too many sync requests, please wait' },
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/push', authMiddleware, syncLimiter, syncPush);
router.get('/history', authMiddleware, getSyncHistory);

export default router;
