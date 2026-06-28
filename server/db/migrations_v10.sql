-- D5: 双人星系引力互动 · 关系邀请表
CREATE TABLE IF NOT EXISTS relationship_invitations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  inviter_id INT NOT NULL,
  invitee_id INT NOT NULL,
  status ENUM('pending','accepted','revoked') DEFAULT 'pending',
  share_token VARCHAR(32) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP NULL,
  FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (invitee_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_pair (inviter_id, invitee_id),
  INDEX idx_invitee (invitee_id),
  INDEX idx_token (share_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
