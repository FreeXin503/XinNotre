import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import apiRouter from './routes/api.js';
import { initDatabase, closePool } from './config/database.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;

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
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:8000', 'http://127.0.0.1:8000'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  }
}));
app.use(express.json({ limit: '50mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes prefix
app.use('/api', apiRouter);

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
  await closePool();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Launch server & DB connection
async function startServer() {
  try {
    await initDatabase();
    
    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 XinNote Full-stack Server running at:`);
      console.log(`👉 http://localhost:${PORT}`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error('❌ Server startup failed due to database init error:', err.message);
    process.exit(1);
  }
}

startServer();
