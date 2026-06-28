/**
 * 心迹星图 API Key 数据访问层 (Repository)
 * 职责：封装所有 user_api_keys / ai_usage_log 表相关 SQL 操作
 *
 * 所有 SQL 参数均参数化（禁止字符串拼接）
 * 不存在记录返回 null 而非 throw（由 Controller 判断 404）
 */
import { query } from '../config/database.js';

class KeyRepository {
  /**
   * 获取用户所有 API Key 元信息（不返回加密内容）
   * @param {number} userId
   * @returns {Promise<Object[]>}
   */
  async findByUserId(userId) {
    const result = await query(
      'SELECT id, provider, key_hint, daily_quota, used_today, reset_at, created_at FROM user_api_keys WHERE user_id = ?',
      [userId]
    );
    return result.rows;
  }

  /**
   * 插入或更新 API Key（ON DUPLICATE KEY UPDATE）
   * @param {number} userId
   * @param {string} provider
   * @param {string} encrypted - 加密后的 key
   * @param {string} keyHint - 提示字符串（如 "sk-a...bcd"）
   * @returns {Promise<void>}
   */
  async upsert(userId, provider, encrypted, keyHint) {
    await query(
      `INSERT INTO user_api_keys (user_id, provider, encrypted_key, key_hint, reset_at)
       VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))
       ON DUPLICATE KEY UPDATE
         encrypted_key = VALUES(encrypted_key),
         key_hint = VALUES(key_hint)`,
      [userId, provider, encrypted, keyHint]
    );
  }

  /**
   * 删除指定 provider 的 API Key
   * @param {number} userId
   * @param {string} provider
   * @returns {Promise<boolean>}
   */
  async delete(userId, provider) {
    const result = await query(
      'DELETE FROM user_api_keys WHERE user_id = ? AND provider = ?',
      [userId, provider]
    );
    return result.rows.affectedRows > 0;
  }

  /**
   * 获取加密的 API Key 及配额信息
   * @param {number} userId
   * @param {string} provider
   * @returns {Promise<Object|null>} { encrypted_key, used_today, daily_quota, reset_at }
   */
  async findEncryptedKey(userId, provider) {
    const result = await query(
      'SELECT encrypted_key, used_today, daily_quota, reset_at FROM user_api_keys WHERE user_id = ? AND provider = ?',
      [userId, provider]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * 重置每日用量计数器（用于配额过期后归零）
   * @param {number} userId
   * @param {string} provider
   * @returns {Promise<void>}
   */
  async resetUsedToday(userId, provider) {
    await query(
      'UPDATE user_api_keys SET used_today = 0, reset_at = DATE_ADD(NOW(), INTERVAL 1 DAY) WHERE user_id = ? AND provider = ?',
      [userId, provider]
    );
  }

  /**
   * 递增当日用量计数
   * @param {number} userId
   * @param {string} provider
   * @param {number} tokens
   * @returns {Promise<void>}
   */
  async incrementUsed(userId, provider, tokens) {
    await query(
      'UPDATE user_api_keys SET used_today = used_today + ? WHERE user_id = ? AND provider = ?',
      [tokens, userId, provider]
    );
  }

  /**
   * 获取按 provider 分组的当日用量统计
   * @param {number} userId
   * @returns {Promise<Object[]>}
   */
  async getDailyUsage(userId) {
    const result = await query(
      `SELECT provider, SUM(input_tokens) as in_tokens, SUM(output_tokens) as out_tokens, SUM(cost_usd) as cost
       FROM ai_usage_log
       WHERE user_id = ? AND created_at >= CURDATE()
       GROUP BY provider`,
      [userId]
    );
    return result.rows;
  }

  /**
   * 获取按 provider 分组的近30天用量统计
   * @param {number} userId
   * @returns {Promise<Object[]>}
   */
  async getMonthlyUsage(userId) {
    const result = await query(
      `SELECT provider, SUM(cost_usd) as cost
       FROM ai_usage_log
       WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY provider`,
      [userId]
    );
    return result.rows;
  }

  /**
   * 记录一次 AI 调用用量日志
   * @param {number} userId
   * @param {string} provider
   * @param {string} model
   * @param {number} inputTokens
   * @param {number} outputTokens
   * @param {number|string} cost
   * @returns {Promise<void>}
   */
  async logUsage(userId, provider, model, inputTokens, outputTokens, cost) {
    await query(
      `INSERT INTO ai_usage_log (user_id, provider, model, input_tokens, output_tokens, cost_usd)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, provider, model, inputTokens, outputTokens, cost]
    );
  }
}

// 单例导出
export default new KeyRepository();
