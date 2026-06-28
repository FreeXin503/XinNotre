-- F1: 为 cosmos_snapshots 表增加 updated_at 字段（编辑接口走 UPDATE 需要）
ALTER TABLE cosmos_snapshots ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
