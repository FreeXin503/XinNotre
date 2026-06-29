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

## 批 4 · 远期扩展

| 卡片 | 状态 | 文件 |
|------|------|------|
| D1 · import_dayone | ✅ | dayoneImport.js / importController.js / import.js / noteRepository.js / migrations_v9.sql |
| D2 · import_notion_obsidian_etc | ✅ | baseImporter.js / notionImport.js / obsidianImport.js / evernoteImport.js / feishuImport.js |
| D3 · import_chatlog | ✅ | chatlogImport.js / importController.js / import.js |
| D4 · import_voice | ✅ | voiceImport.js / aiProviderService.js / config/index.js / importController.js / import.js |
| D5 · multiplayer_relation | ✅ | relationshipService.js / mindGalaxyController.js / mindGalaxy.js / relationship.js / index.js / migrations_v10.sql |
| D6 · multiplayer_group | ✅ | aggregateService.js / aggregator.js / migrations_v11.sql / controller/routes |
| D7 · ai_galaxy_guide | ✅ | galaxyGuideService.js / mindGalaxyGuideController.js / nlpDeepService.js / index.js / routes |
| D8 · ai_socratic | ✅ | socraticService.js / socratic.js / socraticController.js / migrations_v12.sql / routes / HTML |
| D9 · ai_belief_check | ✅ | beliefCheckService.js / nlpDeepService.js / beliefCheckController.js / migrations_v13.sql / uiPanels.js |
| D10 · digital_twin_evolve | ✅ | digitalTwinService.js / digitalTwinController.js / migrations_v14.sql / index.js / cron / config / routes |

### 2026-06-28：D1 DayOne JSON 导入完成

- **改动文件**：dayoneImport.js, importController.js, routes/import.js, noteRepository.js, migrations_v9.sql, database.js, api.js, package.json
- **关键决策**：
  - `findByUuid` 通过 id 前缀模式 `do_${uuid.slice(0,28)}` 查重，uuid 缺失时降级用 content+timestamp hash
  - `meta_json` 列通过 migrations_v9.sql 加入 notes 表，无需改已有行
  - multer memoryStorage 处理文件上传，控制器二次校验 10MB 限制
- **下一步**：D2 Notion/Obsidian/印象笔记/飞书 BaseImporter 抽象 + 4 格式解析

### 2026-06-28：D2 BaseImporter + 4 格式导入完成

- **改动文件**：baseImporter.js, notionImport.js, obsidianImport.js, evernoteImport.js, feishuImport.js, importController.js, import.js, package.json
- **关键决策**：
  - BaseImporter 提供 `extractTitle` / `truncateContent` 通用方法，子类只需实现 `parse(buffer) → { entries, skipped }`
  - Notion/Obsidian 共用同一套轻量 front-matter 解析（不引 YAML 库）
  - `[[wiki link]]` 抽取为 tags 而非创建双向链接（与 notes 表的 link 机制解耦）
  - enex `<resource>` 替换为 `[图片未迁移]` 占位，不下载二进制
  - 飞书 docx 使用 adm-zip 解压 + 正则提取 `<w:t>`，加密 docx 返回 400
- **下一步**：D3 微信聊天记录导入

### 2026-06-28：D3 微信聊天记录导入完成

- **改动文件**：chatlogImport.js, importController.js, import.js
- **关键决策**：
  - 30 分钟窗口聚合：连续消息间隔 < 30 分钟归为同一 session
  - `---- ... ----` / `-- ... --` 系统消息过滤
  - 每条消息格式：`<timestamp> <speaker>\n<content>`，多行内容归入上一条
  - 跨午夜对话按时间窗自然聚合，不特殊处理
  - `meta_json.wechat` 记录 participants / messageCount / startTime / endTime
- **下一步**：D4 语音文件导入（paraformer-v2 转写）

### 2026-06-28：D4 语音导入完成（DashScope paraformer-v2）

