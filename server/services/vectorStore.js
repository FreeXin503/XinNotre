import { LRUCache } from 'lru-cache';
import { config } from '../config/index.js';

const QDRANT_URL = config.qdrantUrl;

// LRU 缓存:向量搜索 embedding 缓存
const cache = new LRUCache({ max: 5000 });

// 内存回退向量存储 — 按 userId 分桶, 每桶 LRU 上限
const FALLBACK_MAX_VECTORS_PER_USER = 5000;
const userVectors = new Map();   // Map<userId, Map<vectorId, Float32Array>>
const userPayloads = new Map();  // Map<userId, Map<vectorId, Object>>

let qdrantClient = null;
let initPromise = null;

export const VECTOR_DIM = 768;
export const COLLECTION_NAME = 'xinnote_notes';

async function getQdrantClient() {
  if (!QDRANT_URL) return null;
  if (qdrantClient) return qdrantClient;

  try {
    const { QdrantClient } = await import('@qdrant/js-client-rest');
    qdrantClient = new QdrantClient({ url: QDRANT_URL });
    await qdrantClient.getCollections();
    return qdrantClient;
  } catch {
    console.warn('[vectorStore] Qdrant not available, using in-memory fallback');
    return null;
  }
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function l2Normalize(vec) {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  const result = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) result[i] = vec[i] / norm;
  return result;
}

// ─── Public API ───

export async function ensureCollection(dim = VECTOR_DIM) {
  const client = await getQdrantClient();
  if (!client) return;

  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      await client.getCollection(COLLECTION_NAME);
    } catch {
      await client.createCollection(COLLECTION_NAME, {
        vectors: { size: dim, distance: 'Cosine' },
        hnsw_config: { m: 16, ef_construct: 200 }
      });
      console.log(`[vectorStore] Qdrant collection "${COLLECTION_NAME}" created`);
    }
  })();
  return initPromise;
}

export async function upsertVector(id, vector, payload = {}) {
  const normalized = l2Normalize(vector);
  cache.set(`vec:${id}`, normalized);

  const client = await getQdrantClient();
  if (client) {
    await client.upsert(COLLECTION_NAME, {
      wait: false,
      points: [{ id, vector: Array.from(normalized), payload }]
    });
  } else {
    const userId = payload?.user_id;
    if (userId == null) return;

    let uv = userVectors.get(userId);
    let up = userPayloads.get(userId);
    if (!uv) {
      uv = new Map();
      up = new Map();
      userVectors.set(userId, uv);
      userPayloads.set(userId, up);
    }
    // LRU 淘汰: 超出上限则清空最旧的(只清当前用户的)
    if (uv.size >= FALLBACK_MAX_VECTORS_PER_USER) {
      const keys = Array.from(uv.keys());
      const toDelete = keys.slice(0, Math.ceil(FALLBACK_MAX_VECTORS_PER_USER * 0.2));
      for (const k of toDelete) { uv.delete(k); up.delete(k); }
    }
    uv.set(id, normalized);
    up.set(id, payload);
  }
}

export async function deleteVector(id) {
  cache.delete(`vec:${id}`);

  const client = await getQdrantClient();
  if (client) {
    try { await client.delete(COLLECTION_NAME, { wait: false, points: [id] }); } catch {}
  } else {
    for (const [userId, uv] of userVectors) {
      if (uv.delete(id)) {
        userPayloads.get(userId)?.delete(id);
        break;
      }
    }
  }
}

/**
 * 向量搜索
 * @param {Float32Array|number[]} queryVector
 * @param {number} topK
 * @param {number|null} filterUser - 非 null 则只搜索该用户的向量
 * @returns {Promise<Array<{id, score, payload}>>} score 统一归一到 [0,1] 相似度
 */
export async function searchVectors(queryVector, topK = 30, filterUser = null) {
  const normalized = l2Normalize(queryVector);

  const client = await getQdrantClient();
  if (client) {
    const filter = filterUser != null
      ? { must: [{ key: 'user_id', match: { value: filterUser } }] }
      : undefined;

    const result = await client.search(COLLECTION_NAME, {
      vector: Array.from(normalized),
      limit: topK,
      filter,
      with_payload: true
    });
    // Qdrant Cosine distance 范围 [0,2], 0=最相似; 转为 similarity: 1 - distance/2 → [0,1]
    return result.map(r => ({
      id: r.id,
      score: 1 - (r.score || 0) / 2,
      payload: r.payload
    }));
  }

  // In-memory fallback
  const results = [];
  for (const [userId, uv] of userVectors) {
    if (filterUser != null && userId !== filterUser) continue;
    for (const [id, vec] of uv) {
      const payload = userPayloads.get(userId)?.get(id);
      results.push({ id, score: cosineSimilarity(normalized, vec), payload });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

export async function clearVectors() {
  cache.clear();
  const client = await getQdrantClient();
  if (client) {
    try { await client.deleteCollection(COLLECTION_NAME); } catch {}
    await ensureCollection();
  } else {
    userVectors.clear();
    userPayloads.clear();
  }
}

export function getVectorCount() {
  const client = qdrantClient;
  if (client) return -1;
  let count = 0;
  for (const uv of userVectors.values()) count += uv.size;
  return count;
}

// ─── Cached search (deduplicates embeddings) ───
let searchCache = new LRUCache({ max: 200 });

/**
 * 带缓存的向量搜索 (安全版本: 强制 userId 隔离)
 * @param {function} embeddingFn - (text) => Promise<number[]>
 * @param {string} text - 查询文本
 * @param {number} topK
 * @param {number} ttl - 缓存 TTL (毫秒)
 * @param {number} userId - 必填, 用户 id, 用于缓存隔离与检索过滤
 * @param {boolean} [filterUser=true] - 是否将 userId 作为 searchVectors 的过滤条件
 * @returns {Promise<Array<{id, score, payload}>>}
 */
export async function cachedSearch(embeddingFn, text, topK = 30, ttl = 300000, userId, filterUser = true) {
  if (userId == null) {
    throw new TypeError('[vectorStore.cachedSearch] userId 是必填参数');
  }
  const cacheKey = `search:u${userId}:${text.substring(0, 80)}:${topK}`;
  const cached = searchCache.get(cacheKey);
  if (cached) return cached;

  const queryVector = await embeddingFn(text);
  const results = await searchVectors(queryVector, topK, filterUser ? userId : null);
  searchCache.set(cacheKey, results);
  return results;
}

export function clearSearchCache() {
  searchCache.clear();
}
