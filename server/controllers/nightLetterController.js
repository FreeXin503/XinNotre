/**
 * 心迹星图 深夜来信 · Controller
 * 职责：提供 5 个 API 端点，管理历史名人来信的触发、查阅和回复
 *
 * SSE 流式通信模式与 penpalController.js 保持一致：
 * - 设置 text/event-stream, no-cache, keep-alive 头部
 * - req.on('close') 时 abort AI 请求
 * - 事件类型：status, chunk, result, done, error
 */
import { query } from '../config/database.js';
import { callAi } from '../services/aiProviderService.js';
import { scanForNightLetterTrigger, generateNightLetter } from '../services/nightLetterTriggerService.js';
import { setupSSE, sendSSE } from '../utils/sse.js';
import { success, fail, asyncHandler } from '../utils/response.js';

// ── 1. GET /api/night-letters/personas ──────────────────

/**
 * 获取可用历史名人列表
 */
export const listNightLetterPersonas = asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT id, persona_key, display_name, era, avatar_emoji, philosophy_tags, difficulty_level FROM night_letter_personas WHERE is_active = TRUE ORDER BY display_name ASC'
  );
  success(res, { personas: result.rows });
});

// ── 2. GET /api/night-letters/threads ───────────────────

/**
 * 获取用户的所有来信线程
 */
export const listNightLetterThreads = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const result = await query(
    `SELECT t.id, t.persona_id, p.display_name, p.avatar_emoji, p.persona_key,
            t.emotional_context, t.letter_count, t.is_read, t.created_at, t.updated_at
     FROM night_letter_threads t
     JOIN night_letter_personas p ON p.id = t.persona_id
     WHERE t.user_id = ?
     ORDER BY t.created_at DESC`,
    [userId]
  );
  success(res, { threads: result.rows });
});

// ── 3. GET /api/night-letters/threads/:id/letters ───────

/**
 * 获取某个线程的全部信件
 */
export const getNightLetters = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const threadId = req.params.id;

  // 验证线程归属
  const threadResult = await query(
    'SELECT id, persona_id, emotional_context, is_read FROM night_letter_threads WHERE id = ? AND user_id = ?',
    [threadId, userId]
  );
  if (threadResult.rows.length === 0) {
    return fail(res, 'Thread not found', 404);
  }

  // 标记已读
  await query(
    'UPDATE night_letter_threads SET is_read = TRUE WHERE id = ? AND user_id = ?',
    [threadId, userId]
  );

  // 获取信件
  const lettersResult = await query(
    'SELECT id, role, content, quoted_note_snippets, is_stream_interrupted, created_at FROM night_letter_messages WHERE thread_id = ? ORDER BY created_at ASC',
    [threadId]
  );

  const personaResult = await query(
    'SELECT id, persona_key, display_name, avatar_emoji FROM night_letter_personas WHERE id = ?',
    [threadResult.rows[0].persona_id]
  );

  success(res, {
    thread: {
      id: threadResult.rows[0].id,
      emotionalContext: threadResult.rows[0].emotional_context,
      persona: personaResult.rows[0] || null
    },
    letters: lettersResult.rows.map(l => ({
      ...l,
      quoted_note_snippets: l.quoted_note_snippets ? tryParseJSON(l.quoted_note_snippets) : null
    }))
  });
});

// ── 4. POST /api/night-letters/check (SSE) ──────────────

/**
 * 手动触发来信检测 + 生成
 * 无近期触发点时返回 shouldSend=false
 */
export const triggerNightLetter = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { forcePersonaKey } = req.body || {};

  setupSSE(res);

  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  try {
    sendSSE(res, 'status', { message: '正在扫描近期日记...' });

    const triggerInfo = await scanForNightLetterTrigger(userId);

    if (!triggerInfo || !triggerInfo.shouldSend) {
      sendSSE(res, 'result', { shouldSend: false, message: '近期未检测到适合触发来信的情绪波动' });
      sendSSE(res, 'done', {});
      return res.end();
    }

    sendSSE(res, 'status', {
      message: `检测到潜在触发点: ${triggerInfo.emotionalContext}`,
      triggerNotes: triggerInfo.triggerNotes.map(n => ({ id: n.id, title: n.title }))
    });

    sendSSE(res, 'status', { message: '正在为您挑选最契合的历史智者...' });

    const result = await generateNightLetter(userId, {
      forcePersonaKey,
      overrideTrigger: triggerInfo
    });

    if (!result.threadId) {
      sendSSE(res, 'error', { message: '来信生成失败，请稍后重试' });
      return res.end();
    }

    // 获取 persona 详情
    const personaResult = await query(
      `SELECT p.persona_key, p.display_name, p.avatar_emoji
       FROM night_letter_threads t
       JOIN night_letter_personas p ON p.id = t.persona_id
       WHERE t.id = ?`,
      [result.threadId]
    );

    sendSSE(res, 'result', {
      shouldSend: true,
      threadId: result.threadId,
      firstLetterId: result.firstLetterId,
      personaKey: personaResult.rows[0]?.persona_key || null,
      personaName: personaResult.rows[0]?.display_name || null,
      personaEmoji: personaResult.rows[0]?.avatar_emoji || null,
      emotionalContext: triggerInfo.emotionalContext
    });
    sendSSE(res, 'done', {});
  } catch (err) {
    console.error('[nightLetter] trigger error:', err.message);
    sendSSE(res, 'error', { message: '检测过程出错: ' + err.message });
  } finally {
    res.end();
  }
});

