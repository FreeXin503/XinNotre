import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import authMiddleware from '../middleware/auth.js';
import {
  getCosmosSnapshot,
  generateCosmosSnapshot,
  getCosmosEvolution,
  getCosmosSnapshotById
} from '../controllers/cosmosController.js';

const router = Router();

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true
});

router.get('/snapshot', authMiddleware, getCosmosSnapshot);
router.post('/generate', authMiddleware, aiLimiter, generateCosmosSnapshot);
router.get('/evolution', authMiddleware, getCosmosEvolution);
router.get('/snapshot/:id', authMiddleware, getCosmosSnapshotById);

export default router;
