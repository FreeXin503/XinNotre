/**
 * 心迹星图 便签服务层
 * 职责：封装便签 CRUD 业务逻辑，统一错误处理，
 *       作为 app.js 与 ApiClient 之间的中间层
 *
 * 所有方法返回值与 store 数据结构对齐
 * 网络超时默认 30s
 * 401 响应自动触发重新登录流程
 */
import { ApiClient } from '../api.js';
import { store } from '../core/state.js';

// ── 自定义错误 ──────────────────────────────────────────

export class NoteServiceError extends Error {
  /**
   * @param {string} message
   * @param {string} code - 错误码: 'NOT_FOUND' | 'NETWORK' | 'AUTH' | 'VALIDATION'
   * @param {number} [statusCode]
   */
  constructor(message, code = 'UNKNOWN', statusCode = undefined) {
    super(message);
    this.name = 'NoteServiceError';
    this.code = code;
    this.statusCode = statusCode;
  }

  static fromApi(err) {
    if (err.message && err.message.includes('登录已失效')) {
      return new NoteServiceError(err.message, 'AUTH', 401);
    }
    if (err.message && err.message.includes('超时')) {
      return new NoteServiceError(err.message, 'NETWORK');
    }
    if (err.message && err.message.includes('请求失败 (404)')) {
      return new NoteServiceError(err.message, 'NOT_FOUND', 404);
    }
    if (err.message && err.message.includes('请求失败 (400)')) {
      return new NoteServiceError(err.message, 'VALIDATION', 400);
    }
    return new NoteServiceError(err.message || '未知错误', 'UNKNOWN');
  }
}

// ── 便签查询 ────────────────────────────────────────────

/**
 * 获取便签列表（带分页/分类/搜索）
 * @param {{ category?: string, search?: string, page?: number, pageSize?: number }} [params]
 * @returns {Promise<{ items: Object[], total: number, categories: Object[], deletedCount: number }>}
 */
export async function fetchNotes(params = {}) {
  try {
    const data = await ApiClient.getNotes(params);

    // 适配新旧 API 响应格式
    const responseData = data.data || data;
    const items = responseData.items || data.notes || [];
    const total = responseData.total || items.length;
    const categories = data.meta?.categories || responseData.categories || [];
    const deletedCount = data.meta?.deletedCount || responseData.deletedCount || 0;

    // 映射为前端统一 Note 格式
    const notes = items.map(note => ({
      id: note.id,
      title: note.title || '无标题',
      content: note.content || '',
      date: new Date(note.updated_at || note.created_at).toLocaleString(),
      category: note.category || '未分类',
      wordCount: (note.content || '').length,
      fileId: 'db-notes'
    }));

    // 更新 store
    store.setState({
      notes,
      categories,
      deletedCount
    });

    return { items: notes, total, categories, deletedCount };
  } catch (err) {
    const svcErr = NoteServiceError.fromApi(err);
    if (svcErr.code === 'AUTH') {
      store.setState({
        isLoggedIn: false,
        user: null
      });
    }
    throw svcErr;
  }
}

/**
 * 获取便签详情（含版本历史）
 * @param {string} id
 * @returns {Promise<{ note: Object, versions: Object[] }>}
 */
export async function fetchNoteDetail(id) {
  try {
    const data = await ApiClient.getNoteDetail(id);
    const responseData = data.data || data;
    return {
      note: responseData.note,
      versions: responseData.versions || []
    };
  } catch (err) {
    throw NoteServiceError.fromApi(err);
  }
}

/**
 * 获取回收站便签
 * @param {number} [page]
 * @param {number} [pageSize]
 * @returns {Promise<{ items: Object[], total: number }>}
 */
export async function fetchDeletedNotes(page = 1, pageSize = 50) {
  try {
    const data = await ApiClient.getDeletedNotes({ page, pageSize });
    const responseData = data.data || data;
    return {
      items: responseData.items || [],
      total: responseData.total || 0
    };
  } catch (err) {
    throw NoteServiceError.fromApi(err);
  }
}

// ── 便签写入 ────────────────────────────────────────────

/**
 * 创建新便签
 * @param {{ title: string, content?: string, category?: string }} data
 * @returns {Promise<Object>}
 */
export async function createNote(data) {
  try {
    const res = await ApiClient.createNote({
      title: (data.title || '无标题').trim(),
      content: data.content || '',
      category: data.category || '未分类'
    });
    const note = res.data || res;
    await fetchNotes(); // 刷新列表
    return note;
  } catch (err) {
    throw NoteServiceError.fromApi(err);
  }
}

/**
 * 更新便签
 * @param {string} id
 * @param {{ title?: string, content?: string, category?: string }} data
 * @returns {Promise<Object>}
 */
export async function updateNote(id, data) {
  try {
    const payload = {};
    if (data.title !== undefined) payload.title = data.title.trim();
    if (data.content !== undefined) payload.content = data.content;
    if (data.category !== undefined) payload.category = data.category.trim();
    const res = await ApiClient.updateNote(id, payload);
    const note = res.data || res;
    await fetchNotes();
    return note;
  } catch (err) {
    throw NoteServiceError.fromApi(err);
  }
}

/**
 * 删除便签（默认软删除）
 * @param {string} id
 * @param {boolean} [hard=false]
 * @returns {Promise<void>}
 */
export async function deleteNote(id, hard = false) {
  try {
    await ApiClient.deleteNote(id, hard);
    store.setState('currentNote', null);
    await fetchNotes();
  } catch (err) {
    throw NoteServiceError.fromApi(err);
  }
}

/**
 * 从回收站恢复便签
 * @param {string} id
 * @returns {Promise<Object>}
 */
export async function restoreNote(id) {
  try {
    const res = await ApiClient.restoreNote(id);
    await fetchNotes();
    return res.data || res;
  } catch (err) {
    throw NoteServiceError.fromApi(err);
  }
}

/**
 * 切换便签选中状态
 * @param {Object|null} note
 */
export async function selectNote(note) {
  store.setState('currentNote', note);

  if (!note) return;

  // 异步获取版本历史
  try {
    const detail = await fetchNoteDetail(note.id);
    store.setState('versions', detail.versions);
  } catch (err) {
    console.error('拉取版本历史失败:', err.message);
    store.setState('versions', []);
  }
}
