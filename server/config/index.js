/**
 * 集中化配置模块
 * 所有环境变量通过此模块统一管理，消除分散的 dotenv.config() 调用。
 *
 * 导入此模块即自动加载 .env —— 其余文件无需再调用 dotenv.config()。
 */
import dotenv from 'dotenv';
dotenv.config();

export const config = Object.freeze({
  // 服务器
  port: parseInt(process.env.PORT, 10) || 8000,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:8000', 'http://127.0.0.1:8000'],

  // 数据库
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'xinnote_db'
  },

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',

  // 加密
  encryptionKey: process.env.ENCRYPTION_KEY || '',

  // AI Provider
  geminiKey: process.env.GEMINI_KEY || '',
  deepseekKey: process.env.DEEPSEEK_KEY || '',
  deepseekUrl: process.env.DEEPSEEK_URL || 'https://api.deepseek.com/chat/completions',

  // Qdrant 向量数据库（可选）
  qdrantUrl: process.env.QDRANT_URL || '',

  // 心智星系 · 隐私控制
  localMode: process.env.LOCAL_MODE === 'true',
  afterDelete: process.env.AFTER_DELETE === 'true'
});
