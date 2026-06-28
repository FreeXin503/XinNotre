import mysql from 'mysql2/promise';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default configurations
const dbUser = config.db.user;
const dbPassword = config.db.password;
const dbHost = config.db.host;
const dbPort = config.db.port;
const dbName = config.db.name;

let pool;

export async function initDatabase() {
  console.log('🔄 Checking MySQL configuration...');
  
  // 1. Connect to system to ensure DB exists
  const connection = await mysql.createConnection({
    host: dbHost,
    user: dbUser,
    password: dbPassword,
    port: parseInt(dbPort)
  });

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ Database '${dbName}' created or verified successfully!`);
  } catch (err) {
    console.error('❌ Error creating MySQL database registry:', err.message);
    throw err;
  } finally {
    await connection.end();
  }

  // 2. Initialize pool
  pool = mysql.createPool({
    host: dbHost,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    port: parseInt(dbPort),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  // 3. Migration runner with tracking
  const migrationFiles = [
    { version: 'migrations',         name: 'v1 base tables' },
    { version: 'migrations_v2',      name: 'v2 phase 1-2 tables' },
    { version: 'migrations_v3',      name: 'v3 hardening + stubs' },
    { version: 'migrations_v4',      name: 'v4 feature tables' },
    { version: 'migrations_v5',      name: 'v5 cosmos snapshots' },
    { version: 'migrations_v6',      name: 'v6 schema_migrations tracking table' },
    { version: 'migrations_v7',      name: 'v7 mind-galaxy tables' },
    { version: 'migrations_v8',      name: 'v8 cosmos_snapshots updated_at' },
    { version: 'migrations_v9',      name: 'v9 notes meta_json + source_type extend' },
    { version: 'migrations_v10',     name: 'v10 relationship_invitations' },
    { version: 'migrations_v11',     name: 'v11 aggregate_sessions' },
  ];

  try {
    console.log('🔄 Running database migrations...');

    // Ensure tracking table exists first
    const trackingPath = path.join(__dirname, '../db/migrations_v6.sql');
    const trackingSql = await readFile(trackingPath, 'utf8');
    const trackingQueries = trackingSql.split(';').map(q => q.trim()).filter(q => q.length > 0);
    for (const q of trackingQueries) {
      try { await pool.query(q); } catch { /* table may already exist */ }
    }

    // Get already-applied versions
    let applied = new Set();
    try {
      const [rows] = await pool.query('SELECT version FROM schema_migrations');
      for (const r of rows) applied.add(r.version);
    } catch { /* tracking table might be fresh */ }

    // Seed existing migrations for backward compatibility (pre-v6 databases)
    if (applied.size === 0) {
      try {
        const [tableCheck] = await pool.query(
          "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'notes'",
          [dbName]
        );
        if (tableCheck.length > 0) {
          // Tables already exist from before tracking was added — seed all versions
          for (const { version } of migrationFiles) {
            try {
              await pool.query('INSERT IGNORE INTO schema_migrations (version, name) VALUES (?, ?)', [version, version]);
              applied.add(version);
            } catch { /* best effort */ }
          }
          console.log('✅ Seeded existing migrations into tracking table');
        }
      } catch { /* fresh database, run all migrations */ }
    }

    // Run each migration file if not yet applied
    for (const { version, name } of migrationFiles) {
      if (applied.has(version)) {
        console.log(`  ⏭️  ${name} (${version}) already applied`);
        continue;
      }

      const filePath = path.join(__dirname, `../db/${version}.sql`);
      let sql;
      try { sql = await readFile(filePath, 'utf8'); } catch {
        console.warn(`  ⚠️  ${version}.sql not found, skipping`);
        continue;
      }

      const queries = sql.split(';').map(q => q.trim()).filter(q => q.length > 0);
      let hasErrors = false;

      for (const q of queries) {
        try {
          await pool.query(q);
        } catch (qErr) {
          // Tolerate common idempotent errors for older migrations
          const tolerable = qErr.errno === 1061 || qErr.errno === 1050 || qErr.errno === 1060 || qErr.errno === 1062;
          if (tolerable) {
            hasErrors = true;
          } else {
            throw qErr;
          }
        }
      }

      await pool.query('INSERT INTO schema_migrations (version, name) VALUES (?, ?)', [version, name]);
      console.log(`  ✅ ${name} (${version}) applied${hasErrors ? ' (some statements skipped)' : ''}`);
    }

    // Critical indexes (tracked as migration v0_indexes)
    const safeIndexes = [
      { name: 'idx_notes_user_deleted_updated', sql: 'CREATE INDEX idx_notes_user_deleted_updated ON notes(user_id, is_deleted, updated_at DESC)' },
      { name: 'idx_notes_user_category', sql: 'CREATE INDEX idx_notes_user_category ON notes(user_id, category)' },
      { name: 'idx_notes_user_created', sql: 'CREATE INDEX idx_notes_user_created ON notes(user_id, created_at DESC)' },
      { name: 'idx_notes_user_deleted_created', sql: 'CREATE INDEX idx_notes_user_deleted_created ON notes(user_id, is_deleted, created_at DESC)' },
      { name: 'idx_note_versions_note_id', sql: 'CREATE INDEX idx_note_versions_note_id ON note_versions(note_id, version_num DESC)' },
      { name: 'idx_sync_history_user_created', sql: 'CREATE INDEX idx_sync_history_user_created ON sync_history(user_id, created_at DESC)' },
      { name: 'idx_ai_reports_user_created', sql: 'CREATE INDEX idx_ai_reports_user_created ON ai_reports(user_id, created_at DESC)' },
      { name: 'idx_kb_user_updated', sql: 'CREATE INDEX idx_kb_user_updated ON knowledge_bases(user_id, updated_at DESC)' },
      { name: 'idx_kbn_kb_note', sql: 'CREATE INDEX idx_kbn_kb_note ON knowledge_base_notes(kb_id, note_id)' },
      { name: 'idx_kbn_kb_order', sql: 'CREATE INDEX idx_kbn_kb_order ON knowledge_base_notes(kb_id, sort_order)' },
      { name: 'idx_apikeys_user', sql: 'CREATE INDEX idx_apikeys_user ON user_api_keys(user_id, provider)' },
      { name: 'idx_usage_log_user', sql: 'CREATE INDEX idx_usage_log_user ON ai_usage_log(user_id, created_at DESC)' },
      { name: 'idx_tags_user', sql: 'CREATE INDEX idx_tags_user ON tags(user_id)' },
      { name: 'idx_note_links_source', sql: 'CREATE INDEX idx_note_links_source ON note_links(source_note_id)' },
      { name: 'idx_note_links_target', sql: 'CREATE INDEX idx_note_links_target ON note_links(target_note_id)' },
      { name: 'idx_emo_snap_user', sql: 'CREATE INDEX idx_emo_snap_user ON emotion_snapshots(user_id, period_start DESC)' },
    ];

    if (!applied.has('v0_indexes')) {
      for (const { name: idxName, sql } of safeIndexes) {
        try {
          await pool.query(sql);
        } catch (idxErr) {
          if (idxErr.errno !== 1061) {
            console.warn(`  ⚠️  Index ${idxName} creation warning:`, idxErr.message);
          }
        }
      }
      // Fulltext index
      try {
        await pool.query('ALTER TABLE notes ADD FULLTEXT INDEX notes_fts_idx (title, content) WITH PARSER ngram');
      } catch (idxErr) {
        if (idxErr.errno !== 1061) {
          console.warn('  ⚠️  Fulltext index creation warning:', idxErr.message);
        }
      }
      await pool.query('INSERT INTO schema_migrations (version, name) VALUES (?, ?)', ['v0_indexes', 'Critical indexes']);
    }

    console.log('✅ Migrations applied successfully!');
  } catch (err) {
    console.error('❌ Migration application failed:', err.message);
    throw err;
  }
}

// Standard query wrapper with parameter clamping
export async function closePool() {
  if (pool) {
    await pool.end();
    console.log('✅ MySQL connection pool closed');
  }
}

export const query = async (text, params = []) => {
  if (!pool) {
    pool = mysql.createPool({
      host: dbHost,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      port: parseInt(dbPort),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }

  const [rows] = await pool.query(text, params);
  return { rows };
};

/**
 * 事务包装器:自动 beginTransaction / commit / rollback
 * @param {function} callback - async (txQuery) => { ... }
 *   txQuery(sql, params) 在当前事务内执行查询,返回 { rows }
 * @returns {Promise<any>} callback 的返回值
 *
 * 用法示例:
 *   await withTransaction(async (tx) => {
 *     const r1 = await tx('UPDATE notes SET title=? WHERE id=?', [t, id]);
 *     const r2 = await tx('INSERT INTO note_versions(...) VALUES(...)', [...]);
 *     return r2;
 *   });
 */
export async function withTransaction(callback) {
  if (!pool) throw new Error('Database pool not initialized');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const txQuery = async (text, params = []) => {
      const [rows] = await conn.query(text, params);
      return { rows };
    };
    const result = await callback(txQuery);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * 安全地 clamp 数值型查询参数,防止恶意大数值压垮数据库
 * @param {number|string} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clampInt(val, min = 1, max = 200) {
  const n = parseInt(val, 10);
  if (isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}
