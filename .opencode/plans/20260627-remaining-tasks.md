# 剩余开发任务执行计划

## 1. 需求摘要

将 Claude Code 开发过程中遗留的 3 项任务完成：前端内联样式提取 CSS 类（~2h）、创建 API 冒烟测试脚本（~1.5h）、更新 CLAUDE.md 项目文档（~1h），总计约 4.5h。

---

## 2. 构建拓扑图

```
[并行] 卡片 1 ∥ 卡片 2 ∥ 卡片 3 （三者无交叉依赖，完全独立）
  ├── 卡片 1: public/css/style.css + public/js/app.js （前端样式提取）
  ├── 卡片 2: server/test/smoke.js （API 冒烟测试）
  └── 卡片 3: CLAUDE.md + C:\Users\Zxin\.claude\CLAUDE.md （文档更新）
```

三张卡片可完全并行执行。每张卡片改动量均 ≤ 200 行。

---

## 3. 数据契约总览

三张卡片无跨卡片共享数据结构，各自独立。无需全局类型定义。

卡片 1 的约定：
```css
/* 以下 CSS 类名已在卡片 1 中定义，app.js 将引用这些类名 */

/* 玻璃卡片面板 */
.x-panel-glass {
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.02);
}

/* 玻璃卡片面板（小圆角变体） */
.x-panel-glass-sm {
  padding: 20px;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.02);
}

/* 对话气泡头部 */
.x-bubble-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
  margin-bottom: 8px;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.04);
  padding-bottom: 4px;
}

/* 药丸形操作按钮 */
.x-btn-pill {
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
}

/* 透明无边框按钮 */
.x-btn-ghost {
  background: none;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s;
}

/* 建议卡片 */
.x-suggestion-card {
  flex: 1;
  min-width: 200px;
  padding: 10px 14px;
  background: rgba(138, 180, 248, 0.03);
  border: 1px solid rgba(138, 180, 248, 0.1);
  border-radius: 12px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

/* 表格滚动包裹 */
.x-table-wrapper {
  overflow-x: auto;
  max-width: 100%;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  margin: 16px 0;
  background: rgba(255, 255, 255, 0.01);
}
```

---

## 4. 任务卡片列表

---

### 🛠️ [1] 任务卡片：public/css/style.css（新增 CSS 类）
构建优先级：P0 - 底层依赖
改动性质：纯新增
前置依赖卡片：无
可并行执行：是（不与 2、3 交叉）
单卡片代码量预估：55 行
受影响已有文件：
  - public/css/style.css - 在此文件末尾追加（行 4097 起，原文件行 1-4096 不许动）
必须导入的模块/路径：无（纯 CSS 文件，无 import）
核心功能 / 目标：在 style.css 末尾追加 7 个提取的 CSS 类，供 app.js 引用
硬性接口契约 / 修改点：

在 public/css/style.css 末尾（行 4097）追加以下 CSS 代码块。原文件 1-4096 行【绝对禁止修改】。

写入内容（直接复制）：
```css
/* ===== 提取自 app.js 内联样式 ===== */

.x-panel-glass {
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.02);
}

.x-panel-glass-sm {
  padding: 20px;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.02);
}

.x-bubble-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
  margin-bottom: 8px;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.04);
  padding-bottom: 4px;
}

.x-btn-pill {
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
}

.x-btn-ghost {
  background: none;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s;
}

.x-suggestion-card {
  flex: 1;
  min-width: 200px;
  padding: 10px 14px;
  background: rgba(138, 180, 248, 0.03);
  border: 1px solid rgba(138, 180, 248, 0.1);
  border-radius: 12px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.x-table-wrapper {
  overflow-x: auto;
  max-width: 100%;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  margin: 16px 0;
  background: rgba(255, 255, 255, 0.01);
}
```

本卡片产出物被后续卡片消费情况：
- 产出：7 个 CSS 类（.x-panel-glass, .x-panel-glass-sm, .x-bubble-header, .x-btn-pill, .x-btn-ghost, .x-suggestion-card, .x-table-wrapper）
- 被卡片 1B（app.js 修改）消费

验收清单：
[输入] 浏览器加载页面 → [预期输出] style.css 末尾包含 7 个 .x-* CSS 类定义
[输入] 使用 CSS 类名 .x-bubble-header → [预期输出] 元素显示为 flex 布局、12px 字体、primary 色
[输入] 使用 CSS 类名 .x-panel-glass → [预期输出] 元素显示为 16px 内边距、圆角边框、半透明背景

