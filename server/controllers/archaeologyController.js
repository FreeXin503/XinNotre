import { query } from '../config/database.js';
import { callAi, extractJson } from '../services/aiProviderService.js';
import { getCorpus } from '../services/corpusService.js';
import { setupSSE, sendSSE } from '../utils/sse.js';
import { success, fail, asyncHandler } from '../utils/response.js';

function getCoKeywords(notes) {
  const wordCount = {};
  const stopWords = new Set(['的', '了', '是', '在', '我', '有', '和', '就', '不', '也', '都', '这', '那', '到', '要', '还', '上', '为', '被', '能', '于', '与', '及', '去', '把', '让', '从', '它', '她', '他', '们', '对', '而', '但', '或', '所', '如', '之', '个', '中', '很', '更', '一', '可以', '这个', '没有', '不是', '就是', '因为', '所以', '但是', '而且', '可能', '一些', '一个', '什么', '怎么', '如何', '非常', '比较', '已经', '还是', '就是', '只是', '不过']);

  const zhChars = /[\u4e00-\u9fff]/;
  for (const n of notes) {
    const text = (n.content || '') + (n.title || '');
    for (let i = 0; i < text.length - 1; i++) {
      if (!zhChars.test(text[i])) continue;
      const bigram = text.substring(i, i + 2);
      if (!stopWords.has(bigram)) {
        wordCount[bigram] = (wordCount[bigram] || 0) + 1;
      }
    }
  }

  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

export const digBlindBox = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { digMode = 'random', seed = '' } = req.body;

    let sql = 'SELECT id, title, LEFT(content, 800) as content, category, created_at FROM notes WHERE user_id = ? AND is_deleted = FALSE';
    const params = [userId];

    if (digMode === 'emotion' && seed) {
      params.push(`%${seed}%`);
      sql += ' AND (title LIKE ? OR content LIKE ?)';
      params.push(`%${seed}%`);
    } else if (digMode === 'topic' && seed) {
      params.push(`%${seed}%`);
      sql += ' AND (content LIKE ? OR title LIKE ?)';
      params.push(`%${seed}%`);
    }

    sql += ' AND id NOT IN (SELECT note_id FROM archaeology_cards WHERE user_id = ? AND dug_at > DATE_SUB(NOW(), INTERVAL 7 DAY))';
    params.push(userId);

    sql += ' ORDER BY RAND() LIMIT 1';

    const result = await query(sql, params);
    if (!result.rows || result.rows.length === 0) {
      return fail(res, '考古层暂无出土物，请先导入便签或换挖掘模式', 404);
    }

    const note = result.rows[0];

    // Get co-keywords from notes in ±30 day window
    const dateStr = String(note.created_at || '').substring(0, 10);
    const windowNotes = await query(
      `SELECT content, title FROM notes WHERE user_id = ? AND is_deleted = FALSE
       AND created_at >= DATE_SUB(?, INTERVAL 30 DAY) AND created_at <= DATE_ADD(?, INTERVAL 30 DAY)
       LIMIT 50`,
      [userId, dateStr, dateStr]
    );
    const coKeywords = getCoKeywords(windowNotes.rows || []);

    const daysAgo = Math.floor((Date.now() - new Date(note.created_at).getTime()) / 86400000);

    // Get 3 co-occurring note titles from same category
    const coNotes = await query(
      `SELECT title FROM notes WHERE user_id = ? AND category = ? AND id != ? AND is_deleted = FALSE ORDER BY RAND() LIMIT 3`,
      [userId, note.category || '未分类', note.id]
    );
    const coNoteTitles = (coNotes.rows || []).map(n => n.title);

    const meta = { daysAgo, coKeywords, coNoteTitles };

    // Insert into archaeology_cards
    const insert = await query(
      `INSERT INTO archaeology_cards (user_id, note_id, dig_mode, dig_seed, meta_json)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE dug_at = dug_at`,
      [userId, note.id, digMode, seed || null, JSON.stringify(meta)]
    );

    const cardId = insert.insertId || insert.rows?.insertId;
    // If DUPLICATE, fetch existing id
    let finalCardId = cardId;
    if (!finalCardId) {
      const existing = await query(
        'SELECT id FROM archaeology_cards WHERE user_id = ? AND note_id = ? AND dig_mode = ?',
        [userId, note.id, digMode]
      );
      finalCardId = existing.rows?.[0]?.id;
    }

    success(res, {
      cardId: finalCardId,
      noteId: note.id,
      noteTitle: note.title,
      noteContent: note.content,
      noteCategory: note.category,
      createdAt: note.created_at,
      meta,
      isAppraised: false,
      appraisal: null
    });

});

