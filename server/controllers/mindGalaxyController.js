/**
 * 心智星系 v2 · 控制器
 */
import { success, fail, asyncHandler } from '../utils/response.js';
import { setupSSE, sendSSE } from '../utils/sse.js';
import {
  generateGalaxyFromNotes, generateGalaxyFromKnowledgeBase, generateMixedGalaxy
} from '../services/mindGalaxyService.js';
import { preprocess } from '../services/mindGalaxy/preprocessService.js';
import { analyzeBasic } from '../services/mindGalaxy/nlpBasicService.js';
import { analyzeDeep } from '../services/mindGalaxy/nlpDeepService.js';
import { buildMindGraph, saveGraph } from '../services/mindGalaxy/mindGraphService.js';
import { mapToGalaxy } from '../services/mindGalaxy/galaxyMappingService.js';
import configService from '../services/mindGalaxy/configService.js';
import MindGalaxyRepository from '../repositories/mindGalaxyRepository.js';

const repo = new MindGalaxyRepository();

// ── v1 兼容薄层 ──
export const getGalaxyFromNotes = asyncHandler(async (req, res) => {
  const { limit = 50, category } = req.query;
  try {
    const galaxyData = await generateGalaxyFromNotes(req.user.id, { limit: parseInt(limit) || 50, category });
    return success(res, { galaxy: galaxyData, source: 'notes', generatedAt: new Date().toISOString() });
  } catch (err) {
    return fail(res, 'Failed to generate galaxy from notes', 500);
  }
});

export const getGalaxyFromKnowledgeBase = asyncHandler(async (req, res) => {
  const { kbId, limit = 100 } = req.query;
  try {
    const galaxyData = await generateGalaxyFromKnowledgeBase(req.user.id, { kbId, limit: parseInt(limit) || 100 });
    return success(res, { galaxy: galaxyData, source: 'knowledge', generatedAt: new Date().toISOString() });
  } catch (err) {
    return fail(res, 'Failed to generate galaxy from knowledge base', 500);
  }
});

export const getMixedGalaxy = asyncHandler(async (req, res) => {
  try {
    const galaxyData = await generateMixedGalaxy(req.user.id);
    return success(res, { galaxy: galaxyData, source: 'mixed', generatedAt: new Date().toISOString() });
  } catch (err) {
    return fail(res, 'Failed to generate mixed galaxy', 500);
  }
});

// ── v2: 分析 ⌄⌄ 手动输入分析 ──
export const analyzeGalaxy = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { text, source = 'notes' } = req.body || {};

  if (!text || typeof text !== 'string') {
    return fail(res, '缺少 text 字段', 400);
  }

  const { segments } = await preprocess(userId, {
    sources: [{ type: source, text, ref: 'manual', timestamp: new Date().toISOString() }]
  });

  const basic = await analyzeBasic(segments);
  let deep = null;
  try {
    deep = await analyzeDeep(userId, { segments, basicResult: basic });
  } catch { /* deep optional */ }

  const graph = await buildMindGraph({ basic, deep, segments });
  await saveGraph(userId, graph);

  const snapshot = await mapToGalaxy(userId, graph);

  return success(res, { graph, snapshot });
});

// ── v2: 分析 SSE 流式 ──
export const analyzeGalaxyStream = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { text, source = 'notes', model } = req.body || {};

  setupSSE(res);

  if (!text || typeof text !== 'string') {
    sendSSE(res, 'error', { error: '缺少 text 字段' });
    return res.end();
  }

  try {
    sendSSE(res, 'status', { stage: 'preprocess' });
    const { segments, meta } = await preprocess(userId, {
      sources: [{ type: source, text, ref: 'manual-sse', timestamp: new Date().toISOString() }]
    });
    sendSSE(res, 'status', { stage: 'basic-analyze', meta });

    const basic = await analyzeBasic(segments);
    sendSSE(res, 'status', { stage: 'deep-analyze', topics: basic.topics.length });

    let deep = null;
    try {
      deep = await analyzeDeep(userId, {
        segments, basicResult: basic,
        options: { model, onChunk: (chunk) => sendSSE(res, 'chunk', { text: chunk }) }
      });
    } catch {
      sendSSE(res, 'status', { stage: 'deep-skipped', reason: 'AI unavailable' });
    }

    sendSSE(res, 'status', { stage: 'graph-build' });
    const graph = await buildMindGraph({ basic, deep, segments });
    await saveGraph(userId, graph);

    sendSSE(res, 'status', { stage: 'galaxy-map' });
    const snapshot = await mapToGalaxy(userId, graph);

    sendSSE(res, 'result', {
      snapshotId: snapshot?.id,
      galaxyType: snapshot?.galaxyType,
      bodyCount: snapshot?.bodies?.length || 0,
      noteCount: segments.length
    });
    sendSSE(res, 'done');
  } catch (err) {
    sendSSE(res, 'error', { error: err.message });
  }
  res.end();
});

