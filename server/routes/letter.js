import { Router } from 'express';
import authMiddleware from '../middleware/auth.js';
import { createLetter, listLetters, triggerCheck, openLetter } from '../controllers/letterController.js';

const router = Router();

// Mount this router at '/' — /letter and /letters routes share this file
router.post('/letter', authMiddleware, createLetter);
router.get('/letters', authMiddleware, listLetters);
router.post('/letters/check', authMiddleware, triggerCheck);
router.get('/letter/:id/open', authMiddleware, openLetter);

export default router;
