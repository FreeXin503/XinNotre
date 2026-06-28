/**
 * 心迹星图 · 心智宇宙触发器（轻量 Hook）
 * 职责：当有新日记写入时，异步触发宇宙快照更新。
 * 使用防抖机制防止频繁触发。
 *
 * 与 noteRepository 低耦合，不持有任何数据库引用，
 * 仅提供一个队列接口供 noteRepository 在写入后 fire-and-forget 调用。
 */
let pendingUserId = null;
let pendingTimeout = null;
let lastTriggerTime = new Map(); // userId → timestamp

/**
 * 请求更新宇宙快照（防抖，5 分钟内同用户只触发一次）
 * @param {number} userId
 */
export function requestCosmosUpdate(userId) {
  const now = Date.now();
  const last = lastTriggerTime.get(userId) || 0;

  // 防抖：5 分钟内不重复触发
  if (now - last < 300000) {
    return;
  }

  lastTriggerTime.set(userId, now);

  // 异步触发，不阻塞主流程
  runCosmosUpdate(userId).catch(err => {
    console.error('[cosmosHook] update failed:', err.message);
  });
}

/**
 * 实际的宇宙快照更新逻辑（异步）
 * @param {number} userId
 */
async function runCosmosUpdate(userId) {
  try {
    const { analyzeDiariesForCosmos } = await import('./cosmosService.js');
    const { query } = await import('../config/database.js');

    const { snapshot, corpusHash, noteCount } = await analyzeDiariesForCosmos(userId, {
      model: 'deepseek-chat',
      force: false
    });

    const versionTag = `hook-${Date.now().toString(36)}`;
    const snapshotJson = JSON.stringify(snapshot);

    await query(
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
  } catch (err) {
    if (err.message && err.message.includes('日记不足')) {
      // 日记不足不是错误，忽略
      return;
    }
    console.error('[cosmosHook] runCosmosUpdate error:', err.message);
  }
}

/**
 * 清除防抖缓存（用于测试或手动重置）
 */
export function clearDebounce(userId) {
  lastTriggerTime.delete(userId);
}
