import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import apiRouter from './routes/api.js';
import { initDatabase } from './config/database.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: '50mb' })); // support large notes payload during sync

// API routes prefix
app.use('/api', apiRouter);

// Host static assets from 'public' folder
app.use(express.static(path.join(__dirname, '../public')));

// Fallback to index.html for SPA router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Launch server & DB connection
async function startServer() {
  try {
    // 1. Initialize Postgres Database and run migrations
    await initDatabase();
    
    // 2. Start Listening
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
