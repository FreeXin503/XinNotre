/**
 * 心智星系 v2 · 控制器
 */
import { success, fail, asyncHandler } from '../utils/response.js';
import { setupSSE, sendSSE } from '../utils/sse.js';
import {
  generateGalaxyFromNotes, generateGalaxyFromKnowledgeBase, generateMixedGalaxy
} from '../services/mindGalaxyService.js';
import { preprocess, purgeRawText } from '../services/mindGalaxy/preprocessService.js';
import { analyzeBasic } from '../services/mindGalaxy/nlpBasicService.js';
import { analyzeDeep } from '../services/mindGalaxy/nlpDeepService.js';
import { buildMindGraph, saveGraph } from '../services/mindGalaxy/mindGraphService.js';
import { mapToGalaxy } from '../services/mindGalaxy/galaxyMappingService.js';
import configService from '../services/mindGalaxy/configService.js';
import { generateReport } from '../services/mindGalaxy/reportService.js';
import { exportData, exportReportPDF } from '../services/mindGalaxy/exportService.js';
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

  let report = await repo.getReportBySnapshotId(userId, snapshotId);
  if (!report) {
    try {
      const generated = await generateReport(userId, snapshotId);
      return success(res, generated);
    } catch (err) {
      return fail(res, `报告生成失败: ${err.message}`, 500);
    }
  }

  const reportJson = report.report_json || report;

  // C26: 注入 sourceRef — 为每条结论附星系位置和原始日记
  const snapshot = await repo.getSnapshotById(snapshotId, userId);
  if (snapshot?.snapshot_json) {
    const snapJson = typeof snapshot.snapshot_json === 'string' ? JSON.parse(snapshot.snapshot_json) : snapshot.snapshot_json;
    const bodies = snapJson.bodies || [];
    const bodyByName = new Map();
    bodies.forEach(b => { if (b.name) bodyByName.set(b.name, b.id || b.nodeId); });

    // 为核心信念添加 sourceRef
    (reportJson.coreBeliefs || []).forEach(belief => {
      if (belief.evidence) {
        belief.sourceRef = belief.evidence.map(ev => ({
          excerpt: ev.excerpt || '',
          recordId: ev.recordId || '',
          bodyId: bodyByName.get(belief.label) || null,
          galaxyUrl: bodyByName.get(belief.label) ? `/mind-galaxy.html?focus=${encodeURIComponent(bodyByName.get(belief.label))}` : null
        }));
      }
    });

    // 为关系人物添加 sourceRef
    (reportJson.relationshipGalaxy?.topPersons || []).forEach(p => {
      const bid = bodyByName.get(p.name);
      p.sourceRef = bid ? { bodyId: bid, galaxyUrl: `/mind-galaxy.html?focus=${encodeURIComponent(bid)}` } : null;
    });
  }

  return success(res, reportJson);
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
  const { reportId } = req.body || {};

  if (!['json', 'csv', 'pdf', 'picture'].includes(format)) {
    return fail(res, `不支持的格式: ${format}`, 400);
  }

  try {
    if (format === 'json' || format === 'csv') {
      const result = await exportData(userId, format);
      if (result.contentType === 'application/json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        return res.send(result.data);
      }
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      return res.send(result.data);
    }

    if (format === 'pdf') {
      if (!reportId) return fail(res, '缺少 reportId', 400);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="mind-galaxy-report-${reportId}.pdf"`);
      await exportReportPDF(userId, reportId, res);
      return;
    }

    // picture: 降级前端导出
    return success(res, { format: 'picture', message: '请使用前端 canvas 导出功能' });
  } catch (err) {
    return fail(res, `导出失败: ${err.message}`, 500);
  }
});

// ── v2: 隐私控制 ──
export const setPrivacySettings = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { localMode, afterDelete } = req.body || {};
  if (typeof localMode !== 'undefined') {
    const cfg = await repo.getConfig(userId, '_privacy');
    await repo.saveConfig(userId, {
      ...(cfg?.config_json || {}), name: '_privacy', id: '_privacy',
      privacyMode: localMode ? 'local' : 'cloud', deleteAfterAnalysis: !!cfg?.config_json?.deleteAfterAnalysis
    });
  }
  if (typeof afterDelete !== 'undefined') {
    const cfg = await repo.getConfig(userId, '_privacy');
    await repo.saveConfig(userId, { ...(cfg?.config_json || {}), name: '_privacy', id: '_privacy', deleteAfterAnalysis: !!afterDelete });
  }
  return success(res, { localMode: localMode ?? null, afterDelete: afterDelete ?? null });
});

export const getPrivacySettings = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const cfg = await repo.getConfig(userId, '_privacy');
  const json = cfg?.config_json || {};
  return success(res, { localMode: json.privacyMode === 'local', afterDelete: !!json.deleteAfterAnalysis });
});

export const purgeAfterAnalysis = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { sourceRef } = req.body || {};
  const result = await purgeRawText(userId, sourceRef || null);
  return success(res, result);
});

// ── v2: 星体编辑 ──
export const renameBody = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { bodyId, newName } = req.body || {};
  if (!bodyId || !newName || typeof newName !== 'string') return fail(res, '缺少 bodyId 或 newName', 400);
  if (newName.length > 20) return fail(res, '名称不能超过 20 个字符', 400);
  const ok = await repo.updateBodyName(userId, bodyId, newName.trim());
  if (!ok) return fail(res, '星体不存在或更新失败', 404);
  return success(res, { renamed: true, bodyId, newName: newName.trim() });
});

export const classifyNoteToTopic = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { noteId, topicId } = req.body || {};
  if (!noteId || !topicId) return fail(res, '缺少 noteId 或 topicId', 400);
  const snapshot = await repo.getLatestSnapshot(userId);
  if (!snapshot?.snapshot_json) return fail(res, '暂无星系快照', 404);
  const json = typeof snapshot.snapshot_json === 'string'
    ? JSON.parse(snapshot.snapshot_json) : snapshot.snapshot_json;
  if (!json.bodies) return fail(res, '星系数据异常', 500);
  const planet = json.bodies.find(b => (b.nodeId || b.id) === noteId);
  if (!planet) return fail(res, '便签节点不存在', 404);
  planet.topicId = topicId;
  planet.manual = true;
  await repo.updateSnapshotJson(snapshot.id, userId, json);
  return success(res, { classified: true, noteId, topicId });
});

export const setBodyVisibility = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { bodyId, visible } = req.body || {};
  if (!bodyId || typeof visible !== 'boolean') return fail(res, '缺少 bodyId 或 visible', 400);
  const cfg = await repo.getConfig(userId, '_privacy');
  const configJson = cfg?.config_json || {};
  const hiddenIds = configJson.hiddenNodeIds || [];
  if (visible) {
    const idx = hiddenIds.indexOf(bodyId);
    if (idx >= 0) hiddenIds.splice(idx, 1);
  } else {
    if (!hiddenIds.includes(bodyId)) hiddenIds.push(bodyId);
  }
  await repo.saveConfig(userId, {
    name: '_privacy', id: '_privacy', hiddenNodeIds: hiddenIds,
    privacyMode: configJson.privacyMode || 'cloud', deleteAfterAnalysis: !!configJson.deleteAfterAnalysis
  });
  return success(res, { bodyId, visible, hiddenCount: hiddenIds.length });
});

export const getHiddenBodies = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const cfg = await repo.getConfig(userId, '_privacy');
  const json = cfg?.config_json || {};
  return success(res, { hiddenNodeIds: json.hiddenNodeIds || [] });
});

// ── v2: 人物管理 ──
export const mergePersons = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { personIdA, personIdB } = req.body || {};
  if (!personIdA || !personIdB) return fail(res, '缺少 personIdA 或 personIdB', 400);
  const snapshot = await repo.getLatestSnapshot(userId);
  if (!snapshot?.snapshot_json) return fail(res, '暂无星系快照', 404);
  const json = typeof snapshot.snapshot_json === 'string'
    ? JSON.parse(snapshot.snapshot_json) : snapshot.snapshot_json;
  const bodies = json.bodies || [];
  const target = bodies.find(b => (b.id || b.nodeId) === personIdA);
  const source = bodies.find(b => (b.id || b.nodeId) === personIdB);
  if (!target || !source) return fail(res, '人物不存在', 404);
  if (target.type !== 'person' || source.type !== 'person') return fail(res, '只能合并人物类型节点', 400);
  target.meta = target.meta || {};
  target.meta.mergedFrom = [...(target.meta.mergedFrom || []), personIdB];
  target.intimacy = Math.max(target.intimacy || 0, source.intimacy || 0);
  json.bodies = bodies.filter(b => (b.id || b.nodeId) !== personIdB);
  await repo.updateSnapshotJson(snapshot.id, userId, json);
  return success(res, { merged: personIdB, into: personIdA });
});

export const updatePersonIntimacy = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { personId, intimacy } = req.body || {};
  if (!personId || typeof intimacy !== 'number') return fail(res, '缺少 personId 或 intimacy', 400);
  if (intimacy < 0 || intimacy > 1) return fail(res, '亲密度范围 0-1', 400);
  const snapshot = await repo.getLatestSnapshot(userId);
  if (!snapshot?.snapshot_json) return fail(res, '暂无星系快照', 404);
  const json = typeof snapshot.snapshot_json === 'string'
    ? JSON.parse(snapshot.snapshot_json) : snapshot.snapshot_json;
  const person = (json.bodies || []).find(b => (b.id || b.nodeId) === personId);
  if (!person || person.type !== 'person') return fail(res, '人物不存在', 404);
  person.intimacy = intimacy;
  await repo.updateSnapshotJson(snapshot.id, userId, json);
  return success(res, { personId, intimacy });
});

export const listPersons = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const snapshot = await repo.getLatestSnapshot(userId);
  if (!snapshot?.snapshot_json) return success(res, { persons: [] });
  const json = typeof snapshot.snapshot_json === 'string'
    ? JSON.parse(snapshot.snapshot_json) : snapshot.snapshot_json;
  const persons = (json.bodies || []).filter(b => b.type === 'person');
  return success(res, { persons });
});

export default {
  // legacy
  getGalaxyFromNotes, getGalaxyFromKnowledgeBase, getMixedGalaxy,
  // v2
  analyzeGalaxy, analyzeGalaxyStream, getMindGraph, getV2Snapshot,
  generateV2Snapshot, getEvolution, getReport,
  saveConfig, getConfig, listConfigs, deleteConfigHandler, exportGalaxy,
  // privacy
  setPrivacySettings, getPrivacySettings, purgeAfterAnalysis,
  // edit
  renameBody, classifyNoteToTopic, setBodyVisibility, getHiddenBodies,
  // person
  mergePersons, updatePersonIntimacy, listPersons
};
