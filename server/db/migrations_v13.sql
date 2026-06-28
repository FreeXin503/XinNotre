-- D9: 信念系统 5 维度检验表
CREATE TABLE IF NOT EXISTS belief_checks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  belief_text VARCHAR(500) NOT NULL,
  scores_json JSON NOT NULL COMMENT '{evidenceStrength,logicalConsistency,counterexampleTolerance,emotionalLoad,behavioralConsequence}',
  risk VARCHAR(10) NOT NULL COMMENT 'low|medium|high',
  alternatives_json JSON NOT NULL COMMENT 'string[]',
  raw_analysis TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_beliefs (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