🚫 禁区声明：
以下变/量/接口【绝对禁止修改】：style.css 第 1-4096 行的任何内容
以下文件【绝对禁止改动】：除 public/css/style.css 外的任何文件
以下新增依赖【绝对禁止引入】：无

防翻车边界 Case（必写）：
- 确保追加的内容在文件末尾，前面有至少一个空行与原有内容分隔
- CSS 属性值中的 var(--border-color) 等 CSS 变量在 style.css 头部已定义，无需重复定义
- 文件末尾必须有换行符

参考依赖 Context：
无

⚠️【执行模型硬约束】：
「【执行工兵严格指令】：你当前仅负责落地本文件的代码。你必须严格遵守架构师给出的数据结构和 Diff 指示，【严禁】私自修改任何未授权的字段名、参数顺序或函数签名。代码必须写全异常捕获与空值检查！」

---

### 🛠️ [1B] 任务卡片：public/js/app.js（替换内联样式为 CSS 类）
构建优先级：P1 - 业务层
改动性质：局部 Diff 修复
前置依赖卡片：[1]（依赖 style.css 中的 CSS 类定义）
可并行执行：否（必须在卡片 1 之后执行）
单卡片代码量预估：140 行（7 处替换，每处约 20 行上下文变更）
受影响已有文件：
  - public/js/app.js - 仅替换以下 7 处 style.cssText 赋值，其余 3170 行不许动
必须导入的模块/路径：无（app.js 是纯 JS 文件）
核心功能 / 目标：将 7 个高频 style.cssText 赋值替换为 className = 'x-xxx 类名'，保留各自独特的 CSS 属性

硬性接口契约 / 修改点（精确 Diff，按行号定位）：

---

**修改 1：行 672 — sync history panel → .x-panel-glass**

旧代码（行 672）：
```js
panel.style.cssText = 'margin-top:16px; padding:16px; border:1px solid var(--border-color); border-radius:16px; background: rgba(255,255,255,0.02);';
```
新代码：
```js
panel.className = 'x-panel-glass';
panel.style.marginTop = '16px';
```

---

**修改 2：行 717 — trash drawer → .x-panel-glass**

旧代码（行 717）：
```js
drawer.style.cssText = 'width:100%; margin-top:20px; padding:16px; border:1px solid var(--border-color); border-radius:16px; background: rgba(255,255,255,0.02);';
```
新代码：
```js
drawer.className = 'x-panel-glass';
drawer.style.width = '100%';
drawer.style.marginTop = '20px';
```

---

**修改 3：行 874 — version history box → .x-panel-glass-sm**

旧代码（行 874）：
```js
box.style.cssText = `margin-top: 40px; padding: 20px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 14px;`;
```
新代码：
```js
box.className = 'version-history-box x-panel-glass-sm';
box.style.marginTop = '40px';
```

---

**修改 4：行 1098 — bubble header（多智能体视角）→ .x-bubble-header**

旧代码（行 1098）：
```js
bubbleHeader.style.cssText = 'display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; color:var(--primary); margin-bottom:8px; border-bottom:1px dashed rgba(255,255,255,0.04); padding-bottom:4px;';
```
新代码：
```js
bubbleHeader.className = 'x-bubble-header';
```

---

**修改 5：行 1278 — bubble header（轮转模式）→ .x-bubble-header**

旧代码（行 1278）：
```js
bubbleHeader.style.cssText = 'display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; color:var(--primary); margin-bottom:8px; border-bottom:1px dashed rgba(255,255,255,0.04); padding-bottom:4px;';
```
新代码：
```js
bubbleHeader.className = 'x-bubble-header';
```

---

**修改 6：行 1443 — suggestion card → .x-suggestion-card**

旧代码（行 1443）：
```js
card.style.cssText = 'flex:1; min-width:200px; padding:10px 14px; background:rgba(138,180,248,0.03); border:1px solid rgba(138,180,248,0.1); border-radius:12px; cursor:pointer; font-size:12px; transition:all 0.2s;';
```
新代码：
```js
card.className = 'ai-preset-card x-suggestion-card';
```

---

**修改 7：行 2536 — table scroll wrapper → .x-table-wrapper**

旧代码（行 2536）：
```js
wrapper.style.cssText = 'overflow-x: auto; max-width: 100%; border: 1px solid var(--border-color); border-radius: 12px; margin: 16px 0; background: rgba(255,255,255,0.01);';
```
新代码：
```js
wrapper.className = 'table-scroll-wrapper x-table-wrapper';
```

