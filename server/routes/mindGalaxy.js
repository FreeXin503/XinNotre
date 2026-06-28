import { Router } from 'express';
import authMiddleware from '../middleware/auth.js';
import {
  getGalaxyFromNotes, getGalaxyFromKnowledgeBase, getMixedGalaxy,
  analyzeGalaxy, analyzeGalaxyStream, getMindGraph, getV2Snapshot,
  generateV2Snapshot, getEvolution, getReport, saveConfig, getConfig,
  listConfigs, deleteConfigHandler, exportGalaxy
} from '../controllers/mindGalaxyController.js';

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

export default router;