// ── 5. POST /api/night-letters/threads/:id/reply (SSE) ──

/**
 * 用户回复历史名人的来信（流式返回 AI 的续信）
 */
export const replyToNightLetter = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const threadId = req.params.id;
  const { message } = req.body || {};

  if (!message || !message.trim()) {
    return fail(res, '回复内容不能为空', 400);
  }

  setupSSE(res);
  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  try {
    // 1. 验证线程归属
    const threadResult = await query(
      'SELECT t.id, t.persona_id, t.emotional_context FROM night_letter_threads t WHERE t.id = ? AND t.user_id = ?',
      [threadId, userId]
    );
    if (threadResult.rows.length === 0) {
      sendSSE(res, 'error', { message: '来信线程不存在或无权访问' });
      return res.end();
    }

    const thread = threadResult.rows[0];

    // 2. 写入用户回信
    await query(
      'INSERT INTO night_letter_messages (thread_id, role, content) VALUES (?, \'user\', ?)',
      [threadId, message.trim()]
    );

    // 3. 加载 persona 信息和历史消息
    const personaResult = await query(
      'SELECT persona_key, display_name, system_prompt, quote_style FROM night_letter_personas WHERE id = ?',
      [thread.persona_id]
    );
    if (personaResult.rows.length === 0) {
      sendSSE(res, 'error', { message: '历史人物数据缺失' });
      return res.end();
    }
    const persona = personaResult.rows[0];

    // 加载全量历史消息作为上下文
    const historyResult = await query(
      'SELECT role, content FROM night_letter_messages WHERE thread_id = ? ORDER BY created_at ASC LIMIT 20',
      [threadId]
    );

    // 4. 构建 AI 请求
    const contextNote = thread.emotional_context
      ? `\n【本次来信情感背景】\n${thread.emotional_context}`
      : '';

    const historyText = historyResult.rows.map(m =>
      `[${m.role === 'persona' ? persona.display_name : '用户'}]: ${m.content}`
    ).join('\n\n');

    const systemPrompt = (persona.system_prompt || '') +
      '\n\n【重要】你正在与一位向你寻求慰藉的朋友通信。请基于上文的历史消息回复ta的最新一条消息。' +
      contextNote;

    const response = await callAi({
      userId,
      model: 'deepseek-chat',
      systemPrompt,
      userMessage: `以下是对话历史：\n${historyText}\n\n请以${persona.display_name}的身份，回复用户的最新消息：\n${message.trim()}`,
      stream: true,
      temperature: 0.7,
      maxTokens: 2048,
      signal: abortController.signal,
      onChunk: (delta) => {
        if (delta) {
          sendSSE(res, 'chunk', { content: delta });
        }
      }
    });

    // 5. 写入 AI 回信
    const fullContent = response.text || '';
    await query(
      `INSERT INTO night_letter_messages (thread_id, role, content, is_stream_interrupted)
       VALUES (?, 'persona', ?, ?)`,
      [threadId, fullContent, abortController.signal.aborted ? 1 : 0]
    );

    // 更新 thread 计数
    await query(
      'UPDATE night_letter_threads SET letter_count = letter_count + 2, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [threadId]
    );

    // 获取真实 letterId
    const letterResult = await query(
      'SELECT id FROM night_letter_messages WHERE thread_id = ? ORDER BY created_at DESC LIMIT 1',
      [threadId]
    );
    const actualLetterId = letterResult.rows[0]?.id || null;

    sendSSE(res, 'done', { letterId: actualLetterId, truncated: abortController.signal.aborted ? 1 : 0 });
  } catch (err) {
    console.error('[nightLetter] reply error:', err.message);
    if (!res.headersSent) {
      sendSSE(res, 'error', { message: '回复生成失败: ' + err.message });
    }
  } finally {
    res.end();
  }
});

// ── 工具函数 ────────────────────────────────────────────

function tryParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}