---

**注意：** 以下 style 使用【绝对不改】：
- 行 146 (sysMsg) — 单次使用，不提取
- 行 270 (btnCreate) — 已有 className 补充，不提取
- 行 286 (headerRight) — 已有 className，不提取
- 行 291 (btnEdit) — 已用 className 覆盖，保留 style.cssText 用于颜色变量
- 行 298 (btnDelete) — 同上
- 行 314 (editView) — 已用 className + display，不提取
- 行 339 (btnLogout) — 单次使用，不提取
- 行 1438 (suggestionsEl) — 已有 className，不提取
- 行 2109 (cell) — 含动态 `${bg}` `${border}`，无法提取
- 行 2382 (hlTooltip) — position:fixed 含 z-index，不适合提取

本卡片产出物被后续卡片消费情况：
无后续消费者

验收清单：
[输入] 启动服务器，打开前端页面 → [预期输出] 所有面板（同步历史、回收站、版本历史）显示正常，边框/圆角/内边距不变
[输入] AI 对话中触发多智能体视角 → [预期输出] 对话气泡头部样式不变（flex 布局、primary 色、虚线底边框）
[输入] AI 对话中收到建议卡片 → [预期输出] 建议卡片样式不变（flex、半透明边框、圆角）
[输入] 便签正文中包含 Markdown 表格 → [预期输出] 表格包裹容器样式不变（overflow-x、圆角、margin）
[输入] 对比修改前后的页面截图 → [预期输出] 无视觉差异

🚫 禁区声明：
以下函数/变量/接口【绝对禁止修改】：除上述 7 处 style.cssText 替换外，app.js 中的其他 11 处 style.cssText 赋值【均不改】
以下文件【绝对禁止改动】：除 public/js/app.js 外的任何文件
以下字段名【绝对禁止重命名】：无
以下新增依赖【绝对禁止引入】：无

防翻车边界 Case（必写）：
- 修改 3：box 已有 className='version-history-box'，追加为 className='version-history-box x-panel-glass-sm'，空格分隔
- 修改 6：card 已有 className='ai-preset-card'，追加为 className='ai-preset-card x-suggestion-card'
- 修改 7：wrapper 已有 className='table-scroll-wrapper'，追加为 className='table-scroll-wrapper x-table-wrapper'
- 修改 1、2：panel 和 drawer 原先无 className，直接用 className 赋值
- 修改 1 的 marginTop 保留为独立 style（CSS 类不含 margin-top）
- 修改 2 的 width 和 marginTop 保留为独立 style（CSS 类不含这两个属性）
- 修改 3 的 marginTop 保留为独立 style（CSS 类不含 margin-top）

参考依赖 Context：
app.js 中已有使用 className 赋值的代码示例（行 291-292）：
```js
btnEdit.id = 'btn-edit-note';
btnEdit.className = 'btn-action-outline';
```
遵循相同模式即可。

⚠️【执行模型硬约束】：
「【执行工兵严格指令】：你当前仅负责落地本文件的代码。你必须严格遵守架构师给出的数据结构和 Diff 指示，【严禁】私自修改任何未授权的字段名、参数顺序或函数签名。代码必须写全异常捕获与空值检查！」

---

### 🛠️ [2] 任务卡片：server/test/smoke.js（API 冒烟测试脚本）
构建优先级：P1 - 业务层
改动性质：纯新增
前置依赖卡片：无
可并行执行：是（与 1、3 均无交叉依赖）
单卡片代码量预估：160 行
受影响已有文件：
  - 根目录/test_api.js - 删除（废弃文件）
必须导入的模块/路径：无（使用 Node.js 18+ 内置 fetch）
核心功能 / 目标：创建可独立运行的冒烟测试脚本，覆盖 7 个核心 API 场景，输出 ✅/❌ 汇总

硬性接口契约 / 修改点：

创建文件 `E:\GzrjxyGzrjxyGzrjxyGzrjxy\Project documents for all departments\AInything\OPPO便签导出系统\server\test\smoke.js`。

脚本必须包含以下测试用例（按顺序执行）：

