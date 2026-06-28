import { query } from '../config/database.js';
import { logUsage } from '../services/keyService.js';
import { injectLengthToSystemPrompt, getLengthMaxTokens } from '../services/lengthModeService.js';
import { setupSSE, sendSSE } from '../utils/sse.js';
import { success, fail, asyncHandler } from '../utils/response.js';
import { callAi } from '../services/aiProviderService.js';

export const generateReport = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    scope = 'yearly',
    year = new Date().getFullYear(),
    month = null,
    model = 'deepseek-chat',
    customApiKey = '',
    customApiUrl = '',
    lengthMode = ''
  } = req.body;

  setupSSE(res);

  try {
    let sql = 'SELECT title, content, category, created_at FROM notes WHERE user_id = ? AND is_deleted = FALSE';
    const params = [userId];

    if (scope === 'yearly' || scope === 'monthly') {
      params.push(`${year}%`);
      sql += ` AND created_at LIKE ?`;
    }

    if (scope === 'monthly' && month) {
      const monthStr = String(month).padStart(2, '0');
      params.push(`${year}-${monthStr}%`);
      sql += ` AND created_at LIKE ?`;
    }

    sql += ' ORDER BY created_at ASC LIMIT 800';

    const result = await query(sql, params);
    if (!result.rows || result.rows.length === 0) {
      sendSSE(res,'error', { message: '暂无便签数据可生成报告' });
      sendSSE(res,'done', {});
      return;
    }

    sendSSE(res,'status', { message: `已加载 ${result.rows.length} 篇便签，正在生成报告...` });

    const notes = result.rows;
    const totalWords = notes.reduce((sum, n) => sum + (n.content?.length || 0), 0);
    const categories = [...new Set(notes.map(n => n.category))];

    const sortedByLength = [...notes].sort((a, b) => (b.content?.length || 0) - (a.content?.length || 0));
    const sampleNotes = [notes[0], notes[Math.floor(notes.length / 3)], notes[Math.floor(notes.length * 2 / 3)], notes[notes.length - 1], ...sortedByLength.slice(0, 3)]
      .filter((v, i, a) => a.findIndex(t => t.title === v.title) === i);

    const sampleText = sampleNotes.map(n =>
      `【${String(n.created_at || '').substring(0, 10)} | ${n.category || '未知'}】${n.title}\n${(n.content || '').substring(0, 500)}`
    ).join('\n\n---\n\n');

    const scopeLabel = scope === 'monthly' ? `${year}年${month}月` : `${year}年度`;

    const systemPrompt = `你是一位深情的"数字人生记录官"，像 Spotify 年度歌单和支付宝年度账单那样，为用户生成一份极具感染力、有温度的 ${scopeLabel} 个人数字人生报告。
背景数据：
- 时间范围：${String(notes[0].created_at || '').substring(0, 10)} ~ ${String(notes[notes.length - 1].created_at || '').substring(0, 10)}
- 总便签数：${notes.length} 篇
- 总字数约：${totalWords.toLocaleString()} 字
- 分类目录：${categories.join('、')}
以下是抽取的代表性便签片段，你可以从中感知用户这一年/月的生活状态、情绪变化和成长轨迹：
${sampleText}
请用优美、富有情感的中文，生成一份包含以下板块的报告（用 Markdown 格式）：
1. **📊 数据总览**
2. **🌟 年度关键词** — 3-5个核心关键词
3. **🎭 情感曲线**
4. **🏆 高光时刻** — 3-5个
5. **🌙 深夜独白**
6. **📈 成长轨迹**
7. **💫 新年寄语**`;

    if (lengthMode) {
      systemPrompt = injectLengthToSystemPrompt(systemPrompt, lengthMode);
    }

    const userMessage = `请为我生成一份 ${scopeLabel} 个人数字人生报告。`;

    const abortController = new AbortController();
    req.on('close', () => abortController.abort());

    const aiResult = await callAi({
      userId, model, customApiKey, customApiUrl,
      systemPrompt,
      userMessage,
      stream: true,
      temperature: 0.9,
      maxTokens: lengthMode ? getLengthMaxTokens(lengthMode) : undefined,
      signal: abortController.signal,
      onChunk: (delta) => {
        if (delta) sendSSE(res, 'chunk', { content: delta });
      }
    });

    const responseText = aiResult.text || '';
    const provider = aiResult.provider;

    logUsage(userId, provider, model, systemPrompt.length + userMessage.length, responseText.length);

    await query(
      'INSERT INTO ai_reports (user_id, scope, year, month, content, word_count) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, scope, year, month || null, responseText, responseText.length]
    );

    sendSSE(res,'done', {});
  } catch (err) {
    console.error('Report generation error:', err.message);
    sendSSE(res,'error', { message: err.message || '报告生成失败' });
    sendSSE(res,'done', {});
  }
});

export const getReportHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const result = await query(
    'SELECT * FROM ai_reports WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
    [userId]
  );
  success(res, { reports: result.rows });
});
