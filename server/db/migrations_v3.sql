-- =============================================================
-- XinNote migrations_v3.sql
-- Phase 0: 安全地基 + 新表(MVP 预留)
-- =============================================================

-- 1. user_api_keys 补唯一索引 (防止 ON DUPLICATE KEY 行为异常)
ALTER TABLE user_api_keys ADD UNIQUE INDEX uq_user_provider (user_id, provider);

-- 2. ai_reports 增加分享过期时间列 (shareController 使用)
ALTER TABLE ai_reports ADD COLUMN share_expires_at TIMESTAMP NULL DEFAULT NULL AFTER share_token;

-- 3. emotion_snapshots 表标记 (预留清理, 当前可保留)

-- 4. penpal_threads (C1 跨时空笔友)
CREATE TABLE IF NOT EXISTS penpal_threads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  persona_label VARCHAR(80) NOT NULL COMMENT '如"2021 年的我"',
  window_start DATE NOT NULL,
  window_end DATE NOT NULL,
  corpus_hash CHAR(64) NOT NULL COMMENT '锁定在该窗口语料指纹',
  letter_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. penpal_letters (C1 来往信件)
CREATE TABLE IF NOT EXISTS penpal_letters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  thread_id INT NOT NULL,
  role ENUM('user', 'past_self') NOT NULL,
  content TEXT NOT NULL,
  truncated TINYINT(1) DEFAULT 0 COMMENT 'SSE 中断半截标记',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (thread_id) REFERENCES penpal_threads(id) ON DELETE CASCADE,
  INDEX idx_penpal_letters_thread (thread_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. sealed_letters (C2 致未来的信)
CREATE TABLE IF NOT EXISTS sealed_letters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(200) DEFAULT NULL,
  content LONGTEXT NOT NULL,
  sealed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  trigger_type ENUM('date', 'next_sync', 'goal_done', 'reverse') NOT NULL,
  trigger_value VARCHAR(64) DEFAULT NULL COMMENT 'date 时为 YYYY-MM-DD, goal_done 时为 goalId, reverse 不填',
  delivered_at TIMESTAMP NULL DEFAULT NULL,
  delivery_persona_snapshot_id INT DEFAULT NULL COMMENT 'FK persona_snapshots.id',
  wax_seal_emoji VARCHAR(16) DEFAULT '📮',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sealed_letters_user (user_id, delivered_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. memoirs (D2 主题回忆录)
CREATE TABLE IF NOT EXISTS memoirs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  theme VARCHAR(200) NOT NULL,
  status ENUM('draft', 'generated', 'published') DEFAULT 'draft',
  chapter_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. memoir_chapters (D2 回忆录章节)
CREATE TABLE IF NOT EXISTS memoir_chapters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  memoir_id INT NOT NULL,
  seq INT NOT NULL,
  title VARCHAR(200) DEFAULT NULL,
  content LONGTEXT DEFAULT NULL,
  citations_json JSON DEFAULT NULL COMMENT '[{noteId, quote, created_at}]',
  FOREIGN KEY (memoir_id) REFERENCES memoirs(id) ON DELETE CASCADE,
  UNIQUE KEY uq_memoir_chapter (memoir_id, seq)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
