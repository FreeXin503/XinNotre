import { query } from '../../config/database.js';
import { analyzeDeepBelief } from './nlpDeepService.js';

export async function checkBelief(userId, beliefText) {
  if (!beliefText || typeof beliefText !== 'string') {
    throw Object.assign(new Error('缺少信念文本'), { statusCode: 400 });
  }

  const truncated = beliefText.length > 200
    ? beliefText.substring(0, 200)
    : beliefText;

  const result = await analyzeDeepBelief(userId, truncated);

  const scores = result.scores;
  const risk = result.risk;
  const alternatives = result.alternatives;
  const rawAnalysis = result.rawAnalysis;

  await query(
    'INSERT INTO belief_checks (user_id, belief_text, scores_json, risk, alternatives_json, raw_analysis) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, truncated, JSON.stringify(scores), risk, JSON.stringify(alternatives), rawAnalysis]
  );

  return {
    beliefText: truncated,
    scores,
    risk,
    alternatives,
    rawAnalysis,
    checkedAt: new Date().toISOString()
  };
}

export async function getBeliefHistory(userId, limit = 20) {
  const rows = await query(
    'SELECT id, belief_text, scores_json, risk, alternatives_json, created_at FROM belief_checks WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, Math.min(limit, 100)]
  );

  return rows.rows.map(r => ({
    id: r.id,
    beliefText: r.belief_text,
    scores: JSON.parse(r.scores_json || '{}'),
    risk: r.risk,
    alternatives: JSON.parse(r.alternatives_json || '[]'),
    checkedAt: r.created_at
  }));
}
