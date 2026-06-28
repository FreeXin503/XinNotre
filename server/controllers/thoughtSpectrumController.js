/**
 * 心迹星图 思想谱系星图 · Controller
 * 职责：生成思想谱系快照、管理课题演化追踪、查询历史数据
 *
 * SSE 端点:
 *   POST /api/thought-spectrum/generate — 生成当期思想谱系
 * 普通端点:
 *   GET  /api/thought-spectrum/history — 历史快照列表
 *   GET  /api/thought-spectrum/evolution?topicId= — 课题演变曲线
 *   POST /api/thought-spectrum/topics — 管理课题
 */
import { query } from '../config/database.js';
import { callAi, extractJson } from '../services/aiProviderService.js';
import { getCorpus } from '../services/corpusService.js';
import { getLengthMaxTokens } from '../services/lengthModeService.js';
import crypto from 'crypto';
import { setupSSE, sendSSE } from '../utils/sse.js';
import { success, fail, asyncHandler } from '../utils/response.js';

// ── 1. POST /api/thought-spectrum/generate (SSE) ───────

/**
 * 生成当期思想谱系快照
 *
 * 请求体: { model?: string, force?: boolean, lengthMode?: 'short'|'medium'|'long' }
 *
 * SSE 事件:
 *   status → chunk → result { snapshotId, versionTag, alignment, ... } → done
 */
