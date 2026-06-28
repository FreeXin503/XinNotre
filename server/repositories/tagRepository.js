/**
 * 心迹星图 标签数据访问层 (Repository)
 * 职责：封装所有 tags / note_tags 表相关 SQL 操作
 *
 * 所有 SQL 参数均参数化（禁止字符串拼接）
 * 不存在记录返回 null 而非 throw（由 Controller 判断 404）
 */
import { query } from '../config/database.js';

class TagRepository {
  /**
   * 获取用户所有标签（含每个标签的笔记数）
   * @param {number} userId
   * @returns {Promise<Object[]>}
   */
  async findByUserId(userId) {
    const result = await query(
      `SELECT t.*, COUNT(nt.tag_id) as note_count
       FROM tags t
       LEFT JOIN note_tags nt ON nt.tag_id = t.id
       WHERE t.user_id = ?
       GROUP BY t.id
       ORDER BY t.created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  /**
   * 创建标签
   * @param {number} userId
   * @param {string} name
   * @param {string} color
   * @returns {Promise<Object|null>}
   */
  async create(userId, name, color) {
    const insertResult = await query(
      'INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)',
      [userId, name, color]
    );
    const result = await query('SELECT * FROM tags WHERE id = ?', [insertResult.rows.insertId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * 按 ID 查询单个标签
   * @param {number} userId
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findById(userId, id) {
    const result = await query(
      'SELECT * FROM tags WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * 更新标签名称/颜色
   * @param {number} id
   * @param {number} userId
   * @param {{ name?: string, color?: string }} data
   * @returns {Promise<Object|null>}
   */
  async update(id, userId, data) {
    const existing = await this.findById(userId, id);
    if (!existing) return null;

    const finalName = data.name !== undefined ? String(data.name).trim().substring(0, 50) : existing.name;
    const finalColor = data.color !== undefined ? String(data.color).substring(0, 20) : existing.color;

    await query(
      'UPDATE tags SET name = ?, color = ? WHERE id = ? AND user_id = ?',
      [finalName, finalColor, id, userId]
    );

    const result = await query('SELECT * FROM tags WHERE id = ?', [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * 删除标签
   * @param {number} id
   * @param {number} userId
   * @returns {Promise<boolean>}
   */
  async delete(id, userId) {
    const result = await query(
      'DELETE FROM tags WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.rows.affectedRows > 0;
  }

  /**
   * 获取指定笔记的标签列表
   * @param {string} noteId
   * @param {number} userId
   * @returns {Promise<Object[]>}
   */
  async findByNoteId(noteId, userId) {
    const result = await query(
      `SELECT t.* FROM tags t
       JOIN note_tags nt ON nt.tag_id = t.id
       WHERE nt.note_id = ? AND t.user_id = ?`,
      [noteId, userId]
    );
    return result.rows;
  }

  /**
   * 批量获取多个笔记的标签映射
   * @param {string[]} noteIds
   * @param {number} userId
   * @returns {Promise<Object>} tagMap: { noteId: [{ id, name, color }, ...] }
   */
  async findByNoteIds(noteIds, userId) {
    if (!Array.isArray(noteIds) || noteIds.length === 0) return {};

    const placeholders = noteIds.map(() => '?').join(',');
    const result = await query(
      `SELECT nt.note_id, t.id as tag_id, t.name, t.color
       FROM note_tags nt
       JOIN tags t ON t.id = nt.tag_id
       WHERE nt.note_id IN (${placeholders}) AND t.user_id = ?`,
      [...noteIds, userId]
    );

    const tagMap = {};
    for (const row of result.rows) {
      if (!tagMap[row.note_id]) tagMap[row.note_id] = [];
      tagMap[row.note_id].push({ id: row.tag_id, name: row.name, color: row.color });
    }
    return tagMap;
  }

  /**
   * 为笔记添加标签
   * @param {string} noteId
   * @param {number} tagId
   * @returns {Promise<void>}
   */
  async addToNote(noteId, tagId) {
    await query(
      'INSERT IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)',
      [noteId, tagId]
    );
  }

  /**
   * 从笔记移除标签（校验笔记归属）
   * @param {string} noteId
   * @param {number} tagId
   * @param {number} userId
   * @returns {Promise<void>}
   */
  async removeFromNote(noteId, tagId, userId) {
    await query(
      `DELETE nt FROM note_tags nt
       JOIN notes n ON n.id = nt.note_id
       WHERE nt.note_id = ? AND nt.tag_id = ? AND n.user_id = ?`,
      [noteId, tagId, userId]
    );
  }
}

// 单例导出
export default new TagRepository();
