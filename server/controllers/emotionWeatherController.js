import { query } from '../config/database.js';
import { callAi, extractJson } from '../services/aiProviderService.js';
import { runBatchAnnotation, getAnnotationProgress } from '../services/batchAnnotationService.js';
import { setupSSE, sendSSE } from '../utils/sse.js';
import { success, fail, asyncHandler } from '../utils/response.js';

const activeAnnotations = new Map();

export const startAnnotation = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { model, customApiKey, customApiUrl, force } = req.body;

  setupSSE(res);

  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  if (activeAnnotations.get(userId)?.emotion) {
    sendSSE(res, 'error', { message: '情绪标注已在运行中' });
    sendSSE(res, 'done', {});
    return;
  }

  activeAnnotations.set(userId, { ...activeAnnotations.get(userId), emotion: true });

  try {
    const result = await runBatchAnnotation({
      userId, model, customApiKey, customApiUrl,
      taskType: 'emotion', batchSize: 20, maxBatches: 80,
      signal: abortController.signal,
      onProgress: (p) => sendSSE(res, 'progress', p)
    });

    sendSSE(res, 'result', result);
  } catch (err) {
    sendSSE(res, 'error', { message: err.message });
  } finally {
    activeAnnotations.set(userId, { ...activeAnnotations.get(userId), emotion: false });
    sendSSE(res, 'done', {});
  }
});

export const getWeatherGrid = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { year = new Date().getFullYear(), layer = 'emotion' } = req.query;

    const rows = await query(
      `SELECT day_date, mood_score, emotion_label, emotion_color, top_words, note_count
       FROM emotion_weather_grid
       WHERE user_id = ? AND YEAR(day_date) = ?
       ORDER BY day_date ASC`,
      [userId, parseInt(year)]
    );

    const days = (rows.rows || []).map(r => ({
      date: String(r.day_date || ''),
      score: r.mood_score,
      label: r.emotion_label || null,
      color: layer === 'note_count' ? null : (r.emotion_color || null),
      noteCount: r.note_count || 0
    }));

    const legend = [
      { label: 'joy', color: '#f5c542', range: [80, 100] },
      { label: 'calm', color: '#4ed8ff', range: [60, 80] },
      { label: 'tired', color: '#8ba4c8', range: [40, 60] },
      { label: 'anxious', color: '#8366f1', range: [20, 40] },
      { label: 'sad', color: '#ff6b8a', range: [0, 20] }
    ];

    success(res, { year: parseInt(year), layer, days, legend });

});

export const getClimateDiagnosis = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { year = new Date().getFullYear(), model = 'deepseek-chat', customApiKey, customApiUrl, lengthMode = '' } = req.body;

  setupSSE(res);

  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  try {
    const rows = await query(
      `SELECT day_date, mood_score, emotion_label FROM emotion_weather_grid
       WHERE user_id = ? AND YEAR(day_date) = ? AND mood_score IS NOT NULL
       ORDER BY day_date ASC`,
      [userId, parseInt(year)]
    );

    const days = rows.rows || [];
    if (days.length < 14) {
      // Local-only diagnosis
      sendSSE(res, 'result', { plumRains: [], harvests: [], narrative: days.length < 14 ? '数据不足，至少需要14天标注数据才能进行气候诊断' : '' });
      sendSSE(res, 'done', {});
      return;
    }

    // Local analysis: find consecutive low/high periods
    const plumRains = [];
    const harvests = [];
    let lowRun = [], highRun = [];

    for (const d of days) {
      if ((d.mood_score || 50) < 40) {
        lowRun.push(d);
        highRun = [];
        if (lowRun.length >= 14 && lowRun.length % 7 === 0) {
          plumRains.push({ start: lowRun[0].day_date, end: d.day_date, avgScore: Math.round(lowRun.reduce((s, x) => s + (x.mood_score || 50), 0) / lowRun.length) });
        }
      } else if ((d.mood_score || 50) > 70) {
        highRun.push(d);
        lowRun = [];
        if (highRun.length >= 7 && highRun.length % 3 === 0) {
          harvests.push({ start: highRun[0].day_date, end: d.day_date, avgScore: Math.round(highRun.reduce((s, x) => s + (x.mood_score || 50), 0) / highRun.length) });
        }
      } else {
        lowRun = []; highRun = [];
      }
    }

    // Try AI for narrative
    try {
      const dataStr = days.slice(0, 100)
        .map(d => `${d.day_date}: score=${d.mood_score} label=${d.emotion_label}`).join('\n');
      const systemPrompt = `基于以下一年的情绪数据，识别出用户的"梅雨季"(持续低潮期)和"丰收季"(持续高能期)。请用纯JSON返回：
{
  "narrative": "一份温暖、有洞察的气候分析，80-150字"
}`;
      const result = await callAi({ userId, model, customApiKey, customApiUrl, systemPrompt, userMessage: dataStr, stream: false, temperature: 0.7, maxTokens: 512, signal: abortController.signal, lengthMode: lengthMode || undefined });
      const parsed = extractJson(result.text);
      if (parsed?.narrative) {
        sendSSE(res, 'result', { plumRains: plumRains.slice(0, 5), harvests: harvests.slice(0, 5), narrative: parsed.narrative });
        sendSSE(res, 'done', {});
        return;
      }
    } catch (e) { /* fall through */ }

    sendSSE(res, 'result', { plumRains: plumRains.slice(0, 5), harvests: harvests.slice(0, 5), narrative: '基于情绪数据的周期分析完成。' });
    sendSSE(res, 'done', {});
  } catch (err) {
    console.error('[weather] diagnosis error:', err.message);
    sendSSE(res, 'error', { message: '气候诊断失败' });
    sendSSE(res, 'done', {});
  }
});
