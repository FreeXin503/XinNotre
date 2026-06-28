# 批5 · 创新玩法模块联调与前端补齐

## 1. 需求摘要

将 8 个创新玩法模块全部联调落地：5 个已有前端模块（A1 便签考古盲盒 / B1 灵魂人格档案 / A2 情绪天气图 / B2 成长证据树 / D1 生命年报卷宗）补 serve-static.js Mock API + 端到端验证；3 个无前端模块（C1 跨时空笔友 / C2 时光胶囊 / D2 主题回忆录）创建完整前端 + 主页入口 + 联调。完成后所有模块可从前端 icon-rail 进入并使用。

## 2. 构建拓扑图

```
Phase 0（同文件串行追加）
  Card 0A ──→ Card 0B
  (serve-static.js 依次追加，5个已有 → 3个新增)

Phase 1（纯新增，3 文件可并行）
  Card 1A ∥ Card 1B ∥ Card 1C
  (penpal.js / letter.js / memoir.js)

Phase 2（同两文件串行）
  Card 2A ──→ Card 2B
  (api.js → index.js + index.html)

Phase 3（单卡片）
  Card 3A
  (smoke-test + bug fix)
```

## 3. 数据契约总览

```typescript
// ============ 跨文件共享类型定义 ============

// --- Penpal (笔友) ---
interface PenpalThread {
  id: number
  personaLabel: string  // "2021年的我"
  windowStart: string   // YYYY-MM-DD
  windowEnd: string     // YYYY-MM-DD
  letterCount: number
  createdAt: string
  corpusHash: string
}
interface PenpalLetter {
  id: number
  threadId: number
  role: 'user' | 'past_self'
  content: string
  truncated: boolean
  createdAt: string
}

// --- Letter (时光胶囊) ---
interface SealedLetter {
  id: number
  title: string
  content: string
  sealedAt: string
  triggerType: 'date' | 'next_sync' | 'goal_done' | 'reverse'
  triggerValue: string
  deliveredAt: string | null
  waxSealEmoji: string
}

// --- Memoir (回忆录) ---
interface Memoir {
  id: number
  theme: string
  status: 'draft' | 'generated' | 'published'
  chapterCount: number
  createdAt: string
}
interface MemoirChapter {
  seq: number
  title: string
  content: string
  citations: Array<{ noteId, quote }>
}
```

## 4. 任务卡片

---

🛠️ **Card 0A: serve-static.js — 5 个已有模块 Mock API**
构建优先级：P0
改动性质：既有重构（追加）
前置依赖卡片：无
可并行执行：否（同文件）
单卡片代码量预估：~50 行
受影响已有文件：`serve-static.js` — 仅追加 MOCK_API 对象，不改现有 handler
必须导入的模块/路径：无
核心功能/目标：为 A1/B1/A2/B2/D1 添加 mock API handler，使轻量模式可预览

硬性接口契约 — 追加到 `MOCK_API` 的 5 个 handler：
```js
'/api/archaeology/dig': () => ({
  success: true,
  data: {
    card: { id: 1, noteId: 'mock-1', digMode: 'random', noteContent: '这是挖掘出的便签内容示例…', noteDate: '2024-03-15', noteCategory: '生活', noteTitle: 'mock 标题' },
    coKeywords: ['成长', '感悟', '日常'],
    relatedNotes: [{ id: 2, title: '相关便签1', content: '…' }]
  },
  timestamp: new Date().toISOString()
}),
'/api/archaeology/cards': () => ({ success: true, data: { cards: [] }, timestamp: new Date().toISOString() }),
'/api/persona/history': () => ({ success: true, data: { snapshots: [] }, timestamp: new Date().toISOString() }),
'/api/weather/grid?year=2026': () => ({ success: true, data: { year: 2026, layer: 'emotion', days: [], legend: [] }, timestamp: new Date().toISOString() }),
// 实际上 query 参数无法精确匹配，用通用 GET handler
'/api/weather/grid': () => ({ success: true, data: { year: 2026, layer: 'emotion', days: [], legend: [] }, timestamp: new Date().toISOString() }),
'/api/goals': () => ({ success: true, data: { goals: [] }, timestamp: new Date().toISOString() }),
'/api/almanac/list': () => ({ success: true, data: { volumes: [] }, timestamp: new Date().toISOString() }),
```

验收清单：
- GET /api/archaeology/cards → `{success:true, data:{cards:[]}}`
- GET /api/persona/history → `{success:true, data:{snapshots:[]}}`
- GET /api/weather/grid → `{success:true, data:{days:[]}}`
- GET /api/goals → `{success:true, data:{goals:[]}}`
- GET /api/almanac/list → `{success:true, data:{volumes:[]}}`

🚫 禁区声明：不删不改已有 MOCK_API 条目；不改静态文件服务逻辑

