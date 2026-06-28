-- XinNote v5 Migrations
-- Phase 2: 3D 心智星相图 · 快照持久化 + 实体演化链 + 增量 Delta
--
-- 执行顺序: database.js 启动时自动读取并执行(v1→v2→v3→v4→v5)

-- ============================================================
-- T1: 心智宇宙快照（每周期/每次日记写入触发）
-- ============================================================

CREATE TABLE IF NOT EXISTS cosmos_snapshots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    version_tag VARCHAR(40) NOT NULL COMMENT '如 2026-W26 或 snapshot-{timestamp}',
    diary_count INT COMMENT '分析的日记数',
    time_range_start DATE COMMENT '分析起始日期',
    time_range_end DATE COMMENT '分析结束日期',
    snapshot_json JSON NOT NULL COMMENT '完整 ThreeCosmosSnapshotV3 JSON',
    corpus_hash CHAR(64) NOT NULL COMMENT '日记语料指纹，用于增量检测',
    sun_render_type VARCHAR(20) COMMENT '当前核心类型: YELLOW_GIANT|BLUE_SUPERGIANT|BLACK_HOLE',
    dominant_schema VARCHAR(100) COMMENT '主导 CBT 图式: 如 VALUE_DEFECTIVENESS',
    swallow_rate DECIMAL(5,2) DEFAULT 0.00 COMMENT '吞噬率 [0,100]: 黑洞吞噬健康心理的速率',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_cosmos_snapshot_user (user_id, created_at DESC),
    INDEX idx_cosmos_snapshot_user_tag (user_id, version_tag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- T2: 实体演化注册表——保证天体 ID 在时间序列中一致
-- ============================================================

CREATE TABLE IF NOT EXISTS cosmos_entity_registry (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    entity_id VARCHAR(100) NOT NULL COMMENT '天体 ID (sun/planet/satellite/nebula)',
    entity_type VARCHAR(30) NOT NULL COMMENT 'sun|planet|satellite|nebula|desire_clump',
    stable_identity_hash CHAR(64) NOT NULL COMMENT 'SHA-256(心理语义特征)，用于跨快照匹配',
    first_seen_at_snapshot_id INT COMMENT '首次出现的快照 ID',
    last_seen_at_snapshot_id INT COMMENT '最近出现的快照 ID',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否仍在当前心理宇宙中存在',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (first_seen_at_snapshot_id) REFERENCES cosmos_snapshots(id) ON DELETE SET NULL,
    FOREIGN KEY (last_seen_at_snapshot_id) REFERENCES cosmos_snapshots(id) ON DELETE SET NULL,
    UNIQUE KEY uniq_entity_hash (user_id, stable_identity_hash),
    INDEX idx_entity_user_type (user_id, entity_type, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- T3: 演化增量池——相邻快照间的参数变化
-- ============================================================

CREATE TABLE IF NOT EXISTS cosmos_evolution_deltas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    from_snapshot_id INT NOT NULL COMMENT '前一个快照',
    to_snapshot_id INT NOT NULL COMMENT '后一个快照',
    delta_json JSON NOT NULL COMMENT '所有天体的参数增量 {sun:{radius_delta,swallow_delta},planets:[{id,e_delta,r_delta}]}',
    significant_events JSON COMMENT '重大事件: ["霍金辐射":黑洞质量骤降, "行星碰撞":两颗行星语义冲突]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (from_snapshot_id) REFERENCES cosmos_snapshots(id) ON DELETE CASCADE,
    FOREIGN KEY (to_snapshot_id) REFERENCES cosmos_snapshots(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_delta_pair (user_id, from_snapshot_id, to_snapshot_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
