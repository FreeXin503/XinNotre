import { query } from '../config/database.js';
import { getDecryptedKey, logUsage } from '../services/keyService.js';
import { injectLengthToSystemPrompt } from '../services/lengthModeService.js';
import { config } from '../config/index.js';
import { setupSSE, sendSSE } from '../utils/sse.js';
import { success, fail, asyncHandler } from '../utils/response.js';

export const analyzeEmotion = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    model = 'deepseek-chat',
    customApiKey = '',
    customApiUrl = '',
    weekStart = null,
    lengthMode = ''
  } = req.body;

  setupSSE(res);

  try {
    let sql = 'SELECT title, content, category, created_at FROM notes WHERE user_id = ? AND is_deleted = FALSE AND content IS NOT NULL AND LENGTH(content) > 20';
    const params = [userId];

    if (weekStart) {
      const endDate = new Date(weekStart);
      endDate.setDate(endDate.getDate() + 7);
      params.push(weekStart, endDate.toISOString().substring(0, 10));
      sql += ` AND created_at >= ? AND created_at < ?`;
    }

    sql += ` ORDER BY created_at ASC LIMIT 100`;
    const result = await query(sql, params);

    if (!result.rows || result.rows.length === 0) {
      sendSSE(res,'error', { message: '暂无便签数据可供情绪分析' });
      sendSSE(res,'done', {});
      return;
    }

    sendSSE(res,'status', { message: `正在分析 ${result.rows.length} 篇便签的情绪脉络...` });

    const notes = result.rows;
    const corpus = notes.map(n =>
      `[${String(n.created_at || '').substring(0, 10)}] ${n.title}: ${(n.content || '').substring(0, 300)}`
    ).join('\n');

    const systemPrompt = `你是一位温暖的心理倾听师。请分析以下用户的便签日记，生成一份情绪追踪报告。

要求用纯 JSON 格式返回（不要有任何其他文字），格式如下：
{
  "overall_mood": "正面/中性/负面",
  "mood_score": 75,
  "emotions": [
    {"label": "焦虑", "percentage": 25, "trend": "上升/下降/平稳"},
    {"label": "平静", "percentage": 35, "trend": "上升/下降/平稳"},
    {"label": "快乐", "percentage": 20, "trend": "上升/下降/平稳"},
    {"label": "疲惫", "percentage": 15, "trend": "上升/下降/平稳"},
    {"label": "感恩", "percentage": 5, "trend": "上升/下降/平稳"}
  ],
  "insight": "一段温�的，基于便签内容的具体情绪洞察，100-200字",
  "suggestion": "基于当下情绪状态的具体建议，80-150字",
  "weekly_summary": "本周情绪一句话总结"
}

确保 percentage 加起来等于 100。`;

    if (lengthMode) {
      systemPrompt = injectLengthToSystemPrompt(systemPrompt, lengthMode);
    }

    const userMessage = `请分析以下便签日记的情绪：\n${corpus}`;

    const isGemini = model.startsWith('gemini');
    let fullResponse = '';

    if (isGemini) {
      const apiKey = customApiKey || await getDecryptedKey(userId, 'gemini') || config.geminiKey;
      if (!apiKey) throw new Error('未配置 Gemini API Key');

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const bodyPayload = {
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
      };

      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });

      if (!response.ok) throw new Error(`AI 服务异常 (${response.status})`);
      const data = await response.json();
      fullResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      const apiKey = customApiKey || await getDecryptedKey(userId, 'deepseek') || config.deepseekKey;
      const apiUrl = customApiUrl || config.deepseekUrl;
      if (!apiKey) throw new Error('未配置 DeepSeek API Key');

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7,
          max_tokens: 2048
        })
      });

      if (!response.ok) throw new Error(`AI 服务异常 (${response.status})`);
      const data = await response.json();
      fullResponse = data.choices?.[0]?.message?.content || '';
    }

    // Parse JSON from response
    let parsed;
    try {
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      parsed = null;
    }

    if (!parsed) {
      sendSSE(res,'chunk', {
        content: fullResponse,
        raw: true
      });
    } else {
      sendSSE(res,'result', parsed);
    }

    sendSSE(res,'done', {});
  } catch (err) {
    console.error('Emotion analysis error:', err.message);
    sendSSE(res,'error', { message: err.message || '情绪分析失败' });
    sendSSE(res,'done', {});
  }
});

export const getEmotionWeekly = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { weeks = 4 } = req.query;

  const result = await query(
    `SELECT
      DATE_FORMAT(created_at, '%Y-%u') as week_label,
      MIN(created_at) as week_start,
      COUNT(*) as note_count,
      SUM(LENGTH(content)) as total_chars
     FROM notes
     WHERE user_id = ? AND is_deleted = FALSE
       AND created_at >= DATE_SUB(NOW(), INTERVAL ? WEEK)
     GROUP BY week_label
     ORDER BY week_label DESC`,
    [userId, parseInt(weeks)]
  );

  success(res, { weeks: result.rows });
});
