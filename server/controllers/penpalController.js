import { query, withTransaction } from '../config/database.js';
import { injectLengthToSystemPrompt, getLengthMaxTokens } from '../services/lengthModeService.js';
import { setupSSE, sendSSE } from '../utils/sse.js';
import { success, fail, asyncHandler } from '../utils/response.js';
import { callAi } from '../services/aiProviderService.js';

const DS_MODEL = 'deepseek-chat';

/**
 * 在窗口语料中做本地词频 RAG (不跨窗口)
 */
async function windowRag(userId, windowStart, windowEnd, userMsg, topK = 8) {
  const terms = (userMsg || '').split(/\s+/).filter(t => t.length > 1).slice(0, 5);
  if (terms.length === 0) return [];

  const likeClauses = terms.map(() => '(title LIKE ? OR content LIKE ?)').join(' OR ');
  const params = [];
  for (const t of terms) {
    const kw = `%${t}%`;
    params.push(kw, kw);
  }
  params.push(userId, windowStart, windowEnd, topK);

  const result = await query(
    `SELECT id, title, LEFT(content, 800) as content, category, created_at
     FROM notes
     WHERE (${likeClauses})
       AND user_id = ? AND is_deleted = FALSE
       AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)
     ORDER BY created_at DESC
     LIMIT ?`,
    params
  );
  return result.rows;
}