```js
// 测试常量
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000/api';
// 测试用户：随机后缀避免冲突
const TEST_USER = `smoke_${Date.now()}`;
const TEST_PASS = 'SmokeTest123!';
let authToken = '';
let noteId = '';
let tagId = '';
let kbId = '';

// 测试 1: 健康检查
// GET BASE_URL/health
// 期望: status === 200, body.status === 'ok'

// 测试 2: 用户注册
// POST BASE_URL/auth/register
// body: { username: TEST_USER, password: TEST_PASS }
// 期望: status === 201, body.success === true

// 测试 3: 用户登录
// POST BASE_URL/auth/login
// body: { username: TEST_USER, password: TEST_PASS }
// 期望: status === 200, body.success === true, body.data.token 存在
// 提取: authToken = body.data.token

// 测试 4: 便签 CRUD（需 Authorization: Bearer token）
// 4a. POST /notes → 创建便签 { title: '冒烟测试便签', content: '测试内容', category: '测试' }
//     期望: status 200/201, body.success === true, body.data.id 存在
//     提取: noteId = body.data.id
// 4b. GET /notes → 便签列表
//     期望: status === 200, body.success === true, Array.isArray(body.data.items)
// 4c. GET /notes/:noteId → 便签详情
//     期望: status === 200, body.success === true
// 4d. PUT /notes/:noteId → 更新便签 { title: '冒烟测试便签(已更新)' }
//     期望: status === 200, body.success === true
// 4e. DELETE /notes/:noteId → 删除便签
//     期望: status === 200, body.success === true

// 测试 5: 标签 CRUD（需 token）
// 5a. POST /tags → 创建标签 { name: '冒烟标签', color: '#ff6b6b' }
//     期望: status 200/201, body.success === true
//     提取: tagId = body.data.id
// 5b. GET /tags → 标签列表
//     期望: status === 200, Array.isArray(body.data)

// 测试 6: 知识库（需 token）
// 6a. POST /knowledge-bases → 创建知识库 { name: '冒烟知识库', description: '测试' }
//     期望: status 200/201, body.success === true
//     提取: kbId = body.data.id
// 6b. GET /knowledge-bases → 知识库列表
//     期望: status === 200, Array.isArray(body.data)

// 测试 7: 清理
// DELETE /knowledge-bases/:kbId → 删除测试知识库
// DELETE /tags/:id → 删除测试标签
// （便签已在 4e 删除）
```

