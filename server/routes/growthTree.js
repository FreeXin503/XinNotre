import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import authMiddleware from '../middleware/auth.js';
import {
  startGoalExtraction,
  listGoals,
  updateGoalStatus,
  linkEvidence,
  settleYear
} from '../controllers/growthTreeController.js';

const router = Router();

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true
});

// Mount this router at '/' — routes span /goal and /goals prefixes
router.post('/goal/extract', authMiddleware, aiLimiter, startGoalExtraction);
router.get('/goals', authMiddleware, listGoals);
router.put('/goals/:id/status', authMiddleware, updateGoalStatus);
router.post('/goals/:id/evidence', authMiddleware, linkEvidence);
router.post('/goals/settle', authMiddleware, aiLimiter, settleYear);

export default router;
