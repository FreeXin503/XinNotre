/**
 * 心智星系 v2 · 数据访问层 (Repository)
 * 职责：封装 mind_graphs / cosmos_snapshots / observation_reports / galaxy_configs / data_sources / analysis_cache 的 SQL 操作
 *
 * 所有 SQL 参数化；不存在记录返回 null
 */
import { query } from '../config/database.js';

class MindGalaxyRepository {
  constructor(dbQuery = query) {
    this.q = dbQuery;
  }

  // ── 心智图谱 ─────────────────────────────────────────────

  async saveGraph(userId, graph) {
    const j = typeof graph === 'string' ? graph : JSON.stringify(graph);
    const hash = graph.corpusHash || '';
    const { rows } = await this.q(
      'INSERT INTO mind_graphs (user_id, graph_json, corpus_hash) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE graph_json = VALUES(graph_json)',
      [userId, j, hash]
    );
    return rows.insertId;
  }

  async getLatestGraph(userId) {
    const { rows } = await this.q(
      'SELECT * FROM mind_graphs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
    if (!rows.length) return null;
    const row = rows[0];
    row.graph_json = typeof row.graph_json === 'string' ? JSON.parse(row.graph_json) : row.graph_json;
    return row;
  }

  // ── 星系快照（复写 cosmos_snapshots）───────────────────

  async saveSnapshot(userId, snapshot) {
    const j = typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot);
    const { rows } = await this.q(
      `INSERT INTO cosmos_snapshots
        (user_id, version_tag, diary_count, time_range_start, time_range_end, snapshot_json,
         corpus_hash, sun_render_type, dominant_schema, swallow_rate,
         galaxy_type, spiral_arms, winding_tightness, core_bulge_size, flatness)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        snapshot.versionTag,
        snapshot.analyzedDiaryCount || 0,
        snapshot.timeRange?.start || null,
        snapshot.timeRange?.end || null,
        j,
        snapshot.corpusHash || '',
        snapshot.bodies?.find(b => b.type === 'black_hole')?.visual?.radius ? 'BLACK_HOLE' : 'YELLOW_GIANT',
        null,
        null,
        snapshot.galaxyType || 'S',
        snapshot.spiralArms || 3,
        snapshot.windingTightness || 0.5,
        snapshot.coreBulgeSize || 4,
        snapshot.flatness || 0.3
      ]
    );
    return rows.insertId;
  }

  async getLatestSnapshot(userId) {
    const { rows } = await this.q(
      'SELECT * FROM cosmos_snapshots WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
    if (!rows.length) return null;
    const row = rows[0];
    row.snapshot_json = typeof row.snapshot_json === 'string' ? JSON.parse(row.snapshot_json) : row.snapshot_json;
    return row;
  }

  async getSnapshotById(id, userId) {
    const { rows } = await this.q(
      'SELECT * FROM cosmos_snapshots WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    if (!rows.length) return null;
    const row = rows[0];
    row.snapshot_json = typeof row.snapshot_json === 'string' ? JSON.parse(row.snapshot_json) : row.snapshot_json;
    return row;
  }

  async listSnapshots(userId, limit = 12) {
    const clamped = Math.min(Math.max(1, limit), 100);
    const { rows } = await this.q(
      `SELECT id, version_tag, diary_count, time_range_start, time_range_end,
              corpus_hash, sun_render_type, galaxy_type, swallow_rate, created_at
       FROM cosmos_snapshots WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
      [userId, clamped]
    );
    return rows;
  }

  // ── 解读报告 ─────────────────────────────────────────────

  async saveReport(userId, galaxySnapshotId, report) {
    const j = typeof report === 'string' ? report : JSON.stringify(report);
    const { rows } = await this.q(
      'INSERT INTO observation_reports (user_id, galaxy_snapshot_id, report_json) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE report_json = VALUES(report_json)',
      [userId, galaxySnapshotId, j]
    );
    return rows.insertId;
  }

  async getReportBySnapshotId(userId, galaxySnapshotId) {
    const { rows } = await this.q(
      'SELECT * FROM observation_reports WHERE user_id = ? AND galaxy_snapshot_id = ?',
      [userId, galaxySnapshotId]
    );
    if (!rows.length) return null;
    const row = rows[0];
    row.report_json = typeof row.report_json === 'string' ? JSON.parse(row.report_json) : row.report_json;
    return row;
  }

  // ── 个性化配置 ───────────────────────────────────────────

  async saveConfig(userId, config) {
    const j = typeof config === 'string' ? config : JSON.stringify(config);
    const { rows } = await this.q(
      'INSERT INTO galaxy_configs (user_id, name, config_json) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE config_json = VALUES(config_json), updated_at = CURRENT_TIMESTAMP',
      [userId, config.name, j]
    );
    return rows.insertId;
  }

  async getConfig(userId, configId) {
    const { rows } = await this.q(
      'SELECT * FROM galaxy_configs WHERE id = ? AND user_id = ?',
      [configId, userId]
    );
    if (!rows.length) return null;
    const row = rows[0];
    row.config_json = typeof row.config_json === 'string' ? JSON.parse(row.config_json) : row.config_json;
    return row;
  }

  async listConfigs(userId) {
    const { rows } = await this.q(
      'SELECT id, name, updated_at FROM galaxy_configs WHERE user_id = ? ORDER BY updated_at DESC',
      [userId]
    );
    return rows;
  }

  async deleteConfig(userId, configId) {
    const { rows } = await this.q(
      'DELETE FROM galaxy_configs WHERE id = ? AND user_id = ?',
      [configId, userId]
    );
    return rows.affectedRows > 0;
  }

  // ── 数据源 ───────────────────────────────────────────────

  async insertDataSource(userId, data) {
    const { rows } = await this.q(
      'INSERT INTO data_sources (user_id, source_type, source_ref, content_hash, segment_count, preprocess_meta) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE segment_count = VALUES(segment_count)',
      [
        userId,
        data.sourceType || 'notes',
        data.sourceRef || null,
        data.contentHash || '',
        data.segmentCount || 0,
        data.preprocessMeta ? JSON.stringify(data.preprocessMeta) : null
      ]
    );
    return rows.insertId;
  }

  async listDataSources(userId, options = {}) {
    const { sourceType, limit = 50 } = options;
    const clamped = Math.min(Math.max(1, limit), 200);
    let sql = 'SELECT * FROM data_sources WHERE user_id = ?';
    const params = [userId];
    if (sourceType) {
      sql += ' AND source_type = ?';
      params.push(sourceType);
    }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(clamped);
    const { rows } = await this.q(sql, params);
    return rows;
  }

  // ── 分析缓存 ─────────────────────────────────────────────

  async upsertEmbeddingCache(userId, hash, vector, metadata) {
    const { rows } = await this.q(
      'INSERT INTO analysis_cache (user_id, embedding_hash, embedding_vector, metadata_json) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE embedding_vector = VALUES(embedding_vector), metadata_json = VALUES(metadata_json)',
      [
        userId,
        hash,
        vector || null,
        metadata ? JSON.stringify(metadata) : null
      ]
    );
    return rows.insertId;
  }

  async getEmbeddingCache(userId, hash) {
    const { rows } = await this.q(
      'SELECT * FROM analysis_cache WHERE user_id = ? AND embedding_hash = ?',
      [userId, hash]
    );
    if (!rows.length) return null;
    const row = rows[0];
    try { row.metadata_json = row.metadata_json ? JSON.parse(typeof row.metadata_json === 'string' ? row.metadata_json : row.metadata_json) : null; } catch { /* raw if not JSON */ }
    return row;
  }
}

export default MindGalaxyRepository;
