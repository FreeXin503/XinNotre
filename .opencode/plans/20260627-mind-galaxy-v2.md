# 心智星系 v2 · 全量开发计划

## 1. 需求摘要

整合现有 `mind-galaxy.html`（轻量无 AI）与 `cosmos`（AI 驱动但有 Bug）为单一系统：多源文本输入 → NLP 分析 → 加权有向心智图谱 → 10 类天体映射+螺旋布局 → 分层 3D 渲染 → 时间演化 → 解读报告(哈勃类型学) → 个性化配置+导出。前端拆分为 ES 模块，后端复用 cosmos 的 AI 管道、3 张表及演化服务（修复 Bug）。

## 2. 构建拓扑

```
[阶段A 契约] C1(C1) → C2(DB) → C3(仓储)
[阶段B 分析] C4(预处理)∥C5(NLP基础)∥C6(NLP深度) → C7(图谱) → C8(映射) → C9(演化修复) → C10(报告)∥C11(配置) → C12(导出)
[阶段B 总装] C13(路由)∥C14(控制器)
[阶段C 前端] C15(壳+api) → C16(主模块) → C17(渲染器)∥C18(纹理) → C19a(天体前5) → C19b(天体后5) → C20(布局)∥C21(后处理)∥C22(交互) → C23(时间)∥C24(UI) → C25(分析器)∥C26(导出器)
[阶段D 远期] C27-C30 (低优先级,后续迭代)
```

## 3. 数据契约总览

```typescript
// ========= 心智图谱 =========
type NodeType = 'CoreSelf'|'Belief'|'Theme'|'Emotion'|'Person'|'Memory'|'Shadow';
type EdgeType = 'supports'|'triggers'|'correlates'|'represses'|'derives';

interface MindNode {
  id:string; type:NodeType; label:string; weight:number;
  centrality:{ degree:number; betweenness:number; eigenvector:number };
  attributes:{
    coreSelf?:{ strength:number; stability:number; integration:number };
    belief?:{ level:'core'|'middle'|'concrete'; strength:number; polarity:'pos'|'neg'; formedAt?:string };
    theme?:{ importance:number; heat:number; trend:'rising'|'stable'|'fading' };
    emotion?:{ intensity:number; frequency:number; persistence:number; vector20:number[] };
    person?:{ intimacy:number; polarity:number; influence:number };
    memory?:{ importance:number; vividness:number };
    shadow?:{ repression:number; energy:number };
  };
  sourceRefs:{ sourceType:'notes'|'knowledge'|'chat'|'social'|'voice'; recordId:string; excerpt:string }[];
  createdAt:string;
}
interface MindEdge { id:string; type:EdgeType; from:string; to:string; weight:number; }
interface MentalGraph { userId:string; nodes:MindNode[]; edges:MindEdge[]; timeRange:{start:string;end:string}; corpusHash:string; computedAt:string; }

// ========= 星系快照 =========
type CelestialType = 'black_hole'|'giant_star'|'main_sequence'|'planet_system'|'nebula'|'binary_companion'|'asteroid_belt'|'dark_matter'|'supernova_remnant'|'neutron_star';

interface CelestialBody {
  id:string; type:CelestialType; nodeId:string; name:string; position:[number,number,number];
  visual:{ radius:number; colorHex:string; emissiveIntensity:number; temperature?:number; flickerFreq?:number; opacity?:number; density?:number; particleCount?:number };
  motion?:{ parentBodyId?:string; orbitRadius?:number; orbitInclination?:number; orbitSpeed?:number; orbitPhase?:number; eccentricity?:number };
  spawnAnimation:'birth'|'supernova'|'none';
  meta:Record<string,any>;
}
interface GalaxySnapshot {
  id:string; userId:string; versionTag:string; galaxyType:'E'|'S'|'SB'|'Irr'|'Merger';
  spiralArms:number; windingTightness:number; coreBulgeSize:number; flatness:number;
  bodies:CelestialBody[]; timeRange:{start:string;end:string}; analyzedDiaryCount:number; corpusHash:string; createdAt:string;
}

// ========= 报告/配置 =========
interface ObservationReport { id:string; galaxySnapshotId:string;
  overview:{ hubbleType:string; starCount:number; nebulaKinds:number; coreMass:number; oneLineSummary:string; confidence:'high'|'mid'|'low' };
  coreBeliefs:{ id:string; label:string; strength:number; evidence:{excerpt:string;recordId:string}[] }[];
  emotionSpectrum:{ dominant:string; distribution:{emotion:string;ratio:number}[]; cycle:string; triggers:{stimulus:string;emotion:string;confidence:number}[] };
  relationshipGalaxy:{ topPersons:{id:string;name:string;intimacy:number;polarity:number}[]; patterns:string[] };
  evolutionTimeline:{ nodes:{date:string;type:'growth'|'beliefShift'|'trauma';description:string}[]; trend:string };
  shadows:{ repressedThemes:string[]; cognitiveBiases:string[]; unintegrated:string[] };
  typology:{ type:string; traits:string[]; strengths:string[]; blindSpots:string[]; suggestions?:string[] };
}
interface GalaxyConfig { id:string; userId:string; name:string; template:'default'|'psychology'|'art'|'minimal'; colorScheme:Record<CelestialType,string>; spiralArms:number; windingTightness:number; hiddenNodeIds:string[]; renamedNodes:Record<string,string>; privacyMode:'local'|'cloud'; deleteAfterAnalysis:boolean; updatedAt:string; }
```

