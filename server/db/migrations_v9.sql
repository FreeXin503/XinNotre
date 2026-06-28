-- D1: notes 表添加 meta_json 列，用于导入元数据（DayOne location/weather/photos 等）
ALTER TABLE notes ADD COLUMN meta_json JSON NULL COMMENT '导入元数据: {dayone:{weather,location,photos,sampledAt},truncated} AFTER word_count;

-- D4: data_sources source_type ENUM 扩展 'import' 类型（原值为 notes/knowledge/chat/social/voice）
ALTER TABLE data_sources MODIFY COLUMN source_type ENUM('notes','knowledge','chat','social','voice','import') NOT NULL COMMENT '数据来源类型';
