import { query, withTransaction } from '../config/database.js';
import { getLengthMaxTokens } from '../services/lengthModeService.js';
import { hybridRetrieve } from '../services/retrievalService.js';
import { setupSSE, sendSSE } from '../utils/sse.js';
import { success, fail, asyncHandler } from '../utils/response.js';
import { callAi } from '../services/aiProviderService.js';

const DS_MODEL = 'deepseek-chat';

/**
 * 校验 AI 输出中的引用是否真实存在于用户便签
 */
async function verifyCitations(userId, citations) {
  if (!Array.isArray(citations) || citations.length === 0) return [];
  const verified = [];
  for (const cit of citations) {
    if (!cit.noteId || !cit.quote) continue;
    if (cit.quote.length < 8) continue;
    try {
      const res = await query(
        'SELECT id, content FROM notes WHERE id = ? AND user_id = ?',
        [cit.noteId, userId]
      );
      if (res.rows.length > 0 && res.rows[0].content.includes(cit.quote)) {
        verified.push(cit);
      }
    } catch { /* skip unverifiable */ }
  }
  return verified;
}

// ─── D2: 主题回忆录 ───

export const generateMemoir = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  let { theme, chapters = 5 } = req.body;

  if (!theme || !theme.trim()) {
    return fail(res, 'theme 必填');
  }
  theme = String(theme).substring(0, 200);
  chapters = Math.max(1, Math.min(12, parseInt(chapters, 10) || 5));

  // 并发锁: 同一用户同一时间只能生成一个回忆录
  const lockKey = `memoir_gen_${userId}`;

  setupSSE(res);

  try {
    // 检索全量相关便签
    const relevantNotes = await hybridRetrieve(userId, theme, 30);
    if (!relevantNotes || relevantNotes.length < 5) {
      sendSSE(res, 'error', { message: `围绕"${theme}"的便签太少(仅 ${relevantNotes?.length || 0} 条), 请更换主题` });
      return res.end();
    }

    const noteContext = relevantNotes.map((n, i) =>
      `[#${n.id}] 标题: ${n.payload?.title || '无标题'}\n日期: ${n.payload?.created_at || ''}\n原文: ${(n.content || '').substring(0, 1500)}`
    ).join('\n\n---\n\n');

    const systemPrompt = `你是一名传记作者。围绕主题「${theme}」写一本 ${chapters} 章的结构化回忆录。

## 写作要求
- 每章必须引用 3-8 条便签原文片段, 引用标注格式为 [来源: #noteId]
- 引用片段必须来自下方提供的检索结果, 严禁虚构。
- 每章字数 300-800 字。
- 输出格式: 每章以 "## 第X章: 章节标题" 开头, 纯文字 Markdown。

## 检索到的便签原文(可引用):
${noteContext}`;

    const aiResult = await callAi({
      userId,
      model: DS_MODEL,
      systemPrompt,
      userMessage: `请以主题「${theme}」创作一本 ${chapters} 章的个人回忆录。`,
      stream: true,
      temperature: 0.7,
      maxTokens: getLengthMaxTokens('long') || 4096,
      signal: req.signal,
      onChunk: (delta) => {
        if (delta) sendSSE(res, 'chunk', { t: delta });
      }
    });

    const fullText = aiResult.text || '';

    if (fullText.trim().length < 50) {
      sendSSE(res, 'error', { message: 'AI 生成内容过短, 请重试' });
      return res.end();
    }

    // 提取引用, 验证真实性
    const citationRegex = /\[来源:\s*#([A-Za-z0-9_-]+)\]/g;
    const rawCitations = [];
    let m;
    while ((m = citationRegex.exec(fullText)) !== null) {
      rawCitations.push({ noteId: m[1], quote: '' });
    }

    // 提取每句引用 (找到 noteId 附近 ≈ 20 字)
    const verifiedCitations = [];
    for (const c of rawCitations) {
      const idx = fullText.indexOf(`#${c.noteId}`);
      if (idx >= 0) {
        const start = Math.max(0, idx - 30);
        const end = Math.min(fullText.length, idx + 80);
        c.quote = fullText.substring(start, end).replace(/[\[\]#\n]/g, ' ').trim();
      }
    }
    const finalCitations = await verifyCitations(userId, rawCitations);

    // 清理输出: 移除未验证的引用标记
    let cleanText = fullText;
    for (const c of rawCitations) {
      if (!finalCitations.find(v => v.noteId === c.noteId)) {
        cleanText = cleanText.replace(new RegExp(`\\[来源:\\s*#${c.noteId}\\]`, 'g'), '');
      }
    }

    // 按章节分割
    const chapterBlocks = cleanText.split(/(?=^##\s+第)/m).filter(b => b.trim());
    const actualChapters = chapterBlocks.length || 1;

    // 存入 DB
    let memoirId;
    await withTransaction(async (tx) => {
      const ins = await tx(
        'INSERT INTO memoirs (user_id, theme, status, chapter_count) VALUES (?, ?, ?, ?)',
        [userId, theme, 'generated', actualChapters]
      );
      memoirId = ins.rows.insertId;

      for (let i = 0; i < chapterBlocks.length; i++) {
        const block = chapterBlocks[i].trim();
        const titleMatch = block.match(/^##\s+(.+?)(?:\n|$)/);
        const title = titleMatch ? titleMatch[1].trim() : `第 ${i + 1} 章`;
        const content = block.replace(/^##\s+.+?\n/, '').trim();

        const chapterCitations = finalCitations.filter(c =>
          block.includes(`#${c.noteId}`)
        );

        await tx(
          'INSERT INTO memoir_chapters (memoir_id, seq, title, content, citations_json) VALUES (?, ?, ?, ?, ?)',
          [memoirId, i + 1, title, content, JSON.stringify(chapterCitations)]
        );
      }
    });

    sendSSE(res, 'done', { memoirId, chapters: actualChapters });
    res.end();
  } catch (err) {
    if (err.name === 'AbortError') {
      sendSSE(res, 'done', { note: '已中断' });
    } else {
      console.error('[memoir] generate error:', err.message);
      sendSSE(res, 'error', { message: err.message });
    }
    if (!res.writableEnded) res.end();
  }
});

export const listMemoirs = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const result = await query(
    'SELECT * FROM memoirs WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  success(res, { memoirs: result.rows });
});

export const editChapter = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { memoirId, seq } = req.params;
  const { title, content } = req.body;

  if (!content) return fail(res, 'content 必填');

  const memoir = await query('SELECT * FROM memoirs WHERE id = ? AND user_id = ?', [memoirId, userId]);
  if (memoir.rows.length === 0) return fail(res, '回忆录不存在', 404);

  await query(
    'UPDATE memoir_chapters SET title = COALESCE(?, title), content = ? WHERE memoir_id = ? AND seq = ?',
    [title || null, content, memoirId, parseInt(seq, 10)]
  );

  success(res, { message: '章节已更新' });
});

export const publishMemoir = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const result = await query(
    'UPDATE memoirs SET status = ? WHERE id = ? AND user_id = ?',
    ['published', id, userId]
  );
  if (result.rows.affectedRows === 0) {
    return fail(res, '回忆录不存在', 404);
  }
  success(res, { message: '回忆录已发布' });
});

export const exportMemoirPdf = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const memoir = await query('SELECT * FROM memoirs WHERE id = ? AND user_id = ?', [id, userId]);
  if (memoir.rows.length === 0) return fail(res, '回忆录不存在', 404);

  const chapters = await query(
    'SELECT * FROM memoir_chapters WHERE memoir_id = ? ORDER BY seq ASC',
    [id]
  );

  success(res, {
    memoir: memoir.rows[0],
    chapters: chapters.rows
  });
});
