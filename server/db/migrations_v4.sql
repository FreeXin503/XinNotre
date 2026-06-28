-- XinNote v4 Migrations
-- Feature 1: 逆向精神叩问"深夜来信"
-- Feature 2: 个人思想谱系星图
--
-- 执行顺序: database.js 启动时自动读取并执行

-- ============================================================
-- Feature 1: 深夜来信 (Night Letters)
-- ============================================================

-- 预定义历史名人画像
CREATE TABLE IF NOT EXISTS night_letter_personas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    persona_key VARCHAR(60) NOT NULL UNIQUE COMMENT '如 socrates, confucius, nietzsche',
    display_name VARCHAR(100) NOT NULL COMMENT '如 苏格拉底',
    era VARCHAR(40) COMMENT '如 古希腊/先秦/19世纪德国',
    avatar_emoji VARCHAR(8) DEFAULT '🏛️' COMMENT '前端头像 emoji',
    philosophy_tags JSON COMMENT '["斯多葛学派","反诘法","伦理学"]',
    system_prompt TEXT NOT NULL COMMENT '完整角色扮演 prompt，含写作风格指令和禁止条款',
    quote_style ENUM('direct','paraphrase','analogy') DEFAULT 'direct' COMMENT '引用用户日记的风格',
    greeting_template TEXT COMMENT '来信开篇模板，{username}占位符',
    difficulty_level ENUM('gentle','moderate','challenging') DEFAULT 'moderate' COMMENT '对用户的叩击力度',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 深夜来信对话线程
CREATE TABLE IF NOT EXISTS night_letter_threads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    persona_id INT NOT NULL COMMENT 'FK night_letter_personas.id',
    trigger_note_ids JSON COMMENT '触发本次来信的日记 id 列表',
    emotional_context VARCHAR(120) COMMENT 'AI 概括的情绪上下文, 如"近一周的孤独感"',
    letter_count INT DEFAULT 1,
    is_delivered BOOLEAN DEFAULT TRUE COMMENT '是否已推送给用户',
    is_read BOOLEAN DEFAULT FALSE COMMENT '用户是否已读',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (persona_id) REFERENCES night_letter_personas(id) ON DELETE CASCADE,
    INDEX idx_night_letter_active (user_id, is_read, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 深夜来信消息体
CREATE TABLE IF NOT EXISTS night_letter_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    thread_id INT NOT NULL,
    role ENUM('persona','user') NOT NULL COMMENT 'persona=历史人物来信, user=用户回信',
    content LONGTEXT NOT NULL,
    quoted_note_snippets JSON COMMENT '[{noteId,quote,sentence}] — AI引用的日记原文',
    is_stream_interrupted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (thread_id) REFERENCES night_letter_threads(id) ON DELETE CASCADE,
    INDEX idx_night_letter_msg (thread_id, created_at ASC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Feature 2: 思想谱系星图 (Thought Spectrum)
-- ============================================================

-- 思想谱系快照（每周期生成一次）
CREATE TABLE IF NOT EXISTS thought_spectrum_snapshots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    version_tag VARCHAR(40) NOT NULL COMMENT '如 2026-W26',
    corpus_hash CHAR(64) NOT NULL COMMENT '对应时期日记指纹',
    note_count INT COMMENT '快照覆盖日记数',
    alignment_json JSON NOT NULL COMMENT '思想对齐数据: [{thinkerId,displayName,resonanceScore,...}]',
    dominant_tradition VARCHAR(200) COMMENT '如 斯多葛学派65%·实用主义30%',
    avatar_url VARCHAR(500) COMMENT 'AI 生成的谱系星图 SVG/PNG URL (可选)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_spectrum_user (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户关注的认知课题
CREATE TABLE IF NOT EXISTS thought_topics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    topic_name VARCHAR(100) NOT NULL COMMENT '如 财富观, 亲密关系, 自由意志',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_user_topic (user_id, topic_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 课题认知演变数据点
CREATE TABLE IF NOT EXISTS topic_evolution_points (
    id INT AUTO_INCREMENT PRIMARY KEY,
    topic_id INT NOT NULL,
    spectrum_snapshot_id INT NOT NULL COMMENT '关联的谱系快照',
    stance_label VARCHAR(100) COMMENT '当期的立场标签,如 现实主义乐观',
    stance_score INT COMMENT '-100到+100的态度强度',
    evidence_note_ids JSON COMMENT '支持该立场的日记id',
    evolution_vector VARCHAR(40) COMMENT '相比上一期的变化: radicalizing|moderating|stable|reversing',
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (topic_id) REFERENCES thought_topics(id) ON DELETE CASCADE,
    FOREIGN KEY (spectrum_snapshot_id) REFERENCES thought_spectrum_snapshots(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_topic_snapshot (topic_id, spectrum_snapshot_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
