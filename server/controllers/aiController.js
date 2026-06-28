import { query } from '../config/database.js';
import { hybridRetrieve, buildContextText } from '../services/retrievalService.js';

import { injectLengthToSystemPrompt, getLengthMaxTokens } from '../services/lengthModeService.js';

import { setupSSE, sendSSE } from '../utils/sse.js';
import { success, fail, asyncHandler } from '../utils/response.js';
import { callAi } from '../services/aiProviderService.js';

export const chatStream = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    messages = [],
    model = 'deepseek-chat',
    contextMode = 'all', // 'all' (RAG), 'category', 'note', 'kb', 'none'
    currentNoteId = null,
    currentCategory = null,
    currentKbId = null,
    customApiKey = '',
    customApiUrl = '',
    systemInstruction: clientSystemInstruction = '',
    lengthMode = ''
  } = req.body;

  // Set SSE Headers
  setupSSE(res);

  try {
    // 1. Gather RAG Context
    let memoryFragments = [];
    let systemInstruction = clientSystemInstruction || "你是一个能够共情的个人知识助理和灵魂伴侣。基于用户的便签进行辅助回答。";

    const userMessages = messages.filter(m => m.role === 'user');
    const searchQuery = userMessages.length > 0 ? userMessages[userMessages.length - 1].content : '';

    if (contextMode === 'note' && currentNoteId) {
      const noteRes = await query('SELECT title, content FROM notes WHERE id = ? AND user_id = ?', [currentNoteId, userId]);
      if (noteRes.rows.length > 0) {
        const note = noteRes.rows[0];
        memoryFragments.push(`【当前便签：${note.title}】\n${note.content}`);
      }
    } else if (contextMode === 'category' && currentCategory) {
      const notesRes = await query(
        'SELECT title, LEFT(content, 800) as snippet FROM notes WHERE user_id = ? AND category = ? AND is_deleted = FALSE LIMIT 10',
        [userId, currentCategory]
      );
      notesRes.rows.forEach(note => {
        memoryFragments.push(`【便签：${note.title}】\n${note.snippet}...`);
      });
    } else if (contextMode === 'kb' && currentKbId) {
      const kbRes = await query('SELECT name FROM knowledge_bases WHERE id = ? AND user_id = ?', [currentKbId, userId]);
      if (kbRes.rows.length > 0) {
        const kbName = kbRes.rows[0].name;
        const notesRes = await query(
          `SELECT n.title, LEFT(n.content, 1200) as snippet
           FROM knowledge_base_notes kbn
           JOIN notes n ON n.id = kbn.note_id
           WHERE kbn.kb_id = ? AND n.user_id = ? AND n.is_deleted = FALSE
           ORDER BY kbn.sort_order ASC, kbn.added_at DESC
           LIMIT 20`,
          [currentKbId, userId]
        );
        memoryFragments.push(`【知识库：${kbName}】`);
        notesRes.rows.forEach(note => {
          memoryFragments.push(`【便签：${note.title}】\n${note.snippet}...`);
        });
      }
    } else if (searchQuery) {
      // Hybrid retrieval: vector + FTS + time decay
      const results = await hybridRetrieve(userId, searchQuery, 8);
      results.forEach((r, i) => {
        memoryFragments.push(`【便签记忆＃${i + 1}：${r.payload?.title || ''}】\n${(r.content || '').substring(0, 1200)}`);
      });
    }

    // Construct final prompt injection
    if (memoryFragments.length > 0) {
      systemInstruction += `\n\n【背景关联记忆碎片】\n以下是你检索到的用户相关便签片段，请结合这些真实的背景便签内容，给予共情、高度个性化且具有启发性的回复。请注意隐私：\n${memoryFragments.join('\n\n')}`;
    }

    // Inject length mode into system instruction
    if (lengthMode) {
      const lengthTokens = getLengthMaxTokens(lengthMode);
      systemInstruction = injectLengthToSystemPrompt(systemInstruction, lengthMode);
    }

    // 2. Route request via aiProviderService (handles Gemini/DeepSeek routing internally)
    const lastUserMsg = messages.filter(m => m.role === 'user').pop();
    const promptText = lastUserMsg ? lastUserMsg.content : '';
    const historyMsgs = messages.filter(m => m !== lastUserMsg);
    const historyText = historyMsgs.length > 0
      ? historyMsgs.map(m => `${m.role === 'user' ? '用户' : '助手'}：${m.content}`).join('\n\n---\n\n')
      : '';

    const userMessage = historyText
      ? `【对话历史】\n${historyText}\n\n【当前消息】\n${promptText}`
      : promptText;

    const abortController = new AbortController();
    req.on('close', () => abortController.abort());

    await callAi({
      userId, model, customApiKey, customApiUrl,
      systemPrompt: systemInstruction,
      userMessage,
      stream: true,
      temperature: 0.7,
      maxTokens: lengthMode ? getLengthMaxTokens(lengthMode) : undefined,
      signal: abortController.signal,
      onChunk: (delta) => {
        if (delta) sendSSE(res, 'chunk', { content: delta });
      }
    });

    sendSSE(res, 'done', {});
  } catch (err) {
    console.error('❌ AI Soul dialogue error:', err.message);
    sendSSE(res, 'error', { message: 'AI service error, please try again later' });
  } finally {
    res.end();
  }
});
