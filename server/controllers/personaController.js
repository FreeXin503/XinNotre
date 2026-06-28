import { query } from '../config/database.js';
import { callAi, extractJson } from '../services/aiProviderService.js';
import { getCorpus } from '../services/corpusService.js';
import { setupSSE, sendSSE } from '../utils/sse.js';
import { success, fail, asyncHandler } from '../utils/response.js';

export const generatePersona = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { model = 'deepseek-chat', customApiKey = '', customApiUrl = '', force = false, lengthMode = '' } = req.body;

  setupSSE(res);

  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  try {
    sendSSE(res, 'status', { message: '正在读取语料...' });

    const scope = { mode: 'all', limit: 300, perNoteChars: 200 };
    const corpus = await getCorpus(userId, scope);

    if (corpus.count === 0) {
      sendSSE(res, 'error', { message: '暂无便签数据可生成人格档案' });
      sendSSE(res, 'done', {});
      return;
    }

    // Check if same corpus already has a snapshot
    if (!force) {
      const existing = await query(
        'SELECT ps.id, ps.version_tag, ps.created_at FROM persona_snapshots ps JOIN persona_versions pv ON ps.id = pv.snapshot_id WHERE ps.user_id = ? AND ps.corpus_hash = ? ORDER BY pv.seq DESC LIMIT 1',
        [userId, corpus.hash]
      );
      if (existing.rows && existing.rows.length > 0) {
        sendSSE(res, 'result', { cached: true, snapshotId: existing.rows[0].id, versionTag: existing.rows[0].version_tag });
        sendSSE(res, 'done', {});
        return;
      }
    }

    sendSSE(res, 'status', { message: `正在分析 ${corpus.count} 篇便签的人格特征...` });

    const systemPrompt = `你是一位深邃的"个人成长分析师"。请基于用户的便签日记，生成一份人格档案。

用户语料（共${corpus.count}篇，${corpus.corpusText.length}字）：

${corpus.corpusText.substring(0, 8000)}

请用纯 JSON 格式返回（不要有任何其他文字）：
{
  "radar": {
    "thinker": 0-100,
    "doer": 0-100,
    "emotional": 0-100,
    "rational": 0-100,
    "romantic": 0-100,
    "pragmatic": 0-100
  },
  "keywords": [{"word": "示例", "count": 10}],
  "summary": "一段 150-250 字人格综述，分析用户的思维方式、情绪模式和行为倾向",
  "crossTalk": "「今日的你对这一阶段的自己说」— 一段跨时空对话，80-120字，用第二人称"
}

维度含义：
- thinker: 深度思考、反思倾向
- doer: 行动力、执行倾向
- emotional: 情绪感知、共情能力
- rational: 逻辑分析、理性决策
- romantic: 理想主义、文艺感
- pragmatic: 务实主义、效率导向

确保六个维度的值加起来有意义，建议分布在 30-90 范围。`;

    const result = await callAi({
      userId, model, customApiKey, customApiUrl,
      systemPrompt,
      userMessage: '请为我生成人格档案。',
      stream: true,
      temperature: 0.8,
      maxTokens: 2048,
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

    // Validate radar dimensions, fill missing with 50
    const dims = ['thinker', 'doer', 'emotional', 'rational', 'romantic', 'pragmatic'];
    for (const d of dims) {
      if (typeof parsed.radar?.[d] !== 'number') {
        if (!parsed.radar) parsed.radar = {};
        parsed.radar[d] = 50;
      }
      parsed.radar[d] = Math.max(0, Math.min(100, parsed.radar[d]));
    }

    const year = new Date().getFullYear();
    const quarter = Math.floor(new Date().getMonth() / 3) + 1;

    // Get next seq
    const seqResult = await query('SELECT COALESCE(MAX(seq), 0) + 1 as next_seq FROM persona_versions WHERE user_id = ?', [userId]);
    const nextSeq = seqResult.rows?.[0]?.next_seq || 1;
    const versionTag = `${year}Q${quarter}-v${nextSeq}`;

    // Insert snapshot
    const snapResult = await query(
      'INSERT INTO persona_snapshots (user_id, version_tag, corpus_hash, note_count, radar_json, keywords_json, summary, cross_talk) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, versionTag, corpus.hash, corpus.count, JSON.stringify(parsed.radar), JSON.stringify(parsed.keywords || []), parsed.summary || '', parsed.crossTalk || '']
    );
    const snapshotId = snapResult.insertId;

    // Insert version chain
    await query(
      'INSERT INTO persona_versions (user_id, snapshot_id, seq) VALUES (?, ?, ?)',
      [userId, snapshotId, nextSeq]
    );

    sendSSE(res, 'result', {
      cached: false,
      snapshotId,
      versionTag,
      radar: parsed.radar,
      keywords: parsed.keywords || [],
      summary: parsed.summary || '',
      crossTalk: parsed.crossTalk || ''
    });

    sendSSE(res, 'done', {});
  } catch (err) {
    console.error('[persona] generate error:', err.message);
    if (!res.headersSent) {
      sendSSE(res, 'error', { message: '生成失败: ' + err.message });
    }
    sendSSE(res, 'done', {});
  }
});

