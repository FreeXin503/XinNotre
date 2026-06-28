/**
 * 心迹星图 · 心智宇宙时序演化引擎
 *
 * 职责：
 *   1. 周滑窗批量分析——将半年日记按周切片生成快照序列
 *   2. 相邻快照 Delta 计算——对比参数变化（用于前端 Tween 动画）
 *   3. 稳定实体 ID 解析——同一思维模式跨快照保持 ID 一致
 *
 * 并发安全：使用 runningLocks Map 防止重复运行（同 batchAnnotationService 模式）
 */
import { query, withTransaction } from '../config/database.js';
import { analyzeDiariesForCosmos, registerEntities } from './cosmosService.js';
import { getCorpus } from './corpusService.js';
import crypto from 'crypto';

// ── 并发锁 ──────────────────────────────────────────────

const runningLocks = new Map();

function acquireLock(userId) {
  if (runningLocks.get(userId)?.has('cosmos_evolution')) {
    throw new Error('宇宙演化分析正在进行中');
  }
  if (!runningLocks.has(userId)) runningLocks.set(userId, new Set());
  runningLocks.get(userId).add('cosmos_evolution');
}

function releaseLock(userId) {
  runningLocks.get(userId)?.delete('cosmos_evolution');
  if (runningLocks.get(userId)?.size === 0) runningLocks.delete(userId);
}

// ════════════════════════════════════════════════════════════
// 1. 周滑窗批量快照生成
// ════════════════════════════════════════════════════════════

/**
 * 批量生成指定时间范围内的周级宇宙快照
 *
 * @param {number} userId
 * @param {Object} options
 * @param {string} options.startDate - YYYY-MM-DD
 * @param {string} options.endDate - YYYY-MM-DD
 * @param {string} [options.model='deepseek-chat']
 * @param {function} [options.onProgress] - (current, total, phase) => void
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ snapshotIds: number[], weekCount: number }>}
 */
