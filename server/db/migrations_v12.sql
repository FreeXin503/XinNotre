-- D8: 苏格拉底式反思引导 · 会话表
CREATE TABLE IF NOT EXISTS socratic_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  session_id VARCHAR(36) NOT NULL,
  stage ENUM('clarify','counterexample','verify','summary') DEFAULT 'clarify',
  turn_count INT DEFAULT 0,
  initial_topic VARCHAR(500) NOT NULL,
  history_json JSON NOT NULL COMMENT '[{role,content,stage}]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_session (session_id),
  INDEX idx_user_sessions (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
