import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/index.js';
import apiRouter from './routes/api.js';
import { initDatabase, closePool, query } from './config/database.js';
import { startAutoSync, stopAutoSync, syncAllNotes } from './services/vectorSyncService.js';
import { ensureCollection } from './services/vectorStore.js';
import { assertKeyReady } from './services/cryptoService.js';
import { initSkillCache } from './services/skillCacheService.js';
import { viewSharedReport } from './controllers/shareController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = config.port;

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// CORS - restrict to specific origins in production
const allowedOrigins = config.corsOrigins;
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || config.nodeEnv !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  }
}));
app.use(express.json({ limit: '50mb' }));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const dbResult = await query('SELECT 1 as ok');
    res.json({
      status: 'ok',
      db: dbResult.rows[0].ok === 1 ? 'connected' : 'error',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      db: 'disconnected',
      timestamp: new Date().toISOString()
    });
  }
});

// API routes prefix
app.use('/api', apiRouter);

// Public share route (no auth required)
app.get('/s/:token', viewSharedReport);

// Host static assets from 'public' folder
app.use(express.static(path.join(__dirname, '../public')));

// Fallback to index.html for SPA router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.message);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
async function shutdown(signal) {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  stopAutoSync();
  await closePool();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Launch server & DB connection
async function startServer() {
  try {
    // 加密密钥必须在任何涉及解密的操作前就绪
    assertKeyReady();
    initSkillCache();
    await initDatabase();
    await ensureCollection();
    startAutoSync();
    console.log('[vectorSync] Background sync enabled');
    
    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 心迹星图 Full-stack Server running at:`);
      console.log(`👉 http://localhost:${PORT}`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error('❌ Server startup failed due to database init error:', err.message);
    process.exit(1);
  }
}

startServer();