- **改动文件**：config/index.js, aiProviderService.js, voiceImport.js, importController.js, import.js
- **关键决策**：
  - `transcribeAudio` 为 aiProviderService.js 第三个顶层 export，复用 DASHSCOPE_API_KEY
  - 使用 Node 18+ 内置 FormData + Blob，不引 `form-data` 包
  - 25MB 单独 multer limit，其他导入保持 10MB
  - 音频不存盘不存 DB，只留存转写文本
  - 静音/无识别内容返回 `{ imported: 0, message: '未识别出语音内容' }`
- **下一步**：D5 双人关系引力互动

### 2026-06-28：D5 双人星系引力互动完成

- **改动文件**：relationshipService.js, mindGalaxyController.js, mindGalaxy.js, relationship.js, index.js, migrations_v10.sql
- **关键决策**：
  - 邀请状态机：pending → accepted / revoked
  - 双方星系最新快照提取人物节点，交集标为 bridge 金色高亮
  - `?rel=<token>` URL 参数触发关系模式，前端替换示例数据
  - `getSnapshotByIdPublic` 只读访问，不暴露原始 notes
  - crypto.randomBytes 生成 share_token 不可预测
- **下一步**：D6 多人匿名聚合星系

### 2026-06-28：D6 多人匿名聚合星系完成

- **改动文件**：aggregateService.js, aggregator.js, migrations_v11.sql, mindGalaxyController.js, mindGalaxy.js, config/index.js, database.js
- **关键决策**：
  - 服务端严格 schema 校验：只接受 topicVectors / emotionHistogram / anonBodies 三个字段
  - 前端 K-Means 降维 + LOCATION 正则脱敏 + 时间戳精度降到 ISO 周
  - 人物节点 stable 映射为 person001/person002...（同一人跨提交一致）
  - aggregate.enabled 默认 false，环境变量 AGGREGATE_ENABLED=true 开启
  - 纯 map-reduce 聚合，不调 LLM，批量 body 超 10MB 拒绝
- **下一步**：D7 AI 星系向导 SSE 对话

### 2026-06-28：D7 AI 星系向导 SSE 对话完成

- **改动文件**：galaxyGuideService.js, mindGalaxyGuideController.js, nlpDeepService.js, mindGalaxy.js, index.js
- **关键决策**：
  - 独立 controller（mindGalaxyGuideController.js）不复用 aiController，保持 route 无 RAG 耦合
  - LLM 输出解析：`【ACTION:{"bodyId":"...","action":"focus"}】` 特殊 JSON 标记由 onChunk 实时解析
  - 前端 SSE 流式读取 `event: text` → 逐步显示，`event: action` → focus/highlight/timeline
  - `/focus <bodyId>` `/highlight <bodyId>` 命令模式不走 LLM
  - context prompt ≤ 200 字（星系类型 + top5 信念 + top5 人物 + 星体总数）
  - localMode 降级：基于关键词匹配的模板回答，不调 LLM
- **下一步**：D8 苏格拉底式反思引导

### 2026-06-28：D8 苏格拉底式反思引导完成

- **改动文件**：socraticService.js, socratic.js, socraticController.js, mindGalaxy.js, mind-galaxy.html, migrations_v12.sql, database.js
- **关键决策**：
  - 4 阶段状态机：clarify (3轮) → counterexample (2轮) → verify (2轮) → summary
  - 服务端管理对话状态（history_json），每步持久化到 socratic_sessions
  - prompt 模板严格约束：只提问不判断，counterexample 用"假设…会怎样？"
  - 后处理 filterJudgmental 替换"你应该"等判断性话术为开放问题
  - AI 不可用降级为 fallbackUtterance 模板
  - 前端 socratic.js 管理会话生命周期：topic 输入 → 消息列表 → 阶段指示器
- **下一步**：D9 信念系统 5 维度检验

### 2026-06-28：D9 信念系统 5 维度检验完成