## 4. 任务卡片

---

### C1 类型契约 `server/types/mindGalaxyTypes.js`
**前置:** 无 | **优先级:** P0 | **性质:** 纯新增 | **代码量:** ~150行

**目标:** 定义全量 TypeScript 契约(JSDoc)+运行时校验器。输出文件内容必须包含上方全部 interface 的 JSDoc 定义，及导出函数 `validateMentalGraph`、`validateGalaxySnapshot`、`validateObservationReport`、`validateGalaxyConfig`。

**契约:** 每个 validate 函数签名为 `(data: any): { valid: boolean, errors: string[] }`。校验 nodeType/CelestialType/EdgeType/galaxyType 枚举值合法性；必填字段非空；数组元素逐个递归校验；数字范围检查（radius>0、weight>=0、vector20 长度=20）；JSON 对象嵌套容错。

**禁区:** 不改 `cosmosTypes.js`；不引入 ts 依赖。

**验收:**
1. `validateMentalGraph({ userId:'u1', nodes:[{ id:'1', type:'CoreSelf', label:'我', weight:1.0, centrality:{degree:1,betweenness:0,eigenvector:1}, attributes:{coreSelf:{strength:80,stability:70,integration:60}}, sourceRefs:[], createdAt:'2026-01-01' }], edges:[], timeRange:{start:'',end:''}, corpusHash:'abc', computedAt:'' })` → `valid:true`
2. `validateMentalGraph({ userId:'u1', nodes:[{ id:'1', type:'InvalidType', label:'x', weight:1 }] })` → `valid:false`，errors 含 "InvalidType"
3. `validateGalaxySnapshot({...galaxyType:'X'})` → `valid:false`

**边界:** 空数组、null/undefined 字段、嵌套对象缺失、enum 值不在白名单、数字 NaN。

**执行约束:** 本文件仅输出 JSDoc 类型+校验函数，不写业务逻辑。

---

### C2 数据库迁移 v7 `server/db/migrations_v7.sql`
**前置:** C1 | **优先级:** P0 | **性质:** 纯新增 | **代码量:** ~60行

**目标:** 建表 `mind_graphs`(`id INT PK,user_id INT FK,graph_json JSON NOT NULL,corpus_hash CHAR(64) UNIQUE,created_at TIMESTAMP INDEX`)、`observation_reports`(`id PK,user_id FK,galaxy_snapshot_id INT FK→cosmos_snapshots,report_json JSON,created_at`)、`galaxy_configs`(`id PK,user_id FK,name VARCHAR,config_json JSON,UNIQUE(user_id,name)`)、`data_sources`(`id PK,user_id FK,source_type ENUM('notes','knowledge','chat','social','voice'),source_ref VARCHAR,content_hash CHAR(64) UNIQUE,segment_count INT,created_at`)、`analysis_cache`(`id PK,user_id FK,embedding_hash CHAR(64) UNIQUE,embedding_vector BLOB,metadata_json JSON,created_at`)。并 `ALTER TABLE cosmos_snapshots ADD COLUMN IF NOT EXISTS galaxy_type VARCHAR(8), ADD COLUMN IF NOT EXISTS spiral_arms INT, ADD COLUMN IF NOT EXISTS winding_tightness DECIMAL(4,2), ADD COLUMN IF NOT EXISTS core_bulge_size DECIMAL(4,2), ADD COLUMN IF NOT EXISTS flatness DECIMAL(4,2)`。末尾必须在 `server/config/database.js` 的 migrations 数组中加 `{ version:'migrations_v7', name:'v7 mind-galaxy tables' }`——**阅读 `config/database.js` 确认现有迁移格式后插入**。

