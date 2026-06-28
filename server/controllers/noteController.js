/**
 * 心迹星图 便签控制器
 * 职责：HTTP 请求/响应处理，业务逻辑委托给 NoteRepository
 *
 * 优化说明：
 * - 裸 SQL 已全部迁移至 server/repositories/noteRepository.js
 * - 响应格式统一使用 server/utils/response.js
 * - 异步错误由 asyncHandler 自动捕获
 */
import noteRepository from '../repositories/noteRepository.js';
import { success, fail, paginated, asyncHandler } from '../utils/response.js';
import { clampInt } from '../config/database.js';

/**
 * GET /api/notes
 * 分页获取便签列表（含分类统计、回收站计数）
 */
export const getNotes = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { category, search } = req.query;
  const page = clampInt(req.query.page, 1, 10000);
  const pageSize = clampInt(req.query.pageSize, 1, 200);

  const result = await noteRepository.findByUserId(userId, { category, search, page, pageSize });

  res.json({
    success: true,
    data: {
      items: result.items,
      total: result.total,
      page,
      pageSize,
      totalPages: Math.ceil(result.total / pageSize) || 0
    },
    meta: {
      categories: result.categories,
      deletedCount: result.deletedCount
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/notes/deleted
 * 获取回收站便签列表
 */
export const getDeletedNotes = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = clampInt(req.query.page, 1, 10000);
  const pageSize = clampInt(req.query.pageSize, 1, 200);

  const result = await noteRepository.findDeleted(userId, page, pageSize);
  paginated(res, result.items, result.total, page, pageSize);
});

/**
 * GET /api/notes/:id
 * 获取便签详情（含版本历史）
 */
export const getNoteDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const note = await noteRepository.findById(id, userId);
  if (!note) {
    return fail(res, 'Note not found', 404);
  }

  const versions = await noteRepository.findVersions(id);
  success(res, { note, versions });
});

/**
 * POST /api/notes
 * 创建新便签
 */
export const createNote = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { title = '无标题', content = '', category = '未分类', id: customId } = req.body;

  const note = await noteRepository.create({ title, content, category, id: customId }, userId);
  success(res, note, 201);
});

/**
 * PUT /api/notes/:id
 * 更新便签（自动创建版本快照）
 */
export const updateNote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const note = await noteRepository.update(id, req.body, userId);
  success(res, note);
});

/**
 * DELETE /api/notes/:id?hard=false
 * 删除便签（默认软删除到回收站）
 */
export const deleteNote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { hard = false } = req.query;

  const deleted = hard === 'true' || hard === true
    ? await noteRepository.hardDelete(id, userId)
    : await noteRepository.softDelete(id, userId);

  if (!deleted) {
    return fail(res, 'Note not found', 404);
  }
  success(res, { message: hard ? 'Note permanently deleted' : 'Note soft-deleted successfully' });
});

/**
 * POST /api/notes/:id/restore
 * 从回收站恢复便签
 */
export const restoreNote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const note = await noteRepository.restore(id, userId);
  if (!note) {
    return fail(res, 'Deleted note not found', 404);
  }
  success(res, note);
});
