import { query } from '../config/database.js';
import { callAi, extractJson } from '../services/aiProviderService.js';
import { runBatchAnnotation } from '../services/batchAnnotationService.js';
import { getCorpus } from '../services/corpusService.js';
import { setupSSE, sendSSE } from '../utils/sse.js';
import { success, fail, asyncHandler } from '../utils/response.js';

const activeExtractions = new Map();

export const startGoalExtraction = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { model, customApiKey, customApiUrl } = req.body;

  setupSSE(res);

  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  if (activeExtractions.get(userId)) {
    sendSSE(res, 'error', { message: '目标抽取已在运行中' });
    sendSSE(res, 'done', {});
    return;
  }

  activeExtractions.set(userId, true);

  try {
    const result = await runBatchAnnotation({
      userId, model, customApiKey, customApiUrl,
      taskType: 'goal', batchSize: 30, maxBatches: 50,
      signal: abortController.signal,
      onProgress: (p) => sendSSE(res, 'progress', p)
    });

    sendSSE(res, 'result', result);
  } catch (err) {
    sendSSE(res, 'error', { message: err.message });
  } finally {
    activeExtractions.delete(userId);
    sendSSE(res, 'done', {});
  }
});

export const listGoals = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { status, year } = req.query;

    let sql = `SELECT g.*, n.title as source_title, n.created_at as note_created
               FROM growth_goals g LEFT JOIN notes n ON g.source_note_id = n.id
               WHERE g.user_id = ?`;
    const params = [userId];

    if (status) {
      params.push(status);
      sql += ' AND g.status = ?';
    }
    if (year) {
      params.push(parseInt(year));
      sql += ' AND (g.settled_year = ? OR YEAR(g.raised_at) = ?)';
      params.push(parseInt(year));
    }

    sql += ' ORDER BY g.created_at DESC LIMIT 200';

    const result = await query(sql, params);
    const goals = await Promise.all((result.rows || []).map(async (g) => {
      const evResult = await query(
        'SELECT note_id, evidence_type, note_text FROM growth_evidence WHERE goal_id = ?',
        [g.id]
      );
      return {
        id: g.id,
        goalSummary: g.goal_summary || (g.goal_text || '').substring(0, 100),
        category: g.category,
        raisedAt: g.raised_at,
        status: g.status,
        settledYear: g.settled_year,
        sourceNoteId: g.source_note_id,
        sourceTitle: g.source_title,
        createdAt: g.created_at,
        evidence: (evResult.rows || []).map(e => ({
          noteId: e.note_id, evidenceType: e.evidence_type, noteText: e.note_text
        }))
      };
    }));

    success(res, { goals });
});

export const updateGoalStatus = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { status, settledYear } = req.body;

  const validStatuses = ['pending', 'in_progress', 'achieved', 'abandoned'];
  if (!validStatuses.includes(status)) {
    return fail(res, '无效的状态值', 400);
  }

    const goal = await query('SELECT id FROM growth_goals WHERE id = ? AND user_id = ?', [id, userId]);
    if (!goal.rows?.length) return fail(res, '目标不存在', 404);

    await query(
      'UPDATE growth_goals SET status = ?, status_changed_at = NOW(), settled_year = COALESCE(?, settled_year) WHERE id = ?',
      [status, settledYear || null, id]
    );

    success(res, { success: true });
});

export const linkEvidence = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { noteId, evidenceType, noteText } = req.body;

  if (!noteId || !evidenceType) {
    return fail(res, 'noteId 和 evidenceType 必填', 400);
  }

    const goal = await query('SELECT id FROM growth_goals WHERE id = ? AND user_id = ?', [id, userId]);
    if (!goal.rows?.length) return fail(res, '目标不存在', 404);

    await query(
      `INSERT INTO growth_evidence (goal_id, note_id, evidence_type, note_text) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE note_text = VALUES(note_text)`,
      [id, noteId, evidenceType, noteText || '']
    );

    success(res, { success: true });
});

