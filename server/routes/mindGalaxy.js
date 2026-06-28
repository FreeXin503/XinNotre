import { Router } from 'express';
import authMiddleware from '../middleware/auth.js';
import {
  getGalaxyFromNotes, getGalaxyFromKnowledgeBase, getMixedGalaxy,
  analyzeGalaxy, analyzeGalaxyStream, getMindGraph, getV2Snapshot,
  generateV2Snapshot, getEvolution, getReport, saveConfig, getConfig,
  listConfigs, deleteConfigHandler, exportGalaxy,
  setPrivacySettings, getPrivacySettings, purgeAfterAnalysis,
  renameBody, classifyNoteToTopic, setBodyVisibility, getHiddenBodies,
  mergePersons, updatePersonIntimacy, listPersons,
  inviteRelationship, acceptRelationship, revokeRelationship,
  listRelationshipInvitations, getRelationshipGraphHandler,
  aggregateJoin, aggregateResult
} from '../controllers/mindGalaxyController.js';
import { aiGuideStream } from '../controllers/mindGalaxyGuideController.js';
import { startSocraticSession, socraticStepHandler } from '../controllers/socraticController.js';
import { checkBeliefHandler, getBeliefHistoryHandler } from '../controllers/beliefCheckController.js';

const router = Router();

// ── v1 (backward compat) ──
router.get('/from-notes', authMiddleware, getGalaxyFromNotes);
router.get('/from-kb', authMiddleware, getGalaxyFromKnowledgeBase);
router.get('/mixed', authMiddleware, getMixedGalaxy);

// ── v2 分析 ──
router.get('/analyze', authMiddleware, analyzeGalaxy);
router.post('/analyze-stream', authMiddleware, analyzeGalaxyStream);

// ── v2 图谱+快照 ──
router.get('/graph', authMiddleware, getMindGraph);
router.get('/snapshot', authMiddleware, getV2Snapshot);
router.post('/generate', authMiddleware, generateV2Snapshot);

// ── v2 演化 ──
router.get('/evolution', authMiddleware, getEvolution);

// ── v2 报告 ──
router.get('/report/:snapshotId', authMiddleware, getReport);

// ── v2 配置 ──
router.post('/config', authMiddleware, saveConfig);
router.get('/config', authMiddleware, listConfigs);
router.get('/config/:id', authMiddleware, getConfig);
router.delete('/config/:id', authMiddleware, deleteConfigHandler);

// ── v2 导出 ──
router.post('/export/:format', authMiddleware, exportGalaxy);

// ── v2 隐私 ──
router.get('/privacy', authMiddleware, getPrivacySettings);
router.put('/privacy', authMiddleware, setPrivacySettings);
router.post('/privacy/after-delete', authMiddleware, purgeAfterAnalysis);

// ── v2 编辑 ──
router.put('/body/rename', authMiddleware, renameBody);
router.post('/body/classify', authMiddleware, classifyNoteToTopic);
router.put('/body/visibility', authMiddleware, setBodyVisibility);
router.get('/body/hidden', authMiddleware, getHiddenBodies);

// ── v2 人物 ──
router.post('/person/merge', authMiddleware, mergePersons);
router.put('/person/intimacy', authMiddleware, updatePersonIntimacy);
router.get('/person/list', authMiddleware, listPersons);

// ── D5 双人关系 ──
router.post('/relationship/invite', authMiddleware, inviteRelationship);
router.post('/relationship/accept/:invId', authMiddleware, acceptRelationship);
router.post('/relationship/revoke/:invId', authMiddleware, revokeRelationship);
router.get('/relationship/list', authMiddleware, listRelationshipInvitations);
router.get('/relationship/graph/:token', getRelationshipGraphHandler);

// ── D6 多人匿名聚合 ──
router.post('/aggregate/join', authMiddleware, aggregateJoin);
router.get('/aggregate/result', authMiddleware, aggregateResult);

// ── D7 星系向导 ──
router.post('/ai-guide', authMiddleware, aiGuideStream);

// ── D8 苏格拉底反思引导 ──
router.post('/socratic/start', authMiddleware, startSocraticSession);
router.post('/socratic/step', authMiddleware, socraticStepHandler);

// ── D9 信念检验 ──
router.post('/belief-check', authMiddleware, checkBeliefHandler);
router.get('/belief-check/history', authMiddleware, getBeliefHistoryHandler);

export default router;