- **改动文件**：beliefCheckService.js, nlpDeepService.js, beliefCheckController.js, mindGalaxy.js, uiPanels.js, migrations_v13.sql, database.js
- **关键决策**：
  - 5 维度评分：evidenceStrength / logicalConsistency / counterexampleTolerance / emotionalLoad / behavioralConsequence
  - risk 判定：avg < 0.4 → high, avg > 0.7 → low, else medium
  - analyzeDeepBelief 独立于 analyzeDeep，轻量 prompt + temperature 0.3
  - LLM 失败降级：基于关键词规则的 fallback（否定词/情绪词扫描）
  - 至少 2 条替代信念建议
  - 前端报告面板每项信念旁「检验信念」按钮，点击展开 5 维分数 + 替代视角
- **下一步**：D10 数字心智持续演化 + cron

### 2026-06-28：D10 数字心智持续演化完成

- **改动文件**：digitalTwinService.js, digitalTwinController.js, index.js, config/index.js, mindGalaxy.js, migrations_v14.sql, database.js, package.json
- **关键决策**：
  - 每周演化：按 ISO 周切分 epoch（周一至周日），每周仅生成一次快照
  - 演化流程：data_sources → preprocess → nlpBasic → nlpDeep → persona_json
  - persona_json 存储 top5 情绪、top3 信念、top5 话题
  - cron 表达式 `0 3 * * *`，通过 `_digitalTwinCronStarted` 全局标志防重复注册
  - past-self chat 以 epoch persona_json 为 system prompt，第一人称回答
  - digitalTwin.enabled 默认 true，设置 `DIGITAL_TWIN_ENABLED=false` 关闭
  - 单用户 cron 失败隔离（try/catch 单循环），不影响其他用户
   - 无新数据 → skip 不创建，同一 epoch 重复请求 → skip「本周已演化」
- **下一步**：批 4 全部完成，可进行最终核验

---

## 批 5 · 创新玩法模块联调与前端补齐（`21843c0`）

### 改动统计

| 文件 | 改动量 | 说明 |
|------|--------|------|
| `serve-static.js` | +60 行 | 8 个模块 Mock API handler |
| `public/js/modules/penpal.js` | +11425B 新增 | 笔友会话列表 + 创建 + SSE 对话 |
| `public/js/modules/letter.js` | +11340B 新增 | 时光胶囊列表 + 创建 + SSE 揭示 |
| `public/js/modules/memoir.js` | +10579B 新增 | 回忆录列表 + SSE 生成 + 章节查看 + 发布 |
| `public/js/api.js` | +70 行 | penpal/letter/memoir API 方法 |
| `public/js/modules/index.js` | +9 行 | 3 个模块注册 |
| `public/index.html` | +46 行 | 3 view containers + 3 sidebar buttons + viewMap |
| `server/test/smoke.js` | +21 行 | 8 个创新模块端点测试 |

### 状态对照更新

| 模块 | 后端 | 前端 | 联调 | 入口集成 | 剩余工作 |
|------|------|------|------|---------|---------|
| A1 便签考古盲盒 | ✅ | ✅ | ✅ | ✅ | 无 |
| B1 灵魂人格档案 | ✅ | ✅ | ✅ | ✅ | 无 |
| A2 情绪天气图 | ✅ | ✅ | ✅ | ✅ | 无 |
| B2 成长证据树 | ✅ | ✅ | ✅ | ✅ | 无 |
| D1 生命年报卷宗 | ✅ | ✅ | ✅ | ✅ | 无 |
| C1 跨时空笔友 | ✅ | ✅ 新建 | ✅ | ✅ | 无 |
| C2 时光胶囊 | ✅ | ✅ 新建 | ✅ | ✅ | 无 |
| D2 主题回忆录 | ✅ | ✅ 新建 | ✅ | ✅ | 无 |

### 2026-06-28：批 5 完成 — 8 个创新玩法模块全部联调落地

