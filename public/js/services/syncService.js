/**
 * 心迹星图 云同步服务
 * 职责：将本地备份文件同步至云端数据库，含智能去重、进度反馈、批量分片
 *
 * 设计要点：
 * - 大文件分片上传（每片 ≤100 条）
 * - 基于 updated_at 的去重策略（较新者优先）
 * - 同步进度通过 onProgress 回调实时反馈
 * - 网络中断后提示用户手动重试（不自动重试避免数据覆盖）
 */
import { ApiClient } from '../api.js';
import { store } from '../core/state.js';

// ── 常量 ────────────────────────────────────────────────

const BATCH_SIZE = 100; // 每批最多 100 条

// ── 错误 ────────────────────────────────────────────────

export class SyncError extends Error {
  constructor(message, code = 'SYNC_ERROR', details = undefined) {
    super(message);
    this.name = 'SyncError';
    this.code = code;
    this.details = details;
  }
}

// ── 核心导出 ────────────────────────────────────────────

/**
 * @typedef {Object} SyncOptions
 * @property {(current:number, total:number)=>void} [onProgress]
 */

/**
 * @typedef {Object} SyncResult
 * @property {number} inserted
 * @property {number} updated
 * @property {number} skipped
 */

/**
 * 将本地备份同步至云端
 * @param {Array<{id:string, notes:Object[], categories:Object}>} localFiles - importedFiles（不含 db-notes）
 * @param {SyncOptions} [options]
 * @returns {Promise<SyncResult>}
 */
export async function syncLocalToCloud(localFiles, options = {}) {
  if (!localFiles || localFiles.length === 0) {
    throw new SyncError('当前没有载入本地备份文件', 'NO_FILES');
  }

  // 1. 收集所有分类下的便签并去重
  let allNotesMap = new Map();

  localFiles.forEach(file => {
    if (!file.categories) return;
    Object.keys(file.categories).forEach(catName => {
      const notes = file.categories[catName] || [];
      notes.forEach(n => {
        // 跳过 '全部便签' 中的去重（已在分类中覆盖）
        allNotesMap.set(n.id, {
          id: n.id,
          title: n.title,
          content: n.content,
          category: n.category || '未分类',
          date: n.date
        });
      });
    });
  });

  const allNotes = Array.from(allNotesMap.values());
  if (allNotes.length === 0) {
    throw new SyncError('所选目录中没有便签数据', 'EMPTY');
  }

  // 2. 分片上传
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  const totalBatches = Math.ceil(allNotes.length / BATCH_SIZE);

  for (let i = 0; i < allNotes.length; i += BATCH_SIZE) {
    const batch = allNotes.slice(i, i + BATCH_SIZE);
    const batchIndex = Math.floor(i / BATCH_SIZE) + 1;

    // 进度回调
    if (options.onProgress) {
      options.onProgress(Math.min(i + batch.length, allNotes.length), allNotes.length);
    }

    try {
      const res = await ApiClient.syncPush(batch);
      if (res.stats) {
        totalInserted += res.stats.inserted || 0;
        totalUpdated += res.stats.updated || 0;
        totalSkipped += res.stats.skipped || 0;
      }
    } catch (err) {
      // 网络中断不自动重试，抛出让用户决策
      throw new SyncError(
        `同步在第 ${batchIndex}/${totalBatches} 批时中断: ${err.message}`,
        'BATCH_FAILED',
        { batchIndex, totalBatches, processed: i + batch.length, total: allNotes.length }
      );
    }
  }

  // 3. 刷新同步历史和便签列表
  try {
    await fetchSyncHistory();
    store.setState('activeFileId', 'db-notes');
    store.setState('activeCategoryName', '全部便签');
  } catch (err) {
    console.error('[syncService] 刷新同步后数据失败:', err.message);
  }

  return { inserted: totalInserted, updated: totalUpdated, skipped: totalSkipped };
}

/**
 * 获取同步历史记录
 * @returns {Promise<Object[]>}
 */
export async function fetchSyncHistory() {
  try {
    const data = await ApiClient.getSyncHistory();
    const history = data.history || [];
    store.setState('syncHistory', history);
    return history;
  } catch (err) {
    console.error('[syncService] 获取同步历史失败:', err.message);
    return [];
  }
}

/**
 * 获取同步历史（仅读取 store，不发起网络请求）
 * @returns {Object[]}
 */
export function getCachedSyncHistory() {
  return store.getState('syncHistory') || [];
}

// ── 内部去重工具 ────────────────────────────────────────

/**
 * 基于 id 和 updated_at 的去重合并
 * @param {Object[]} localNotes
 * @param {Object[]} remoteNotes
 * @returns {Object[]} 需要同步的便签列表
 */
export function dedupNotes(localNotes, remoteNotes) {
  const remoteMap = new Map();
  remoteNotes.forEach(n => remoteMap.set(n.id, n));

  return localNotes.filter(local => {
    const remote = remoteMap.get(local.id);
    if (!remote) return true; // 本地有但远程没有 → 需要同步

    // 比较 updated_at，较新的需要同步
    const localTime = new Date(local.updated_at || local.date || 0).getTime();
    const remoteTime = new Date(remote.updated_at || 0).getTime();
    return localTime > remoteTime;
  });
}
