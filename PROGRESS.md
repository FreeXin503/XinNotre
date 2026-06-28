# 开发进度跟踪

> 自动维护说明：每完成一个子任务后，git commit + 更新 plan 文档 + 更新本文件。

---

## 创新玩法模块（8 个）

来源：`docs/requirements/2026-06-23-innovation-playability-stickiness-constructive-design.md`

| 模块 | 优先级 | 后端 | 前端 | 联调 | 入口集成 | 剩余工作 |
|------|--------|------|------|------|---------|---------|
| A1 便签考古盲盒 | P0 | ✅ | ✅ 220行 | ❌ | ❌ | 联调API、集成到主页 |
| B1 灵魂人格档案 | P0 | ✅ | ✅ 312行 | ❌ | ❌ | 联调API、集成到主页 |
| A2 情绪天气图 | P1 | ✅ | ✅ 165行 | ❌ | ❌ | 联调API、集成到主页 |
| B2 成长证据树 | P1 | ✅ | ✅ 155行 | ❌ | ❌ | 联调API、集成到主页 |
| C1 跨时空笔友 | P1 | ✅ | ❌ 无前端 | ❌ | ❌ | 创建前端模块 |
| D1 生命年报自动出版 | P1 | ✅ | ✅ 109行 | ❌ | ❌ | 联调API、集成到主页 |
| C2 致未来的信（时光胶囊） | P2 | ✅ | ❌ 无前端 | ❌ | ❌ | 创建前端模块 |
| D2 主题回忆录生成器 | P2 | ✅ | ❌ 无前端 | ❌ | ❌ | 创建前端模块 |

### 附加模块（已全部完成）

| 模块 | 后端 | 前端 | 状态 |
|------|------|------|------|
| 心智星相图 Cosmos | ✅ | ✅ 648行 | 完成 |
| 心智星系 Mind Galaxy v2 | ✅ | ✅ 后端6个Services + 前端10个ES模块 | **完成**（30张卡片全部落地） |
| 夜信 Night Letter | ✅ | ✅ 407行 | 完成 |
| 思维光谱 Thought Spectrum | ✅ | ✅ 416行 | 完成 |

---

## 已完成任务总览（`9703df8`）

以下所有工作已在两次提交中完成并入库：

### 剩余清理任务（`20260627-remaining-tasks`）
| 卡片 | 内容 | 状态 |
|------|------|------|
| Card 1 | CSS 类提取（style.css 追加 7 个 `.x-*` 类） | ✅ 已合并到 style.css |
| Card 1B | app.js 内联样式替换为 className（7 处） | ✅ 已替换 |
| Card 2 | API 冒烟测试脚本 server/test/smoke.js | ✅ 已创建 |
| Card 3 | CLAUDE.md 文档更新（目录/规范/模块清单） | ✅ 已更新 |
| Card 3B | 全局 CLAUDE.md 追加 opencode 环境说明 | ✅ 已追加 |

### 黑洞 Bug 修复（`20260627-fix-blackhole-core-ref-error`）
| 修复 | 状态 |
|------|------|
| `celestialBodies.js:51` `const core = new T.Mesh(...)` | ✅ 已修复 |

### 心智星系 v2（`20260627-mind-galaxy-v2`）

**阶段A - 契约层**
| 卡片 | 状态 | 文件 |
|------|------|------|
| C1 类型契约 | ✅ | `server/types/mindGalaxyTypes.js`（347行，含校验器） |
| C2 DB迁移v7 | ✅ | `server/db/migrations_v7.sql`（4张表） |
| C3 仓储层 | ✅ | `server/repositories/mindGalaxyRepository.js`（196行，CRUD完整） |

**阶段B - 分析层**
| 卡片 | 状态 | 文件 |
|------|------|------|
| C4 数据预处理 | ✅ | `server/services/mindGalaxy/preprocessService.js` |
| C5 NLP基础分析 | ✅ | `server/services/mindGalaxy/nlpBasicService.js`（TF-IDF + K-Means + 20维情绪词典） |
| C6 NLP深度分析 | ✅ | `server/services/mindGalaxy/nlpDeepService.js`（LLM prompt + callAi） |
| C7 心智图谱建模 | ✅ | `server/services/mindGalaxy/mindGraphService.js`（权重公式+7类节点+5类边） |
| C8 星系映射 | ✅ | `server/services/mindGalaxy/galaxyMappingService.js`（10类天体+螺旋布局+哈勃分类） |
| C9 演化服务修复 | ✅ | `server/services/evolutionService.js`（registerEntities参数已正确，无bug） |
| C10 报告服务 | ✅ | 通过 `galaxyMappingService` 中 `mapToGalaxy` 包含的类型推断和映射，C14控制器已有 `/getReport` 端点 |
| C11 配置服务 | ✅ | `server/services/mindGalaxy/configService.js` |
| C12 导出服务 | ✅ | C14控制器 `exportGalaxy` 支持 JSON + picture 格式 |
| C13 路由总装 | ✅ | `server/routes/mindGalaxy.js`（v1+v2 共13个端点） |
| C14 控制器总装 | ✅ | `server/controllers/mindGalaxyController.js`（252行，asyncHandler + SSE 完整） |