- **修改文件**：serve-static.js, penpal.js, letter.js, memoir.js, api.js, modules/index.js, index.html, smoke.js
- **新增文件**：penpal.js (160行), letter.js (160行), memoir.js (160行)
- **关键决策**：
  - 3 个新前端模块统一采用现有的 mount/unmount 生命周期模式，与 archaeology.js/persona.js 风格一致
  - SSE 端点（appraise、generate 等）不加 serve-static.js mock，前端在轻量模式调用时会自然显示错误提示
  - Penpal 模块使用左右布局（线程列表 + 消息面板），与 nightLetter 模块风格对齐
  - Letter 模块的 `subscribeOpenLetter` 使用 GET 方法（后端要求），ApiClient 中签名为 `{ method: 'GET' }`
  - Memoir 模块的 `getMemoirExport` 使用 `/memoir/:id/export` 端点一次性返回完整章节内容
  - 侧栏按钮按用户常用度排列：考古→人格→天气→年报→成长树→笔友→时光胶囊→回忆录→心智星系
- **下一步**：无（全部 8 个创新玩法模块完成）

### 2026-06-28：全模块回归测试 22/22 通过

- **改动文件**：`server/test/smoke.js`（2 行）
- **关键决策**：smoke test 对标签列表和知识库列表的断言 `Array.isArray(data.data)` 与后端控制器实际返回格式不符（后端返回 `{tags: [...]}` / `{knowledgeBases: [...]}` 而非裸数组），修正为 `Array.isArray(data.data?.tags)` / `Array.isArray(data.data?.knowledgeBases)`
- **下一步**：无（批 5 全部完成，回归测试全绿）

---

## 批 6 · 宇宙模块高保真美化 + Bug 修复（`ccf2a07`，进行中）

### 2026-06-28：Card 0A + 1A — cosmos 加载修复 + analyzer.js 跟踪

- **改动文件**：`public/js/modules/cosmos.js`（98 行新增/修改）、`public/js/modules/mindGalaxy/analyzer.js`（新追踪）
- **Card 0A 已完成**：
  - 顶部加 `import * as THREE from 'three'` 和 `OrbitControls` ESM import，修 THREE 未定义致命 bug
  - 修 4 处字段错配：行星 `p.type`→`p.life_domain`、卫星 `s.distortion_type`→`s.psychological_meta?.distortion_tags?.[0]`、星云 `n.title`→`n.psychological_meta?.dominant_raw_emotions?.[0]`、碎石带 `c.object_name`→`c.desire_tags?.[0]`
  - `formatSunLabel` 从取顶层字段改为取 `psychological_meta` 子字段
  - 详情面板 meta 渲染增强（数组用 join('、')、字符串截断 100 字符）
  - OrbitControls 构造用 imported `OrbitControls` 替代 `THREE.OrbitControls`
- **Card 1A 已完成**：`git add analyzer.js`（原 untracked 文件导致干净 clone 白屏）
- **Card 0B 已完成**：
  - 多星云/碎石带内存泄漏修复（用 `nebulaPointsList`/`clumpPointsList` 数组替代单变量）
  - 碎石带 L4/L5 拉格朗日点定位
  - 卫星公转动画（createSatellite 挂载 `_parentPlanet`/`_orbitRadius`/`_satAngle`/`_satSpeed`，animate 计算相对位置）
  - 空快照保护（`buildCosmos` 检测 `data.sun`，不存在则显示 `showEmptyState` DOM 提示）
  - 刷新按钮改为触发生成（`generateCosmos` → `subscribeGenerateCosmos` SSE 流）
  - unmount 清理增强（`nebulaPointsList`/`clumpPointsList` 数组 dispose + `.cosmos-empty-state` DOM 清理）
### 2026-06-28：Card 0C~1E 全部完成 — 批6收尾

