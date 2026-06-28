import { Router } from 'express';
import authMiddleware from '../middleware/auth.js';
import { listTags, createTag, updateTag, deleteTag, getNoteTags, getNoteTagsBatch, addTagToNote, removeTagFromNote } from '../controllers/tagController.js';

const router = Router();

// Mount this router at '/' so both /tags and /notes/:noteId/tags patterns work
router.get('/tags', authMiddleware, listTags);
router.post('/tags', authMiddleware, createTag);
router.put('/tags/:id', authMiddleware, updateTag);
router.delete('/tags/:id', authMiddleware, deleteTag);
router.get('/notes/:noteId/tags', authMiddleware, getNoteTags);
router.post('/notes/tags/batch', authMiddleware, getNoteTagsBatch);
router.post('/notes/:noteId/tags', authMiddleware, addTagToNote);
router.delete('/notes/:noteId/tags/:tagId', authMiddleware, removeTagFromNote);

export default router;
