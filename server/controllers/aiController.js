import { query } from '../config/database.js';

// DeepSeek default credentials
const DEFAULT_DEEPSEEK_KEY = process.env.DEEPSEEK_KEY || '';
const DEFAULT_DEEPSEEK_URL = process.env.DEEPSEEK_URL || 'https://api.deepseek.com/chat/completions';

// Gemini default credentials
const DEFAULT_GEMINI_KEY = process.env.GEMINI_KEY || '';

export async function chatStream(req, res) {
  const userId = req.user.id;
  const {
    messages = [],
    model = 'deepseek-chat',
    contextMode = 'all', // 'all' (RAG), 'category', 'note', 'none'
    currentNoteId = null,
    currentCategory = null,
    customApiKey = '',
    customApiUrl = '',
    systemInstruction: clientSystemInstruction = ''
  } = req.body;

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // 1. Gather RAG Context
    let memoryFragments = [];
    let systemInstruction = clientSystemInstruction || "你是一个能够共情的个人知识助理和灵魂伴侣。基于用户的便签进行辅助回答。";

    // Extract last user message to use as search query
    const userMessages = messages.filter(m => m.role === 'user');
    const searchQuery = userMessages.length > 0 ? userMessages[userMessages.length - 1].content : '';

    if (contextMode === 'note' && currentNoteId) {
      const noteRes = await query('SELECT title, content FROM notes WHERE id = $1 AND user_id = $2', [currentNoteId, userId]);
      if (noteRes.rows.length > 0) {
        const note = noteRes.rows[0];
        memoryFragments.push(`【当前便签：${note.title}】\n${note.content}`);
      }
    } else if (contextMode === 'category' && currentCategory) {
      const notesRes = await query(
        'SELECT title, LEFT(content, 800) as snippet FROM notes WHERE user_id = $1 AND category = $2 AND is_deleted = FALSE LIMIT 10',
        [userId, currentCategory]
      );
      notesRes.rows.forEach(note => {
        memoryFragments.push(`【便签：${note.title}】\n${note.snippet}...`);
      });
    } else if (contextMode === 'all' && searchQuery) {
      // MySQL native full-text search RAG with Chinese ngram parser!
      let ftsRes = await query(
        `SELECT title, LEFT(content, 1000) as snippet,
                MATCH(title, content) AGAINST($2 IN BOOLEAN MODE) as \`rank\`
         FROM notes
         WHERE user_id = $1 AND is_deleted = FALSE AND MATCH(title, content) AGAINST($2 IN BOOLEAN MODE)
         ORDER BY \`rank\` DESC LIMIT 6`,
        [userId, searchQuery]
      );
      
      // Fallback to fuzzy text search if FTS returns no results
      if (!ftsRes || ftsRes.rows.length === 0) {
        ftsRes = await query(
          `SELECT title, LEFT(content, 1000) as snippet 
           FROM notes 
           WHERE user_id = $1 AND is_deleted = FALSE AND (title LIKE $2 OR content LIKE $2)
           LIMIT 5`,
          [userId, `%${searchQuery.substring(0, 8)}%`]
        );
      }

      ftsRes.rows.forEach(note => {
        memoryFragments.push(`【便签记忆：${note.title}】\n${note.snippet}`);
      });
    }

    // Construct final prompt injection
    if (memoryFragments.length > 0) {
      systemInstruction += `\n\n【背景关联记忆碎片】\n以下是你检索到的用户相关便签片段，请结合这些真实的背景便签内容，给予共情、高度个性化且具有启发性的回复。请注意隐私：\n${memoryFragments.join('\n\n')}`;
    }

    // 2. Route request to either DeepSeek or Gemini
    const isGemini = model.startsWith('gemini');

    if (isGemini) {
      // --- Google Gemini Streaming Integration (SSE mode) ---
      const apiKey = customApiKey || DEFAULT_GEMINI_KEY;
      if (!apiKey) throw new Error('未配置 Gemini API Key，请在设置中填写或联系管理员。');
      
      const targetModel = model; // e.g. gemini-2.5-flash-preview-05-20
      // Use alt=sse for standard SSE streaming - much cleaner to parse
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:streamGenerateContent?alt=sse&key=${apiKey}`;

      // Convert messages to Gemini's format (filter empty messages)
      const contents = messages
        .filter(msg => msg.content && msg.content.trim())
        .map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }));

      // Ensure at least one message
      if (contents.length === 0) {
        throw new Error('消息内容为空，无法发送请求');
      }

      const bodyPayload = {
        contents,
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        generationConfig: {
          temperature: 0.9,
          topP: 0.95,
          maxOutputTokens: 8192
        }
      };

      const abortController = new AbortController();
      req.on('close', () => abortController.abort());

      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
        signal: abortController.signal
      });

      if (!response.ok) {
        const errText = await response.text();
        const sanitized = `AI 服务响应异常 (${response.status})`;
        console.error(`Gemini API error: ${response.status} ${errText.substring(0, 200)}`);
        throw new Error(sanitized);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // SSE format: each event is "data: {json}\n\n"
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete last line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          
          const jsonStr = trimmed.substring(6);
          if (jsonStr === '[DONE]') continue;
          
          try {
            const chunkObj = JSON.parse(jsonStr);
            const text = chunkObj.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (text) {
              sendEvent('chunk', { content: text });
            }
          } catch (e) {
            // Incomplete JSON fragment, skip
          }
        }
      }
      sendEvent('done', {});

    } else {
      // --- DeepSeek Streaming Integration ---
      const apiKey = customApiKey || DEFAULT_DEEPSEEK_KEY;
      const apiUrl = customApiUrl || DEFAULT_DEEPSEEK_URL;

      const bodyPayload = {
        model: model, // deepseek-chat or deepseek-reasoner
        messages: [
          { role: 'system', content: systemInstruction },
          ...messages
        ],
        stream: true
      };

      const abortController = new AbortController();
      if (!req.destroyed) {
        req.on('close', () => abortController.abort());
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(bodyPayload),
        signal: abortController.signal
      });

      if (!response.ok) {
        const errText = await response.text();
        const sanitized = `AI 服务响应异常 (${response.status})`;
        console.error(`DeepSeek API error: ${response.status} ${errText.substring(0, 200)}`);
        throw new Error(sanitized);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // save incomplete line

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine || cleanLine === 'data: [DONE]') continue;

          if (cleanLine.startsWith('data: ')) {
            try {
              const chunkObj = JSON.parse(cleanLine.substring(6));
              const delta = chunkObj.choices?.[0]?.delta;
              
              if (delta) {
                const content = delta.content || '';
                const reasoning = delta.reasoning_content || '';
                if (content || reasoning) {
                  sendEvent('chunk', { content, reasoning });
                }
              }
            } catch (e) {
              // JSON parse failure on partial stream line, normal
            }
          }
        }
      }
      sendEvent('done', {});
    }
  } catch (err) {
    console.error('❌ AI Soul dialogue error:', err.message);
    sendEvent('error', { message: err.message });
  } finally {
    res.end();
  }
}
