/**
 * 心迹星图 · 3D 心智星相图 Controller (Phase 2)
 *
 * 端点:
 *   GET  /api/cosmos/snapshot        — 获取最新快照（查表或自动生成）
 *   POST /api/cosmos/generate (SSE)  — AI 生成新快照
 *   GET  /api/cosmos/evolution       — 演化历史列表
 *
 * 安全: 所有端点均受 authMiddleware 保护
 */
import { query } from '../config/database.js';
import { analyzeDiariesForCosmos, registerEntities } from '../services/cosmosService.js';
import { validateCosmosSnapshot } from '../types/cosmosTypes.js';
import crypto from 'crypto';
import { setupSSE, sendSSE } from '../utils/sse.js';
import { success, fail, asyncHandler } from '../utils/response.js';

// ── 1. GET /api/cosmos/snapshot ─────────────────────────

/**
 * 获取当前用户的最新宇宙快照
 * 若无则自动触发一次分析
 */
export const getCosmosSnapshot = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { start_date, end_date } = req.query;

  // 查询最新缓存快照
  const result = await query(
    `SELECT id, snapshot_json, version_tag, diary_count, created_at
     FROM cosmos_snapshots
     WHERE user_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );

  if (result.rows.length > 0) {
    const row = result.rows[0];
    return success(res, {
      snapshotId: row.id,
      versionTag: row.version_tag,
      diaryCount: row.diary_count,
      createdAt: row.created_at,
      snapshot: tryParseJSON(row.snapshot_json),
      cached: true
    });
  }

  // 无快照，返回空状态
  success(res, {
    cached: false,
    message: '暂无宇宙快照，请通过生成端点创建'
  });
});

// ── 2. POST /api/cosmos/generate (SSE) ─────────────────

/**
 * AI 生成心智星相图快照（流式 SSE）
 *
 * 请求体: {
 *   model?: string,
 *   force?: boolean,
 *   startDate?: string,
 *   endDate?: string,
 *   lengthMode?: 'short'|'medium'|'long'
 * }
 *
 * SSE 事件: status → chunk → result { snapshotId, versionTag } → done
 */
export const generateCosmosSnapshot = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { model, force, startDate, endDate, lengthMode } = req.body || {};

  setupSSE(res);
  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  try {
    // 冷却检查（24h 内不重复生成，除非 force=true）
    if (!force) {
      const recent = await query(
        'SELECT id, version_tag FROM cosmos_snapshots WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) LIMIT 1',
        [userId]
      );
      if (recent.rows.length > 0) {
        sendSSE(res, 'result', {
          cached: true,
          snapshotId: recent.rows[0].id,
          versionTag: recent.rows[0].version_tag,
          message: '24 小时内已生成过快照'
        });
        sendSSE(res, 'done', {});
        return res.end();
      }
    }

    // 调用分析管线
    const { snapshot, corpusHash, noteCount } = await analyzeDiariesForCosmos(userId, {
      model: model || 'deepseek-chat',
      startDate,
      endDate,
      force,
      lengthMode,
      signal: abortController.signal,
      onChunk: (delta) => {
        if (delta) sendSSE(res, 'chunk', { content: delta });
      },
      onStatus: (msg) => {
        sendSSE(res, 'status', { message: msg });
      }
    });

    sendSSE(res, 'status', { message: '正在持久化快照...' });

    // 持久化到 cosmos_snapshots
    const versionTag = getSnapshotVersionTag();
    const snapshotJson = JSON.stringify(snapshot);
    const insertResult = await query(
      `INSERT INTO cosmos_snapshots
       (user_id, version_tag, diary_count, time_range_start, time_range_end,
        snapshot_json, corpus_hash, sun_render_type, dominant_schema, swallow_rate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, versionTag, noteCount,
        snapshot.time_range.start_date || null,
        snapshot.time_range.end_date || null,
        snapshotJson, corpusHash,
        snapshot.sun.render_type,
        snapshot.sun.psychological_meta.cbt_schema_type,
        snapshot.sun.psychological_meta.swallow_rate
      ]
    );
    const snapshotId = insertResult.rows.insertId;

    // 注册实体演化链
    await registerEntities(query, userId, snapshotId, snapshot);

    sendSSE(res, 'result', {
      snapshotId,
      versionTag,
      sunRenderType: snapshot.sun.render_type,
      planetCount: snapshot.planets.length,
      satelliteCount: snapshot.satellites.length,
      noteCount
    });
    sendSSE(res, 'done', {});
  } catch (err) {
    console.error('[cosmos] generate error:', err.message);
    sendSSE(res, 'error', { message: '宇宙快照生成失败: ' + err.message });
  } finally {
    res.end();
  }
});

// ── 3. GET /api/cosmos/evolution ───────────────────────

/**
 * 获取演化历史列表
 * Query: ?range=6months (默认)
 */
export const getCosmosEvolution = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const range = req.query.range || '6months';
  let dateLimit = '';
  const params = [userId];

  if (range === '3months') { dateLimit = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 3 MONTH)'; }
  else if (range === '1year') { dateLimit = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)'; }
  else { dateLimit = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)'; }

  const snapshots = await query(
    `SELECT id, version_tag, diary_count, sun_render_type, dominant_schema, swallow_rate, created_at
     FROM cosmos_snapshots WHERE user_id = ? ${dateLimit}
     ORDER BY created_at DESC LIMIT 30`,
    params
  );

  const deltas = await query(
    `SELECT d.id, d.to_snapshot_id, d.delta_json, d.significant_events, d.created_at
     FROM cosmos_evolution_deltas d
     JOIN cosmos_snapshots s ON d.to_snapshot_id = s.id
     WHERE d.user_id = ? ${dateLimit}
     ORDER BY d.created_at DESC LIMIT 30`,
    params
  );

  success(res, {
    snapshots: snapshots.rows.map(s => ({
      ...s,
      swallow_rate: Number(s.swallow_rate || 0)
    })),
    deltas: deltas.rows.map(d => ({
      ...d,
      delta_json: tryParseJSON(d.delta_json),
      significant_events: tryParseJSON(d.significant_events)
    }))
  });
});

// ── 4. GET /api/cosmos/snapshot/:id ────────────────────

/**
 * 按 ID 获取指定快照（含完整 snapshot_json）
 */
export const getCosmosSnapshotById = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const snapshotId = req.params.id;

  const result = await query(
    'SELECT snapshot_json, version_tag, diary_count, created_at FROM cosmos_snapshots WHERE id = ? AND user_id = ?',
    [snapshotId, userId]
  );
  if (result.rows.length === 0) {
    return fail(res, 'Snapshot not found', 404);
  }
  const row = result.rows[0];
  success(res, {
    snapshot: tryParseJSON(row.snapshot_json),
    versionTag: row.version_tag,
    diaryCount: row.diary_count,
    createdAt: row.created_at
  });
});

// ── 工具函数 ────────────────────────────────────────────

function tryParseJSON(str) {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return null; }
}

function getSnapshotVersionTag() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `cosmos-${y}${m}${d}-${h}${min}`;
}

/**
 * 注册当前快照中所有天体到实体演化链
 * @param {number} userId
 * @param {number} snapshotId
 * @param {Object} snapshot
 */
