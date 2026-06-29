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
