import { query } from '../../config/database.js';
import { config } from '../../config/index.js';

const ALLOWED_FIELDS = new Set(['topicVectors', 'emotionHistogram', 'anonBodies']);
const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024;

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw Object.assign(new Error('无效的匿名payload'), { statusCode: 400 });
  }
  const keys = Object.keys(payload);
  for (const k of keys) {
    if (!ALLOWED_FIELDS.has(k)) {
      throw Object.assign(new Error(`非法字段: ${k}`), { statusCode: 400 });
    }
  }
  if (!Array.isArray(payload.topicVectors)) {
    throw Object.assign(new Error('topicVectors 必须是数组'), { statusCode: 400 });
  }
  if (!payload.emotionHistogram || typeof payload.emotionHistogram !== 'object') {
    throw Object.assign(new Error('emotionHistogram 必须是对象'), { statusCode: 400 });
  }
  if (!Array.isArray(payload.anonBodies)) {
    throw Object.assign(new Error('anonBodies 必须是数组'), { statusCode: 400 });
  }
  const serialized = JSON.stringify(payload);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_PAYLOAD_SIZE) {
    throw Object.assign(new Error('payload 超过 10MB 限制'), { statusCode: 413 });
  }
}

export async function joinSession(sessionId, userId, anonymousPayload) {
  if (!config.aggregate?.enabled) {
    throw Object.assign(new Error('聚合功能未启用'), { statusCode: 403 });
  }

  if (!sessionId || typeof sessionId !== 'string') {
    throw Object.assign(new Error('缺少 sessionId'), { statusCode: 400 });
  }

  validatePayload(anonymousPayload);

  const existing = await query(
    'SELECT id, payload_json, participant_count FROM aggregate_sessions WHERE session_id = ? AND user_id = ?',
    [sessionId, userId]
  );

  let participantCount;
  if (existing.rows.length > 0) {
    await query(
      'UPDATE aggregate_sessions SET payload_json = ? WHERE session_id = ? AND user_id = ?',
      [JSON.stringify(anonymousPayload), sessionId, userId]
    );
  } else {
    await query(
      'INSERT INTO aggregate_sessions (session_id, user_id, payload_json) VALUES (?, ?, ?)',
      [sessionId, userId, JSON.stringify(anonymousPayload)]
    );
  }

  const countResult = await query(
    'SELECT COUNT(DISTINCT user_id) AS cnt FROM aggregate_sessions WHERE session_id = ?',
    [sessionId]
  );
  participantCount = countResult.rows[0]?.cnt || 1;

  return { sessionId, participantCount };
}

export async function getAggregateResult(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') {
    throw Object.assign(new Error('缺少 sessionId'), { statusCode: 400 });
  }

  const rows = await query(
    'SELECT payload_json, user_id FROM aggregate_sessions WHERE session_id = ? ORDER BY created_at ASC',
    [sessionId]
  );

  if (rows.rows.length === 0) {
    throw Object.assign(new Error('聚合会话不存在'), { statusCode: 404 });
  }

  const allPayloads = rows.rows.map(r => {
    try { return { userId: r.user_id, ...JSON.parse(r.payload_json) }; }
    catch { return null; }
  }).filter(Boolean);

  const n = allPayloads.length;
  if (n === 0) {
    throw Object.assign(new Error('无可用的聚合数据'), { statusCode: 500 });
  }

  const dims = allPayloads[0].topicVectors?.[0]?.length || 0;

  const avgTopicVectors = allPayloads[0].topicVectors.map((_, ti) => {
    const vec = allPayloads[0].topicVectors[ti] || [];
    if (dims === 0) return [];
    const avg = new Array(dims).fill(0);
    for (const p of allPayloads) {
      const v = p.topicVectors?.[ti] || new Array(dims).fill(0);
      for (let d = 0; d < dims; d++) {
        avg[d] += (v[d] || 0) / n;
      }
    }
    return avg;
  });

  const emotionBuckets = ['焦虑', '平静', '忧郁', '兴奋', '愤怒', '悲伤', '恐惧', '喜悦'];
  const mergedEmotion = {};
  for (const bucket of emotionBuckets) {
    let sum = 0;
    for (const p of allPayloads) {
      sum += p.emotionHistogram?.[bucket] || 0;
    }
    mergedEmotion[bucket] = sum;
  }

  const personFreq = {};
  for (const p of allPayloads) {
    for (const body of (p.anonBodies || [])) {
      const label = body.anonLabel || body.label;
      if (label) {
        personFreq[label] = (personFreq[label] || 0) + 1;
      }
    }
  }

  const groupGalaxy = {
    participantCount: n,
    avgTopicVectors,
    emotionHistogram: mergedEmotion,
    personFrequency: Object.entries(personFreq)
      .map(([label, count]) => ({ label, count, frequency: count / n }))
      .sort((a, b) => b.count - a.count),
    generatedAt: new Date().toISOString()
  };

  return { groupGalaxy, participantCount: n };
}
