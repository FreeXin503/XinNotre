/**
 * 心迹星图 便签数据访问层 (Repository)
 * 职责：封装所有 notes 表相关 SQL 操作，Controller 层禁止出现裸 SQL
 *
 * 所有 SQL 参数均参数化（禁止字符串拼接）
 * 不存在记录返回 null 而非 throw（由 Controller 判断 404）
 * 事务操作使用 config/database.js 提供的 withTransaction
 */
import crypto from 'crypto';
import { query, withTransaction, clampInt } from '../config/database.js';

class NoteRepository {
  // ── 查询 ───────────────────────────────────────────────

  /**
   * 分页查询用户便签（含分类统计、回收站计数）
   * @param {number} userId
   * @param {{ category?: string, search?: string, page?: number, pageSize?: number }} options
   * @returns {Promise<{ items: Object[], total: number, categories: Object[], deletedCount: number }>}
   */
  async findByUserId(userId, options = {}) {
    const { category, search } = options;
    const page = clampInt(options.page, 1, 10000);
    const pageSize = clampInt(options.pageSize, 1, 200);
    const offset = (page - 1) * pageSize;

    let where = 'WHERE user_id = ? AND is_deleted = FALSE';
    const params = [userId];

    if (category && category !== '全部') {
      params.push(category);
      where += ' AND category = ?';
    }

    if (search) {
      const kw = `%${search}%`;
      params.push(kw, kw, kw);
      where += ' AND (title LIKE ? OR content LIKE ? OR category LIKE ?)';
    }

    // Count total
    const countResult = await query(`SELECT COUNT(*) as total FROM notes ${where}`, params);
    const total = Number(countResult.rows[0]?.total || 0);

    // Fetch page
    const pageParams = [...params, pageSize, offset];
    const result = await query(
      `SELECT id, user_id, title, LEFT(content, 800) as content, category, word_count, is_deleted, created_at, updated_at
       FROM notes ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
      pageParams
    );

    // Category stats
    const statsResult = await query(
      'SELECT category, COUNT(*) as count FROM notes WHERE user_id = ? AND is_deleted = FALSE GROUP BY category',
      [userId]
    );

    // Deleted count
    const deletedCountRes = await query(
      'SELECT COUNT(*) as count FROM notes WHERE user_id = ? AND is_deleted = TRUE',
      [userId]
    );

    return {
      items: result.rows,
      total,
      categories: statsResult.rows,
      deletedCount: Number(deletedCountRes.rows[0]?.count || 0)
    };
  }

  /**
   * 查询单条便签
   * @param {string} id
   * @param {number} userId
   * @returns {Promise<Object|null>}
   */
  async findById(id, userId) {
    const result = await query(
      'SELECT * FROM notes WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * 按标题查询（用于双向链接）
   * @param {number} userId
   * @param {string} title
   * @returns {Promise<Object|null>}
   */
  async findByTitle(userId, title) {
    const result = await query(
      'SELECT id FROM notes WHERE user_id = ? AND title = ? AND is_deleted = FALSE LIMIT 1',
      [userId, title]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * 获取已删除便签列表
   * @param {number} userId
   * @param {number} [page=1]
   * @param {number} [pageSize=50]
   * @returns {Promise<{ items: Object[], total: number }>}
   */
  async findDeleted(userId, page = 1, pageSize = 50) {
    page = clampInt(page, 1, 10000);
    pageSize = clampInt(pageSize, 1, 200);
    const offset = (page - 1) * pageSize;

    const countResult = await query(
      'SELECT COUNT(*) as total FROM notes WHERE user_id = ? AND is_deleted = TRUE',
      [userId]
    );
    const total = Number(countResult.rows[0]?.total || 0);

    const result = await query(
      'SELECT id, user_id, title, LEFT(content, 500) as content, category, word_count, is_deleted, created_at, updated_at FROM notes WHERE user_id = ? AND is_deleted = TRUE ORDER BY updated_at DESC LIMIT ? OFFSET ?',
      [userId, pageSize, offset]
    );

    return { items: result.rows, total };
  }

  /**
   * 获取版本历史
   * @param {string} noteId
   * @returns {Promise<Object[]>}
   */
  async findVersions(noteId) {
    const result = await query(
      'SELECT * FROM note_versions WHERE note_id = ? ORDER BY version_num DESC',
      [noteId]
    );
    return result.rows;
  }

  // ── 写入 ───────────────────────────────────────────────

  /**
   * 创建便签
   * @param {{ title: string, content: string, category: string, id?: string }} data
   * @param {number} userId
   * @returns {Promise<Object>}
   */
  async create(data, userId) {
    const title = String(data.title || '无标题').substring(0, 500);
    const content = String(data.content || '').substring(0, 100000);
    const category = String(data.category || '未分类').substring(0, 100);
    const wordCount = content.length;

    const id = (data.id && /^[A-Za-z0-9_-]{8,64}$/.test(String(data.id)))
      ? data.id
      : crypto.randomBytes(16).toString('hex');

    await query(
      `INSERT INTO notes (id, user_id, title, content, category, word_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, userId, title, content, category, wordCount]
    );

    const note = await this.findById(id, userId);

    // 异步同步双向链接
    this._syncNoteLinks(id, userId, title, content).catch(() => {});

    // 异步触发宇宙快照更新
    this._fireCosmosHook(userId).catch(() => {});

    return note;
  }