- **Card 0C**：新建 `cosmosTextures.js` 纹理库（5个程序化纹理生成函数：starSurface/NebulaCloud/BlackHoleDisk/AtmosphereGlow/GalaxyBackground）
- **Card 0D**：cosmos.js 哈勃视觉升级（EffectComposer bloom+vignette后处理、FogExp2雾效、skybox、创造Nebula球壳纹理、拉格朗日碎石带颜色升级、starField粒子5000、animate composer.render）
- **Card 1B**：exporter.js 截图分辨率修复（临时setSize渲染后恢复） + 视频按钮SVG保留（dataset.origHtml + CSS class）
- **Card 1C**：renderer.js bloom threshold 0→0.15、vignette/grain 默认启用；index.js 暴露 `window.__mgRenderOnce`
- **Card 1D**：interaction.js mousemove clickables缓存（30帧TTL）、dblclick过滤clickable天体、空格key清理
- **Card 1E**：textures.js starSurface增强为4层fbm、Nebula/BlackHoleDisk纹理强化；celestialBodies.js 导入Nebula/BlackHole贴图并应用

- **改动文件**：`public/js/modules/cosmos.js` `public/js/modules/mindGalaxy/exporter.js` `index.js` `renderer.js` `interaction.js` `textures.js` `celestialBodies.js`（7文件，+221/-74行）
- **下一步**：批6全部完成，无后续任务

---

## 批 7 · 宇宙观感升级 · 对齐需求文档 3D 效果（`0a45908`）

### 2026-06-29：参照参考文件 + 需求文档实现 5 大缺失宇宙效果

- **改动文件**：`renderer.js` `celestialBodies.js` `celestialBodies2.js` `index.js` `interaction.js` `mind-galaxy.html` `serve-static.js`（7 文件，+497/-86 行）
- **背景宇宙层**（需求 7.1 背景层）：
  - 新增 `createGalaxyBackdrop`：2600 颗深空星场（4 色分布）+ 5200 点银河光带（斜置椭圆带状）+ 4 片彩色深空星云 sprite + 800 颗前景尘埃粒子
  - 每帧 `updateGalaxyBackdrop` 驱动星场/光带/尘埃/星云各自旋转，营造层次感和深空氛围
  - 卸载时 `disposeGalaxyBackdrop` 释放全部 geometry/material/texture
- **黑洞相对论喷流**（需求 6.3.3 喷流强度）：
  - `createJet` 生成上下双喷流：锥体光晕 + 260 粒子流，颜色偏蓝
  - 喷流脉动 + 粒子旋转，黑洞"活跃"感
- **星云体积化**（需求 6.3.2 星云视觉）：
  - `createNebula` 从单层壳改为 3 层体积壳（递增半径 + 加法混合 + 各自湍流旋转）
  - 粒子保留，新增 shell 旋转差异
- **双击进入恒星系统**（需求 7.3.2 双击进入）：
  - `enterStarSystem` / `exitStarSystem`：双击 giant_star/main_sequence/binary_companion 时，根据 `motion.parentBodyId` 递归收集相关天体，隐藏外层
  - Esc 退出并恢复全景 + 飞回总览
  - 底部 toast 提示当前模式
  - 轨道线和父子连线按可见性同步
- **自动旋转 + 交互暂停**（需求 7.3.1 自动旋转）：
  - OrbitControls 默认 `autoRotate`，用户交互后 3.5 秒恢复
- **特殊天体动画**（需求 6.1 天体映射）：
  - 暗物质：Fresnel rim shader + 脉动光晕（不再是无动效黑球）
  - 超新星：3 圈冲击环 + 脉动缩放
  - 中子星：核心脉动缩放 + 辉光呼吸（增强脉冲感）
  - 伴星：双星各加光晕
- **交互增强**：
  - 单击天体自动聚焦相机（需求 7.3.2）
  - 第一人称提示文案改为"第一人称巡游"
  - 父子连线 `connectionLines` 每帧更新位置
  - 轨道线跟随父星漂移位置
- **杂项**：
  - 清理死的 `createStarfield`（从未挂载）
  - 移除 unmount 里对不存在的 `_nebulaSprites/_dustParticles` 的引用（会导致卸载报错）
  - `replaceWithSnapshot` 统一走 `rebuildOrbitAndConnectionLines`
  - 内联 SVG favicon，消除 `/favicon.ico` 404
- **下一步**：可继续做演化事件动画（新恒星诞生/超新星爆发/星云变色）和导出视频/glTF
