import express from 'express';
import rateLimit from 'express-rate-limit';
import { register, login } from '../controllers/authController.js';
import { getNotes, getNoteDetail, createNote, updateNote, deleteNote } from '../controllers/noteController.js';
import { syncPush } from '../controllers/syncController.js';
import { chatStream } from '../controllers/aiController.js';
import { getSkills } from '../controllers/skillController.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Rate limiting for auth routes (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// Public auth routes
router.post('/auth/register', authLimiter, register);
router.post('/auth/login', authLimiter, login);

// Protected routes (require JWT auth)
router.get('/notes', authMiddleware, getNotes);
router.post('/notes', authMiddleware, createNote);
router.get('/notes/:id', authMiddleware, getNoteDetail);
router.put('/notes/:id', authMiddleware, updateNote);
router.delete('/notes/:id', authMiddleware, deleteNote);

// Userscript Cloud Sync route
router.post('/sync/push', authMiddleware, syncPush);

// SSE Streaming AI Dialog route
router.post('/ai/chat', authMiddleware, chatStream);

// Get parsed nvwo skills
router.get('/skills', authMiddleware, getSkills);

export default router;
