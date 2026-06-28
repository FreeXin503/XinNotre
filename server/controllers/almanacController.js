import { query } from '../config/database.js';
import { callAi, extractJson } from '../services/aiProviderService.js';
import { getCorpus } from '../services/corpusService.js';
import { bindAlmanacPdf } from '../services/almanacPdfService.js';
import { setupSSE, sendSSE } from '../utils/sse.js';
import { success, fail, asyncHandler } from '../utils/response.js';

export const publishAlmanac = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { reportId, model = 'deepseek-chat', customApiKey = '', customApiUrl = '', lengthMode = '' } = req.body;

  setupSSE(res);

  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  try {
    const reportResult = await query(
      'SELECT * FROM ai_reports WHERE id = ? AND user_id = ?',
      [reportId, userId]
    );
    if (!reportResult.rows?.length) {
      sendSSE(res, 'error', { message: '报告不存在' });
      sendSSE(res, 'done', {});
      return;
    }

    const report = reportResult.rows[0];
    const year = report.year;
    if (!year) {
      sendSSE(res, 'error', { message: '报告年份无效' });
      sendSSE(res, 'done', {});
      return;
    }

    // Check if already published
    const existing = await query(
      'SELECT id FROM almanac_volumes WHERE user_id = ? AND report_id = ?',
      [userId, reportId]
    );
    if (existing.rows?.length) {
      sendSSE(res, 'error', { message: '该报告已出版卷宗，如需重新出版请先删除旧卷宗', existingVolumeId: existing.rows[0].id });
      sendSSE(res, 'done', {});
      return;
    }

    sendSSE(res, 'status', { message: '正在读取语料...' });

    const corpus = await getCorpus(userId, {
      mode: 'range',
      dateStart: `${year}-01-01`,
      dateEnd: `${year}-12-31`,
      limit: 400,
      perNoteChars: 150
    });

    // Get historical keywords from previous almanacs
    const historyKeywords = await query(
      `SELECT av.keyword_evolution FROM almanac_volumes av
       JOIN ai_reports ar ON av.report_id = ar.id
       WHERE av.user_id = ? AND ar.year < ? AND ar.year >= ? - 5
       ORDER BY ar.year ASC`,
      [userId, year, year]
    );
    const historyPart = (historyKeywords.rows || []).map(r => {
      const ke = typeof r.keyword_evolution === 'string' ? JSON.parse(r.keyword_evolution) : r.keyword_evolution;
      return ke ? JSON.stringify(ke) : '';
    }).filter(Boolean).join('\n');

    sendSSE(res, 'status', { message: '正在生成卷宗元数据...' });

    const systemPrompt = `你是一位"数字出版编辑"。基于用户的便签语料和年度报告，生成年报卷宗元数据。
用户${year}年便签共${corpus.count}篇：

${corpus.corpusText.substring(0, 6000)}

请用纯JSON返回（不要有其他文字）：
{
  "volumeTitle": "一个诗意的年度标题，如'2026·破晓之书'",
  "topQuotes": [{"quote":"引文","noteId":"便签ID（可空）","date":"YYYY-MM-DD"}],
  "topPersons": [{"name":"人物","mentions":次数}],
  "milestones": [{"title":"里程碑事件","date":"YYYY-MM-DD"}],
  "keywordEvolution": {"year":${year},"keywords":["关键词1","关键词2"]}
}`;

    const userMessage = `请为${year}年的个人年报生成卷宗元数据。`;
    const result = await callAi({
      userId, model, customApiKey, customApiUrl,
      systemPrompt, userMessage,
      stream: true, temperature: 0.8, maxTokens: 8192,
      signal: abortController.signal,
      onChunk: (chunk) => sendSSE(res, 'chunk', { content: chunk }),
      lengthMode: lengthMode || undefined
    });

    const parsed = extractJson(result.text);
    if (!parsed) {
      sendSSE(res, 'error', { message: 'AI 返回格式异常，请重试' });
      sendSSE(res, 'done', {});
      return;
    }

    const insertResult = await query(
      `INSERT INTO almanac_volumes (user_id, report_id, volume_title, cover_theme, top_quotes, top_persons, milestones, keyword_evolution, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [userId, reportId, parsed.volumeTitle || `${year}年度生命年报`, 'aurora',
       JSON.stringify(parsed.topQuotes || []), JSON.stringify(parsed.topPersons || []),
       JSON.stringify(parsed.milestones || []), JSON.stringify(parsed.keywordEvolution || {})]
    );

    sendSSE(res, 'result', {
      volumeId: insertResult.insertId,
      volumeTitle: parsed.volumeTitle || `${year}年度生命年报`,
      topQuotes: parsed.topQuotes || [],
      topPersons: parsed.topPersons || [],
      milestones: parsed.milestones || [],
      keywordEvolution: parsed.keywordEvolution || {}
    });

    sendSSE(res, 'done', {});
  } catch (err) {
    console.error('[almanac] publish error:', err.message);
    if (!res.headersSent) sendSSE(res, 'error', { message: '出版失败: ' + err.message });
    sendSSE(res, 'done', {});
  }
});

export const downloadAlmanacPdf = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

    const volume = await query(
      'SELECT v.*, r.content FROM almanac_volumes v JOIN ai_reports r ON v.report_id = r.id WHERE v.id = ? AND v.user_id = ?',
      [id, userId]
    );
    if (!volume.rows?.length) {
      return fail(res, '卷宗不存在', 404);
    }

    const vol = volume.rows[0];
    const volData = {
      volume_title: vol.volume_title,
      cover_theme: vol.cover_theme,
      top_quotes: typeof vol.top_quotes === 'string' ? JSON.parse(vol.top_quotes) : vol.top_quotes,
      top_persons: typeof vol.top_persons === 'string' ? JSON.parse(vol.top_persons) : vol.top_persons,
      milestones: typeof vol.milestones === 'string' ? JSON.parse(vol.milestones) : vol.milestones
    };

    const reportContent = vol.content || '';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(vol.volume_title)}.pdf"`);

    bindAlmanacPdf(volData, reportContent, res);

});

export const listAlmanacs = asyncHandler(async (req, res) => {
  const userId = req.user.id;

    const result = await query(
      `SELECT v.id, v.volume_title, v.cover_theme, v.is_published, v.created_at, r.scope, r.year
       FROM almanac_volumes v JOIN ai_reports r ON v.report_id = r.id
       WHERE v.user_id = ? ORDER BY r.year DESC`,
      [userId]
    );

    success(res, { volumes: (result.rows || []).map(r => ({
      id: r.id, title: r.volume_title, coverTheme: r.cover_theme,
      isPublished: !!r.is_published, createdAt: r.created_at, scope: r.scope, year: r.year
    })) });
});
