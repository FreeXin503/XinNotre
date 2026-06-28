# 心迹星图（OPPO便签导出系统）

## 项目概述

基于 OPPO 便签导出系统演化而来的全栈便签管理与 AI 对话系统，集成了多种心智可视化功能，包括心智星系、心智星相图、知识库、成长证据树等 12+ 个创新业务模块。

## 技术栈

- 前端：原生 HTML + JavaScript + Tailwind CSS + Three.js（CDN引入）
- 后端：Node.js + Express.js
- 数据库：MySQL
- 认证：JWT Token
- 部署：本地部署 / Docker Compose
- AI 能力：大模型对话 + 向量检索 + 文本嵌入

## 项目结构

```
心迹星图/
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
├── server/                  # 后端服务
│   ├── index.js             # 服务器入口
│   ├── routes/              # 路由层
│   │   ├── api.js           # API 路由总入口
│   │   └── *.js             # 子路由文件（auth, notes, ai, kb, cosmos等20+）
│   ├── controllers/         # 控制器层（请求处理）
│   │   ├── authController.js
│   │   ├── noteController.js
│   │   ├── kbController.js
│   │   ├── aiController.js
│   │   ├── cosmosController.js
│   │   ├── mindGalaxyController.js
│   │   └── ...（共24个）
│   ├── services/            # 业务逻辑层
│   │   ├── aiProviderService.js
│   │   ├── cosmosService.js
│   │   ├── mindGalaxyService.js
│   │   ├── vectorStore.js
│   │   ├── embeddingService.js
│   │   └── ...（共15+个）
│   ├── repositories/        # 数据访问层
│   │   ├── noteRepository.js
│   │   ├── kbRepository.js
│   │   ├── tagRepository.js
│   │   └── keyRepository.js
│   ├── middleware/          # 中间件
│   │   ├── auth.js          # 认证中间件
│   │   └── validate.js      # 参数校验
│   ├── config/              # 配置
│   │   ├── index.js         # 集中式配置（禁止直接读process.env）
│   │   └── database.js      # 数据库连接与查询
│   ├── utils/               # 工具函数
│   │   ├── response.js      # 统一响应格式（success/fail/paginated）
│   │   └── sse.js           # SSE 流式工具（setupSSE/sendSSE）
│   ├── test/                # 测试
│   │   └── smoke.js         # API 冒烟测试脚本
│   ├── types/               # 类型定义
│   │   └── cosmosTypes.js
│   ├── db/                  # 数据库
│   │   ├── migrations.sql   # 数据库迁移 v1
│   │   ├── migrations_v2.sql
│   │   └── seed/            # 种子数据
│   └── package.json
├── .opencode/               # opencode 配置
│   ├── AGENTS.md            # 本文件
│   ├── plans/               # Plan skill 产出的执行计划
│   └── plugins/             # opencode 插件
├── docs/                    # 文档
│   ├── plans/               # 历史执行计划
│   ├── requirements/        # 需求文档
│   └── archive/             # 归档的旧文件
├── serve-static.js          # 静态文件服务器（带Mock API，无需MySQL）
├── docker-compose.yml       # Docker 部署配置
├── opencode.json            # opencode 项目配置
├── PROGRESS.md              # 开发进度跟踪
└── README.md
```

## 编码规范

### 后端规范

- **分层架构**：严格遵循 routes → controllers → services → repositories 四层架构
- **统一响应格式**：所有 API 返回 `{ success: boolean, data?: any, error?: string, timestamp: string }`
- **异步错误处理**：控制器使用 `asyncHandler` 包装，自动捕获异步错误
- **认证方式**：JWT Token，请求头 `Authorization: Bearer <token>`，用户信息挂载在 `req.user`
- **数据库操作**：通过 `query()` 函数执行 SQL，参数化查询防止注入
- **文件命名**：控制器和服务使用 camelCase 命名（如 `mindGalaxyController.js`）
- **导出方式**：使用 ES Modules（`import` / `export`）
- **路由拆分**：大型模块必须创建独立子路由文件 `server/routes/xxx.js`，在 `api.js` 中统一挂载
- **Repository 模式**：数据访问优先使用 Repository 类（`server/repositories/` 目录），不直接在控制器中写 SQL
- **集中式配置**：环境变量必须通过 `server/config/index.js` 的 `config` 对象访问，禁止直接读 `process.env`
- **SSE 流式端点**：使用 `utils/sse.js` 的 `setupSSE(res)` 和 `sendSSE(res, event, data)`
- **控制器包装**：所有异步控制器必须用 `asyncHandler` 包装（来自 `utils/response.js`），自动捕获异步错误

### 前端规范

- **API 调用**：优先使用封装好的 ApiClient（`public/js/api.js`）
- **Token 存储**：JWT Token 存储在 `localStorage` 的 `xinnote_token` 键
- **API 基础路径**：`/api`
- **页面间跳转**：通过 URL 参数传递状态（如 `index.html?noteId=xxx&kbId=xxx`）
- **3D 可视化**：使用 Three.js r147，通过 CDN 引入
- **样式方案**：Tailwind CSS + 自定义 CSS 变量

### API 工具函数

所有控制器函数必须通过 `asyncHandler` 包装：
```js
import { asyncHandler } from '../utils/response.js';

export const myEndpoint = asyncHandler(async (req, res) => {
  const data = await someService.doSomething(req.user.id);
  return success(res, data);
});
```

响应生成使用以下工具函数（来自 `utils/response.js`）：
- `success(res, data, statusCode = 200)` — 成功响应
- `fail(res, message, statusCode = 400, details)` — 错误响应
- `paginated(res, items, total, page, pageSize)` — 分页响应