export const settleYear = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { year = new Date().getFullYear(), model = 'deepseek-chat', customApiKey, customApiUrl, force = false, lengthMode = '' } = req.body;

  setupSSE(res);

  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  try {
    if (!force) {
      const settled = await query(
        'SELECT COUNT(*) as c FROM growth_goals WHERE user_id = ? AND settled_year = ?',
        [userId, parseInt(year)]
      );
      if (settled.rows?.[0]?.c > 0) {
        sendSSE(res, 'error', { message: `${year}年已结算，使用 force=true 可重新结算` });
        sendSSE(res, 'done', {});
        return;
      }
    }

    sendSSE(res, 'status', { message: '正在读取年度目标与便签...' });

    const goals = await query(
      `SELECT g.* FROM growth_goals g WHERE g.user_id = ? AND (g.settled_year = ? OR (g.raised_at IS NOT NULL AND YEAR(g.raised_at) = ?))
       ORDER BY g.created_at ASC`,
      [userId, parseInt(year), parseInt(year)]
    );
    if (!goals.rows?.length) {
      sendSSE(res, 'error', { message: '该年份无目标可结算' });
      sendSSE(res, 'done', {});
      return;
    }

    const corpus = await getCorpus(userId, { mode: 'range', dateStart: `${year}-01-01`, dateEnd: `${year}-12-31`, limit: 300, perNoteChars: 200 });

    sendSSE(res, 'status', { message: `正在对 ${goals.rows.length} 个目标进行年终结算...` });

    const goalsText = goals.rows.map((g, i) =>
      `#${i + 1} [${g.category || 'other'}] ${g.goal_summary || ''}\n原文: ${(g.goal_text || '').substring(0, 200)}`
    ).join('\n\n');

    const systemPrompt = `你是一位"成长审计师"。基于用户一年的便签语料，判断以下目标的完成状态。

目标列表：
${goalsText}

用户该年便签语料片段（共${corpus.count}篇）：
${corpus.corpusText.substring(0, 6000)}

请用纯JSON返回：
{
  "results": [
    {"goalIndex": 1, "verdict": "achieved|failed|progress", "evidenceNoteIds": [], "comment": "20-60字判断理由"}
  ]
}
verdict: achieved=已达成, failed=明确放弃/未达成, progress=仍在进行中。`;

    const result = await callAi({
      userId, model, customApiKey, customApiUrl,
      systemPrompt, userMessage: `请为${year}年的目标做年终结算。`,
      stream: true, temperature: 0.6, maxTokens: 4096,
      signal: abortController.signal,
      onChunk: (chunk) => sendSSE(res, 'chunk', { content: chunk }),
      lengthMode: lengthMode || undefined
    });

    const parsed = extractJson(result.text);
    if (!parsed?.results) {
      sendSSE(res, 'error', { message: 'AI 返回格式异常' });
      sendSSE(res, 'done', {});
      return;
    }

    const validVerdicts = ['achieved', 'failed', 'progress'];
    let updatedCount = 0;
    for (const r of parsed.results) {
      const goal = goals.rows[r.goalIndex - 1];
      if (!goal) continue;
      const verdict = validVerdicts.includes(r.verdict) ? r.verdict : 'progress';
      await query(
        'UPDATE growth_goals SET status = ?, status_changed_at = NOW(), settled_year = ? WHERE id = ?',
        [verdict, parseInt(year), goal.id]
      );
      for (const eid of (r.evidenceNoteIds || [])) {
        try {
          await query(
            `INSERT INTO growth_evidence (goal_id, note_id, evidence_type, note_text) VALUES (?, ?, 'achieved', ?) ON DUPLICATE KEY UPDATE note_text = VALUES(note_text)`,
            [goal.id, eid, r.comment || '']
          );
        } catch (e) { /* skip invalid noteIds */ }
      }
      updatedCount++;
    }

    sendSSE(res, 'result', { updated: updatedCount, total: goals.rows.length });
    sendSSE(res, 'done', {});
  } catch (err) {
    console.error('[growth] settle error:', err.message);
    if (!res.headersSent) sendSSE(res, 'error', { message: '结算失败: ' + err.message });
    sendSSE(res, 'done', {});
  }
});
