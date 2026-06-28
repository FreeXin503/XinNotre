import crypto from 'crypto';
import { LRUCache } from 'lru-cache';
import { config } from '../config/index.js';

const GEMINI_KEY = config.geminiKey;
const EMBEDDING_MODEL = 'text-embedding-004';
const EMBEDDING_URL = 'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent';
const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;

const embedCache = new LRUCache({ max: 10000 });

class EmbeddingServiceError extends Error {
  constructor(message, original) {
    super(message);
    this.name = 'EmbeddingServiceError';
    this.original = original;
  }
}

/**
 * SHA-256 缓存键 (真哈希, 非自造)
 */
function sha256Hash(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

async function fetchEmbedding(text, attempt = 0) {
  if (!GEMINI_KEY) throw new EmbeddingServiceError('GEMINI_KEY not configured');

  const payload = JSON.stringify({
    model: `models/${EMBEDDING_MODEL}`,
    content: { parts: [{ text }] }
  });

  const url = new URL(EMBEDDING_URL);
  const abortCtrl = new AbortController();
  const timer = setTimeout(() => abortCtrl.abort('timeout'), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_KEY
      },
      body: payload,
      signal: abortCtrl.signal
    });

    const data = await res.json();
    if (!res.ok) {
      const msg = data?.error?.message || `HTTP ${res.status}`;
      throw new EmbeddingServiceError(`Gemini API 错误: ${msg}`);
    }
    const values = data?.embedding?.values;
    if (!values || values.length === 0) {
      throw new EmbeddingServiceError('空 embedding 响应');
    }
    return new Float32Array(values);
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new EmbeddingServiceError('embedding 请求超时');
    }
    if (err instanceof EmbeddingServiceError) throw err;

    // 指数退避重试
    if (attempt < MAX_RETRIES) {
      const delay = Math.pow(2, attempt) * 500;
      console.warn(`[embedding] 重试 ${attempt + 1}/${MAX_RETRIES}, 等待 ${delay}ms: ${err.message}`);
      await new Promise(r => setTimeout(r, delay));
      return fetchEmbedding(text, attempt + 1);
    }
    throw new EmbeddingServiceError(`embedding 失败: ${err.message}`, err);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 对单段文本生成 embedding
 * @param {string} text - 文本(空/null 返回空数组, 不发请求)
 * @returns {Promise<Float32Array>}
 */
export async function embedText(text) {
  if (text == null || text === '') return new Float32Array(0);

  const hash = sha256Hash(text);
  const cached = embedCache.get(hash);
  if (cached) return cached;

  const vector = await fetchEmbedding(text);
  embedCache.set(hash, vector);
  return vector;
}

/**
 * 批量 embedding
 * @param {string[]} texts
 * @param {number} [concurrency=5]
 * @returns {Promise<Float32Array[]>}
 */
export async function embedBatch(texts, concurrency = 5) {
  const results = [];
  for (let i = 0; i < texts.length; i += concurrency) {
    const batch = texts.slice(i, i + concurrency);
    const embeddings = await Promise.all(batch.map(t => embedText(t)));
    results.push(...embeddings);
  }
  return results;
}

export function getCacheSize() {
  return embedCache.size;
}

export function clearEmbedCache() {
  embedCache.clear();
}