防翻车边界 Case：
- SSE 端点（/archaeology/:cardId/appraise, /persona/generate 等）不加入 MOCK_API，前端在这些端点调用失败时显示"离线模式不可用"
- query string 变化不影响 mock（/weather/grid?year=2025 也命中 /weather/grid）

---

🛠️ **Card 0B: serve-static.js — 3 个新模块 Mock API**
构建优先级：P0
改动性质：既有重构（追加）
前置依赖卡片：Card 0A
可并行执行：否（同文件串行）
单卡片代码量预估：~30 行
受影响已有文件：`serve-static.js`

硬性接口契约：
```js
'/api/penpal/threads': () => ({ success: true, data: { threads: [] }, timestamp: new Date().toISOString() }),
'/api/letters': () => ({ success: true, data: { letters: [] }, timestamp: new Date().toISOString() }),
'/api/memoir/': () => ({ success: true, data: { memoirs: [] }, timestamp: new Date().toISOString() }),
```

验收清单：GET 以上 3 个端点返回预期空列表

---

🛠️ **Card 1A: 创建 penpal.js 前端模块**
构建优先级：P2
改动性质：纯新增
前置依赖卡片：无
可并行执行：是
单卡片代码量预估：~160 行
受影响已有文件：无（纯新增 `public/js/modules/penpal.js`）
必须导入的模块/路径：无

核心功能/目标：笔友会话列表 + 创建会话 + 消息 SSE 对话

导出接口：
```js
export function mountPenpal(container)
export function unmountPenpal()
```

内部函数：
- `renderMainView()` — 左侧线程列表，右侧消息区
- `loadThreads()` — GET /api/penpal/threads → 列表
- `showCreateDialog()` — modal：personaLabel / windowStart / windowEnd → POST /api/penpal/threads
- `openThread(threadId)` — GET /api/penpal/threads/:id/letters → 渲染消息历史
- `sendMessage(threadId)` — SSE POST /api/penpal/threads/:id/messages

验收清单：
[UI] 加载后显示空列表 + "创建笔友线程"按钮
[UI] 创建弹窗含 personaLabel/windowStart/windowEnd 输入
[API] 点击线程进入消息视图，输入框发送消息 SSE 流式显示回复
[清理] unmount 后 AbortController 终止，全局函数清除

🚫 禁区声明：不修改后端 penpalController.js 和 routes

---

🛠️ **Card 1B: 创建 letter.js 前端模块（时光胶囊）**
构建优先级：P2
改动性质：纯新增
前置依赖卡片：无
可并行执行：是
单卡片代码量预估：~160 行
受影响已有文件：无（纯新增 `public/js/modules/letter.js`）

导出接口：
```js
export function mountLetter(container)
export function unmountLetter()
```

验收清单：
[UI] 加载后显示空列表 + "写封信"按钮
[UI] 写信弹窗含所有 triggerType 选择
[API] 点击已投递信件 → SSE 显示揭示内容
[清理] unmount 正确中止 SSE

---

🛠️ **Card 1C: 创建 memoir.js 前端模块（回忆录）**
构建优先级：P2
改动性质：纯新增
前置依赖卡片：无
可并行执行：是
单卡片代码量预估：~160 行
受影响已有文件：无（纯新增 `public/js/modules/memoir.js`）

导出接口：
```js
export function mountMemoir(container)
export function unmountMemoir()
```

验收清单：
[UI] 加载后显示空列表 + "生成回忆录"按钮
[UI] 生成弹窗含 theme 输入 + chapters 滑块
[API] 生成过程中 SSE 流式显示 → 完成后显示章节列表
[API] 发布按钮可用

---

🛠️ **Card 2A: ApiClient 追加方法 + modules/index.js 注册**
构建优先级：P1
改动性质：既有重构（追加）
前置依赖卡片：Card 1A/1B/1C
可并行执行：否（需要在3个前端模块文件存在后执行）
单卡片代码量预估：~80 行
受影响已有文件：
- `public/js/api.js` — 追加 penpal/letter/memoir 的 ApiClient 方法
- `public/js/modules/index.js` — 追加 3 个 import + 3 个注册项

