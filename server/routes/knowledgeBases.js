import { Router } from 'express';
import authMiddleware from '../middleware/auth.js';
import {
  listKnowledgeBases,
  createKnowledgeBase,
  updateKnowledgeBase,
  deleteKnowledgeBase,
  getKbNotes,
  addNoteToKb,
  removeNoteFromKb,
  reorderKbNotes,
  bulkAddToKb,
  getKbRecommendations
} from '../controllers/kbController.js';

const router = Router();

router.get('/', authMiddleware, listKnowledgeBases);
router.post('/', authMiddleware, createKnowledgeBase);
router.put('/:id', authMiddleware, updateKnowledgeBase);
router.delete('/:id', authMiddleware, deleteKnowledgeBase);
router.get('/:id/notes', authMiddleware, getKbNotes);
router.post('/:id/notes', authMiddleware, addNoteToKb);
router.delete('/notes/:noteId', authMiddleware, removeNoteFromKb);
router.put('/:id/notes/reorder', authMiddleware, reorderKbNotes);
router.post('/:id/notes/bulk', authMiddleware, bulkAddToKb);
router.get('/:id/recommendations', authMiddleware, getKbRecommendations);

export default router;
