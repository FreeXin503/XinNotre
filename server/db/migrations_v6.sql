-- 迁移追踪表：记录已应用的迁移版本
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL DEFAULT '',
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