**验收:** SQL 在 Node 中执行不报语法错；ALTER 幂等（`IF NOT EXISTS` 或用 information_schema 判断）。

**禁区:** 不 DROP/RENAME 已有表；不改 v1-v6 迁移文件。

**参考:** `server/db/migrations_v5.sql` 的表风格。

---

### C3 仓储层 `server/repositories/mindGalaxyRepository.js`
**前置:** C2 | **优先级:** P0 | **性质:** 纯新增 | **代码量:** ~180行

**目标:** 导出类 `MindGalaxyRepository`，构造函数接收 db query 函数。方法(均参数化查询):
- `saveGraph(userId, graph)` → INSERT/UPDATE `mind_graphs` (ON DUPLICATE KEY UPDATE by corpus_hash)
- `getLatestGraph(userId)` → SELECT latest row
- `saveSnapshot(userId, snapshot)` → INSERT `cosmos_snapshots` (含 galaxy_type 等新列)
- `getLatestSnapshot(userId)` / `getSnapshotById(id,userId)` / `listSnapshots(userId,limit)`
- `saveReport` / `getReportBySnapshotId` → `observation_reports`
- `saveConfig` / `getConfig` / `listConfigs` / `deleteConfig` → `galaxy_configs`
- `insertDataSource` / `listDataSources`
- `upsertEmbeddingCache` / `getEmbeddingCache`

**产出消费:** 被 C4-C14 服务层消费。

**验收:**
1. saveGraph + getLatestGraph 读写一致
2. 所有 SQL 含 `WHERE user_id = ?`
3. saveSnapshot 写入了 galaxy_type 等新列

**参考:** `server/repositories/noteRepository.js` 的类结构、`withTransaction` 用法。

---

### C4 数据预处理 `server/services/mindGalaxy/preprocessService.js`
**前置:** C3 | **优先级:** P0 | **并行:** 是(与C5/C6) | **代码量:** ~160行

**目标:** 导出 `async function preprocess(userId, { sources, options })` 返回 `{ records, segments, meta }`。清洗：去重(hash 比)、去噪(模板行/"今日打卡"等+纯表情+<10字标"碎片")、脱敏(人名词典→"人物A"，可配脱敏手机/地址/邮箱)、ISO8601 时间戳、按空行/句号分段、标注元数据(时间/字数/来源/位置权重)。结果落 `data_sources`。

**验收:**
1. 含真姓名的文本→输出替换为"人物A"
2. <10 字符的段标记 `isFragment:true`
3. 完全重复的待处理记录只保留一条

**禁区:** 不删除用户原始数据。脱敏规则从 options 读取白名单。

**参考:** 现有 `mindGalaxyService.js:418` `extractKeywords` 的中文停用词表可复用。

---

### C5 NLP基础分析 `server/services/mindGalaxy/nlpBasicService.js`
**前置:** C4(弱依赖,可并行起草) | **优先级:** P0 | **代码量:** ~190行

**目标:** 算法级分析(无 LLM)。导出 `async function analyzeBasic(segments)` 返回 `{ keywords, topics, emotions20, entities, timePatterns }`。keyword: TF-IDF+简单中文分词(可用正则+停用词)。topics: 关键词向量 K-Means(固定 k=min(8,segments.length))聚类,每簇 TOP3 词为名称。emotions20: 扩展情绪词典(喜悦/平静/满足/感激/希望/爱/骄傲/兴趣/惊讶/悲伤/愤怒/焦虑/恐惧/羞耻/内疚/厌恶/孤独/嫉妒/厌倦/敬畏),每维 0-1。entities: 人物/地点/事件识别(词典+正则),统计频率和共现。timePatterns: 按小时/星期统计写作量和情绪倾向,检测情绪突变点(前后 window 差异 >0.5)。