export const listPersonas = asyncHandler(async (req, res) => {
  const userId = req.user.id;

    const result = await query(
      `SELECT ps.id, ps.version_tag, ps.note_count, ps.radar_json, ps.keywords_json, ps.summary, ps.cross_talk, ps.created_at, pv.seq
       FROM persona_snapshots ps
       JOIN persona_versions pv ON ps.id = pv.snapshot_id
       WHERE ps.user_id = ?
       ORDER BY pv.seq DESC
       LIMIT 50`,
      [userId]
    );

    const list = (result.rows || []).map(r => ({
      id: r.id,
      versionTag: r.version_tag,
      seq: r.seq,
      noteCount: r.note_count,
      radar: typeof r.radar_json === 'string' ? JSON.parse(r.radar_json) : r.radar_json,
      keywords: typeof r.keywords_json === 'string' ? JSON.parse(r.keywords_json) : r.keywords_json,
      summary: r.summary,
      crossTalk: r.cross_talk,
      createdAt: r.created_at
    }));

    success(res, { personas: list });

});

export const getPersonaDiff = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { from, to } = req.query;

  if (!from || !to) {
    return fail(res, '需要 from 和 to 参数', 400);
  }

    const [fromResult, toResult] = await Promise.all([
      query('SELECT * FROM persona_snapshots WHERE id = ? AND user_id = ?', [from, userId]),
      query('SELECT * FROM persona_snapshots WHERE id = ? AND user_id = ?', [to, userId])
    ]);

    if (!fromResult.rows?.length || !toResult.rows?.length) {
      return fail(res, '人格快照不存在', 404);
    }

    const fromData = fromResult.rows[0];
    const toData = toResult.rows[0];

    const fromRadar = typeof fromData.radar_json === 'string' ? JSON.parse(fromData.radar_json) : fromData.radar_json;
    const toRadar = typeof toData.radar_json === 'string' ? JSON.parse(toData.radar_json) : toData.radar_json;

    const drift = {};
    const dims = ['thinker', 'doer', 'emotional', 'rational', 'romantic', 'pragmatic'];
    for (const d of dims) {
      const fv = fromRadar?.[d] || 50;
      const tv = toRadar?.[d] || 50;
      drift[d] = tv - fv;
    }

    const fromKeywords = typeof fromData.keywords_json === 'string' ? JSON.parse(fromData.keywords_json) : fromData.keywords_json || [];
    const toKeywords = typeof toData.keywords_json === 'string' ? JSON.parse(toData.keywords_json) : toData.keywords_json || [];

    success(res, {
      from: { versionTag: fromData.version_tag, radar: fromRadar, keywords: fromKeywords, summary: fromData.summary, createdAt: fromData.created_at },
      to: { versionTag: toData.version_tag, radar: toRadar, keywords: toKeywords, summary: toData.summary, createdAt: toData.created_at },
      drift
    });
});
