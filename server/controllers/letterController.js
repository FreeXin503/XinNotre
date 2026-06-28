import { query, withTransaction } from '../config/database.js';
import { getLengthMaxTokens } from '../services/lengthModeService.js';
import { setupSSE, sendSSE } from '../utils/sse.js';
import { success, fail, asyncHandler } from '../utils/response.js';
import { callAi } from '../services/aiProviderService.js';

const DS_MODEL = 'deepseek-chat';

const ALLOWED_TRIGGER_TYPES = ['date', 'next_sync', 'goal_done', 'reverse'];

// ─── C2 致未来的信 ───

export const createLetter = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { title, content, triggerType, triggerValue, waxSealEmoji } = req.body;

  if (!content) return fail(res, 'content 必填');
  if (!triggerType || !ALLOWED_TRIGGER_TYPES.includes(triggerType)) {
    return fail(res, `triggerType 必须是: ${ALLOWED_TRIGGER_TYPES.join(', ')}`);
  }
  if (triggerType === 'date' && !triggerValue) {
    return fail(res, 'date 类型需要 triggerValue (YYYY-MM-DD)');
  }
  if (triggerType === 'goal_done' && !triggerValue) {
    return fail(res, 'goal_done 类型需要 triggerValue (goalId)');
  }

  const result = await query(
    `INSERT INTO sealed_letters (user_id, title, content, trigger_type, trigger_value, wax_seal_emoji)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId,
      (title || '').substring(0, 200),
      content,
      triggerType,
      triggerType === 'reverse' ? null : String(triggerValue).substring(0, 64),
      waxSealEmoji || '📮'
    ]
  );

  success(res, { letterId: result.rows.insertId }, 201);
});

export const listLetters = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const result = await query(
    `SELECT id, title, sealed_at, trigger_type, trigger_value,
            delivered_at, wax_seal_emoji
     FROM sealed_letters
     WHERE user_id = ?
     ORDER BY sealed_at DESC`,
    [userId]
  );
  success(res, { letters: result.rows });
});

/**
 * 触发检查: 扫描该用户所有未送达信件, 触发条件匹配即送达
 * 幂等: UPDATE ... WHERE id=? AND delivered_at IS NULL + 检查 affectedRows
 */
export const triggerCheck = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const triggers = [];

    // 1. date 类型
    const dateLetters = await query(
      `SELECT id FROM sealed_letters
       WHERE user_id = ? AND trigger_type = 'date' AND trigger_value <= CURDATE() AND delivered_at IS NULL`,
      [userId]
    );
    for (const l of dateLetters.rows) triggers.push(l.id);

    // 2. next_sync 类型: 有新的 sync_history 记录发生在 sealed_at 之后
    const syncLetters = await query(
      `SELECT sl.id FROM sealed_letters sl
       WHERE sl.user_id = ? AND sl.trigger_type = 'next_sync' AND sl.delivered_at IS NULL
         AND EXISTS (SELECT 1 FROM sync_history sh WHERE sh.user_id = ? AND sh.created_at > sl.sealed_at)`,
      [userId, userId]
    );
    for (const l of syncLetters.rows) triggers.push(l.id);

    // 3. goal_done 类型: 目标状态改为 done
    const goalLetters = await query(
      `SELECT sl.id FROM sealed_letters sl
       WHERE sl.user_id = ? AND sl.trigger_type = 'goal_done' AND sl.delivered_at IS NULL
         AND EXISTS (SELECT 1 FROM growth_goals gg WHERE gg.id = sl.trigger_value AND gg.status = 'done')`,
      [userId]
    );
    for (const l of goalLetters.rows) triggers.push(l.id);

    // 4. reverse 类型: 创建即触达, 但也受 delivered_at IS NULL 保护
    const reverseLetters = await query(
      `SELECT id FROM sealed_letters
       WHERE user_id = ? AND trigger_type = 'reverse' AND delivered_at IS NULL`,
      [userId]
    );
    for (const l of reverseLetters.rows) triggers.push(l.id);

    // 唯一化
    const uniqueTriggers = [...new Set(triggers)];
    let delivered = 0;

    for (const letterId of uniqueTriggers) {
      // 获取最新人格快照
      const snapshotRes = await query(
        'SELECT id FROM persona_snapshots WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        [userId]
      );
      const snapshotId = snapshotRes.rows[0]?.id || null;

      const result = await query(
        `UPDATE sealed_letters
         SET delivered_at = NOW(), delivery_persona_snapshot_id = ?
         WHERE id = ? AND user_id = ? AND delivered_at IS NULL`,
        [snapshotId, letterId, userId]
      );

      if (result.rows.affectedRows > 0) delivered++;
    }

    success(res, { delivered, total: uniqueTriggers.length });
});

/**
 * SSE: 打开一封已送达的信, AI 生成"过去的你 vs 现在的你"对照卡
 */
export const openLetter = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  setupSSE(res);

  try {
    const letterRes = await query(
      `SELECT * FROM sealed_letters WHERE id = ? AND user_id = ? AND delivered_at IS NOT NULL`,
      [id, userId]
    );
    if (letterRes.rows.length === 0) {
      sendSSE(res, 'error', { message: '信件未送达或不存在' });
      return res.end();
    }
    const letter = letterRes.rows[0];

    // 获取最新人格快照
    const snapshotRes = await query(
      `SELECT ps.* FROM persona_snapshots ps
       WHERE ps.id = ? AND ps.user_id = ?`,
      [letter.delivery_persona_snapshot_id, userId]
    );

    // 构建系统提示
    let snapshotContext = '';
    if (snapshotRes.rows.length > 0) {
      const snap = snapshotRes.rows[0];
      snapshotContext = `
## 当前人格档案(快照ID: ${snap.id})
- 关键词: ${snap.keywords_json || '无'}
- 六维雷达: ${snap.radar_json || '无'}
- 概况: ${snap.summary || '无'}`;
    }

    const systemPrompt = `你是一名生命叙事分析师。用户的"过去的自己"写了一封封存信, 现在这封信在"现在"被打开了。
请根据以下信息和信的内容, 生成一段有温度的「过去 vs 现在」对照分析。

## 信件信息
标题: ${letter.title || '无标题'}
封存日期: ${String(letter.sealed_at).substring(0, 10)}
送达日期: ${String(letter.delivered_at).substring(0, 10)}
信件原文(引用, 不向用户公开全文): ${(letter.content || '').substring(0, 3000)}${snapshotContext}

## 输出要求
- 以第二人称"你"写给现在的用户, 温暖、真诚。
- 指出信中体现的"过去的你"的关切/希望/目标。
- 对比"现在的你": 哪些实现了, 哪些变化了, 哪些依然在。
- 用文学化的语言, 不要干瘪分析, 要有情感共鸣。
- 控制在 500 字以内。`;

    const maxTokens = getLengthMaxTokens('medium') || 2048;

    // 反向信: 模拟未来给现在的建议
    if (letter.trigger_type === 'reverse') {
      const reverseSystem = `你扮演 ${String(letter.trigger_value || '5 年后')} 的"未来的用户"。
根据该用户最新的便签语料, 以未来自己的视角给现在的用户写一封真诚的建议信。
- 语气温和、充满鼓励, 像是来自未来老友的箴言。
- 信中可以提及"你将来会……"但不要过于具体以免虚假。
- 控制在 400 字以内。`;

      await callAi({
        userId,
        model: DS_MODEL,
        systemPrompt: reverseSystem,
        userMessage: '请写这封来自未来的信。',
        stream: true,
        temperature: 0.7,
        maxTokens,
        signal: req.signal,
        onChunk: (delta) => {
          if (delta) sendSSE(res, 'chunk', { t: delta });
        }
      });
    } else {
      await callAi({
        userId,
        model: DS_MODEL,
        systemPrompt,
        userMessage: `请分析我在 ${String(letter.sealed_at).substring(0, 10)} 写的这封信。`,
        stream: true,
        temperature: 0.7,
        maxTokens,
        signal: req.signal,
        onChunk: (delta) => {
          if (delta) sendSSE(res, 'chunk', { t: delta });
        }
      });
    }

    sendSSE(res, 'done', { letterId: Number(id) });
    res.end();
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('[letter] open error:', err.message);
      sendSSE(res, 'error', { message: err.message });
    }
    if (!res.writableEnded) res.end();
  }
});