### API 响应示例

**成功响应：**
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**失败响应：**
```json
{
  "success": false,
  "error": "错误信息",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 业务模块清单

| 模块 | 路径前缀 | 说明 |
|------|---------|------|
| 认证 | `/api/auth/*` | 登录、注册、Token管理 |
| 便签管理 | `/api/notes/*` | 便签CRUD、分类、标签 |
| 标签管理 | `/api/tags/*` | 标签CRUD、笔记标签关联 |
| 知识库 | `/api/knowledge-bases/*` | 知识库CRUD、笔记关联 |
| AI 对话 | `/api/ai/*` | 聊天、向量检索、RAG |
| 数据同步 | `/api/sync/*` | 同步推送、同步历史 |
| AI 报告 | `/api/report/*` | 报告生成、PDF导出、分享 |
| API Key 管理 | `/api/keys/*` | API Key管理、用量统计 |
| 技能列表 | `/api/skills/*` | AI技能列表 |
| 心智星相图 | `/api/cosmos/*` | 3D心理宇宙可视化 |
| 心智星系 | `/api/mind-galaxy/*` | 3D星系可视化 |
| 情绪天气图 | `/api/emotion-weather/*` | 情绪标注与天气视图 |
| 成长证据树 | `/api/growth-tree/*` | 成长目标与轨迹可视化 |
| 思维光谱 | `/api/thought-spectrum/*` | 思维维度分析 |
| 便签考古盲盒 | `/api/archaeology/*` | 随机回顾旧便签 |
| 灵魂人格档案 | `/api/persona/*` | 人格画像分析 |
| 生命年报卷宗 | `/api/almanac/*` | 年度报告生成与PDF |
| 夜信 | `/api/night-letter/*` | 晚间信件功能 |
| 笔友书信 | `/api/penpal/*` | 笔友对话线程 |
| 回忆录 | `/api/memoir/*` | 回忆录生成与发布 |
| 信件（时光胶囊） | `/api/letter/*` | 定时信件与揭晓 |

## 当前开发状态

- ✅ 便签管理核心功能完成
- ✅ AI 对话与 RAG 检索完成
- ✅ 知识库系统完成
- ✅ 心智星相图（Cosmos）完成
- ✅ 心智星系（Mind Galaxy）数据融合完成
- ✅ 12+ 个业务模块基础框架完成
- 🔄 各模块持续迭代优化中
- 🔄 前端 UI/UX 持续美化中

## opencode 工作流规则

### Plan / Build 双模式

- **Plan 模式**（`调用planskill`）：架构规划，只读不写，产出计划文件到 `.opencode/plans/YYYYMMDD-xxx.md`
- **Build 模式**（`调用buildskill` 或 `执行`）：落地编码，严格按照计划文件执行

### 任务完成自动收尾（防止上下文丢失后无法续接）

每完成一个子任务后，**必须执行以下三步**：

1. **git commit** — 写语义化的英文 commit message，清楚说明变更内容。仅 stage 本次任务相关文件。
2. **更新 plan 文档** — 在 `.opencode/plans/` 对应的计划文件中，标记该子任务为 `✅ done`。
3. **更新 PROGRESS.md** — 记录：
   - 完成了什么（具体功能/文件）
   - 还差什么（后续任务）
   - 关键设计决策（为什么这么实现）
   - 下一步要做什么

### 上下文溢出应对

如果一个对话的上下文接近占满：
1. 先执行任务完成收尾三步（确保代码已提交、计划已更新、进度已记录）
2. 告知用户："上下文已满，建议开启新对话"
3. 新对话启动后，读取 `.opencode/AGENTS.md` + `.opencode/plans/` 最新计划 + `PROGRESS.md` + `git log` 即可无缝续接

## 开发注意事项

### 开发环境

1. **完整环境**：需要 MySQL 数据库，启动 `server/index.js`
2. **轻量预览**：使用 `serve-static.js` 启动静态服务器，API 为 Mock 数据，无需数据库
   ```bash
   node serve-static.js
   # 访问 http://localhost:3000
   ```

### 安全与隐私

1. **JWT Secret**：生产环境必须设置强密钥，不要提交到 Git
2. **数据库密码**：通过环境变量配置，不要硬编码
3. **用户数据**：所有用户数据通过 `user_id` 隔离，SQL 查询必须带上用户过滤条件

### 数据库

1. **迁移文件**：按版本号命名（`migrations.sql`, `migrations_v2.sql`...）
2. **表前缀**：主要表包括 `users`, `notes`, `knowledge_bases`, `knowledge_base_notes` 等
3. **向量存储**：AI 向量检索使用独立的向量存储方案

### 新增模块流程

新增业务模块（如心智星系）的标准流程：
1. `server/services/xxxService.js` - 业务逻辑
2. `server/controllers/xxxController.js` - 请求处理
3. `server/routes/api.js` - 注册路由
4. 前端页面（如 `public/xxx.html`）或集成到主页面
5. `serve-static.js` - 添加 Mock API（可选，用于预览）

### 心智星系模块说明

- **数据映射规则**：
  - 日记模式：分类 → 恒星，便签 → 行星，关键词 → 卫星
  - 知识库模式：知识库 → 恒星，笔记 → 行星，知识点 → 卫星
- **数据来源标记**：每个星体包含 `sourceType`（`notes` / `knowledge`）和原始数据引用
- **双向跳转**：点击星体可跳转到对应的日记/知识库条目
- **混合模式**：支持日记和知识库数据合并展示
