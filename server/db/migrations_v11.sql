-- D6: 多人匿名聚合星系 · 聚合会话表
CREATE TABLE IF NOT EXISTS aggregate_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(32) NOT NULL,
  user_id INT NOT NULL,
  payload_json JSON NOT NULL COMMENT '匿名化后的统计payload: {topicVectors,emotionHistogram,anonBodies}',
  participant_count INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_session (session_id),
  UNIQUE KEY uniq_session_user (session_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
