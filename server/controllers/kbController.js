import { withTransaction } from '../config/database.js';
import kbRepository from '../repositories/kbRepository.js';
import { searchVectors } from '../services/vectorStore.js';
import { embedText } from '../services/embeddingService.js';
import { success, fail, asyncHandler } from '../utils/response.js';

export const listKnowledgeBases = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const knowledgeBases = await kbRepository.findByUserId(userId);
  success(res, { knowledgeBases });
});

export const createKnowledgeBase = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  let { name, description, icon } = req.body;
  name = String(name || '未命名知识库').substring(0, 200);
  description = String(description || '').substring(0, 2000);
  icon = String(icon || '📚').substring(0, 10);

  const kb = await kbRepository.create(userId, name, description, icon);
  success(res, kb, 201);
});

export const updateKnowledgeBase = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  let { name, description, icon } = req.body;
  if (name !== undefined) name = String(name).substring(0, 200);
  if (description !== undefined) description = String(description).substring(0, 2000);
  if (icon !== undefined) icon = String(icon).substring(0, 10);

  const updated = await kbRepository.update(id, userId, { name, description, icon });
  if (!updated) return fail(res, 'Knowledge base not found', 404);
  success(res, updated);
});

export const deleteKnowledgeBase = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const deleted = await kbRepository.delete(id, userId);
  if (!deleted) return fail(res, 'Knowledge base not found', 404);
  success(res, { message: 'Knowledge base deleted' });
});

export const getKbNotes = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  const kb = await kbRepository.findById(id, userId);
  if (!kb) return fail(res, 'Knowledge base not found', 404);

  const notes = await kbRepository.findNotes(id, parseInt(limit), parseInt(offset));
  const total = await kbRepository.countNotes(id);

  success(res, { notes, total });
});

export const addNoteToKb = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { noteId } = req.body;

  if (!noteId) return fail(res, 'noteId is required', 400);

  const kb = await kbRepository.findById(id, userId);
  if (!kb) return fail(res, 'Knowledge base not found', 404);

  const note = await kbRepository.hasNotePermission(noteId, userId);
  if (!note) return fail(res, 'Note not found', 404);

  const existing = await kbRepository.findExisting(id, noteId);
  if (existing) return fail(res, 'Note already in this knowledge base', 409);

  const maxOrder = await kbRepository.getMaxSortOrder(id);
  const nextOrder = maxOrder + 1;

  await kbRepository.addNote(id, noteId, nextOrder);

  success(res, { message: 'Note added to knowledge base' }, 201);
});

export const removeNoteFromKb = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { noteId } = req.params;
  const { kbId } = req.body;

  if (kbId) {
    const kb = await kbRepository.findById(kbId, userId);
    if (!kb) return fail(res, 'Knowledge base not found', 404);
    await kbRepository.removeNote(kbId, noteId);
  } else {
    await kbRepository.removeNoteFromAll(noteId, userId);
  }
  success(res, { message: 'Note removed from knowledge base' });
});

export const reorderKbNotes = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { noteIds } = req.body;

  if (!Array.isArray(noteIds)) return fail(res, 'noteIds array is required', 400);

  const kb = await kbRepository.findById(id, userId);
  if (!kb) return fail(res, 'Knowledge base not found', 404);

  await kbRepository.reorderNotes(id, noteIds);

  success(res, { message: 'Notes reordered' });
});

export const bulkAddToKb = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { noteIds } = req.body;

  if (!Array.isArray(noteIds) || noteIds.length === 0) return fail(res, 'noteIds array required', 400);

  const kb = await kbRepository.findById(id, userId);
  if (!kb) return fail(res, 'Knowledge base not found', 404);

  let added = 0;
  await withTransaction(async (tx) => {
    const maxOrder = await tx(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM knowledge_base_notes WHERE kb_id = ?', [id]
    );
    let nextOrder = Number(maxOrder.rows[0]?.max_order || -1) + 1;

    for (const noteId of noteIds) {
      const existing = await tx(
        'SELECT id FROM knowledge_base_notes WHERE kb_id = ? AND note_id = ?', [id, noteId]
      );
      if (existing.rows.length > 0) continue;
      await tx(
        'INSERT INTO knowledge_base_notes (kb_id, note_id, sort_order) VALUES (?, ?, ?)',
        [id, noteId, nextOrder++]
      );
      added++;
    }
  });

  success(res, { message: `Added ${added} notes`, added });
});

export const getKbRecommendations = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const kb = await kbRepository.findById(id, userId);
  if (!kb) return fail(res, 'Knowledge base not found', 404);

  // Get all notes in this KB to compute a centroid-like query
  const kbNotes = await kbRepository.findNotes(id, 10, 0);

  if (kbNotes.length === 0) return success(res, { recommendations: [] });

  // Build a representative text from KB notes
  const representativeText = kbNotes.map(n => n.title + ' ' + (n.content || '').substring(0, 200)).join(' ');
  const queryVector = await embedText(representativeText);

  // Get existing note IDs in KB
  const existingIds = new Set(kbNotes.map(n => n.id));

  const results = await searchVectors(queryVector, 30, userId);
  const recommendations = results
    .filter(r => !existingIds.has(r.id))
    .slice(0, 8)
    .map(r => ({
      note_id: r.id,
      score: Math.round(r.score * 10000) / 10000,
      reason: `与知识库主题相似度 ${Math.round(r.score * 100)}%`
    }));

  // Save to DB
  await kbRepository.saveRecommendations(id, recommendations);

  success(res, { recommendations });
});
