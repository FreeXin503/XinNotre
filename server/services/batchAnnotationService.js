import { callAi, extractJson } from './aiProviderService.js';
import { query } from '../config/database.js';

const runningLocks = new Map();

export async function runBatchAnnotation(opts) {
  const { userId, model = 'deepseek-chat', customApiKey = '', customApiUrl = '',
    taskType, batchSize = 20, maxBatches = 80, signal = null, onProgress = null } = opts;

  if (!userId || !taskType) throw new Error('userId and taskType required');
  if (runningLocks.get(userId)?.has(taskType)) throw new Error('同类标注任务正在进行中');

  // Lock
  if (!runningLocks.has(userId)) runningLocks.set(userId, new Set());
  runningLocks.get(userId).add(taskType);

  const release = () => {
    runningLocks.get(userId)?.delete(taskType);
    if (runningLocks.get(userId)?.size === 0) runningLocks.delete(userId);
  };

  const result = { annotated: 0, skipped: 0, failed: 0, errors: [] };

  try {
    // Determine which notes to annotate (exclude already done)
    const excludeJoin = taskType === 'emotion'
      ? 'LEFT JOIN emotion_weather_grid ewg ON DATE(n.created_at) = ewg.day_date AND ewg.user_id = n.user_id'
      : 'LEFT JOIN growth_goals gg ON n.id = gg.source_note_id AND gg.user_id = n.user_id';
    const excludeWhere = taskType === 'emotion'
      ? 'AND ewg.id IS NULL'
      : 'AND gg.id IS NULL';

    // Count total remaining
    const countResult = await query(
      `SELECT COUNT(*) as total FROM notes n WHERE n.user_id = ? AND n.is_deleted = FALSE AND n.content IS NOT NULL AND LENGTH(n.content) > 20 ${excludeWhere}`,
      [userId]
    );
    const total = countResult.rows?.[0]?.total || 0;
    if (total === 0) {
      onProgress?.({ done: 0, total: 0, phase: '无待标注数据' });
      release();
      return result;
    }

    const totalBatches = Math.min(Math.ceil(total / batchSize), maxBatches);
    let processedTotal = 0;

    for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
      if (signal?.aborted) break;

      onProgress?.({ done: processedTotal, total, phase: `第 ${batchNum + 1}/${totalBatches} 批` });

      const notesResult = await query(
        `SELECT n.id, n.title, n.content, n.category, DATE(n.created_at) as day_date
         FROM notes n ${excludeJoin}
         WHERE n.user_id = ? AND n.is_deleted = FALSE AND n.content IS NOT NULL AND LENGTH(n.content) > 20 ${excludeWhere}
         ORDER BY n.created_at ASC LIMIT ?`,
        [userId, batchSize]
      );

      const notes = notesResult.rows || [];
      if (notes.length === 0) break;

      try {
        const corpus = notes.map(n =>
          `[${n.day_date}] ${n.title}: ${(n.content || '').substring(0, 400)}`
        ).join('\n\n');

        if (taskType === 'emotion') {
          await annotateEmotionBatch(userId, notes, corpus, { model, customApiKey, customApiUrl, signal });
        } else if (taskType === 'goal') {
          await annotateGoalBatch(userId, notes, corpus, { model, customApiKey, customApiUrl, signal });
        }

        result.annotated += notes.length;
        processedTotal += notes.length;
      } catch (batchErr) {
        result.failed += notes.length;
        result.errors.push(`批次 ${batchNum + 1}: ${batchErr.message}`);
      }
    }

    onProgress?.({ done: processedTotal, total, phase: '完成' });
  } catch (err) {
    result.errors.push(err.message);
  } finally {
    release();
  }

  return result;
}

async function annotateEmotionBatch(userId, notes, corpus, opts) {
  const systemPrompt = `你是一位情绪分析师。请为以下每篇便签标注情绪信息。返回纯 JSON 数组：
[
  {
    "noteId": "...",
    "dayDate": "YYYY-MM-DD",
    "moodScore": 0-100,
    "emotionLabel": "joy|calm|anxious|sad|angry|tired|grateful",
    "emotionColor": "#xxxxxx",
    "topWords": ["词1","词2","词3"]
  }
]
moodScore: 0=极负面, 100=极正面, 50=中性。
emotionColor: 按情绪配温馨色。`;

  const userMessage = `请分析以下便签：\n${corpus}`;
  const result = await callAi({ ...opts, systemPrompt, userMessage, stream: false, temperature: 0.3, maxTokens: 4096 });
  const parsed = extractJson(result.text);
  if (!parsed || !Array.isArray(parsed)) throw new Error('AI 返回格式异常');

  for (const item of parsed) {
    if (!item.noteId || !item.dayDate) continue;
    const score = Math.max(0, Math.min(100, item.moodScore || 50));
    await query(
      `INSERT INTO emotion_weather_grid (user_id, day_date, mood_score, emotion_label, emotion_color, top_words, note_count)
       VALUES (?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE mood_score = ROUND((mood_score + VALUES(mood_score)) / 2), note_count = note_count + 1`,
      [userId, item.dayDate, score, item.emotionLabel || 'calm', item.emotionColor || '#6b84a8', JSON.stringify(item.topWords || [])]
    );
  }
}

async function annotateGoalBatch(userId, notes, corpus, opts) {
  const systemPrompt = `你是一位人生规划分析师。请从以下便签中抽取明确的目标、决心、愿望、承诺语句。
返回纯 JSON 数组（空数组为无目标）：
[
  {
    "noteId": "...",
    "goalText": "原文摘录目标语句",
    "goalSummary": "一句话归纳",
    "category": "health|career|learning|relation|life|other",
    "raisedAt": "YYYY-MM-DD"
  }
]`;

  const userMessage = `请从以下便签中抽取目标：\n${corpus}`;
  const result = await callAi({ ...opts, systemPrompt, userMessage, stream: false, temperature: 0.3, maxTokens: 4096 });
  const parsed = extractJson(result.text);
  if (!parsed || !Array.isArray(parsed)) throw new Error('AI 返回格式异常');

  for (const item of parsed) {
    if (!item.noteId || !item.goalText) continue;
    try {
      await query(
        `INSERT INTO growth_goals (user_id, source_note_id, goal_text, goal_summary, category, raised_at, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [userId, item.noteId, item.goalText, item.goalSummary || item.goalText.substring(0, 100), item.category || 'other', item.raisedAt || null]
      );
    } catch (err) {
      if (err.errno !== 1062) throw err; // skip duplicate
    }
  }
}

export async function getAnnotationProgress(userId, taskType) {
  if (!userId) return { done: 0, total: 0, phase: '' };
  try {
    if (taskType === 'emotion') {
      const total = await query('SELECT COUNT(*) as c FROM notes WHERE user_id=? AND is_deleted=FALSE AND content IS NOT NULL', [userId]);
      const done = await query('SELECT COUNT(DISTINCT day_date) as c FROM emotion_weather_grid WHERE user_id=?', [userId]);
      return { done: done.rows?.[0]?.c || 0, total: total.rows?.[0]?.c || 0, phase: '' };
    }
    if (taskType === 'goal') {
      const total = await query('SELECT COUNT(*) as c FROM notes WHERE user_id=? AND is_deleted=FALSE AND content IS NOT NULL', [userId]);
      const done = await query('SELECT COUNT(DISTINCT source_note_id) as c FROM growth_goals WHERE user_id=?', [userId]);
      return { done: done.rows?.[0]?.c || 0, total: total.rows?.[0]?.c || 0, phase: '' };
    }
  } catch (e) { /* silent */ }
  return { done: 0, total: 0, phase: '' };
}