**阶段C - 前端**
| 卡片 | 状态 | 文件 |
|------|------|------|
| C15 HTML壳+API | ✅ | `public/mind-galaxy.html`（818行，模块入口） |
| C16 主模块 | ✅ | `public/js/modules/mindGalaxy/index.js` |
| C17 渲染器 | ✅ | `public/js/modules/mindGalaxy/renderer.js` |
| C18 纹理库 | ✅ | `public/js/modules/mindGalaxy/textures.js` |
| C19a 天体工厂1-5 | ✅ | `public/js/modules/mindGalaxy/celestialBodies.js` |
| C19b 天体工厂6-10 | ✅ | `public/js/modules/mindGalaxy/celestialBodies2.js` |
| C20 布局 | ✅ | `public/js/modules/mindGalaxy/layout.js` |
| C21 后处理 | ✅ | 内置在 renderer.js（ACESFilmicToneMapping） |
| C22 交互 | ✅ | `public/js/modules/mindGalaxy/interaction.js` |
| C23 时间控件 | ✅ | 内置在 uiPanels.js（播放控制） |
| C24 UI面板 | ✅ | `public/js/modules/mindGalaxy/uiPanels.js` |
| C25 分析器 | ✅ | 前端通过 SSE 调用后端 /analyze-stream |
| C26 导出器 | ✅ | 后端 exportGalaxy 控制器 |

---

## Git 状态

最新提交：`8cfc4b5` — feat(mind-galaxy): batch 3 complete — C25 share posters + C26 report traceability

### 提交历史

| Hash | 消息 |
|------|------|
| `8cfc4b5` | feat(mind-galaxy): batch 3 complete — C25 share posters + C26 report traceability |
| `00cf757` | docs: mark batch 2 complete, next batch 3 (C25,C26) |
| `9d8b165` | feat(mind-galaxy): batch 2 complete — B3-B8 + C10/C12/C17/C23 |
| `79bf9ca` | docs: mark batch 1 complete, update PROGRESS.md milestone |

---

## 下一步

### 当前进度

- **Phase 0 (A1-A10)**: ✅ 完成
- **批1 (23 cards)**: ✅ 完成
- **批2 (9 cards)**: ✅ 完成
- **批3 (2 cards)**: ✅ 完成
- **批4 (10 cards, 可选)**: D1-D10 远期扩展

### 核心工程里程碑：44/44 ✅ 全部完成

---

## 批 3.5 · Bug 修复（F1-F3）

| 卡片 | 状态 | 文件 |
|------|------|------|
| F1 · backend_critical_fix | ✅ | exportService.js / mindGalaxyRepository.js / shareController.js / mindGalaxyController.js / migrations_v8.sql |
| F3 · lifecycle_fix | ✅ | index.js / mindGalaxyController.js |
| F2 · frontend_xss_interaction | ✅ | interaction.js / uiPanels.js / exporter.js / cosmos.js |

### 关键修复

- **exportService.js**: 删除重复 `const beliefs` 解决 SyntaxError；`pageAdded` 监听前移至 `doc.pipe` 后（全页页码）；try/finally 包装（异常时 doc.end()）
- **mindGalaxyRepository.js**: `getSnapshotById(snapshotId)` 重命名为 `getSnapshotByIdPublic`，新增 `updateSnapshotJson`
- **shareController.js**: `Math.random` token 替换为 `crypto.randomBytes(16).toString('base64url')`
- **mindGalaxyController.js**: `getReport` 传 `userId` 防越权；`setPrivacySettings` localMode 分支合并旧配置；编辑端点改走 `updateSnapshotJson`
- **index.js**: `_transitionRAF` 变量 + unmount 取消；`__mgSnapshot` 两分支统一；`bodyBaseStates` 过渡后重建；step 函数 `!mounted` 守卫
- **mindGalaxyController.js**: SSE 端点添加 `req.on('close')` abort 处理

剩余 D1-D10 批4 为远期可选功能（导入/多人/数字孪生等），计划另行规划。
