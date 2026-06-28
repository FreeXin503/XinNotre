-- XinNote v7 Migrations
-- Phase 3: 心智星系 v2 · 图谱持久化 + 报告 + 配置 + 数据源 + 分析缓存
-- 执行顺序: database.js 启动时自动读取并执行(v1→v2→v3→v4→v5→v6→v7)

-- ============================================================
-- T1: 心智图谱——加权有向图的全量快照
-- ============================================================

CREATE TABLE IF NOT EXISTS mind_graphs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    graph_json JSON NOT NULL COMMENT '完整 MentalGraph JSON: {nodes:[{id,type,label,weight,centrality,attributes,sourceRefs,createdAt}],edges:[{id,type,from,to,weight}],timeRange,corpusHash,computedAt}',
    corpus_hash CHAR(64) NOT NULL COMMENT '语料指纹 SHA256',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_graph_hash (user_id, corpus_hash),
    INDEX idx_graph_user_created (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- T2: 观测解读报告
-- ============================================================

CREATE TABLE IF NOT EXISTS observation_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    galaxy_snapshot_id INT NOT NULL COMMENT '关联 cosmos_snapshots',
    report_json JSON NOT NULL COMMENT '完整 ObservationReport JSON (8 章结构)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (galaxy_snapshot_id) REFERENCES cosmos_snapshots(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_report_snapshot (user_id, galaxy_snapshot_id),
    INDEX idx_report_user_created (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- T3: 个性化配置——映射规则/颜色方案/隐藏/重命名/隐私
-- ============================================================

CREATE TABLE IF NOT EXISTS galaxy_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL COMMENT '配置名称',
    config_json JSON NOT NULL COMMENT '完整 GalaxyConfig JSON: {template,colorScheme,spiralArms,windingTightness,hiddenNodeIds,renamedNodes,privacyMode,deleteAfterAnalysis}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_config_user_name (user_id, name),
    INDEX idx_config_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- T4: 多源数据接入记录
-- ============================================================

CREATE TABLE IF NOT EXISTS data_sources (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    source_type ENUM('notes','knowledge','chat','social','voice') NOT NULL COMMENT '数据来源类型',
    source_ref VARCHAR(500) COMMENT '原始数据引用标识',
    content_hash CHAR(64) NOT NULL COMMENT '内容 SHA256',
    segment_count INT DEFAULT 0 COMMENT '分段数',
    preprocess_meta JSON COMMENT '预处理元数据: {is_fragment,word_count,timestamp, etc}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_source_hash (user_id, content_hash),
    INDEX idx_source_user_type (user_id, source_type, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- T5: 分析缓存——向量/嵌入缓存避免重复计算
-- ============================================================

CREATE TABLE IF NOT EXISTS analysis_cache (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    embedding_hash CHAR(64) NOT NULL COMMENT '语义向量 SHA256',
    embedding_vector BLOB COMMENT '词嵌入向量 (Float32Array)',
    metadata_json JSON COMMENT '缓存元数据: {model, dimension, segmented_at, etc}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_embedding_hash (user_id, embedding_hash),
    INDEX idx_cache_user_created (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- ALTER: cosmos_snapshots 扩展 v2 星系参数列 (幂等: database.js 容错 1060)
-- ============================================================

ALTER TABLE cosmos_snapshots ADD COLUMN galaxy_type VARCHAR(8) COMMENT '哈勃分类 E|S|SB|Irr|Merger';
ALTER TABLE cosmos_snapshots ADD COLUMN spiral_arms INT COMMENT '旋臂数量 (2-4)';
ALTER TABLE cosmos_snapshots ADD COLUMN winding_tightness DECIMAL(4,2) COMMENT '缠绕度 [0,1]';
ALTER TABLE cosmos_snapshots ADD COLUMN core_bulge_size DECIMAL(4,2) COMMENT '核球大小 (0-10)';
ALTER TABLE cosmos_snapshots ADD COLUMN flatness DECIMAL(4,2) COMMENT '扁率 [0,1]';
