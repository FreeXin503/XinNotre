-- =============================================
-- Phase 1: Archaeology / Persona
-- =============================================

CREATE TABLE IF NOT EXISTS archaeology_cards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  note_id VARCHAR(100) NOT NULL,
  dig_mode VARCHAR(20) DEFAULT 'random',
  dig_seed VARCHAR(100),
  meta_json JSON,
  appraisal LONGTEXT,
  is_appraised BOOLEAN DEFAULT FALSE,
  dug_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_note_dig (user_id, note_id, dig_mode),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS persona_snapshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  version_tag VARCHAR(40) NOT NULL,
  corpus_hash VARCHAR(64) NOT NULL,
  note_count INT,
  radar_json JSON NOT NULL,
  keywords_json JSON,
  summary TEXT,
  cross_talk TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS persona_versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  snapshot_id INT NOT NULL,
  seq INT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (snapshot_id) REFERENCES persona_snapshots(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_user_seq (user_id, seq)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Phase 2: Emotion Weather / Almanac / Growth
-- =============================================

CREATE TABLE IF NOT EXISTS emotion_weather_grid (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  day_date DATE NOT NULL,
  mood_score INT,
  emotion_label VARCHAR(20),
  emotion_color VARCHAR(16),
  top_words JSON,
  note_count INT DEFAULT 0,
  annotated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_day (user_id, day_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_day (user_id, day_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS almanac_volumes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  report_id INT NOT NULL,
  volume_title VARCHAR(200) NOT NULL,
  cover_theme VARCHAR(40) DEFAULT 'aurora',
  top_quotes JSON,
  top_persons JSON,
  milestones JSON,
  keyword_evolution JSON,
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (report_id) REFERENCES ai_reports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS growth_goals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  source_note_id VARCHAR(100),
  goal_text TEXT NOT NULL,
  goal_summary VARCHAR(200),
  category VARCHAR(40),
  raised_at DATE,
  status VARCHAR(20) DEFAULT 'pending',
  status_changed_at TIMESTAMP NULL,
  settled_year INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (source_note_id) REFERENCES notes(id) ON DELETE SET NULL,
  INDEX idx_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS growth_evidence (
  id INT AUTO_INCREMENT PRIMARY KEY,
  goal_id INT NOT NULL,
  note_id VARCHAR(100) NOT NULL,
  evidence_type VARCHAR(20),
  note_text VARCHAR(500),
  linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (goal_id) REFERENCES growth_goals(id) ON DELETE CASCADE,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_goal_note (goal_id, note_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
