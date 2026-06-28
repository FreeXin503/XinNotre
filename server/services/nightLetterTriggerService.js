/**
 * 心迹星图 深夜来信 · 自动触发引擎
 * 职责：扫描用户近期日记的情绪低谷，匹配历史名人，生成私人信件
 *
 * 核心流程:
 *   1. scanForNightLetterTrigger — 冷却检查 + 情绪检测
 *   2. matchBestPersona — 通过向量相似度 + AI 分析选择最合适的名人
 *   3. buildLetterPrompt — 组装 system_prompt + RAG 上下文
 *   4. generateNightLetter — 调用 AI 流式生成并持久化
 *
 * 防翻车设计:
 * - 72 小时冷却期内绝对不重复发送
 * - 近期日记数 < 3 篇时静默跳过
 * - AI 检测必须返回 JSON 且有 shouldSend=true 才触发
 * - 所有 DB 写入经过 try/catch 保护
 */
import { query } from '../config/database.js';
import { callAi } from './aiProviderService.js';
import { hybridRetrieve } from './retrievalService.js';

// ── 导出接口 ────────────────────────────────────────────

/**
 * 扫描用户近期日记，检测情绪低谷触发点
 * @param {number} userId
 * @param {Object} [options]
 * @param {number} [options.lookbackDays=7] - 回溯天数
 * @param {number} [options.minRecentNotes=3] - 最低日记数阈值
 * @param {number} [options.cooldownHours=72] - 距上次来信的最短冷却时间
 * @returns {Promise<{ shouldSend: boolean, triggerNotes: Array<{id:string, title:string, snippet:string, detectedMood:string}>, emotionalContext: string, recommendedPersonaKey: string|null }>}
 */
export async function scanForNightLetterTrigger(userId, options = {}) {
  const lookbackDays = options.lookbackDays ?? 7;
  const minRecentNotes = options.minRecentNotes ?? 3;
  const cooldownHours = options.cooldownHours ?? 72;

  // 1. 冷却检查
  const lastThread = await query(
    'SELECT created_at FROM night_letter_threads WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
    [userId]
  );
  if (lastThread.rows.length > 0) {
    const hoursSinceLast = (Date.now() - new Date(lastThread.rows[0].created_at).getTime()) / 3600000;
    if (hoursSinceLast < cooldownHours) {
      return { shouldSend: false, triggerNotes: [], emotionalContext: '', recommendedPersonaKey: null };
    }
  }

  // 2. 拉取近期日记
  const recentNotes = await query(
    `SELECT id, title, LEFT(content, 500) as snippet, content, created_at
     FROM notes WHERE user_id = ? AND is_deleted = FALSE
     AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     ORDER BY created_at DESC LIMIT 20`,
    [userId, lookbackDays]
  );

  if (!recentNotes.rows || recentNotes.rows.length < minRecentNotes) {
    return { shouldSend: false, triggerNotes: [], emotionalContext: '', recommendedPersonaKey: null };
  }

  // 3. AI 情绪检测
  const corpus = recentNotes.rows.map(n =>
    `[${String(n.created_at).substring(0, 10)}] ${n.title}: ${(n.content || '').substring(0, 300)}`
  ).join('\n---\n');

  try {
    const aiResult = await callAi({
      userId,
      model: 'deepseek-chat',
      systemPrompt: DETECTION_SYSTEM_PROMPT,
      userMessage: `请分析以下用户近 ${lookbackDays} 天的日记摘要，判断是否有情绪低谷或值得叩问的人生转折点——\n\n${corpus}`,
      stream: false,
      temperature: 0.3,
      maxTokens: 1200
    });

    const parsed = extractJsonFromResponse(aiResult.text || '');

    if (!parsed || !parsed.shouldSend) {
      return { shouldSend: false, triggerNotes: [], emotionalContext: '', recommendedPersonaKey: null };
    }

    // 映射触发便签
    const triggerNoteIdSet = new Set((parsed.triggerNoteIds || []).map(String));
    const triggerNotes = recentNotes.rows
      .filter(n => triggerNoteIdSet.has(String(n.id)))
      .map(n => ({
        id: n.id,
        title: n.title || '',
        snippet: (n.content || '').substring(0, 300),
        detectedMood: parsed.emotionalContext || 'unknown'
      }));

    return {
      shouldSend: true,
      triggerNotes,
      emotionalContext: parsed.emotionalContext || '近期情绪波动',
      recommendedPersonaKey: parsed.recommendedPersona || null
    };
  } catch (err) {
    console.error('[nightLetterTrigger] AI 情绪检测失败:', err.message);
    return { shouldSend: false, triggerNotes: [], emotionalContext: '', recommendedPersonaKey: null };
  }
}

