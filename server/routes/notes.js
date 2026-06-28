import { Router } from 'express';
import authMiddleware from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getNotes, getDeletedNotes, getNoteDetail, createNote, updateNote, deleteNote, restoreNote } from '../controllers/noteController.js';

const router = Router();

router.get('/', authMiddleware, validate('pagination'), getNotes);
router.get('/deleted', authMiddleware, getDeletedNotes);
router.post('/', authMiddleware, validate('createNote'), createNote);
router.get('/:id', authMiddleware, getNoteDetail);
router.put('/:id', authMiddleware, validate('updateNote'), updateNote);
router.delete('/:id', authMiddleware, deleteNote);
router.post('/:id/restore', authMiddleware, restoreNote);

export default router;