export const generateThoughtSpectrum = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { model = 'deepseek-chat', force = false, lengthMode = '' } = req.body || {};

  setupSSE(res);
  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  try {
    // 1. 检查最近是否已生成（冷却 24 小时，除非 force=true）
    if (!force) {
      const recent = await query(
        'SELECT id, version_tag FROM thought_spectrum_snapshots WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) LIMIT 1',
        [userId]
      );
      if (recent.rows.length > 0) {
        sendSSE(res, 'result', {
          cached: true,
          snapshotId: recent.rows[0].id,
          versionTag: recent.rows[0].version_tag,
          message: '24 小时内已生成，使用最近快照'
        });
        sendSSE(res, 'done', {});
        return res.end();
      }
    }

    sendSSE(res, 'status', { message: '正在读取近期日记语料...' });

    // 2. 获取语料
    const corpus = await getCorpus(userId, { mode: 'all', limit: 200, perNoteChars: 300 });
    if (!corpus.notes || corpus.notes.length < 10) {
      sendSSE(res, 'result', { error: '语料不足', message: '至少需要 10 篇便签才能生成思想谱系' });
      sendSSE(res, 'done', {});
      return res.end();
    }

    const noteCount = corpus.notes.length;
    const corpusHash = crypto.createHash('sha256').update(corpus.corpusText).digest('hex');
    const versionTag = getWeekVersionTag();

    // 3. 查询上一期快照（用于漂移计算）
    const prevSnapshot = await query(
      'SELECT id, alignment_json FROM thought_spectrum_snapshots WHERE user_id = ? AND id != (SELECT COALESCE(MAX(id),0) FROM thought_spectrum_snapshots WHERE user_id = ?) ORDER BY created_at DESC LIMIT 1',
      [userId, userId]
    );
    const prevAlignment = prevSnapshot.rows.length > 0
      ? tryParseJSON(prevSnapshot.rows[0].alignment_json)
      : null;

    // 4. 截断语料到 8000 字
    const corpusText = corpus.corpusText.substring(0, 8000);

    sendSSE(res, 'status', { message: `正在分析 ${noteCount} 篇日记的思想谱系...` });

    // 5. AI 谱系对齐分析
    const maxTokens = lengthMode ? getLengthMaxTokens(lengthMode) : 4096;

    const systemPrompt = SPECTRUM_SYSTEM_PROMPT;

    let userPrompt = `请分析以下用户的日记语料，将其思想映射到思想家库——\n\n${corpusText}`;
    if (prevAlignment && Array.isArray(prevAlignment.thinkerAlignment)) {
      userPrompt += `\n\n参考上期对齐数据（用于计算思想漂移）：\n${JSON.stringify(prevAlignment, null, 2)}`;
    }

    const aiResult = await callAi({
      userId,
      model,
      systemPrompt,
      userMessage: userPrompt,
      stream: true,
      temperature: 0.4,
      maxTokens,
      signal: abortController.signal,
      onChunk: (delta) => {
        if (delta) {
          sendSSE(res, 'chunk', { content: delta });
        }
      }
    });

    // 6. 解析 AI 输出
    const fullText = aiResult.text || '';
    const parsed = extractJson(fullText);

    if (!parsed || !parsed.spectrum) {
      sendSSE(res, 'error', { message: 'AI 分析结果格式异常，请重试' });
      return res.end();
    }

    // 7. 构建 dominant_tradition 字符串
    const center = parsed.constellationCenter || {};
    const dominantTradition = center.primaryTradition
      ? `${center.primaryTradition}${center.primaryPercentage || ''}%` +
        (center.secondaryTraditions || []).map(s => `·${s.name}${s.percentage}%`).join('')
      : '';

    // 8. 写入数据库
    const alignmentJson = JSON.stringify(parsed);
    const insertResult = await query(
      `INSERT INTO thought_spectrum_snapshots (user_id, version_tag, corpus_hash, note_count, alignment_json, dominant_tradition)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, versionTag, corpusHash, noteCount, alignmentJson, dominantTradition]
    );
    const snapshotId = insertResult.rows.insertId;

    // 9. 处理话题演变
    if (parsed.topics && Array.isArray(parsed.topics)) {
      for (const topic of parsed.topics) {
        if (!topic.topicName) continue;
        // upsert 话题
        await query(
          'INSERT INTO thought_topics (user_id, topic_name) VALUES (?, ?) ON DUPLICATE KEY UPDATE is_active = TRUE',
          [userId, topic.topicName]
        );
        const topicRes = await query(
          'SELECT id FROM thought_topics WHERE user_id = ? AND topic_name = ?',
          [userId, topic.topicName]
        );
        const topicId = topicRes.rows[0]?.id;
        if (topicId) {
          await query(
            `INSERT INTO topic_evolution_points (topic_id, spectrum_snapshot_id, stance_label, stance_score, evidence_note_ids, evolution_vector)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE stance_label = VALUES(stance_label), stance_score = VALUES(stance_score)`,
            [
              topicId, snapshotId,
              topic.stanceLabel || '', topic.stanceScore ?? 0,
              JSON.stringify(topic.evidenceNoteIds || []),
              topic.evolutionVector || 'stable'
            ]
          );
        }
      }
    }

    // 10. 计算 drift
    let drift = {};
    if (prevAlignment && Array.isArray(prevAlignment.thinkerAlignment)) {
      const prevMap = new Map(prevAlignment.thinkerAlignment.map(t => [t.thinkerId, t.resonanceScore || 0]));
      const biggestShifts = (parsed.spectrum || [])
        .map(curr => {
          const prevScore = prevMap.get(curr.thinkerId) || 0;
          const delta = (curr.resonanceScore || 0) - prevScore;
          return { thinkerId: curr.thinkerId, scoreDelta: Math.round(delta * 10) / 10 };
        })
        .sort((a, b) => Math.abs(b.scoreDelta) - Math.abs(a.scoreDelta))
        .slice(0, 5);

      drift = {
        fromVersionTag: prevSnapshot.rows[0].version_tag,
        biggestShifts,
        overallNarrative: parsed.drift?.overallNarrative || ''
      };
    }

    sendSSE(res, 'result', {
      snapshotId,
      versionTag,
      alignment: parsed,
      constellationCenter: center,
      drift,
      noteCount
    });
    sendSSE(res, 'done', {});
  } catch (err) {
    console.error('[thoughtSpectrum] generate error:', err.message);
    sendSSE(res, 'error', { message: '谱系分析失败: ' + err.message });
  } finally {
    res.end();
  }
});

// ── 2. GET /api/thought-spectrum/history ────────────────

/**
 * 获取历史快照列表
 */
export const listThoughtSpectrum = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const result = await query(
    `SELECT id, version_tag, note_count, dominant_tradition, created_at
     FROM thought_spectrum_snapshots
     WHERE user_id = ?
     ORDER BY created_at DESC LIMIT 50`,
    [userId]
  );
  success(res, { snapshots: result.rows });
});

// ── 3. GET /api/thought-spectrum/evolution ──────────────

/**
 * 获取某个课题的认知演变曲线
 */
export const getTopicEvolution = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const topicId = req.query.topicId;
  const limit = Math.min(parseInt(req.query.limit) || 12, 50);

  if (!topicId) {
    const topics = await query(
      'SELECT id, topic_name FROM thought_topics WHERE user_id = ? AND is_active = TRUE ORDER BY topic_name',
      [userId]
    );
    return success(res, { topics: topics.rows });
  }

  const topicResult = await query(
    'SELECT id, topic_name FROM thought_topics WHERE id = ? AND user_id = ?',
    [topicId, userId]
  );
  if (topicResult.rows.length === 0) {
    return fail(res, 'Topic not found', 404);
  }

  const points = await query(
    `SELECT ep.id, ep.stance_label, ep.stance_score, ep.evolution_vector, ep.recorded_at,
            ss.version_tag
     FROM topic_evolution_points ep
     JOIN thought_spectrum_snapshots ss ON ss.id = ep.spectrum_snapshot_id
     WHERE ep.topic_id = ?
     ORDER BY ep.recorded_at ASC
     LIMIT ?`,
    [topicId, limit]
  );

  success(res, {
    topic: topicResult.rows[0],
    points: points.rows
  });
});

// ── 4. POST /api/thought-spectrum/topics ────────────────

/**
 * 管理用户关注的课题
 * 请求体: { action: 'add'|'remove'|'list', topicName?: string }
 */
export const manageTopics = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { action, topicName } = req.body || {};

  if (action === 'add') {
    if (!topicName || !topicName.trim()) {
      return fail(res, 'topicName is required', 400);
    }
    await query(
      'INSERT INTO thought_topics (user_id, topic_name) VALUES (?, ?) ON DUPLICATE KEY UPDATE is_active = TRUE',
      [userId, topicName.trim()]
    );
    const result = await query(
      'SELECT id, topic_name FROM thought_topics WHERE user_id = ? AND topic_name = ?',
      [userId, topicName.trim()]
    );
    return success(res, { topic: result.rows[0] || null });
  }

  if (action === 'remove') {
    if (!topicName && !req.body.topicId) {
      return fail(res, 'topicName or topicId required', 400);
    }
    if (topicName) {
      await query('UPDATE thought_topics SET is_active = FALSE WHERE user_id = ? AND topic_name = ?', [userId, topicName.trim()]);
    } else if (req.body.topicId) {
      await query('UPDATE thought_topics SET is_active = FALSE WHERE user_id = ? AND id = ?', [userId, req.body.topicId]);
    }
    return success(res, { message: 'Topic removed' });
  }

  // action === 'list' (默认)
  const topics = await query(
    'SELECT id, topic_name, created_at FROM thought_topics WHERE user_id = ? AND is_active = TRUE ORDER BY topic_name',
    [userId]
  );
  success(res, { topics: topics.rows });
});

// ── 工具函数 ────────────────────────────────────────────

function tryParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * 获取 ISO 周版本标签，如 "2026-W26"
 * @returns {string}
 */
function getWeekVersionTag() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now - startOfYear) / 86400000);
  const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ── 常量：谱系分析 Prompt ──────────────────────────────

const SPECTRUM_SYSTEM_PROMPT = `你是一位比较哲学与认知心理学专家。你需要在哲学思想的光谱上定位用户的思维模式。

## 参考思想家库 (部分，每次取最匹配的 10-20 位输出)

斯多葛学派: 马可·奥勒留, 塞涅卡, 爱比克泰德
存在主义: 萨特, 加缪, 克尔凯郭尔, 尼采
东方哲学: 孔子, 老子, 庄子, 王阳明, 慧能, 孟子
实用主义: 威廉·詹姆斯, 杜威, 理查德·罗蒂
分析哲学: 维特根斯坦, 罗素, 奎因
后现代: 福柯, 德里达, 德勒兹
政治哲学: 汉娜·阿伦特, 约翰·罗尔斯, 以赛亚·伯林
伦理学: 康德, 边沁, 亚里士多德, 西蒙娜·薇依
浪漫主义: 卢梭, 歌德, 泰戈尔
批判理论: 马克思, 阿多诺, 马尔库塞

## 分析要求
- 从日记语料中提取用户的底层价值观、论证方式、情绪倾向
- 与上述思想家进行思想共振评分 (0-100)
- 识别用户当前思维的重心传统 (constellationCenter)
- 检测用户对某些话题 (财富、关系、事业等) 的立场变化

## 输出格式 (纯 JSON，不要包含任何其他文字)
{
  "spectrum": [
    {
      "thinkerId": "socrates",
      "displayName": "苏格拉底",
      "era": "古希腊",
      "resonanceScore": 78,
      "dominantDimension": "ethics",
      "snippetMatch": "用户原文中的一句话(≤80字)"
    }
  ],
  "constellationCenter": {
    "primaryTradition": "斯多葛学派",
    "primaryPercentage": 45,
    "secondaryTraditions": [{"name":"存在主义","percentage":30}, {"name":"禅宗","percentage":25}]
  },
  "topics": [
    {
      "topicName": "财富观",
      "stanceLabel": "现实主义乐观",
      "stanceScore": 45,
      "evidenceNoteIds": [],
      "evolutionVector": "stable"
    }
  ],
  "drift": {
    "overallNarrative": "100-200字的思想演变分析"
  }
}`;
