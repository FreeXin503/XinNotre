import express from 'express';
import { register, login } from '../controllers/authController.js';
import { getNotes, getNoteDetail, createNote, updateNote, deleteNote } from '../controllers/noteController.js';
import { syncPush } from '../controllers/syncController.js';
import { chatStream } from '../controllers/aiController.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Public auth routes
router.post('/auth/register', register);
router.post('/auth/login', login);

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

export default router;