export async function batchEvolutionarySnapshots(userId, options) {
  const { startDate, endDate, model = 'deepseek-chat', onProgress = null, signal = null } = options;

  acquireLock(userId);
  const snapshotIds = [];

  try {
    // 1. 按周分割时间范围
    const weeks = splitIntoWeeks(startDate, endDate);
    if (weeks.length > 26) {
      // 限制最多 26 周
      weeks.splice(0, weeks.length - 26);
    }

    if (onProgress) onProgress(0, weeks.length, '初始化');

    // 2. 逐周分析
    for (let i = 0; i < weeks.length; i++) {
      if (signal?.aborted) break;

      const week = weeks[i];
      if (onProgress) onProgress(i + 1, weeks.length, `分析第 ${i + 1}/${weeks.length} 周`);

      try {
        // 检查该周日记数
        const countResult = await query(
          `SELECT COUNT(*) as count FROM notes
           WHERE user_id = ? AND is_deleted = FALSE
           AND created_at >= ? AND created_at < ?
           AND content IS NOT NULL AND LENGTH(content) > 20`,
          [userId, week.start, week.end]
        );
        const noteCount = Number(countResult.rows[0]?.count || 0);
        if (noteCount < 3) {
          continue; // 跳过日记不足 3 篇的周
        }

        // 生成该周快照
        const { snapshot, corpusHash } = await analyzeDiariesForCosmos(userId, {
          model,
          startDate: week.start,
          endDate: week.end,
          signal
        });

        // 持久化
        const versionTag = `evol-${week.start.replace(/-/g, '')}`;
        const snapshotJson = JSON.stringify(snapshot);

        const insertResult = await query(
          `INSERT INTO cosmos_snapshots
           (user_id, version_tag, diary_count, time_range_start, time_range_end,
            snapshot_json, corpus_hash, sun_render_type, dominant_schema, swallow_rate)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId, versionTag, noteCount,
            week.start, week.end,
            snapshotJson, corpusHash || '',
            snapshot.sun.render_type,
            snapshot.sun.psychological_meta.cbt_schema_type,
            snapshot.sun.psychological_meta.swallow_rate
          ]
        );
        const snapshotId = insertResult.rows.insertId;
        snapshotIds.push(snapshotId);

        // 注册实体（从 cosmosController 复用）
        await registerEntities(query, userId, snapshotId, snapshot);
      } catch (weekErr) {
        console.error(`[evolution] 第 ${i + 1} 周分析失败:`, weekErr.message);
        continue; // 某周失败不中止整体流程
      }
    }

    // 3. 计算所有相邻 Delta
    if (snapshotIds.length >= 2) {
      if (onProgress) onProgress(snapshotIds.length, snapshotIds.length, '计算演化增量...');
      for (let i = 1; i < snapshotIds.length; i++) {
        try {
          await computeEvolutionDelta(snapshotIds[i - 1], snapshotIds[i]);
        } catch (deltaErr) {
          console.error(`[evolution] delta ${i} 计算失败:`, deltaErr.message);
        }
      }
    }

    return { snapshotIds, weekCount: snapshotIds.length };
  } finally {
    releaseLock(userId);
  }
}

// ════════════════════════════════════════════════════════════
// 2. 相邻快照 Delta 计算
// ════════════════════════════════════════════════════════════

/**
 * 计算前后两个快照的演化增量
 * @param {number} prevSnapshotId
 * @param {number} nextSnapshotId
 * @returns {Promise<Object>} delta_json
 */
export async function computeEvolutionDelta(prevSnapshotId, nextSnapshotId) {
  const [prevRes, nextRes] = await Promise.all([
    query('SELECT user_id, snapshot_json FROM cosmos_snapshots WHERE id = ?', [prevSnapshotId]),
    query('SELECT user_id, snapshot_json FROM cosmos_snapshots WHERE id = ?', [nextSnapshotId])
  ]);

  if (prevRes.rows.length === 0 || nextRes.rows.length === 0) {
    throw new Error('快照不存在');
  }

  const userId = prevRes.rows[0].user_id;
  const prev = tryParseJSON(prevRes.rows[0].snapshot_json);
  const next = tryParseJSON(nextRes.rows[0].snapshot_json);

  if (!prev || !next) throw new Error('快照 JSON 解析失败');

  // ── Sun delta ──
  const sunDelta = {
    radius_delta: round1((next.sun?.geometry?.radius || 0) - (prev.sun?.geometry?.radius || 0)),
    swallow_delta: round1(
      (next.sun?.psychological_meta?.swallow_rate || 0) - (prev.sun?.psychological_meta?.swallow_rate || 0)
    ),
    render_type_changed: (prev.sun?.render_type !== next.sun?.render_type)
  };

  // ── Planets delta ──
  const planetDeltas = (next.planets || []).map(nPlanet => {
    const pPrev = (prev.planets || []).find(p => p.life_domain === nPlanet.life_domain);
    if (!pPrev) return { life_domain: nPlanet.life_domain, is_new: true, e_delta: 0, r_delta: 0 };
    return {
      life_domain: nPlanet.life_domain,
      is_new: false,
      e_delta: round1((nPlanet.kepler_orbit?.eccentricity || 0) - (pPrev.kepler_orbit?.eccentricity || 0)),
      radius_delta: round1((nPlanet.visual_layer?.radius || 0) - (pPrev.visual_layer?.radius || 0)),
      atmosphere_delta: round1((nPlanet.visual_layer?.atmosphere_density || 0) - (pPrev.visual_layer?.atmosphere_density || 0)),
      crater_delta: (nPlanet.visual_layer?.crater_count || 0) - (pPrev.visual_layer?.crater_count || 0)
    };
  });

  // ── 重大事件检测 ──
  const significantEvents = [];

  // 霍金辐射：黑洞 swallow_rate 骤降 >30%
  if (sunDelta.swallow_delta < -30) {
    significantEvents.push('霍金辐射: 黑洞吞噬率骤降' + Math.abs(sunDelta.swallow_delta).toFixed(0) + '%');
  }

  // 恒星重生：BLACK_HOLE → YELLOW_GIANT
  if (sunDelta.render_type_changed && next.sun?.render_type === 'YELLOW_GIANT') {
    significantEvents.push('恒星重生: 黑洞重新点燃为健康恒星');
  }

  // 行星碰撞
  planetDeltas.forEach(pd => {
    if (pd.e_delta > 0.3) {
      significantEvents.push(`轨道扰动: ${pd.life_domain} 离心率骤增 ${pd.e_delta.toFixed(2)}`);
    }
    if (pd.crater_delta > 10) {
      significantEvents.push(`陨石撞击: ${pd.life_domain} 新增 ${pd.crater_delta} 个陨石坑`);
    }
  });

  // ── 持久化 Delta ──
  const deltaJson = {
    sun: sunDelta,
    planets: planetDeltas,
    sat_count_change: (next.satellites?.length || 0) - (prev.satellites?.length || 0),
    nebula_count_change: (next.nebulas?.length || 0) - (prev.nebulas?.length || 0)
  };

  await query(
    `INSERT INTO cosmos_evolution_deltas (user_id, from_snapshot_id, to_snapshot_id, delta_json, significant_events)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE delta_json = VALUES(delta_json), significant_events = VALUES(significant_events)`,
    [userId, prevSnapshotId, nextSnapshotId, JSON.stringify(deltaJson), JSON.stringify(significantEvents)]
  );

  return deltaJson;
}

// ════════════════════════════════════════════════════════════
// 3. 稳定实体 ID 解析
// ════════════════════════════════════════════════════════════

/**
 * 解析或生成稳定的实体 ID
 * @param {number} userId
 * @param {string} entityType - sun|planet|satellite|nebula|desire_clump
 * @param {Object} psychologyData - 心理特征数据
 * @returns {Promise<string>} 稳定的 entity_id
 */
export async function resolveStableEntityId(userId, entityType, psychologyData) {
  // 计算 stable_identity_hash
  const hashInput = JSON.stringify({
    entityType,
    domain: psychologyData.life_domain || '',
    schemaType: psychologyData.cbt_schema_type || '',
    distortionTags: psychologyData.distortion_tags || []
  });
  const hash = crypto.createHash('sha256').update(hashInput, 'utf8').digest('hex');

  // 查询 registry
  const existing = await query(
    'SELECT entity_id FROM cosmos_entity_registry WHERE user_id = ? AND stable_identity_hash = ? LIMIT 1',
    [userId, hash]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].entity_id;
  }

  // 不存在则生成新 ID
  const newId = `cosmos-${entityType}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  return newId;
}

// ════════════════════════════════════════════════════════════
// 工具函数
// ════════════════════════════════════════════════════════════

/**
 * 将日期范围按周分割
 * @param {string} startDate
 * @param {string} endDate
 * @returns {Array<{ start: string, end: string }>}
 */
function splitIntoWeeks(startDate, endDate) {
  const weeks = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  let current = new Date(start);
  while (current < end) {
    const weekStart = new Date(current);
    current.setDate(current.getDate() + 7);
    const weekEnd = current > end ? new Date(end) : new Date(current);
    weeks.push({
      start: weekStart.toISOString().slice(0, 10),
      end: weekEnd.toISOString().slice(0, 10)
    });
  }

  return weeks;
}

function tryParseJSON(str) {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return null; }
}

function round1(val) {
  if (typeof val !== 'number' || isNaN(val)) return 0;
  return Math.round(val * 10) / 10;
}

}