**验收:**
1. 20篇中文文本→≥3个主题簇
2. emotions20 长度恒为 20 且各维在 [0,1]
3. 人物实体含频率+共现信息

**参考:** `mindGalaxyService.js:436` `analyzeEmotion` 词典可扩展为 20 维。

---

### C6 NLP深度分析 `server/services/mindGalaxy/nlpDeepService.js`
**前置:** C5 | **优先级:** P0 | **代码量:** ~200行

**目标:** LLM 提取。导出 `async function analyzeDeep(userId, { segments, basicResult, options })` 返回 `{ beliefs, cognitivePatterns, relationshipDynamics, growthNodes, traumas }`。信念: 核心3-5/中层10-20/具体*，带 evidence 片段+形成时间+强度。认知模式: 归因风格/思维偏差(灾难化/非黑即白/过度概括/读心术/情绪化推理)/时间视角/自我对话语气。关系动力: 模式/未完成事件/投射识别。成长+创伤: 信念根本改变时刻/情绪能量集中点/防御机制。

使用 `aiProviderService.callAi`(temperature 0.3, maxTokens 4096, 流式 chunk)。corpus<5000 字降级(只做基础结论)。AI 调用失败抛 `'AI_UNAVAILABLE'`。所有结论附 `confidence` 和 `evidence` 字段。

**验收:**
1. 含反复自我批评文本→识别到至少 1 个认知偏差(如"非黑即白")
2. 每个信念节点含 ≥1 条 evidence
3. AI 调用超时→抛 AI_UNAVAILABLE(不返回残缺结果)

**参考:** `server/services/cosmosService.js:18` `COSMOS_PSYCHOLOGY_PROMPT` 的 prompt 风格、`callAi` + `extractJson` 用法。

---

### C7 心智图谱建模 `server/services/mindGalaxy/mindGraphService.js`
**前置:** C5,C6 | **优先级:** P0 | **代码量:** ~180行

**目标:** 导出 `async function buildMindGraph(basic, deep, segments)` 返回 `MentalGraph`。生成: 1 个 CoreSelf(整合 self-cognition 相关信念加权统计)、7 类节点(从 basic+deep 提取,每种填对应 attributes)、5 类边(信念支撑/主题关联/情绪触发/人物关系/阴影压抑,weight 从共现频率+相关性导出)。权重公式: `nodeWeight = frequency × avgSegmentLength × (1/(1+0.3×ageInYears)) × (1+averageEmotionIntensity) × (1+Math.log(connectionCount+1))`。落库 `mind_graphs`。

**验收:**
1. CoreSelf 只有 1 个节点
2. 所有节点 weight > 0
3. 边 weight 在 (0,1]

**禁区:** 不调用 LLM。

---

### C8 星系映射 `server/services/mindGalaxy/galaxyMappingService.js`
**前置:** C7 | **优先级:** P0 | **代码量:** ~200行

**目标:** 导出 `async function mapToGalaxy(userId, graph, config?)` 返回 `GalaxySnapshot`。10 类天体映射表(硬编码,不准改对应关系):
| MindNode.type→CelestialType | 说明 |
|---|---|
| CoreSelf→black_hole | 原点,不直接可见 |
| Belief(core)→giant_star | 大质量,高亮 |
| Theme→main_sequence | 中等亮,情绪倾向定色 |
| Belief(非core)→planet_system | 围绕恒星,有轨道 |
| Emotion→nebula | 粒子云,颜色=情绪类型映射 |
| Person→binary_companion | 独立恒星+引力线 |
| Memory→asteroid_belt | 微粒,instanced |
| Shadow→dark_matter | 半透明体积云 |
| 成长节点→supernova_remnant | 扩散气体+残核 |
| 创伤→neutron_star | 极小高密度,脉冲闪烁 |

