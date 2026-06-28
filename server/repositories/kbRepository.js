/**
 * 心迹星图 知识库数据访问层 (Repository)
 * 职责：封装所有 knowledge_bases / knowledge_base_notes / kb_recommendations 表相关 SQL 操作
 *
 * 所有 SQL 参数均参数化（禁止字符串拼接）
 * 不存在记录返回 null 而非 throw（由 Controller 判断 404）
 * 事务操作使用 config/database.js 提供的 withTransaction
 */
import { query, withTransaction } from '../config/database.js';

class KbRepository {
  // ── 知识库 CRUD ────────────────────────────────────────

  /**
   * 获取用户所有知识库（含笔记数）
   * @param {number} userId
   * @returns {Promise<Object[]>}
   */
  async findByUserId(userId) {
    const result = await query(
      `SELECT kb.*, IFNULL(kbnc.c, 0) as note_count
       FROM knowledge_bases kb
       LEFT JOIN (SELECT kb_id, COUNT(*) as c FROM knowledge_base_notes GROUP BY kb_id) kbnc ON kbnc.kb_id = kb.id
       WHERE kb.user_id = ?
       ORDER BY kb.updated_at DESC`,
      [userId]
    );
    return result.rows;
  }

  /**
   * 创建知识库
   * @param {number} userId
   * @param {string} name
   * @param {string} description
   * @param {string} icon
   * @returns {Promise<Object|null>}
   */
  async create(userId, name, description, icon) {
    const insertResult = await query(
      `INSERT INTO knowledge_bases (user_id, name, description, icon)
       VALUES (?, ?, ?, ?)`,
      [userId, name, description, icon]
    );
    const result = await query('SELECT * FROM knowledge_bases WHERE id = ?', [insertResult.rows.insertId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * 按 ID 查询单个知识库
   * @param {number} id
   * @param {number} userId
   * @returns {Promise<Object|null>}
   */
  async findById(id, userId) {
    const result = await query(
      'SELECT * FROM knowledge_bases WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * 更新知识库名称/描述/图标
   * @param {number} id
   * @param {number} userId
   * @param {{ name?: string, description?: string, icon?: string }} data
   * @returns {Promise<Object|null>}
   */
  async update(id, userId, data) {
    const existing = await this.findById(id, userId);
    if (!existing) return null;

    const finalName = data.name !== undefined ? String(data.name).substring(0, 200) : existing.name;
    const finalDesc = data.description !== undefined ? String(data.description).substring(0, 2000) : existing.description;
    const finalIcon = data.icon !== undefined ? String(data.icon).substring(0, 10) : existing.icon;

    await query(
      'UPDATE knowledge_bases SET name = ?, description = ?, icon = ? WHERE id = ? AND user_id = ?',
      [finalName, finalDesc, finalIcon, id, userId]
    );

    const result = await query('SELECT * FROM knowledge_bases WHERE id = ?', [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * 删除知识库
   * @param {number} id
   * @param {number} userId
   * @returns {Promise<boolean>}
   */
  async delete(id, userId) {
    const result = await query(
      'DELETE FROM knowledge_bases WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.rows.affectedRows > 0;
  }

  // ── 知识库-笔记 关联 ───────────────────────────────────

  /**
   * 分页获取知识库内的笔记列表
   * @param {number} kbId
   * @param {number} limit
   * @param {number} offset
   * @returns {Promise<Object[]>}
   */
  async findNotes(kbId, limit, offset) {
    const result = await query(
      `SELECT n.*, kbn.sort_order, kbn.added_at as kb_added_at
       FROM knowledge_base_notes kbn
       JOIN notes n ON n.id = kbn.note_id
       WHERE kbn.kb_id = ?
       ORDER BY kbn.sort_order ASC, kbn.added_at DESC
       LIMIT ? OFFSET ?`,
      [kbId, limit, offset]
    );
    return result.rows;
  }

  /**
   * 统计知识库内的笔记数
   * @param {number} kbId
   * @returns {Promise<number>}
   */
  async countNotes(kbId) {
    const result = await query(
      'SELECT COUNT(*) as count FROM knowledge_base_notes WHERE kb_id = ?',
      [kbId]
    );
    return Number(result.rows[0]?.count || 0);
  }

  /**
   * 向知识库添加笔记
   * @param {number} kbId
   * @param {string} noteId
   * @param {number} sortOrder
   * @returns {Promise<void>}
   */
  async addNote(kbId, noteId, sortOrder) {
    await query(
      'INSERT INTO knowledge_base_notes (kb_id, note_id, sort_order) VALUES (?, ?, ?)',
      [kbId, noteId, sortOrder]
    );
  }

  /**
   * 从指定知识库移除笔记
   * @param {number} kbId
   * @param {string} noteId
   * @returns {Promise<void>}
   */
  async removeNote(kbId, noteId) {
    await query(
      'DELETE FROM knowledge_base_notes WHERE kb_id = ? AND note_id = ?',
      [kbId, noteId]
    );
  }

  /**
   * 从用户的所有知识库中移除指定笔记
   * @param {string} noteId
   * @param {number} userId
   * @returns {Promise<void>}
   */
  async removeNoteFromAll(noteId, userId) {
    await query(
      `DELETE kbn FROM knowledge_base_notes kbn
       JOIN knowledge_bases kb ON kb.id = kbn.kb_id
       WHERE kbn.note_id = ? AND kb.user_id = ?`,
      [noteId, userId]
    );
  }

  /**
   * 获取知识库内当前最大排序值
   * @param {number} kbId
   * @returns {Promise<number>}
   */
  async getMaxSortOrder(kbId) {
    const result = await query(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM knowledge_base_notes WHERE kb_id = ?',
      [kbId]
    );
    return Number(result.rows[0]?.max_order || -1);
  }

  /**
   * 更新知识库内笔记的排序
   * @param {number} kbId
   * @param {string} noteId
   * @param {number} order
   * @returns {Promise<void>}
   */
  async updateSortOrder(kbId, noteId, order) {
    await query(
      'UPDATE knowledge_base_notes SET sort_order = ? WHERE kb_id = ? AND note_id = ?',
      [order, kbId, noteId]
    );
  }

  /**
   * 批量更新知识库内笔记排序（事务内）
   * @param {number} kbId
   * @param {string[]} noteIds - 按目标顺序排列的 noteId 数组
   * @returns {Promise<void>}
   */
  async reorderNotes(kbId, noteIds) {
    await withTransaction(async (tx) => {
      for (let i = 0; i < noteIds.length; i++) {
        await tx(
          'UPDATE knowledge_base_notes SET sort_order = ? WHERE kb_id = ? AND note_id = ?',
          [i, kbId, noteIds[i]]
        );
      }
    });
  }

  /**
   * 检查笔记是否已存在于知识库
   * @param {number} kbId
   * @param {string} noteId
   * @returns {Promise<Object|null>}
   */
  async findExisting(kbId, noteId) {
    const result = await query(
      'SELECT id FROM knowledge_base_notes WHERE kb_id = ? AND note_id = ?',
      [kbId, noteId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * 校验笔记是否属于该用户
   * @param {string} noteId
   * @param {number} userId
   * @returns {Promise<Object|null>}
   */
  async hasNotePermission(noteId, userId) {
    const result = await query(
      'SELECT id FROM notes WHERE id = ? AND user_id = ?',
      [noteId, userId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  // ── 推荐 ───────────────────────────────────────────────

  /**
   * 保存知识库推荐结果
   * @param {number} kbId
   * @param {Array<{ note_id: string, score: number, reason: string }>} recommendations
   * @returns {Promise<void>}
   */
  async saveRecommendations(kbId, recommendations) {
    await this.clearRecommendations(kbId);

    if (recommendations.length > 0) {
      const values = recommendations.map(r => [kbId, r.note_id, r.score, r.reason]);
      const placeholders = values.map(() => '(?, ?, ?, ?)').join(',');
      await query(
        `INSERT INTO kb_recommendations (kb_id, note_id, score, reason) VALUES ${placeholders}`,
        values.flat()
      );
    }
  }

  /**
   * 清空知识库推荐结果
   * @param {number} kbId
   * @returns {Promise<void>}
   */
  async clearRecommendations(kbId) {
    await query('DELETE FROM kb_recommendations WHERE kb_id = ?', [kbId]);
  }

  /**
   * 获取知识库已保存的推荐结果
   * @param {number} kbId
   * @returns {Promise<Object[]>}
   */
  async getRecommendations(kbId) {
    const result = await query(
      'SELECT * FROM kb_recommendations WHERE kb_id = ? ORDER BY score DESC',
      [kbId]
    );
    return result.rows;
  }
}

// 单例导出
export default new KbRepository();
