import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly call dotenv configuration at the very top of imports
dotenv.config();

// Default configurations
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || 'czx503CZX';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = process.env.DB_PORT || 3306;
const dbName = process.env.DB_NAME || 'xinnote_db';

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

  // 3. Run migrations SQL
  try {
    console.log('🔄 Running database migrations...');
    const migrationPath = path.join(__dirname, '../db/migrations.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split queries by semicolon to run individually on MySQL
    const queries = sql
      .split(';')
      .map(q => q.trim())
      .filter(q => q.length > 0);

    for (const q of queries) {
      await pool.query(q);
    }

    // Safely add fulltext index
    try {
      await pool.query(`ALTER TABLE notes ADD FULLTEXT INDEX notes_fts_idx (title, content) WITH PARSER ngram`);
      console.log('✅ Fulltext index added successfully!');
    } catch (indexErr) {
      // index already exists, normal
    }

    console.log('✅ Migrations applied successfully!');
  } catch (err) {
    console.error('❌ Migration application failed:', err.message);
    throw err;
  }
}

// Standard query wrapper
export const query = async (text, params) => {
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
  
  // Convert Postgres style $1, $2 placeholders to MySQL style ? placeholders
  let mysqlQuery = text;
  let matches = text.match(/\$\d+/g);
  if (matches) {
    // Sort matches descending to avoid replacing $10 before $1
    const uniqueMatches = Array.from(new Set(matches)).sort((a, b) => {
      return parseInt(b.substring(1)) - parseInt(a.substring(1));
    });
    
    for (const match of uniqueMatches) {
      mysqlQuery = mysqlQuery.replaceAll(match, '?');
    }
  }

  const [rows] = await pool.query(mysqlQuery, params);
  return { rows };
};