螺旋布局: `r = a * Math.exp(b * theta)`，a=1.5, b=0.3(缠绕度), theta 递增。同一主题簇同旋臂；权重越大离银心越近；情绪倾向影响方位角(积极→第一象限,消极→第三象限,中性→第二/四)；随机扰动 ±0.3 避免重叠。行星轨道: orbitRadius ∝ 衍生距离, eccentricity = 1-stability, orbitSpeed ∝ 关联强度。视觉参数: radius=1+Math.log(weight+1)、brightness=importance*0.7+recentActivity*0.3、colorHex 按情绪映射(积极暖色/消极冷色/中性白)、temperature 按理性/情感维度。哈勃类型推断: spiralArms=主题簇数(2-4), windingTightness 从 b 导出, coreBulgeSize 从 CoreSelf.strength 导出, 结构熵→E/S/SB/Irr/Merger。落库 `cosmos_snapshots`(含新列)。

**验收:**
1. 每个 MindNode 唯一映射一个 CelestialBody
2. black_hole 坐标 [0,0,0]
3. colorHex 合法 #RRGGBB
4. galaxyType ∈ {E,S,SB,Irr,Merger}

**禁区:** 不改映射表对应关系；不改权重公式常数。

---

### C9 演化服务修复+接线 `server/services/evolutionService.js`
**前置:** C8 | **优先级:** P1 | **性质:** 既有修复 | **代码量:** ~150行

**目标:** 3 个修复:
1. **Bug修复**: `cosmosController.js:137` 和 `evolutionService.js:116` 的 `registerEntities(userId, snapshotId, snapshot)` 改为 `registerEntities(query, userId, snapshotId, snapshot)`(4 参数).
2. **删除死代码**: `evolutionService.js:308-326` 孤儿代码块(引用未定义变量).
3. **接线 C8**: `batchEvolutionarySnapshots` 内部改为调用 C8 的 `mapToGalaxy` 产快照(而非旧 cosmosService); `computeEvolutionDelta` 改为对比 `GalaxySnapshot` 而非旧 snapshot.

**验收:**
1. `/cosmos/generate` 或 `/mind-galaxy/generate` 调 registerEntities 不抛 `q is not a function`
2. 308-326 行已删除
3. 两快照 delta 计算含 significant_events(HawkingRadiation/恒星重生/轨道扰动等)

**禁区:** 不改 `cosmos_entity_registry` 哈希算法.

**参考:** `evolutionService.js:151` `computeEvolutionDelta` 现有逻辑.

---

### C10 解读报告 `server/services/mindGalaxy/reportService.js`
**前置:** C8 | **优先级:** P1 | **并行:** 是(与C11) | **代码量:** ~190行

**目标:** 导出 `async function generateReport(userId, snapshotId)` 返回 `ObservationReport`。8 章结构: 概览/核心信念 TOP10/情绪光谱(主导+分布饼+周期+触发)/关系星系(TOP人物+亲密度+模式)/演化时间线(成长节点+信念变迁+趋势)/阴影盲点(被压抑主题+偏差+未整合)/类型学解读。数据驱动为主(从 MentalGraph+GalaxySnapshot 提取)，可选 LLM 润色概述和类型学建议。每结论带 confidence 和 evidence。落 `observation_reports`。

**验收:**
1. 报告含 8 章节
2. 每信念 ≥1 evidence
3. hubbleType 与 snapshot.galaxyType 一致

**禁区:** 不做价值判断("好/坏").

---

### C11 个性化配置 `server/services/mindGalaxy/configService.js`
**前置:** C3 | **优先级:** P1 | **并行:** 是 | **代码量:** ~80行

**目标:** CRUD 配置 + `applyConfigToSnapshot(snapshot, config)`: 按 hiddenNodeIds 过滤 bodies, renamedNodes 覆盖 CelestialBody.name, colorScheme 覆盖 visual.colorHex.

**验收:**
1. 多个配置可存储切换
2. apply 后 hidden 天体不在 bodies 中

---

### C12 导出服务 `server/services/mindGalaxy/exportService.js`
**前置:** C8,C10 | **代码量:** ~120行

**目标:** 导出 `exportImage(snapshotId)`(canvas 渲染截图后端)、`exportReportPDF(reportId)`(报告 HTML→PDF)、`exportData(snapshotId,format)`(JSON/CSV dump).

