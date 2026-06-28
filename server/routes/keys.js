import { Router } from 'express';
import authMiddleware from '../middleware/auth.js';
import { listKeys, setKey, deleteKey, getUsageStats } from '../controllers/keyController.js';

const router = Router();

router.get('/', authMiddleware, listKeys);
router.post('/', authMiddleware, setKey);
router.delete('/:provider', authMiddleware, deleteKey);
router.get('/usage', authMiddleware, getUsageStats);

export default router;