/**
 * 执行来信生成
 * @param {number} userId
 * @param {Object} [options]
 * @param {string} [options.forcePersonaKey] - 强制指定名人
 * @param {Object} [options.overrideTrigger] - 手动触发时传入的外部检测结果
 * @returns {Promise<{ threadId: number|null, firstLetterId: number|null }>}
 */
export async function generateNightLetter(userId, options = {}) {
  // 1. 获取触发信息
  let triggerInfo;
  if (options.overrideTrigger) {
    triggerInfo = options.overrideTrigger;
  } else {
    triggerInfo = await scanForNightLetterTrigger(userId);
  }

  if (!triggerInfo || !triggerInfo.shouldSend) {
    return { threadId: null, firstLetterId: null };
  }

  // 2. 选择 persona
  let personaKey = options.forcePersonaKey || triggerInfo.recommendedPersonaKey;
  const persona = await selectPersonaByKey(personaKey);
  if (!persona) {
    return { threadId: null, firstLetterId: null };
  }

  // 3. RAG 检索增强
  const queryText = triggerInfo.emotionalContext + ' ' +
    (triggerInfo.triggerNotes || []).map(n => n.snippet).join(' ');
  let ragResults = [];
  try {
    ragResults = await hybridRetrieve(userId, queryText, 8);
  } catch (err) {
    console.error('[nightLetterTrigger] RAG 检索失败:', err.message);
  }

  // 4. 构建 prompt 上下文
  const ragContext = ragResults.length > 0
    ? '\n\n【相关日记记忆片段】\n' + ragResults.map((r, i) =>
        `#${i + 1} ${r.payload?.title || '无标题'}:\n${(r.content || '').substring(0, 500)}`
      ).join('\n\n')
    : '';

  const userSnippets = (triggerInfo.triggerNotes || []).map(n =>
    `[${n.detectedMood}] ${n.title}:\n${n.snippet}`
  ).join('\n\n');

  const systemPrompt = persona.system_prompt || '';
  const greeting = (persona.greeting_template || '')
    .replace('{username}', `朋友`);

  const userMessage = [
    `【情绪背景】\n${triggerInfo.emotionalContext}`,
    `【用户近期日记摘录】\n${userSnippets}`,
    ragContext,
    `\n请用你的风格给这位朋友写一封信。以以下开篇：\n${greeting}`
  ].filter(Boolean).join('\n\n');

  // 5. 创建 thread
  const triggerNoteIds = JSON.stringify((triggerInfo.triggerNotes || []).map(n => n.id));
  let threadId;
  try {
    const threadResult = await query(
      `INSERT INTO night_letter_threads (user_id, persona_id, trigger_note_ids, emotional_context, letter_count, is_delivered, is_read)
       VALUES (?, ?, ?, ?, 1, TRUE, FALSE)`,
      [userId, persona.id, triggerNoteIds, triggerInfo.emotionalContext.substring(0, 120)]
    );
    threadId = threadResult.rows.insertId;
  } catch (err) {
    console.error('[nightLetterTrigger] 创建 thread 失败:', err.message);
    return { threadId: null, firstLetterId: null };
  }

  // 6. 调用 AI 生成信件（非流式，首封信预生成）
  try {
    const aiResult = await callAi({
      userId,
      model: 'deepseek-chat',
      systemPrompt,
      userMessage,
      stream: false,
      temperature: 0.7,
      maxTokens: 2048
    });

    const letterContent = aiResult.text || '（来信生成失败）';

    const quotedSnippets = JSON.stringify(
      (triggerInfo.triggerNotes || []).map(n => ({
        noteId: n.id,
        quote: n.snippet,
        sentence: n.title || ''
      }))
    );

    const letterResult = await query(
      `INSERT INTO night_letter_messages (thread_id, role, content, quoted_note_snippets, is_stream_interrupted)
       VALUES (?, 'persona', ?, ?, FALSE)`,
      [threadId, letterContent, quotedSnippets]
    );
    const firstLetterId = letterResult.rows.insertId;

    return { threadId, firstLetterId };
  } catch (err) {
    console.error('[nightLetterTrigger] AI 来信生成失败:', err.message);
    // 清理已创建的孤立 thread
    try { await query('DELETE FROM night_letter_threads WHERE id = ?', [threadId]); } catch {}
    return { threadId: null, firstLetterId: null };
  }
}