**验收:** 导出 PNG 文件存在可打开；PDF 含报告内容；JSON 合法.

**参考:** 服务端可能需引入 `puppeteer` 或 `canvas` 包渲染——如不可用则缩水为 JSON/CSV 纯数据导出并记 TODO.

---

### C13 路由总装 `server/routes/mindGalaxy.js`(改) + `server/routes/api.js`(改)
**前置:** C4-C12 | **优先级:** P0 | **并行:** 是(与C14) | **代码量:** ~60行

**目标:** 在 `mindGalaxy.js` 追加路由(均 `authMiddleware`): `GET /analyze?source=notes|kb&limit=`、`POST /analyze-stream`(SSE)、`GET /graph`、`GET /snapshot`、`POST /generate`(SSE)、`GET /evolution`、`GET /report/:snapshotId`、`GET/POST /config`、`POST /export/:format`。在 `api.js` 保持 `/mind-galaxy` 挂载。保留 cosmos 路由兼容（不动 `cosmos.js`）。

**验收:** 路由表无冲突.

**禁区:** 不改 `authMiddleware`.

---

### C14 控制器总装 `server/controllers/mindGalaxyController.js`(改)
**前置:** C4-C12 | **优先级:** P0 | **并行:** 是 | **代码量:** ~180行

**目标:** 每个端点用 `asyncHandler` 包装。SSE 端点用 `setupSSE(res)`/`sendSSE(res,event,data)`。响应走 `success`/`fail`/`paginated`。增加 `analyzeMindGalaxy`(SSE 流式分析)、`getMindGraph`、`generateSnapshot`、`getSnapshot`、`getEvolution`、`getReport`、`manageConfig`、`exportGalaxy`。

**验收:**
1. 所有端点 asyncHandler 包
2. SSE 端点发送 chunk 事件
3. 错误走 fail

---

### C15 HTML壳 + API helper
**前置:** C13/C14 | **文件:** `public/mind-galaxy.html`(重写)、`public/js/api.js`(追加) | **代码量:** HTML~100行 + api~50行

**目标:** HTML 仅保留 CSS + DOM 骨架 + 模块入口 `import { mountMindGalaxy } from './js/modules/mindGalaxy/index.js'`。删除内联 1500 行脚本。api.js 追加: `getMindGalaxySnapshot`/`analyzeMindGalaxySSE`/`getMindGraph`/`generateReport`/`getReport`/`getGalaxyConfigs`/`exportGalaxy`.

**验收:**
1. HTML 打开无错,模块入口加载
2. api.js 新增方法可调用

**禁区:** 不删现有 CSS classname；不引入新 CDN.

---

### C16 主模块 `public/js/modules/mindGalaxy/index.js`
**前置:** C15 | **代码量:** ~120行

**目标:** `export mountMindGalaxy(container)`/`unmountMindGalaxy()`。模块作用域状态(`scene/camera/renderer`)。`init()`: Three.js scene → background → 读取后端数据 → buildGalaxy → startAnimation。`unmount()`: dispose scene/RAF/events。注册到 `modules/index.js`(module key `'mind-galaxy'`).

---

### C17 渲染器 `public/js/modules/mindGalaxy/renderer.js`
**前置:** C16 | **代码量:** ~100行

**目标:** 从 `mind-galaxy.html:830-879` 逐函数迁移: `initRenderer(container)`→Scene/FogExp2/Camera/Renderer(antialias,sRGB,ACESFilmic)/OrbitControls/Ambient+DirectionalLight/Raycaster/Clock。`startAnimation(renderFn)`/`stopAnimation()`/`dispose()`.

---

### C18 纹理库 `public/js/modules/mindGalaxy/textures.js`
**前置:** C16 | **并行:** 是(与C17) | **代码量:** ~120行

**目标:** 从 `mind-galaxy.html:910-1007` 迁移: `generateGlowTexture`/`generateStarSurfaceTexture`/`generateNebulaTexture`。新增: `generateBlackHoleDiskTexture`/`generateAccretionTexture`.

---

### C19a 天体工厂(前5类) `celestialBodies.js`
**前置:** C17,C18 | **代码量:** ~200行