硬性接口契约 — api.js 追加：
```js
// Penpal
async listPenpalThreads() { return this.request('/penpal/threads', { headers: this.getHeaders() }); },
async createPenpalThread(data) { return this.request('/penpal/threads', { method:'POST', headers:this.getHeaders(), body:JSON.stringify(data) }); },
subscribePenpalMessage(threadId, payload, handlers) {
  return this._sse(`/penpal/threads/${threadId}/messages`, { method:'POST', body:JSON.stringify(payload), signal:handlers?.signal }, handlers);
},
async getPenpalLetters(threadId) { return this.request(`/penpal/threads/${threadId}/letters`, { headers: this.getHeaders() }); },

// Letter
async createLetter(data) { return this.request('/letter', { method:'POST', headers:this.getHeaders(), body:JSON.stringify(data) }); },
async listLetters() { return this.request('/letters', { headers: this.getHeaders() }); },
subscribeOpenLetter(id, handlers) {
  return this._sse(`/letter/${id}/open`, { method:'GET', headers:this.getHeaders(), signal:handlers?.signal }, handlers);
},

// Memoir
async listMemoirs() { return this.request('/memoir/', { headers: this.getHeaders() }); },
subscribeGenerateMemoir(payload, handlers) {
  return this._sse('/memoir/generate', { method:'POST', body:JSON.stringify(payload), signal:handlers?.signal }, handlers);
},
async getMemoirExport(memoirId) { return this.request(`/memoir/${memoirId}/export`, { headers: this.getHeaders() }); },
async publishMemoir(memoirId) { return this.request(`/memoir/${memoirId}/publish`, { method:'POST', headers:this.getHeaders() }); },
```

modules/index.js 追加：
```js
import { mountPenpal, unmountPenpal } from './penpal.js';
import { mountLetter, unmountLetter } from './letter.js';
import { mountMemoir, unmountMemoir } from './memoir.js';

'penpal': { mount: mountPenpal, unmount: unmountPenpal, label: '✉️ 跨时空笔友' },
'letter': { mount: mountLetter, unmount: unmountLetter, label: '📮 时光胶囊' },
'memoir': { mount: mountMemoir, unmount: unmountMemoir, label: '📖 主题回忆录' },
```

验收清单：
[api.js] 所有方法调用 URL 正确
[index.js] 3 个模块注册后可被 switchModule() 调用

---

🛠️ **Card 2B: 主页入口集成（index.html）**
构建优先级：P1
改动性质：既有重构（追加）
前置依赖卡片：Card 2A
可并行执行：否
单卡片代码量预估：~80 行
受影响已有文件：`public/index.html`

修改点：
1. 追加 3 个 view container（`#reader-panel` 内，与已有 5 个并列，class="innovation-view"）
2. 追加 3 个 sidebar button（`.icon-rail-middle` 内，在 growthTree 和 mind-galaxy 之间）
3. switchToInnovationView 扩展：allViews + viewMap

验收清单：
[UI] icon-rail 中 3 个新按钮可见，点击后对应视图显示
[DOM] unmount 时视图隐藏

---

🛠️ **Card 3A: 冒烟测试扩展 + Bug 修复**
构建优先级：P0
改动性质：既有重构（追加）
前置依赖卡片：所有 Phase 0-2 完成
可并行执行：否
单卡片代码量预估：~50 行
受影响已有文件：`server/test/smoke.js`

追加 8 个模块的 API 端点可达性测试：
```js
const MODULE_ENDPOINTS = [
  { method: 'GET', path: '/api/archaeology/cards', name: 'A1 archaeology' },
  { method: 'GET', path: '/api/persona/history', name: 'B1 persona' },
  { method: 'GET', path: '/api/weather/grid?year=2026', name: 'A2 emotion-weather' },
  { method: 'GET', path: '/api/goals', name: 'B2 growth-tree' },
  { method: 'GET', path: '/api/almanac/list', name: 'D1 almanac' },
  { method: 'GET', path: '/api/penpal/threads', name: 'C1 penpal' },
  { method: 'GET', path: '/api/letters', name: 'C2 letter' },
  { method: 'GET', path: '/api/memoir/', name: 'D2 memoir' },
];
```

验收清单：
[测试] node server/test/smoke.js 全部 8 个端点可达（未登录返回 401）
[修复] 测试中发现的问题逐一修复

## 5. 影响分析

| 文件 | 改动类型 | 风险 |
|------|---------|------|
| `serve-static.js` | 追加 ~80 行 MOCK_API | 低 — 纯追加 |
| `public/js/modules/penpal.js` | 新增 ~160 行 | 低 — 纯新增 |
| `public/js/modules/letter.js` | 新增 ~160 行 | 低 — 纯新增 |
| `public/js/modules/memoir.js` | 新增 ~160 行 | 低 — 纯新增 |
| `public/js/api.js` | 追加 ~50 行 | 中 — 需确认不重复定义 |
| `public/js/modules/index.js` | 追加 3 组 import+注册 | 低 |
| `public/index.html` | 追加 3×container + 3×button + viewMap | 低 |
| `server/test/smoke.js` | 追加 8 个端点测试 | 低 |

## 6. 风险提示

1. api.js 方法重复 — 需先确认 ApiClient 是否已存在 penpal/letter/memoir 方法
2. SSE 端点无法 mock — 前端在轻量模式应显示"离线模式不可用"
3. mount 函数名一致性 — switchToInnovationView 中名称必须与 JS export 匹配
4. view container class 一致性 — 必须使用 class="innovation-view"