  /**
   * 更新便签（内含版本快照 & 双向链接同步，事务保护）
   * @param {string} id
   * @param {{ title?: string, content?: string, category?: string }} data
   * @param {number} userId
   * @returns {Promise<Object>}
   * @throws {Error} statusCode=404 时表示便签不存在
   */
  async update(id, data, userId) {
    const updatedNote = await withTransaction(async (tx) => {
      const currentRes = await tx('SELECT * FROM notes WHERE id = ? AND user_id = ?', [id, userId]);
      if (currentRes.rows.length === 0) {
        const err = new Error('Note not found');
        err.statusCode = 404;
        throw err;
      }

      const currentNote = currentRes.rows[0];

      const finalTitle = data.title !== undefined ? String(data.title).substring(0, 500) : currentNote.title;
      const finalContent = data.content !== undefined ? String(data.content).substring(0, 100000) : currentNote.content;
      const finalCategory = data.category !== undefined ? String(data.category).substring(0, 100) : currentNote.category;
      const wordCount = data.content !== undefined ? finalContent.length : currentNote.word_count;

      // 内容变更则创建版本快照
      if (currentNote.title !== finalTitle || currentNote.content !== finalContent) {
        const verCountRes = await tx(
          'SELECT COALESCE(MAX(version_num), 0) as max_ver FROM note_versions WHERE note_id = ?',
          [id]
        );
        const nextVer = Number(verCountRes.rows[0].max_ver) + 1;

        await tx(
          `INSERT INTO note_versions (note_id, title, content, version_num, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [id, currentNote.title, currentNote.content, nextVer, currentNote.updated_at]
        );
      }

      await tx(
        `UPDATE notes SET title = ?, content = ?, category = ?, word_count = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`,
        [finalTitle, finalContent, finalCategory, wordCount, id, userId]
      );

      // 同步双向链接 (事务内)
      await this._syncNoteLinksTx(tx, id, userId, finalTitle, finalContent);

      const updatedRes = await tx('SELECT * FROM notes WHERE id = ? AND user_id = ?', [id, userId]);
      return updatedRes.rows[0];
    });

    // 事务完成后异步触发宇宙快照
    this._fireCosmosHook(userId).catch(() => {});

    return updatedNote;
  }

  /**
   * 软删除（移入回收站）
   * @param {string} id
   * @param {number} userId
   * @returns {Promise<boolean>} 是否删除了记录
   */
  async softDelete(id, userId) {
    const result = await query(
      'UPDATE notes SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.rows.affectedRows > 0;
  }

  /**
   * 永久删除
   * @param {string} id
   * @param {number} userId
   * @returns {Promise<boolean>}
   */
  async hardDelete(id, userId) {
    const result = await query(
      'DELETE FROM notes WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.rows.affectedRows > 0;
  }

  /**
   * 从回收站恢复
   * @param {string} id
   * @param {number} userId
   * @returns {Promise<Object|null>}
   */
  async restore(id, userId) {
    const result = await query(
      'UPDATE notes SET is_deleted = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND is_deleted = TRUE',
      [id, userId]
    );

    if (result.rows.affectedRows === 0) return null;
    return this.findById(id, userId);
  }

  // ── 内部：双向链接同步 ─────────────────────────────────

  /**
   * 解析 [[title]] 双向链接并写入 note_links 表
   * @param {string} noteId
   * @param {number} userId
   * @param {string} title
   * @param {string} content
   */
  async _syncNoteLinks(noteId, userId, title, content) {
    const text = `${title || ''} ${content || ''}`;
    const matches = text.match(/\[\[(.+?)\]\]/g);
    if (!matches) {
      await query('DELETE FROM note_links WHERE source_note_id = ?', [noteId]);
      return;
    }

    const linkTitles = [...new Set(matches.map(m => m.slice(2, -2).trim()))].filter(t => t.length > 0);
    await query('DELETE FROM note_links WHERE source_note_id = ?', [noteId]);

    for (const linkTitle of linkTitles) {
      const linkRes = await this.findByTitle(userId, linkTitle);
      if (linkRes) {
        await query(
          'INSERT IGNORE INTO note_links (source_note_id, target_note_id, link_text) VALUES (?, ?, ?)',
          [noteId, linkRes.id, linkTitle]
        );
      }
    }
  }

  /**
   * 事务内版本的双向链接同步
   * @param {Function} tx - withTransaction 提供的 txQuery
   * @param {string} noteId
   * @param {number} userId
   * @param {string} title
   * @param {string} content
   */
  async _syncNoteLinksTx(tx, noteId, userId, title, content) {
    const text = `${title || ''} ${content || ''}`;
    const matches = text.match(/\[\[(.+?)\]\]/g);
    if (!matches) {
      await tx('DELETE FROM note_links WHERE source_note_id = ?', [noteId]);
      return;
    }

    const linkTitles = [...new Set(matches.map(m => m.slice(2, -2).trim()))].filter(t => t.length > 0);
    await tx('DELETE FROM note_links WHERE source_note_id = ?', [noteId]);

    for (const linkTitle of linkTitles) {
      const linkRes = await tx(
        'SELECT id FROM notes WHERE user_id = ? AND title = ? AND is_deleted = FALSE LIMIT 1',
        [userId, linkTitle]
      );
      if (linkRes.rows.length > 0) {
        await tx(
          'INSERT IGNORE INTO note_links (source_note_id, target_note_id, link_text) VALUES (?, ?, ?)',
          [noteId, linkRes.rows[0].id, linkTitle]
        );
      }
    }
  }

  // ── 内部：异步触发宇宙快照更新 ──

  async _fireCosmosHook(userId) {
    try {
      const { requestCosmosUpdate } = await import('../services/cosmosHookService.js');
      requestCosmosUpdate(userId);
    } catch (err) {
      // 静默失败，不影响主流程
    }
  }
}

// 单例导出
export const noteRepository = new NoteRepository();
export default noteRepository;