**目标:** `createBlackHole(body)`: sphere+吸积盘(torus)+喷流(cylinder), emissive 材质。`createGiantStar(body)`: emissive sphere+4 层 glow sprite+表面纹理。`createMainSequence(body)`: 同上但更小。`createPlanetSystem(body)`: sphere+大气壳(backSide)+轨道环+glow+label。`createNebula(body)`: 粒子 Points(particleCount 15-15000, 3D 体积云, is_dark=暗色/透明=亮色).

**参考:** 迁移 `mind-galaxy.html:1304-1469` createStarMesh/createPlanetMesh 及 `cosmos.js` createBlackHole.

---

### C19b 天体工厂(后5类) `celestialBodies2.js`
**前置:** C19a | **代码量:** ~200行

**目标:** `createBinaryCompanion`: 双 sphere 连线+引力虚线。`createAsteroidBelt`: InstancedMesh 小石块+环形分布。`createDarkMatter`: 半透明体积球+边缘雾。`createSupernovaRemnant`: 粒子扩散云+中心中子星残核。`createNeutronStar`: 极小 sphere+脉冲闪烁 glow+引力扭曲环.

---

### C20 布局 `layout.js` | C21 后处理 `postprocessing.js` | C22 交互 `interaction.js` (并行)
**前置:** C17 | **并行:** 是 | **代码量:** ~120+100+150行

**C20:** `computeSpiralLayout(bodies,params)` 对数螺旋分布, 旋臂分配, 重叠检测。**C21:** EffectComposer+UnrealBloomPass 等后处理(Three.js 0.147 jsm import)。**C22:** raycaster hover/click/dblclick, 相机 tween easeInOutCubic, 搜索高亮, 类型筛选, 视角预设.

**参考:** `mind-galaxy.html:1757-1855` 交互；`cosmos.js` Kepler 布局。

---

### C23 时间控件 `timeControls.js` | C24 UI `uiPanels.js` (并行)
**前置:** C16 | **代码量:** ~100+180行

**C23:** 时间轴 slider, play/pause, 速度, 关键帧插值(bodies 位置/颜色/大小的 lerp)。**C24:** 左数据导入面板(来源选择/手动输入/分析按钮)、右详情面板(按 body.type 显示不同字段+溯源跳转 `window.open('index.html?noteId=...')`)、分析报告卡、配置面板.

**参考:** `mind-galaxy.html:1857-1987` updateDetailPanel/updateAnalysisPanel.

---

### C25 客户端分析器 `analyzer.js` | C26 导出器 `exporter.js` (并行)
**前置:** C15 | **代码量:** ~130+80行

**C25:** 前端实时关键词 TF-IDF + 情绪词典, 调用 `ApiClient.analyzeMindGalaxySSE` 深度分析, <500字提示不足。**C26:** canvas.toDataURL 快照 + 调后端导出端点.

**参考:** `mind-galaxy.html:1989-2056` analyzeText.

---

### C27-C30 远期(低优先级,延后) 多人星系/多模态/AI对话/数字孪生

## 5. 影响分析

**波及已有文件:** `server/routes/mindGalaxy.js`(重写), `server/routes/api.js`(cosmos 保留), `server/controllers/mindGalaxyController.js`(重写), `server/services/evolutionService.js`(修复), `server/config/database.js`(加 migration), `public/mind-galaxy.html`(缩至壳), `public/js/api.js`(追加 helper), `public/js/modules/index.js`(注册新模块), `serve-static.js`(Mock 更新).

**存量数据:** `cosmos_snapshots` 旧行新列为 NULL,读取时缺省 `galaxy_type='S'`.

## 6. 风险提示

- C8 螺旋公式 b 符号反转→布局全反；验收锁定"所有天体在原点周围旋涡分布"。
- C6 信念 evidence 截断→对比验收条件强制 ≥1 evidence。
- C9 registerEntities 参数修复后是否引入新 bug→修复后运行 `/cosmos/generate` 冒烟。
- C21 后处理 import 路径(Three.js 0.147 global vs jsm)→用 `import { EffectComposer } from '...'` 确认路径存在。
- 前端迁移丢功能→每个迁移卡"逐函数迁移,保留原行为"。
