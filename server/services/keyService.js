/**
 * API Key 管理服务
 * 负责密钥解密和用量记录，供控制器和服务统一调用。
 * 提取自 controllers/keyController.js，修复服务层->控制器层的颠倒依赖。
 */
import { query } from '../config/database.js';
import { decrypt } from './cryptoService.js';

/**
 * 获取用户的解密 API Key
 * @param {number} userId - 用户 ID
 * @param {string} provider - 提供商 (gemini / deepseek)
 * @returns {Promise<string|null>} 解密后的 key，未找到返回 null
 */
export async function getDecryptedKey(userId, provider) {
  const result = await query(
    'SELECT encrypted_key, used_today, daily_quota, reset_at FROM user_api_keys WHERE user_id = ? AND provider = ?',
    [userId, provider]
  );
  if (result.rows.length === 0) return null;

  const keyRow = result.rows[0];
  // Reset used_today if expired
  if (keyRow.reset_at && new Date(keyRow.reset_at) < new Date()) {
    await query(
      'UPDATE user_api_keys SET used_today = 0, reset_at = DATE_ADD(NOW(), INTERVAL 1 DAY) WHERE user_id = ? AND provider = ?',
      [userId, provider]
    );
  }
  return decrypt(keyRow.encrypted_key);
}

/**
 * 记录 AI 调用用量
 * @param {number} userId - 用户 ID
 * @param {string} provider - 提供商
 * @param {string} model - 模型名
 * @param {number} inputTokens - 输入 token 数
 * @param {number} outputTokens - 输出 token 数
 */
export async function logUsage(userId, provider, model, inputTokens, outputTokens) {
  const costMap = {
    'text-embedding-004': 0,
    'gemini-2.5-flash': 0.00035,
    'gemini-2.5-pro': 0.00125,
    'deepseek-chat': 0.00014,
    'deepseek-reasoner': 0.00055
  };
  const perK = costMap[model] || 0.00035;
  const cost = ((inputTokens + outputTokens) / 1000) * perK;

  try {
    await query(
      `INSERT INTO ai_usage_log (user_id, provider, model, input_tokens, output_tokens, cost_usd)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, provider, model, inputTokens, outputTokens, cost.toFixed(4)]
    );
    await query(
      'UPDATE user_api_keys SET used_today = used_today + ? WHERE user_id = ? AND provider = ?',
      [inputTokens + outputTokens, userId, provider]
    );
  } catch (err) {
    console.error('[usageLog] error:', err.message);
  }
}
