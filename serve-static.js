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
  
  // 心智星系 Mock API
  '/api/mind-galaxy/from-notes': () => ({
    success: true,
    data: {
      galaxy: {
        stars: [
          {
            id: 'star-growth',
            name: '成长恒星',
            type: 'star',
            hue: 42,
            colorHex: '#f0c040',
            radius: 1.4,
            position: [-5, 1.5, -2],
            coreBelief: '持续学习与自我提升是人生的核心驱动力',
            description: '从日记中提炼出的成长主题，记录着你不断突破自我的历程',
            emotionTendency: '积极进取',
            frequency: '高频',
            sourceType: 'notes',
            noteData: { id: 1, category: '成长日记' }
          },
          {
            id: 'star-relation',
            name: '关系恒星',
            type: 'star',
            hue: 20,
            colorHex: '#ff9966',
            radius: 1.1,
            position: [4, -1, 3],
            coreBelief: '真诚的人际关系是生命中最宝贵的财富',
            description: '关于友情、亲情与爱情的思考与感悟',
            emotionTendency: '温暖',
            frequency: '中频',
            sourceType: 'notes',
            noteData: { id: 2, category: '情感日记' }
          }
        ],
        planets: [
          {
            id: 'planet-learn',
            name: '学习行星',
            type: 'planet',
            parentStarId: 'star-growth',
            colorHex: '#88bbee',
            radius: 0.4,
            orbitRadius: 3.2,
            orbitInclination: 0.15,
            orbitSpeed: 0.22,
            coreMeaning: '通过阅读、实践和反思持续获取新知识',
            emotionTendency: '积极',
            sourceType: 'notes',
            noteData: { id: 101, title: '今日学习笔记', kbId: null }
          },
          {
            id: 'planet-reflect',
            name: '反思行星',
            type: 'planet',
            parentStarId: 'star-growth',
            colorHex: '#cc99ff',
            radius: 0.35,
            orbitRadius: 4.5,
            orbitInclination: -0.1,
            orbitSpeed: 0.15,
            coreMeaning: '每日复盘，从经验中提炼智慧',
            emotionTendency: '理性',
            sourceType: 'notes',
            noteData: { id: 102, title: '每日反思', kbId: null }
          },
          {
            id: 'planet-empathy',
            name: '共情行星',
            type: 'planet',
            parentStarId: 'star-relation',
            colorHex: '#ffaaaa',
            radius: 0.38,
            orbitRadius: 2.8,
            orbitInclination: 0.2,
            orbitSpeed: 0.25,
            coreMeaning: '理解他人感受，建立深度连接',
            emotionTendency: '温暖',
            sourceType: 'notes',
            noteData: { id: 103, title: '与朋友的对话', kbId: null }
          }
        ],
        satellites: [
          {
            id: 'sat-g1',
            name: '突破舒适区',
            type: 'satellite',
            parentPlanetId: 'planet-learn',
            colorHex: '#ffcc88',
            radius: 0.09,
            orbitRadius: 0.7,
            emotionTendency: '积极',
            sourceType: 'notes',
            noteData: { id: 201, title: '第一次公开演讲', kbId: null }
          },
          {
            id: 'sat-g2',
            name: '坚持的力量',
            type: 'satellite',
            parentPlanetId: 'planet-learn',
            colorHex: '#88ddff',
            radius: 0.08,
            orbitRadius: 0.9,
            emotionTendency: '坚定',
            sourceType: 'notes',
            noteData: { id: 202, title: '连续学习30天', kbId: null }
          },
          {
            id: 'sat-r1',
            name: '学会倾听',
            type: 'satellite',
            parentPlanetId: 'planet-empathy',
            colorHex: '#ffbbaa',
            radius: 0.085,
            orbitRadius: 0.65,
            emotionTendency: '温暖',
            sourceType: 'notes',
            noteData: { id: 203, title: '倾听的艺术', kbId: null }
          }
        ],
        meta: { source: 'notes', count: 12, generatedAt: new Date().toISOString() }
      },
      source: 'notes',
      generatedAt: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  }),
  
  '/api/mind-galaxy/from-kb': () => ({
    success: true,
    data: {
      galaxy: {
        stars: [
          {
            id: 'star-cs',
            name: '计算机科学',
            type: 'star',
            hue: 210,
            colorHex: '#6699ff',
            radius: 1.3,
            position: [3, 2, -4],
            coreBelief: '计算机科学是现代科技的基石',
            description: '知识库中的计算机科学相关知识体系',
            emotionTendency: '理性探索',
            frequency: '高频',
            sourceType: 'knowledge',
            kbData: { id: 1, name: '计算机科学', icon: '💻' }
          },
          {
            id: 'star-psychology',
            name: '心理学',
            type: 'star',
            hue: 300,
            colorHex: '#cc88ff',
            radius: 1.0,
            position: [-4, -2, 2],
            coreBelief: '认识自己是终身的课题',
            description: '心理学与认知科学相关知识',
            emotionTendency: '内省',
            frequency: '中频',
            sourceType: 'knowledge',
            kbData: { id: 2, name: '心理学', icon: '🧠' }
          }
        ],
        planets: [
          {
            id: 'planet-algorithm',
            name: '算法与数据结构',
            type: 'planet',
            parentStarId: 'star-cs',
            colorHex: '#88ccff',
            radius: 0.42,
            orbitRadius: 3.0,
            orbitInclination: 0.12,
            orbitSpeed: 0.2,
            coreMeaning: '程序设计的核心基本功',
            emotionTendency: '理性',
            sourceType: 'knowledge',
            noteData: { id: 301, title: '排序算法总结', kbId: 1 }
          },
          {
            id: 'planet-ai',
            name: '人工智能',
            type: 'planet',
            parentStarId: 'star-cs',
            colorHex: '#99aaff',
            radius: 0.45,
            orbitRadius: 4.2,
            orbitInclination: -0.15,
            orbitSpeed: 0.12,
            coreMeaning: '机器学习、深度学习与大模型',
            emotionTendency: '好奇',
            sourceType: 'knowledge',
            noteData: { id: 302, title: 'Transformer原理', kbId: 1 }
          },
          {
            id: 'planet-cognition',
            name: '认知科学',
            type: 'planet',
            parentStarId: 'star-psychology',
            colorHex: '#ddaaff',
            radius: 0.36,
            orbitRadius: 2.6,
            orbitInclination: 0.18,
            orbitSpeed: 0.22,
            coreMeaning: '人类思维与学习的机制',
            emotionTendency: '探索',
            sourceType: 'knowledge',
            noteData: { id: 303, title: '认知偏差清单', kbId: 2 }
          }
        ],
        satellites: [
          {
            id: 'sat-k1',
            name: '动态规划',
            type: 'satellite',
            parentPlanetId: 'planet-algorithm',
            colorHex: '#aaddff',
            radius: 0.09,
            orbitRadius: 0.75,
            emotionTendency: '理性',
            sourceType: 'knowledge',
            noteData: { id: 401, title: 'DP解题模板', kbId: 1 }
          },
          {
            id: 'sat-k2',
            name: '注意力机制',
            type: 'satellite',
            parentPlanetId: 'planet-ai',
            colorHex: '#ccbbff',
            radius: 0.085,
            orbitRadius: 0.8,
            emotionTendency: '好奇',
            sourceType: 'knowledge',
            noteData: { id: 402, title: 'Self-Attention详解', kbId: 1 }
          },
          {
            id: 'sat-k3',
            name: '锚定效应',
            type: 'satellite',
            parentPlanetId: 'planet-cognition',
            colorHex: '#eebbee',
            radius: 0.08,
            orbitRadius: 0.6,
            emotionTendency: '内省',
            sourceType: 'knowledge',
            noteData: { id: 403, title: '锚定效应案例', kbId: 2 }
          }
        ],
        meta: { source: 'knowledge', count: 8, generatedAt: new Date().toISOString() }
      },
      source: 'knowledge',
      generatedAt: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  }),
  
  '/api/mind-galaxy/mixed': () => ({
    success: true,
    data: {
      galaxy: {
        stars: [
          {
            id: 'star-growth',
            name: '成长恒星',
            type: 'star',
            hue: 42,
            colorHex: '#f0c040',
            radius: 1.4,
            position: [-6, 2, -3],
            coreBelief: '持续学习与自我提升是人生的核心驱动力',
            description: '从日记中提炼出的成长主题',
            emotionTendency: '积极进取',
            frequency: '高频',
            sourceType: 'notes',
            noteData: { id: 1, category: '成长日记' }
          },
          {
            id: 'star-relation',
            name: '关系恒星',
            type: 'star',
            hue: 20,
            colorHex: '#ff9966',
            radius: 1.1,
            position: [5, -1, 4],
            coreBelief: '真诚的人际关系是生命中最宝贵的财富',
            description: '关于友情、亲情与爱情的思考',
            emotionTendency: '温暖',
            frequency: '中频',
            sourceType: 'notes',
            noteData: { id: 2, category: '情感日记' }
          },
          {
            id: 'star-cs',
            name: '计算机科学',
            type: 'star',
            hue: 210,
            colorHex: '#6699ff',
            radius: 1.2,
            position: [2, 3, -5],
            coreBelief: '计算机科学是现代科技的基石',
            description: '知识库中的计算机科学知识体系',
            emotionTendency: '理性探索',
            frequency: '高频',
            sourceType: 'knowledge',
            kbData: { id: 1, name: '计算机科学', icon: '💻' }
          },
          {
            id: 'star-psychology',
            name: '心理学',
            type: 'star',
            hue: 300,
            colorHex: '#cc88ff',
            radius: 0.9,
            position: [-3, -3, 3],
            coreBelief: '认识自己是终身的课题',
            description: '心理学与认知科学相关知识',
            emotionTendency: '内省',
            frequency: '中频',
            sourceType: 'knowledge',
            kbData: { id: 2, name: '心理学', icon: '🧠' }
          }
        ],
        planets: [
          {
            id: 'planet-learn',
            name: '学习行星',
            type: 'planet',
            parentStarId: 'star-growth',
            colorHex: '#88bbee',
            radius: 0.4,
            orbitRadius: 3.2,
            orbitInclination: 0.15,
            orbitSpeed: 0.22,
            coreMeaning: '通过阅读、实践和反思持续获取新知识',
            emotionTendency: '积极',
            sourceType: 'notes',
            noteData: { id: 101, title: '今日学习笔记', kbId: null }
          },
          {
            id: 'planet-reflect',
            name: '反思行星',
            type: 'planet',
            parentStarId: 'star-growth',
            colorHex: '#cc99ff',
            radius: 0.35,
            orbitRadius: 4.5,
            orbitInclination: -0.1,
            orbitSpeed: 0.15,
            coreMeaning: '每日复盘，从经验中提炼智慧',
            emotionTendency: '理性',
            sourceType: 'notes',
            noteData: { id: 102, title: '每日反思', kbId: null }
          },
          {
            id: 'planet-empathy',
            name: '共情行星',
            type: 'planet',
            parentStarId: 'star-relation',
            colorHex: '#ffaaaa',
            radius: 0.38,
            orbitRadius: 2.8,
            orbitInclination: 0.2,
            orbitSpeed: 0.25,
            coreMeaning: '理解他人感受，建立深度连接',
            emotionTendency: '温暖',
            sourceType: 'notes',
            noteData: { id: 103, title: '与朋友的对话', kbId: null }
          },
          {
            id: 'planet-algorithm',
            name: '算法与数据结构',
            type: 'planet',
            parentStarId: 'star-cs',
            colorHex: '#88ccff',
            radius: 0.42,
            orbitRadius: 3.0,
            orbitInclination: 0.12,
            orbitSpeed: 0.2,
            coreMeaning: '程序设计的核心基本功',
            emotionTendency: '理性',
            sourceType: 'knowledge',
            noteData: { id: 301, title: '排序算法总结', kbId: 1 }
          },
          {
            id: 'planet-ai',
            name: '人工智能',
            type: 'planet',
            parentStarId: 'star-cs',
            colorHex: '#99aaff',
            radius: 0.45,
            orbitRadius: 4.2,
            orbitInclination: -0.15,
            orbitSpeed: 0.12,
            coreMeaning: '机器学习、深度学习与大模型',
            emotionTendency: '好奇',
            sourceType: 'knowledge',
            noteData: { id: 302, title: 'Transformer原理', kbId: 1 }
          },
          {
            id: 'planet-cognition',
            name: '认知科学',
            type: 'planet',
            parentStarId: 'star-psychology',
            colorHex: '#ddaaff',
            radius: 0.36,
            orbitRadius: 2.6,
            orbitInclination: 0.18,
            orbitSpeed: 0.22,
            coreMeaning: '人类思维与学习的机制',
            emotionTendency: '探索',
            sourceType: 'knowledge',
            noteData: { id: 303, title: '认知偏差清单', kbId: 2 }
          }
        ],
        satellites: [
          { id: 'sat-g1', name: '突破舒适区', type: 'satellite', parentPlanetId: 'planet-learn', colorHex: '#ffcc88', radius: 0.09, orbitRadius: 0.7, emotionTendency: '积极', sourceType: 'notes', noteData: { id: 201, title: '第一次公开演讲', kbId: null } },
          { id: 'sat-g2', name: '坚持的力量', type: 'satellite', parentPlanetId: 'planet-learn', colorHex: '#88ddff', radius: 0.08, orbitRadius: 0.9, emotionTendency: '坚定', sourceType: 'notes', noteData: { id: 202, title: '连续学习30天', kbId: null } },
          { id: 'sat-r1', name: '学会倾听', type: 'satellite', parentPlanetId: 'planet-empathy', colorHex: '#ffbbaa', radius: 0.085, orbitRadius: 0.65, emotionTendency: '温暖', sourceType: 'notes', noteData: { id: 203, title: '倾听的艺术', kbId: null } },
          { id: 'sat-k1', name: '动态规划', type: 'satellite', parentPlanetId: 'planet-algorithm', colorHex: '#aaddff', radius: 0.09, orbitRadius: 0.75, emotionTendency: '理性', sourceType: 'knowledge', noteData: { id: 401, title: 'DP解题模板', kbId: 1 } },
          { id: 'sat-k2', name: '注意力机制', type: 'satellite', parentPlanetId: 'planet-ai', colorHex: '#ccbbff', radius: 0.085, orbitRadius: 0.8, emotionTendency: '好奇', sourceType: 'knowledge', noteData: { id: 402, title: 'Self-Attention详解', kbId: 1 } },
          { id: 'sat-k3', name: '锚定效应', type: 'satellite', parentPlanetId: 'planet-cognition', colorHex: '#eebbee', radius: 0.08, orbitRadius: 0.6, emotionTendency: '内省', sourceType: 'knowledge', noteData: { id: 403, title: '锚定效应案例', kbId: 2 } }
        ],
        meta: { source: 'mixed', notesCount: 6, kbCount: 6, generatedAt: new Date().toISOString() }
      },
      source: 'mixed',
      generatedAt: new Date().toISOString()
    },
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

  '/api/mind-galaxy/engine/generate': () => ({
    success: true,
    data: {
      domain: 'MindGalaxy',
      snapshots: [{
        id: 'mock-ugme-1',
        galaxyType: 'S',
        spiralArms: 3,
        overall_type: 'Spiral',
        summary: 'UGME 引擎模拟生成的星系快照',
        structural_metrics: { entropy: 0.65, density: 0.32, active_index: 0.48 },
        bodies: [
          { id: 'ug_b0', type: 'black_hole', name: '核心自我', position: [0,0,0], visual: { radius: 5, colorHex: '#111122', emissiveIntensity: 3 }, spawnAnimation: 'none', meta: { source: 'ugme', insight: '你的意识核心' } },
          { id: 'ug_b1', type: 'giant_star', name: '成长信念', position: [0,0,0], visual: { radius: 2.8, colorHex: '#FFD700', emissiveIntensity: 2.2 }, spawnAnimation: 'none', meta: { belief: { level: 'core', polarity: 'pos', strength: 0.85 } } },
          { id: 'ug_b2', type: 'giant_star', name: '探索未知', position: [0,0,0], visual: { radius: 2.5, colorHex: '#FF69B4', emissiveIntensity: 2.0 }, spawnAnimation: 'none', meta: { belief: { level: 'core', polarity: 'pos', strength: 0.78 } } },
          { id: 'ug_b3', type: 'main_sequence', name: '学习精进', position: [0,0,0], visual: { radius: 2.0, colorHex: '#00CED1', emissiveIntensity: 1.5 }, spawnAnimation: 'none', meta: { theme: { importance: 0.7, trend: 'growing' } } },
          { id: 'ug_b4', type: 'main_sequence', name: '社交关系', position: [0,0,0], visual: { radius: 1.8, colorHex: '#FF6347', emissiveIntensity: 1.3 }, spawnAnimation: 'none', meta: { theme: { importance: 0.6, trend: 'stable' } } },
          { id: 'ug_b5', type: 'planet_system', name: '编程技能', position: [0,0,0], visual: { radius: 0.9, colorHex: '#98FB98', emissiveIntensity: 1 }, motion: { parentBodyId: 'ug_b3', orbitRadius: 5, orbitInclination: 0.2, orbitSpeed: 0.5, orbitPhase: 1, eccentricity: 0.15 }, spawnAnimation: 'none', meta: {} },
          { id: 'ug_b6', type: 'planet_system', name: '沟通协作', position: [0,0,0], visual: { radius: 0.8, colorHex: '#FFB6C1', emissiveIntensity: 0.9 }, motion: { parentBodyId: 'ug_b4', orbitRadius: 4.2, orbitInclination: -0.15, orbitSpeed: 0.6, orbitPhase: 2, eccentricity: 0.1 }, spawnAnimation: 'none', meta: {} },
          { id: 'ug_b7', type: 'nebula', name: '喜悦星云', position: [0,0,0], visual: { radius: 0.2, colorHex: '#FFD700', emissiveIntensity: 1, density: 0.7, particleCount: 3000 }, spawnAnimation: 'none', meta: {} },
          { id: 'ug_b8', type: 'nebula', name: '沉思星云', position: [0,0,0], visual: { radius: 0.2, colorHex: '#4169E1', emissiveIntensity: 0.7, density: 0.5, particleCount: 2000 }, spawnAnimation: 'none', meta: {} },
          { id: 'ug_b9', type: 'asteroid_belt', name: '碎片记忆', position: [0,0,0], visual: { radius: 0.05, colorHex: '#8888AA', emissiveIntensity: 0.5, particleCount: 600 }, spawnAnimation: 'none', meta: {} },
          { id: 'ug_b10', type: 'dark_matter', name: '潜意识', position: [0,0,0], visual: { radius: 0.15, colorHex: '#222244', emissiveIntensity: 0.2, opacity: 0.35 }, spawnAnimation: 'none', meta: { shadow: { repression: 0.6, energy: 0.4 } } }
        ]
      }]
    },
    timestamp: new Date().toISOString()
  })
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