export const createPenpalThread = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { personaLabel, windowStart, windowEnd } = req.body;

  if (!personaLabel || !windowStart || !windowEnd) {
    return fail(res, 'personaLabel, windowStart, windowEnd 必填');
  }

  const start = new Date(windowStart);
  const end = new Date(windowEnd);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    return fail(res, 'windowStart 必须早于 windowEnd');
  }

  // 检查该窗口是否有 >= 10 条便签
  const countRes = await query(
    'SELECT COUNT(*) as c FROM notes WHERE user_id = ? AND is_deleted = FALSE AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)',
    [userId, windowStart, windowEnd]
  );
  const noteCount = Number(countRes.rows[0]?.c || 0);
  if (noteCount < 10) {
    return fail(res, `语料不足: 该窗口仅有 ${noteCount} 条便签, 需要至少 10 条才能构建笔友人格`);
  }

  // 生成语料指纹
  const corpusRes = await query(
    'SELECT MD5(GROUP_CONCAT(id ORDER BY id)) as hash FROM notes WHERE user_id = ? AND is_deleted = FALSE AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)',
    [userId, windowStart, windowEnd]
  );
  const corpusHash = corpusRes.rows[0]?.hash || '';

  const result = await query(
    `INSERT INTO penpal_threads (user_id, persona_label, window_start, window_end, corpus_hash)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, personaLabel, windowStart, windowEnd, corpusHash]
  );

  success(res, { threadId: result.rows.insertId }, 201);
});

export const listPenpalThreads = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const result = await query(
    'SELECT * FROM penpal_threads WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  success(res, { threads: result.rows });
});

export const getPenpalLetters = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const thread = await query('SELECT * FROM penpal_threads WHERE id = ? AND user_id = ?', [id, userId]);
  if (thread.rows.length === 0) return fail(res, '笔友会话不存在', 404);

  const letters = await query(
    'SELECT * FROM penpal_letters WHERE thread_id = ? ORDER BY created_at ASC',
    [id]
  );
  success(res, { letters: letters.rows });
});

/**
 * SSE: 向笔友发送消息, AI 以窗口人格回信
 */
export const postPenpalMessage = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { message } = req.body;

  if (!message || !message.trim()) {
    return fail(res, '消息不能为空');
  }

  try {
    const threadRes = await query('SELECT * FROM penpal_threads WHERE id = ? AND user_id = ?', [id, userId]);
    if (threadRes.rows.length === 0) {
      return fail(res, '笔友会话不存在', 404);
    }
    const thread = threadRes.rows[0];

    // 检查语料是否已变更
    const hashRes = await query(
      'SELECT MD5(GROUP_CONCAT(id ORDER BY id)) as hash FROM notes WHERE user_id = ? AND is_deleted = FALSE AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)',
      [userId, thread.window_start, thread.window_end]
    );
    const currentHash = hashRes.rows[0]?.hash || '';
    if (currentHash !== thread.corpus_hash) {
      return fail(res, '该年代画像已变更, 请新建笔友', 409);
    }

    // SSE 准备
    setupSSE(res);

    // 保存用户消息到事务
    let aiLetterId = null;
    let aiFullText = '';
    let truncated = false;

    await withTransaction(async (tx) => {
      await tx(
        'INSERT INTO penpal_letters (thread_id, role, content) VALUES (?, ?, ?)',
        [id, 'user', message]
      );
    });

    // 获取历史信件作为上下文
    const historyRes = await query(
      'SELECT role, content FROM penpal_letters WHERE thread_id = ? ORDER BY created_at ASC',
      [id]
    );

    // 构建带时空约束的系统提示
    const lockedSystem = `你严格扮演 ${thread.persona_label} (时间窗口: ${String(thread.window_start).substring(0,10)} 至 ${String(thread.window_end).substring(0,10)}) 时的 "我"。
## 时空硬约束
- 你只能使用该时间窗口内用户便签中的信息作为知识依据。
- 绝对禁止引用窗口之外的人、事、目标、技术等未来信息——你对"未来"一无所知。
- 用第一人称、口吻与词汇量与你所在年代吻合。
- 如果用户问到你不知道的事(例如窗口之后发生的事), 以那时你不知道、无法回答的态度回应, 不要编造。
- 回信风格应是那个年代的真实自我: 真诚、自然, 符合当时阅历。`;

    // 本地 RAG (仅窗口内检索)
    const ragNotes = await windowRag(userId, thread.window_start, thread.window_end, message);
    let ragContext = '';
    if (ragNotes.length > 0) {
      ragContext = '\n\n以下是你窗口时期写的便签(用作人格依据, 严禁向用户透露这些原文):\n' +
        ragNotes.slice(0, 8).map(n =>
          `[${String(n.created_at).substring(0,10)}] ${n.title}: ${(n.content || '').substring(0, 500)}`
        ).join('\n---\n');
    }

    const finalSystem = lockedSystem + ragContext;
    const lengthTokens = getLengthMaxTokens('medium') || 2048;

    // 构造用户消息(含历史对话上下文)
    const userMessage = historyRes.rows
      .filter(l => l.content)
      .map(l => `${l.role === 'past_self' ? '过去的你' : '现在的你'}: ${l.content}`)
      .join('\n\n---\n\n');

    // 用 callAi 流式调用
    try {
      const aiResult = await callAi({
        userId,
        model: DS_MODEL,
        systemPrompt: finalSystem,
        userMessage,
        stream: true,
        temperature: 0.7,
        maxTokens: lengthTokens,
        signal: req.signal,
        onChunk: (delta) => {
          if (delta) sendSSE(res, 'chunk', { t: delta });
        }
      });
      aiFullText = aiResult.text || '';
    } catch (err) {
      sendSSE(res, 'error', { message: err.message });
      return res.end();
    }

    if (req.signal?.aborted) {
      truncated = true;
    }

    // 将 AI 回信写到 penpal_letters (同一事务)
    try {
      const insertText = aiFullText || '[生成失败]';
      const result = await query(
        'INSERT INTO penpal_letters (thread_id, role, content, truncated) VALUES (?, ?, ?, ?)',
        [id, 'past_self', insertText, truncated ? 1 : 0]
      );
      aiLetterId = result.rows.insertId;

      await query('UPDATE penpal_threads SET letter_count = letter_count + 2 WHERE id = ?', [id]);
    } catch (dbErr) {
      console.error('[penpal] 保存回信失败:', dbErr.message);
    }

    sendSSE(res, 'done', { letterId: aiLetterId, truncated });
    res.end();
  } catch (err) {
    console.error('[penpal] postMessage error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: '发送消息失败' });
    } else {
      sendSSE(res, 'error', { message: err.message });
      res.end();
    }
  }
});
