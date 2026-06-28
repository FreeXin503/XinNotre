-- D10: 数字心智持续演化 · 快照表
CREATE TABLE IF NOT EXISTS digital_twin_snapshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  epoch DATE NOT NULL,
  epoch_end DATE NOT NULL,
  persona_json JSON NOT NULL,
  source_snapshot_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_user_epoch (user_id, epoch)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
