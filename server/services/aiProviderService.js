import { getDecryptedKey } from './keyService.js';
import { injectLengthToSystemPrompt, getLengthMaxTokens } from './lengthModeService.js';
import { config } from '../config/index.js';

export async function callAi(opts) {
  const {
    userId, model = 'deepseek-chat', customApiKey = '', customApiUrl = '',
    systemPrompt = '', userMessage = '', stream = false, temperature = 0.7, maxTokens,
    signal = null, onChunk = null, lengthMode
  } = opts;

  if (lengthMode && !maxTokens) {
    maxTokens = getLengthMaxTokens(lengthMode);
  }
  if (lengthMode && systemPrompt) {
    systemPrompt = injectLengthToSystemPrompt(systemPrompt, lengthMode);
  }

  const isGemini = model.startsWith('gemini');
  const provider = isGemini ? 'gemini' : 'deepseek';
  const apiKey = customApiKey || (await getDecryptedKey(userId, provider)) || config[isGemini ? 'geminiKey' : 'deepseekKey'];

  if (!apiKey) {
    throw new Error(`未配置 ${provider} API Key`);
  }

  if (isGemini) {
    return callGemini({ model, apiKey, systemPrompt, userMessage, temperature, maxTokens, stream, signal, onChunk });
  }

  return callDeepSeek({ model, apiKey, apiUrl: customApiUrl, systemPrompt, userMessage, temperature, maxTokens, stream, signal, onChunk });
}

async function callDeepSeek(opts) {
  const { model, apiKey, apiUrl, systemPrompt, userMessage, temperature, maxTokens, stream, signal, onChunk } = opts;
  const baseUrl = apiUrl || config.deepseekUrl;

  const bodyPayload = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    stream,
    temperature,
    max_tokens: maxTokens
  };

  const resp = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(bodyPayload),
    signal
  });

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    throw new Error(`DeepSeek API 异常 (${resp.status}): ${errBody.substring(0, 200)}`);
  }

  if (!stream) {
    const data = await resp.json();
    return { text: data.choices?.[0]?.message?.content || '', provider: 'deepseek', model };
  }

  return streamResponse(resp, onChunk, signal, 'deepseek', model);
}

async function callGemini(opts) {
  const { model, apiKey, systemPrompt, userMessage, temperature, maxTokens, stream, signal, onChunk } = opts;
  const url = stream
    ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`
    : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const bodyPayload = {
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { temperature, maxOutputTokens: maxTokens }
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyPayload),
    signal
  });

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    throw new Error(`Gemini API 异常 (${resp.status}): ${errBody.substring(0, 200)}`);
  }

  if (!stream) {
    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { text, provider: 'gemini', model };
  }

  return streamGeminiSSE(resp, onChunk, signal, model);
}

async function streamResponse(resp, onChunk, signal, provider, model) {
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let fullText = '';

  while (true) {
    if (signal?.aborted) break;
    const { done, value } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      if (trimmed === 'data: [DONE]') continue;
      try {
        const json = JSON.parse(trimmed.substring(6));
        const delta = json.choices?.[0]?.delta?.content || '';
        if (delta) {
          fullText += delta;
          if (onChunk) onChunk(delta);
        }
      } catch (e) { /* skip unparseable chunk */ }
    }
  }

  return { text: fullText, provider, model };
}

async function streamGeminiSSE(resp, onChunk, signal, model) {
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let fullText = '';

  while (true) {
    if (signal?.aborted) break;
    const { done, value } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      try {
        const json = JSON.parse(trimmed.substring(6));
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) {
          fullText += text;
          if (onChunk) onChunk(text);
        }
      } catch (e) { /* skip */ }
    }
  }

  return { text: fullText, provider: 'gemini', model };
}

export function extractJson(text) {
  if (!text) return null;
  // 1. 剥离 markdown 代码块围栏
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : text.trim();

  // 2. 平衡花括号扫描（找到第一个完整 JSON 对象）
  const start = candidate.indexOf('{');
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inStr) {
      if (esc) { esc = false; }
      else if (ch === '\\') { esc = true; }
      else if (ch === '"') { inStr = false; }
    } else {
      if (ch === '"') { inStr = true; }
      else if (ch === '{') { depth++; }
      else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
  }
  if (end === -1) return null;
  try {
    return JSON.parse(candidate.substring(start, end + 1));
  } catch (e) { /* not valid JSON */ }
  return null;
}
