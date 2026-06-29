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

// ── Shared v2 Galaxy Mock (bodies[] format) ──
function mockGalaxyV2() {
  return {
    galaxyType: 'S',
    spiralArms: 3,
    bodies: [
      { id: 'b_core', type: 'black_hole', name: '核心自我', position: [0,0,0], visual: { radius: 4.5, colorHex: '#0a0a20', emissiveIntensity: 4 }, spawnAnimation: 'none', meta: { insight: '你的意识与内心世界' } },
      { id: 'b_growth', type: 'giant_star', name: '个人成长', position: [0,0,0], visual: { radius: 2.6, colorHex: '#FFD700', emissiveIntensity: 2.0 }, spawnAnimation: 'none', meta: { belief: { level: 'core', polarity: 'pos', strength: 0.85 } } },
      { id: 'b_relation', type: 'giant_star', name: '亲密关系', position: [0,0,0], visual: { radius: 2.3, colorHex: '#FF8C94', emissiveIntensity: 1.8 }, spawnAnimation: 'none', meta: { belief: { level: 'core', polarity: 'pos', strength: 0.78 } } },
      { id: 'b_work', type: 'main_sequence', name: '工作事业', position: [0,0,0], visual: { radius: 2.0, colorHex: '#FF6347', emissiveIntensity: 1.5 }, spawnAnimation: 'none', meta: { theme: { importance: 0.72, trend: 'growing' } } },
      { id: 'b_health', type: 'main_sequence', name: '身心健康', position: [0,0,0], visual: { radius: 1.8, colorHex: '#00CED1', emissiveIntensity: 1.3 }, spawnAnimation: 'none', meta: { theme: { importance: 0.65, trend: 'stable' } } },
      { id: 'b_learn', type: 'planet_system', name: '技能精进', position: [0,0,0], visual: { radius: 0.9, colorHex: '#98FB98', emissiveIntensity: 1 }, motion: { parentBodyId: 'b_growth', orbitRadius: 4.8, orbitInclination: 0.2, orbitSpeed: 0.5, orbitPhase: 1, eccentricity: 0.15 }, spawnAnimation: 'none', meta: {} },
      { id: 'b_joy', type: 'nebula', name: '喜悦星云', position: [0,0,0], visual: { radius: 0.15, colorHex: '#FFD700', emissiveIntensity: 1, density: 0.6, particleCount: 2000 }, spawnAnimation: 'none', meta: {} },
      { id: 'b_sad', type: 'nebula', name: '忧郁星云', position: [0,0,0], visual: { radius: 0.15, colorHex: '#4169E1', emissiveIntensity: 0.6, density: 0.4, particleCount: 1500 }, spawnAnimation: 'none', meta: {} },
      { id: 'b_frag', type: 'asteroid_belt', name: '记忆碎片', position: [0,0,0], visual: { radius: 0.04, colorHex: '#8888AA', emissiveIntensity: 0.4, particleCount: 500 }, spawnAnimation: 'none', meta: {} }
    ]
  };
}

// Mock API responses so frontend doesn't crash
const MOCK_API = {
  '/api/notes': () => ({ notes: [], stats: [] }),
  '/api/auth/login': () => ({ success: true, token: 'mock-offline', user: { id: 1, username: 'Offline', name: 'Offline User' } }),
  '/api/auth/register': () => ({ success: true, message: 'Offline mode' }),
  '/api/health': () => ({ status: 'ok', mode: 'offline', timestamp: new Date().toISOString() }),

  // 心智星系 v2 快照（tryLoadServer 加载入口）
  '/api/mind-galaxy/snapshot': () => ({
    success: true,
    data: { snapshot_json: mockGalaxyV2() },
    timestamp: new Date().toISOString()
  }),

  // 心智星系 v2 演化时间轴
  '/api/mind-galaxy/evolution': () => ({
    success: true,
    data: {
      snapshots: [{
        id: 'snap_mock_1',
        snapshot_json: mockGalaxyV2(),
        created_at: new Date(Date.now() - 86400000 * 60).toISOString()
      }, {
        id: 'snap_mock_2',
        snapshot_json: mockGalaxyV2(),
        created_at: new Date(Date.now() - 86400000 * 30).toISOString()
      }, {
        id: 'snap_mock_3',
        snapshot_json: mockGalaxyV2(),
        created_at: new Date().toISOString()
      }]
    },
    timestamp: new Date().toISOString()
  }),

  // 心智星系导入端点（Mock 模式下直接返回快照）
  '/api/mind-galaxy/from-notes': () => ({
    success: true,
    data: mockGalaxyV2(),
    timestamp: new Date().toISOString()
  }),

  '/api/mind-galaxy/from-kb': () => ({
    success: true,
    data: mockGalaxyV2(),
    timestamp: new Date().toISOString()
  }),

  '/api/mind-galaxy/mixed': () => ({
    success: true,
    data: mockGalaxyV2(),
    timestamp: new Date().toISOString()
  }),

  // A1 便签考古盲盒 Mock API
  '/api/archaeology/dig': () => ({
    success: true,
    data: {
      card: { id: 1, noteId: 'mock-1', digMode: 'random', noteContent: '这是挖掘出的便签内容示例…', noteDate: '2024-03-15', noteCategory: '生活', noteTitle: 'mock 标题' },
      coKeywords: ['成长', '感悟', '日常'],
      relatedNotes: [{ id: 2, title: '相关便签1', content: '…' }]
    },
    timestamp: new Date().toISOString()
  }),
  '/api/archaeology/cards': () => ({
    success: true,
    data: { cards: [] },
    timestamp: new Date().toISOString()
  }),

  // B1 灵魂人格档案 Mock API
  '/api/persona/history': () => ({
    success: true,
    data: { snapshots: [] },
    timestamp: new Date().toISOString()
  }),

  // A2 情绪天气图 Mock API
  '/api/weather/grid': () => ({
    success: true,
    data: { year: 2026, layer: 'emotion', days: [], legend: [] },
    timestamp: new Date().toISOString()
  }),

  // B2 成长证据树 Mock API
  '/api/goals': () => ({
    success: true,
    data: { goals: [] },
    timestamp: new Date().toISOString()
  }),

  // D1 生命年报卷宗 Mock API
  '/api/almanac/list': () => ({
    success: true,
    data: { volumes: [] },
    timestamp: new Date().toISOString()
  }),

  // C1 跨时空笔友 Mock API
  '/api/penpal/threads': () => ({
    success: true,
    data: { threads: [] },
    timestamp: new Date().toISOString()
  }),

  // C2 时光胶囊 Mock API
  '/api/letters': () => ({
    success: true,
    data: { letters: [] },
    timestamp: new Date().toISOString()
  }),

  // D2 主题回忆录 Mock API
  '/api/memoir/': () => ({
    success: true,
    data: { memoirs: [] },
    timestamp: new Date().toISOString()
  }),

  '/api/mind-galaxy/engine/generate': () => {
    const snapshot = mockGalaxyV2();
    return {
      success: true,
      data: {
        domain: 'MindGalaxy',
        snapshots: [{
          ...snapshot,
          id: 'mock-ugme-1',
          overall_type: 'Spiral',
          time_snapshot: new Date().toISOString().substring(0, 7),
          summary: 'UGME 引擎模拟生成的星系快照',
          structural_metrics: { entropy: 0.65, density: 0.32, active_index: 0.48 },
          userId: 1
        }]
      },
      timestamp: new Date().toISOString()
    };
  }
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