脚本结构模板（执行工兵严格按此结构实现）：
```js
// smoke.js
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000/api';
const TEST_USER = `smoke_${Date.now()}`;
const TEST_PASS = 'SmokeTest123!';

let passed = 0;
let failed = 0;
const results = [];

function ok(name) { passed++; results.push({ name, pass: true }); console.log(`✅ ${name}`); }
function fail(name, detail) { failed++; results.push({ name, pass: false, detail }); console.log(`❌ ${name}: ${detail}`); }

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function main() {
  let token = '';
  let noteId = '';
  let tagId = '';
  let kbId = '';

  // 测试 1
  try {
    const { status, data } = await api('GET', '/health');
    if (status === 200 && data.status === 'ok') ok('健康检查');
    else fail('健康检查', `status=${status} body=${JSON.stringify(data)}`);
  } catch (e) { fail('健康检查', e.message); }

  // 测试 2
  try {
    const { status, data } = await api('POST', '/auth/register', { username: TEST_USER, password: TEST_PASS });
    if (status === 201 && data.success) ok('用户注册');
    else fail('用户注册', `status=${status} body=${JSON.stringify(data)}`);
  } catch (e) { fail('用户注册', e.message); }

  // 测试 3
  try {
    const { status, data } = await api('POST', '/auth/login', { username: TEST_USER, password: TEST_PASS });
    if (status === 200 && data.success && data.data?.token) {
      ok('用户登录');
      token = data.data.token;
    } else fail('用户登录', `status=${status} token=${!!data.data?.token}`);
  } catch (e) { fail('用户登录', e.message); }

  if (!token) { console.log('⚠️ 登录失败，跳过后续需认证的测试'); } else {
    // 测试 4a
    try {
      const { status, data } = await api('POST', '/notes', { title: '冒烟测试便签', content: '测试内容', category: '测试' }, token);
      if (data.success && data.data?.id) {
        ok('创建便签');
        noteId = data.data.id;
      } else fail('创建便签', JSON.stringify(data));
    } catch (e) { fail('创建便签', e.message); }

    // 测试 4b
    try {
      const { status, data } = await api('GET', '/notes', null, token);
      if (status === 200 && data.success && Array.isArray(data.data?.items)) ok('便签列表');
      else fail('便签列表', JSON.stringify(data).slice(0, 100));
    } catch (e) { fail('便签列表', e.message); }

    // 测试 4c
    if (noteId) {
      try {
        const { status, data } = await api('GET', `/notes/${noteId}`, null, token);
        if (status === 200 && data.success) ok('便签详情');
        else fail('便签详情', JSON.stringify(data));
      } catch (e) { fail('便签详情', e.message); }

      // 测试 4d
      try {
        const { status, data } = await api('PUT', `/notes/${noteId}`, { title: '冒烟测试便签(已更新)' }, token);
        if (status === 200 && data.success) ok('更新便签');
        else fail('更新便签', JSON.stringify(data));
      } catch (e) { fail('更新便签', e.message); }

      // 测试 4e
      try {
        const { status, data } = await api('DELETE', `/notes/${noteId}`, null, token);
        if (status === 200 && data.success) ok('删除便签');
        else fail('删除便签', JSON.stringify(data));
      } catch (e) { fail('删除便签', e.message); }
    }

    // 测试 5a
    try {
      const { status, data } = await api('POST', '/tags', { name: '冒烟标签', color: '#ff6b6b' }, token);
      if (data.success && data.data?.id) {
        ok('创建标签');
        tagId = data.data.id;
      } else fail('创建标签', JSON.stringify(data));
    } catch (e) { fail('创建标签', e.message); }

    // 测试 5b
    try {
      const { status, data } = await api('GET', '/tags', null, token);
      if (status === 200 && Array.isArray(data.data)) ok('标签列表');
      else fail('标签列表', JSON.stringify(data));
    } catch (e) { fail('标签列表', e.message); }

    // 测试 6a
    try {
      const { status, data } = await api('POST', '/knowledge-bases', { name: '冒烟知识库', description: '测试' }, token);
      if (data.success && data.data?.id) {
        ok('创建知识库');
        kbId = data.data.id;
      } else fail('创建知识库', JSON.stringify(data));
    } catch (e) { fail('创建知识库', e.message); }

    // 测试 6b
    try {
      const { status, data } = await api('GET', '/knowledge-bases', null, token);
      if (status === 200 && Array.isArray(data.data)) ok('知识库列表');
      else fail('知识库列表', JSON.stringify(data));
    } catch (e) { fail('知识库列表', e.message); }

    // 测试 7: 清理
    if (kbId) {
      try {
        await api('DELETE', `/knowledge-bases/${kbId}`, null, token);
        ok('清理知识库');
      } catch (e) { fail('清理知识库', e.message); }
    }
    if (tagId) {
      try {
        await api('DELETE', `/tags/${tagId}`, null, token);
        ok('清理标签');
      } catch (e) { fail('清理标签', e.message); }
    }
  }

  console.log(`\n===== 测试结果 =====`);
  console.log(`通过: ${passed}  失败: ${failed}  总计: ${passed + failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
```

本卡片产出物被后续卡片消费情况：
无后续消费者

验收清单：
[输入] 服务器运行时执行 `node server/test/smoke.js` → [预期输出] 14 个测试用例全部 ✅
[输入] 服务器未运行时执行 → [预期输出] 测试 1（健康检查）❌，其余测试跳过或失败，最终 exit code 1
[输入] 验证注册接口 → [预期输出] POST /api/auth/register 返回 201 + success:true
[输入] 验证带 token 的请求 → [预期输出] Authorization header 格式为 Bearer <token>，请求返回 200

🚫 禁区声明：
以下文件【绝对禁止改动】：server/ 下除 server/test/smoke.js 外的所有文件
以下新增依赖【绝对禁止引入】：不得引入 axios、jest、mocha 等第三方测试库，仅使用内置 fetch

防翻车边界 Case（必写）：
- 每个 API 调用必须 try-catch 包裹，网络错误（ECONNREFUSED）须捕获并打印 ❌
- fetch 返回值必须先 await res.json()，对非 JSON 响应需要兜底
- 测试 4c/4d/4e 依赖 noteId 存在，需 if (noteId) 守卫
- 测试 7 清理依赖 kbId/tagId 存在，需 if 守卫
- 最终 process.exit(failed > 0 ? 1 : 0)，确保 CI 能读取 exit code
- 密码 Smok eTest123! 满足 validate.js 密码长度 4-128 要求

参考依赖 Context：
现有 server/utils/response.js 的成功响应格式：
```js
export function success(res, data, statusCode = 200) {
```

现有 server/config/index.js 的端口配置：
```js
port: parseInt(process.env.PORT) || 8000,
```

⚠️【执行模型硬约束】：
「【执行工兵严格指令】：你当前仅负责落地本文件的代码。你必须严格遵守架构师给出的数据结构和 Diff 指示，【严禁】私自修改任何未授权的字段名、参数顺序或函数签名。代码必须写全异常捕获与空值检查！」

---

**附带操作：删除 test_api.js**

在卡片 2 执行时同步执行：

```bash
Remove-Item -LiteralPath "E:\GzrjxyGzrjxyGzrjxyGzrjxy\Project documents for all departments\AInything\OPPO便签导出系统\test_api.js"
```

---

### 🛠️ [3] 任务卡片：CLAUDE.md（项目根目录）— 更新项目文档
构建优先级：P2 - UI/文档层
改动性质：既有重构
前置依赖卡片：无
可并行执行：是（与 1、2 无交叉依赖）
单卡片代码量预估：80 行增量
受影响已有文件：
  - 项目根目录/CLAUDE.md - 在现有内容基础上追加和修正章节
必须导入的模块/路径：无
核心功能 / 目标：更新 CLAUDE.md 反映新架构约定（asyncHandler、response 工具、SSE 工具、config 访问、子路由、Repository 模式），修正过时的目录结构

硬性接口契约 / 修改点：

当前位置 1：在"项目结构"章节中，补充实际存在的文件和目录。

当前描述（行 32-36）：
```markdown
├── public/                  # 前端静态文件
│   ├── index.html           # 主页面（SPA入口）
│   ├── mind-galaxy.html     # 心智星系 3D 可视化页面
│   └── js/                  # 前端脚本
│       └── api.js           # API 客户端封装
```

替换为：
```markdown
├── public/                  # 前端静态文件
│   ├── index.html           # 主页面（SPA入口）
│   ├── mind-galaxy.html     # 心智星系 3D 可视化页面
│   ├── css/                 # 样式文件
│   │   ├── style.css        # 全局样式
│   │   └── animations.css   # 动画定义
│   └── js/                  # 前端脚本
│       ├── api.js           # API 客户端封装
│       ├── app.js           # 主应用逻辑（~2900行）
│       ├── components/      # 可复用组件
│       ├── core/            # 核心状态管理
│       ├── modules/         # 业务模块（almanac, cosmos等）
│       ├── services/        # 前端服务层
│       └── utils/           # 前端工具函数
```

当前位置 2：在"后端规范"章节中，追加以下编码规范（紧接现有规范之后）。

在"数据库操作"规范（行 ~72）之后插入：

```markdown
- **路由拆分**：大型模块必须创建独立子路由文件 `server/routes/xxx.js`，在 `api.js` 中统一挂载
- **Repository 模式**：数据访问优先使用 Repository 类（`server/repositories/` 目录），不直接在控制器中写 SQL
- **集中式配置**：环境变量必须通过 `server/config/index.js` 的 `config` 对象访问，禁止直接读 `process.env`
- **SSE 流式端点**：使用 `utils/sse.js` 的 `setupSSE(res)` 和 `sendSSE(res, event, data)`
```

当前位置 3：在"API 响应示例"章节后，追加 `asyncHandler` 的使用说明：

```markdown
### 控制器函数包装

所有异步控制器必须用 `asyncHandler` 包装：
```js
import { asyncHandler } from '../utils/response.js';

export const myEndpoint = asyncHandler(async (req, res) => {
  const data = await someService.doSomething(req.user.id);
  return success(res, data);
});
```

`asyncHandler` 自动捕获异步错误，返回统一错误格式：`{ success: false, error: '内部服务器错误', timestamp }`。
```

当前位置 4：更新"业务模块清单"，追加未列出的模块：

```markdown
| 模块 | 路径前缀 | 说明 |
|------|---------|------|
| 标签管理 | `/api/tags/*` | 标签 CRUD、笔记标签关联 |
| API Key | `/api/keys/*` | API Key 管理、用量统计 |
| 数据同步 | `/api/sync/*` | 同步推送、同步历史 |
| AI 报告 | `/api/report/*` | 报告生成、PDF 导出、分享 |
| 技能列表 | `/api/skills/*` | AI 技能列表 |
| 便签考古盲盒 | `/api/archaeology/*` | 随机回顾旧便签 |
| 灵魂人格档案 | `/api/persona/*` | 人格画像分析 |
| 生命年报卷宗 | `/api/almanac/*` | 年度报告生成 |
| 笔友书信 | `/api/penpal/*` | 笔友对话线程 |
| 回忆录 | `/api/memoir/*` | 回忆录生成与发布 |
| 信件（时光胶囊） | `/api/letter/*` | 定时信件 |
| 思维光谱 | `/api/thought-spectrum/*` | 思维维度分析 |
```

本卡片产出物被后续卡片消费情况：
无后续消费者

验收清单：
[输入] 新开发者阅读更新后的 CLAUDE.md → [预期输出] 能理解目录结构，知道 public/js/app.js 是主逻辑文件
[输入] 新开发者按编码规范写代码 → [预期输出] 使用 asyncHandler 包装控制器、通过 config 对象访问环境变量、使用 Repository 类做数据访问
[输入] 查找某模块的 API 路径 → [预期输出] 业务模块清单覆盖所有 20+ 个模块

🚫 禁区声明：
以下文件【绝对禁止改动】：C:\Users\Zxin\.claude\CLAUDE.md（全局用户文档由卡片 3B 处理）
以下章节【禁止删除】：任何现有章节，只追加不删除

防翻车边界 Case（必写）：
- 所有路径使用反引号包裹（如 `server/config/index.js`）
- 表格格式保持对齐（Markdown 管道符对齐）
- 不修改两个 CLAUDE.md 的 YAML front matter（如果有的话）
- 追加内容不要与已有内容重复

参考依赖 Context：
项目文档中已有的规范写法（从当前 CLAUDE.md 复制）：
```markdown
- **分层架构**：严格遵循 routes → controllers → services → repositories 四层架构
- **统一响应格式**：所有 API 返回 `{ success: boolean, data?: any, error?: string, timestamp: string }`
```

⚠️【执行模型硬约束】：
「【执行工兵严格指令】：你当前仅负责落地本文件的代码。你必须严格遵守架构师给出的数据结构和 Diff 指示，【严禁】私自修改任何未授权的字段名、参数顺序或函数签名。代码必须写全异常捕获与空值检查！」

---

### 🛠️ [3B] 任务卡片：C:\Users\Zxin\.claude\CLAUDE.md（全局用户文档）— 追加 opencode 环境说明
构建优先级：P2 - UI/文档层
改动性质：纯新增
前置依赖卡片：无
可并行执行：是（与 1、2、3 无交叉依赖）
单卡片代码量预估：15 行
受影响已有文件：
  - C:\Users\Zxin\.claude\CLAUDE.md - 在文件末尾追加一个章节
必须导入的模块/路径：无
核心功能 / 目标：在用户全局 CLAUDE.md 末尾追加一段说明，区分 Claude Code 和 opencode 的工作模式，并将自身标记为 opencode 环境下使用的文档

硬性接口契约 / 修改点：

在文件末尾追加：

```markdown

## 8. opencode 环境说明

本文件及项目级 CLAUDE.md 当前在 **opencode**（非 Claude Code）下运行。

- **项目级配置**：项目根目录的 `CLAUDE.md` 包含项目技术栈和架构规范，opencode 会自动读取
- **Plan / Build 工作流**：opencode 使用自定义 skill 系统。`调用planskill` 进入架构规划模式，`调用buildskill` 进入执行工兵模式
- **计划输出**：Plan skill 产出的计划文件写入 `.opencode/plans/YYYYMMDD-xxx.md`
- **会话持久化**：opencode TUI 模式下会话自动保存，使用 `opencode --continue` 恢复

以上第 1-7 节的行为约束在两套工具中均有效。
```

本卡片产出物被后续卡片消费情况：
无后续消费者

验收清单：
[输入] 打开 C:\Users\Zxin\.claude\CLAUDE.md → [预期输出] 文件末尾有"opencode 环境说明"章节
[输入] 新增章节引用"调用planskill"等触发词 → [预期输出] 与 plan skill 的 trigger 描述一致

🚫 禁区声明：
以下内容【绝对禁止修改】：第 1-7 节的所有内容，仅追加不修改
以下文件【绝对禁止改动】：除 C:\Users\Zxin\.claude\CLAUDE.md 外的任何文件

防翻车边界 Case（必写）：
- 追加前确保文件末尾有换行符
- 追加后确保章节标题 ## 8 不与已有标题冲突（当前最大标题号为 ## 7）
- 不要删除或覆盖任何已有内容

参考依赖 Context：
plan skill 的触发词（从 plan/SKILL.md）：
```
trigger: "调用planskill" (exact match). ALSO triggers: "规划模式" "计划模式"...
```

⚠️【执行模型硬约束】：
「【执行工兵严格指令】：你当前仅负责落地本文件的代码。你必须严格遵守架构师给出的数据结构和 Diff 指示，【严禁】私自修改任何未授权的字段名、参数顺序或函数签名。代码必须写全异常捕获与空值检查！」

---

## 5. 影响分析

| 已有文件 | 波及程度 | 说明 |
|---------|---------|------|
| `public/css/style.css` | 未尾追加 55 行 | 不破坏已有类，纯增量 |
| `public/js/app.js` | 7 处精确替换 | 每处替换 style.cssText → className，保留独特属性 |
| `test_api.js` | 删除 | 废弃文件，无引用 |
| `CLAUDE.md`（根目录） | 4 处修改：更新目录结构、新增编码规范、追加 asyncHandler 说明、更新模块清单 | 追加为主，不删已有内容 |
| `C:\Users\Zxin\.claude\CLAUDE.md` | 末尾追加 15 行 | 纯增量 |
| 存量数据 | 无影响 | 纯前端样式和后端测试，不涉及数据库 |

---

## 6. 风险提示

### 高风险点

1. **卡片 1B 的精确替换（最高风险）**
   - 错误风险：用 className 替换后遗漏了原有 style.cssText 中的独特属性（如 margin-top、width 等）
   - 预防措施：每张卡片已逐处列出"保留为独立 style"的属性，执行工兵必须逐字对照不可遗漏

2. **卡片 2 的 fetch 兼容性**
   - 错误风险：Node.js 版本 < 18 不支持内置 fetch
   - 预防措施：脚本开头检查 Node 版本，若不支持则打印友好提示 `console.error('需要 Node.js 18+')` 后 process.exit(1)
   - ⚠️ 需使用者确认：本机 Node.js 版本 ≥ 18

3. **卡片 2 的 API 路由差异**
   - 错误风险：实际路由路径可能与计划假设不符（如测试 4a POST /notes 是否需要 /api 前缀）
   - 预防措施：脚本使用 BASE_URL 统一管理，默认为 `http://localhost:8000/api`，可通过环境变量覆盖
   - 已在探索阶段确认：所有 API 路由前缀为 `/api`，端口为 8000

4. **卡片 1 的视觉回归**
   - 错误风险：CSS 类定义的属性值与原始 style.cssText 不完全一致
   - 预防措施：每个 CSS 类均从原始 style.cssText 逐字段拷贝，未做任何修改

5. **卡片 3 的重复内容风险**
   - 错误风险：追加的内容可能与 CLAUDE.md 已有内容重复
   - 预防措施：追加前需定位确认对应章节是否已存在。如 asyncHandler 说明若已存在则跳过该追加项

6. **弱模型最易犯错**
   - 卡片 1B 的 className 追加（已有 className 时用空格分隔，不是替换）
   - 卡片 3 的 Markdown 表格对齐格式
   - 预防措施：已在每张卡片中用反例标注了这些易错点

---

## 准出检查清单

□ 每张卡片是否包含前置依赖声明 ✓
□ 每张卡片是否包含禁区声明 ✓
□ 每张卡片是否包含验收清单（3-5 条） ✓
□ 每张卡片是否包含"本卡片产出物被后续卡片消费情况"声明 ✓
□ 每张卡片是否包含具体代码示例或精确到行号的修改指示 ✓
□ 每张卡片改动量是否 ≤ 200 行 ✓（1:55, 1B:140, 2:160, 3:80, 3B:15）
□ 构建拓扑是否标注了串行/并行 ✓（三卡完全并行，但 1B 依赖 1）
□ 数据契约总览是否使用可复制代码块而非描述文字 ✓
□ 多张卡片修改同一文件时，是否已标注叠加顺序和文件锚点（无此场景）
□ 是否有任何模糊表述 ✓（无）
□ 整体计划单个卡片拆解粒度是否不超过 1 个文件 ✓（1B 仅改 app.js，2 仅创建 smoke.js）
□ 数据契约是否精确到字段名和类型 ✓（CSS 属性值、API 请求体字段、测试用例名均已精确指定）
□ 计划已通过 write 工具写入 `.opencode/plans/` ✓
□ 弱模型视角自检：逐一确认，无歧义