export const appraiseCard = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { cardId } = req.params;
  const { model = 'deepseek-chat', customApiKey = '', customApiUrl = '', lengthMode = '' } = req.body;

  setupSSE(res);

  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  try {
    const cardResult = await query(
      'SELECT ac.*, n.title, n.content, n.category, n.created_at FROM archaeology_cards ac JOIN notes n ON ac.note_id = n.id WHERE ac.id = ? AND ac.user_id = ?',
      [cardId, userId]
    );

    if (!cardResult.rows || cardResult.rows.length === 0) {
      sendSSE(res, 'error', { message: '文物卡片不存在' });
      sendSSE(res, 'done', {});
      return;
    }

    const card = cardResult.rows[0];

    // Get context notes from same period for better appraisal
    const dateStr = String(card.created_at || '').substring(0, 10);
    const contextScope = {
      mode: 'range',
      dateStart: dateStr ? String(new Date(new Date(dateStr).getTime() - 30 * 86400000)).substring(0, 10) : null,
      dateEnd: dateStr ? String(new Date(new Date(dateStr).getTime() + 30 * 86400000)).substring(0, 10) : null,
      limit: 20,
      perNoteChars: 200
    };
    const ctx = await getCorpus(userId, contextScope);

    const systemPrompt = `你是一位温暖敏锐的"记忆考古学家"。用户刚刚从自己的日记中"挖掘"出一篇旧便签，请你以考古学家的身份，生成一份《文物鉴定书》。

便签原文：
【${String(card.created_at || '').substring(0, 10)} | ${card.category || '未知'}】${card.title}
${(card.content || '').substring(0, 2000)}

同期语境片段（共${ctx.count}篇）：
${ctx.corpusText.substring(0, 3000)}

请用纯 JSON 格式返回（不要有任何其他文字）：
{
  "thenThinking": "当时用户可能在思考什么、处于什么人生阶段，基于文字推断（80-150字）",
  "didItHappen": "后来这些事情有怎样的发展？基于同期语境和常识推断（80-150字）",
  "inHindsight": "现在回头看，这篇便签像什么？一封未寄出的信、一个预言、还是一次告别（60-100字）"
}`;

    sendSSE(res, 'status', { message: '正在生成鉴定书...' });

    const result = await callAi({
      userId, model, customApiKey, customApiUrl,
      systemPrompt,
      userMessage: '请为这篇出土便签生成文物鉴定书。',
      stream: true,
      temperature: 0.8,
      maxTokens: 1024,
      signal: abortController.signal,
      onChunk: (chunk) => sendSSE(res, 'chunk', { content: chunk }),
      lengthMode: lengthMode || undefined
    });

    const parsed = extractJson(result.text);
    if (!parsed) {
      sendSSE(res, 'result', { raw: result.text });
    } else {
      sendSSE(res, 'result', parsed);
    }

    await query(
      'UPDATE archaeology_cards SET appraisal = ?, is_appraised = TRUE WHERE id = ?',
      [JSON.stringify(parsed || { raw: result.text }), cardId]
    );

    sendSSE(res, 'done', {});
  } catch (err) {
    console.error('[archaeology] appraise error:', err.message);
    if (!res.headersSent) {
      sendSSE(res, 'error', { message: '鉴定失败: ' + err.message });
    }
    sendSSE(res, 'done', {});
  }
});

export const listCards = asyncHandler(async (req, res) => {
  const userId = req.user.id;

    const result = await query(
      `SELECT ac.id, ac.note_id, ac.dig_mode, ac.dig_seed, ac.meta_json, ac.appraisal, ac.is_appraised, ac.dug_at,
              n.title as note_title, LEFT(n.content, 300) as note_content, n.category as note_category, n.created_at as note_created_at
       FROM archaeology_cards ac
       JOIN notes n ON ac.note_id = n.id
       WHERE ac.user_id = ?
       ORDER BY ac.dug_at DESC
       LIMIT 100`,
      [userId]
    );

    const cards = (result.rows || []).map(r => ({
      id: r.id,
      noteId: r.note_id,
      noteTitle: r.note_title,
      noteContent: r.note_content,
      noteCategory: r.note_category,
      noteCreatedAt: r.note_created_at,
      digMode: r.dig_mode,
      digSeed: r.dig_seed,
      meta: typeof r.meta_json === 'string' ? JSON.parse(r.meta_json) : (r.meta_json || {}),
      appraisal: r.appraisal ? (typeof r.appraisal === 'string' ? JSON.parse(r.appraisal) : r.appraisal) : null,
      isAppraised: !!r.is_appraised,
      dugAt: r.dug_at
    }));

    success(res, { cards });

});
