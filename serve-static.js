// Simple static file server - no MySQL required, mocks API endpoints
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const PORT = 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
};

// Mock API responses so frontend doesn't crash
const MOCK_API = {
  '/api/notes': () => ({ notes: [], stats: [] }),
  '/api/auth/login': () => ({ success: true, token: 'mock-offline', user: { id: 1, username: 'Offline', name: 'Offline User' } }),
  '/api/auth/register': () => ({ success: true, message: 'Offline mode' }),
  '/api/health': () => ({ status: 'ok', mode: 'offline', timestamp: new Date().toISOString() }),
};

http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  // Handle API mock routes
  for (const [route, handler] of Object.entries(MOCK_API)) {
    if (urlPath.startsWith(route)) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(handler()));
      return;
    }
  }

  // Static file serving
  let filePath = path.join(publicDir, urlPath === '/' ? 'index.html' : urlPath);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`🚀 XinNote Frontend Preview: http://localhost:${PORT}`);
  console.log(`   📝 API endpoints mocked (no MySQL required)`);
});