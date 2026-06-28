import { Router } from 'express';
import authMiddleware from '../middleware/auth.js';
import { getSkills } from '../controllers/skillController.js';

const router = Router();

router.get('/', authMiddleware, getSkills);

export default router;
