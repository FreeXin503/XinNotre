/**
 * UGME v2.0 通用星系转译引擎 · 核心服务
 *
 * 职责：串联 数据准备 → prompt 构建 → LLM 调用 → JSON 解析 → 校验 → 后处理映射 → 多 snapshot 组装
 * 与现有 nlpDeepService 心理学路径并行，走新 endpoint /engine/generate
 */
import { callAi, extractJson } from '../aiProviderService.js';
import { buildEnginePrompt } from './galaxyEnginePrompt.js';
import { mapSnapshotToBodies } from './galaxyEngineMapper.js';
import { validateEngineMultiSnapshot, ENGINE_DOMAINS } from '../../types/mindGalaxyTypes.js';
import MindGalaxyRepository from '../../repositories/mindGalaxyRepository.js';

const repo = new MindGalaxyRepository();

/**
 * 按 month/week 将 sources 分桶
 * @param {Array<{id:number,timestamp:string,content:string}>} sources
 * @param {string} bucketBy - 'month'|'week'
 * @returns {Array<{snapshot:string, items:Array}>}
 */
function bucketSources(sources, bucketBy) {
  const buckets = new Map();

  for (const src of sources) {
    let key;
    if (bucketBy === 'week') {
      key = getISOWeekKey(src.timestamp);
    } else {
      key = (src.timestamp || '').substring(0, 7) || new Date().toISOString().substring(0, 7);
    }
    if (!buckets.has(key)) {
      buckets.set(key, { snapshot: key, items: [] });
    }
    buckets.get(key).items.push(src);
  }

  return [...buckets.values()].sort((a, b) => a.snapshot.localeCompare(b.snapshot));
}

function getISOWeekKey(timestamp) {
  try {
    const date = new Date(timestamp);
    const jan1 = new Date(date.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((date - jan1) / 86400000) + 1;
    const week = Math.ceil(dayOfYear / 7);
    return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
  } catch {
    return new Date().toISOString().substring(0, 7);
  }
}

/**
 * 通用星系转译引擎 · 生成多时间切片星系
 *
 * @param {number} userId
 * @param {Object} params
 * @param {string} params.domain - ENGINE_DOMAINS 之一
 * @param {Array<{id:number,timestamp:string,content:string}>} params.sources - 原始数据
 * @param {string} [params.bucketBy='month'] - 'month'|'week'
 * @param {string} [params.model='deepseek-chat'] - LLM 模型
 * @returns {Promise<{domain:string, snapshots:Array}>}
 */
export async function generateGalaxyEngine(userId, params) {
  const { domain, sources, bucketBy = 'month', model = 'deepseek-chat' } = params || {};

  if (!ENGINE_DOMAINS.includes(domain)) {
    throw Object.assign(new Error(`非法业务域: ${domain}`), { statusCode: 400 });
  }
  if (!Array.isArray(sources) || sources.length === 0) {
    return { domain, snapshots: [] };
  }

  const cappedSources = sources.slice(0, 200);
  const timeBuckets = bucketSources(cappedSources, bucketBy);

  if (timeBuckets.length === 0) {
    return { domain, snapshots: [] };
  }

  const { systemPrompt, userMessage } = buildEnginePrompt(domain, timeBuckets);

  let parsed;
  try {
    const response = await callAi({
      userId,
      model,
      systemPrompt,
      userMessage,
      temperature: 0.3,
      maxTokens: 8192,
      stream: false
    });

    const text = typeof response === 'object' ? (response.text || '') : String(response);
    parsed = extractJson(text);
  } catch (firstErr) {
    try {
      const retryResp = await callAi({
        userId,
        model,
        systemPrompt: systemPrompt + '\n请确保只返回合法 JSON 对象。',
        userMessage,
        temperature: 0.2,
        maxTokens: 8192,
        stream: false
      });
      const retryText = typeof retryResp === 'object' ? (retryResp.text || '') : String(retryResp);
      parsed = extractJson(retryText);
    } catch (retryErr) {
      throw new Error(`AI_UNAVAILABLE: ${firstErr.message || retryErr.message || '分析服务不可用'}`);
    }
  }

  if (!parsed) {
    throw new Error('LLM 返回内容无法解析为 JSON');
  }

  const validation = validateEngineMultiSnapshot(parsed);
  if (!validation.valid) {
    throw new Error(`LLM 输出校验失败: ${validation.errors.slice(0, 5).join('; ')}`);
  }

  const snapshots = [];
  for (const engineSnapshot of parsed.snapshots) {
    const galaxySnapshot = mapSnapshotToBodies(engineSnapshot, userId, domain);
    try {
      await repo.saveSnapshot(userId, galaxySnapshot);
    } catch { /* 持久化失败不阻塞 */ }
    snapshots.push(galaxySnapshot);
  }

  return { domain, snapshots };
}

export default { generateGalaxyEngine };