// ── v2: 图谱 ──
export const getMindGraph = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const graph = await repo.getLatestGraph(userId);
  if (!graph) return fail(res, '暂无图谱', 404);
  return success(res, graph);
});

// ── v2: 快照 ──
export const getV2Snapshot = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const snapshot = await repo.getLatestSnapshot(userId);
  if (!snapshot) return fail(res, '暂无星系快照', 404);
  return success(res, snapshot);
});

// ── v2: 生成快照(SSE) ──
export const generateV2Snapshot = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { model, force } = req.body || {};

  setupSSE(res);

  try {
    const graph = await repo.getLatestGraph(userId);
    if (!graph || !graph.graph_json) {
      sendSSE(res, 'error', { error: '请先运行 /analyze-stream 生成图谱' });
      return res.end();
    }

    sendSSE(res, 'status', { stage: 'mapping' });
    const snapshot = await mapToGalaxy(userId,
      typeof graph.graph_json === 'string' ? JSON.parse(graph.graph_json) : graph.graph_json
    );

    sendSSE(res, 'result', {
      snapshotId: snapshot?.id,
      galaxyType: snapshot?.galaxyType,
      bodyCount: snapshot?.bodies?.length || 0
    });
    sendSSE(res, 'done');
  } catch (err) {
    sendSSE(res, 'error', { error: err.message });
  }
  res.end();
});

// ── v2: 演化 ──
export const getEvolution = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { range = '6months' } = req.query;
  const limit = range === '3months' ? 12 : range === '1year' ? 52 : 26;
  const snapshots = await repo.listSnapshots(userId, limit);
  return success(res, { snapshots, range });
});

// ── v2: 报告 ──
export const getReport = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { snapshotId } = req.params;
  if (!snapshotId) return fail(res, '缺少 snapshotId', 400);

  const report = await repo.getReportBySnapshotId(userId, snapshotId);
  if (!report) return fail(res, '暂未生成报告', 404);
  return success(res, report);
});

// ── v2: 配置 CRUD ──
export const saveConfig = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const config = req.body;
  if (!config || !config.name) return fail(res, '缺少 name', 400);

  const id = await configService.create(userId, config);
  return success(res, { id });
});

export const getConfig = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const cfg = await repo.getConfig(userId, req.params.id);
  if (!cfg) return fail(res, '配置不存在', 404);
  return success(res, cfg);
});

export const listConfigs = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const configs = await repo.listConfigs(userId);
  return success(res, configs);
});

export const deleteConfigHandler = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const ok = await repo.deleteConfig(userId, req.params.id);
  if (!ok) return fail(res, '删除失败', 404);
  return success(res, { deleted: true });
});

// ── v2: 导出 ──
export const exportGalaxy = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { format } = req.params;
  const { body } = req;

  if (!['json', 'picture'].includes(format)) {
    return fail(res, `不支持的格式: ${format}`, 400);
  }

  if (format === 'json') {
    const snap = await repo.getLatestSnapshot(userId);
    if (!snap) return fail(res, '暂无快照', 404);
    return success(res, { format: 'json', data: snap });
  }

  // picture: 返回示意
  return success(res, { format: 'picture', message: '请使用前端 canvas 导出功能' });
});

export default {
  // legacy
  getGalaxyFromNotes, getGalaxyFromKnowledgeBase, getMixedGalaxy,
  // v2
  analyzeGalaxy, analyzeGalaxyStream, getMindGraph, getV2Snapshot,
  generateV2Snapshot, getEvolution, getReport,
  saveConfig, getConfig, listConfigs, deleteConfigHandler, exportGalaxy
};