// ── 内部函数 ────────────────────────────────────────────

/**
 * 从 AI 响应中解析 JSON（兼容 markdown code block 包裹）
 * @param {string} text
 * @returns {Object|null}
 */
function extractJsonFromResponse(text) {
  if (!text) return null;
  // 尝试直接解析
  try {
    return JSON.parse(text);
  } catch { /* not plain JSON */ }

  // 尝试提取 markdown code block 中的 JSON
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try {
      return JSON.parse(match[1].trim());
    } catch { /* failed */ }
  }

  // 尝试提取第一个 { ... } 块
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch { /* failed */ }
  }
  return null;
}

/**
 * 根据 persona_key 或随机选择一个活跃的 persona
 * @param {number} userId
 * @param {string|null} preferredKey
 * @returns {Promise<Object|null>}
 */
async function selectPersonaByKey(preferredKey) {
  try {
    if (preferredKey) {
      const result = await query(
        'SELECT id, persona_key, system_prompt, greeting_template, quote_style FROM night_letter_personas WHERE persona_key = ? AND is_active = TRUE LIMIT 1',
        [preferredKey]
      );
      if (result.rows.length > 0) return result.rows[0];
    }
    // 随机选一个
    const result = await query(
      'SELECT id, persona_key, system_prompt, greeting_template, quote_style FROM night_letter_personas WHERE is_active = TRUE ORDER BY RAND() LIMIT 1'
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (err) {
    console.error('[nightLetterTrigger] 选择 persona 失败:', err.message);
    return null;
  }
}

// ── 常量 Prompt ─────────────────────────────────────────

const DETECTION_SYSTEM_PROMPT = `你是一位经验丰富的心理分析专家。你的任务是从用户的日记摘要中识别出情绪低谷、焦虑点、孤独感或值得深入叩问的人生转折点。

【分析要求】
- 从文字中识别明显的负面情绪信号：焦虑、孤独、疲惫、失落、自我怀疑
- 也注意积极的里程碑：成就感、顿悟时刻、重要决定
- 如果日记内容过于平淡（如纯事务性记录），应判定为不应触发

【输出格式】
你必须严格以 JSON 格式输出，不要包含任何其他文字：
{
  "shouldSend": true/false,
  "emotionalContext": "用一句话概括当前情绪状态",
  "triggerNoteIds": ["引起注意的日记ID数组"],
  "recommendedPersona": "推荐的历史人物 key, 如 socrates, nietzsche, zhuangzi",
  "reasoning": "简短的分析理由"
}

【推荐规则】
- 孤独感/存在困惑 → socrates (苏格拉底)
- 焦虑/压力/自我怀疑 → zhuangzi (庄子) 或 wangyangming (王阳明)
- 愤怒/不甘/强烈情绪 → nietzsche (尼采)
- 痛苦/悲伤/失落 → simone_weil (西蒙娜·薇依)
- 日常沉思/温和感悟 → tagore (泰戈尔)`;
