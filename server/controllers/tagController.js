import tagRepository from '../repositories/tagRepository.js';
import { success, fail, asyncHandler } from '../utils/response.js';

export const listTags = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const tags = await tagRepository.findByUserId(userId);
  success(res, { tags });
});

export const createTag = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  let { name, color } = req.body;
  name = String(name || '').trim().substring(0, 50);
  color = String(color || '#4ed8ff').substring(0, 20);

  if (!name) return fail(res, 'Tag name required', 400);

  try {
    const tag = await tagRepository.create(userId, name, color);
    success(res, tag, 201);
  } catch (err) {
    if (err.errno === 1062) {
      return fail(res, 'Tag already exists', 409);
    }
    throw err;
  }
});

export const updateTag = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  let { name, color } = req.body;
  if (name !== undefined) name = String(name).trim().substring(0, 50);
  if (color !== undefined) color = String(color).substring(0, 20);

  try {
    const updated = await tagRepository.update(id, userId, { name, color });
    if (!updated) return fail(res, 'Tag not found', 404);
    success(res, updated);
  } catch (err) {
    if (err.errno === 1062) return fail(res, 'Tag name already exists', 409);
    throw err;
  }
});

export const deleteTag = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  await tagRepository.delete(id, userId);
  success(res, { message: 'Tag deleted' });
});

export const addTagToNote = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { noteId } = req.params;
  const { tagId } = req.body;

  const tag = await tagRepository.findById(userId, tagId);
  if (!tag) return fail(res, 'Tag not found', 404);

  await tagRepository.addToNote(noteId, tagId);
  success(res, { message: 'Tag added to note' }, 201);
});

export const removeTagFromNote = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { noteId, tagId } = req.params;

  await tagRepository.removeFromNote(noteId, tagId, userId);
  success(res, { message: 'Tag removed from note' });
});

export const getNoteTags = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { noteId } = req.params;

  const tags = await tagRepository.findByNoteId(noteId, userId);
  success(res, { tags });
});

export const getNoteTagsBatch = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { noteIds } = req.body;

  if (!Array.isArray(noteIds) || noteIds.length === 0) {
    return success(res, { tagMap: {} });
  }

  const tagMap = await tagRepository.findByNoteIds(noteIds, userId);
  success(res, { tagMap });
});
