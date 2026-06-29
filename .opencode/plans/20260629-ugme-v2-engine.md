# UGME v2.0 通用星系转译引擎落地计划

## 背景与目标

用户提供了工业级 UGME v2.0 系统提示词（通用星系转译引擎），支持 4 业务域 + 多时间切片。
经调研，现有 v2 架构（services/mindGalaxy/）已是分层模式（LLM 输出语义特征 → 代码算物理参数），
但仅支持心理学单域、单次快照。本计划新建通用引擎模块，与现有路径并行，实现：
- 4 业务域通用（MindGalaxy/KnowledgeGalaxy/RelationshipGalaxy/OrgGalaxy）
- 多时间切片输出（一次调用多个 snapshot，节点命名全局一致）
- 严格分层：LLM 只输出 semantic_features，代码算 metrics（size/brightness/color）
- 前端契约不变（继续输出 bodies[] 扁平数组）

## 现有架构（不改动）

数据流：preprocess → nlpBasic → nlpDeep(LLM) → mindGraph → galaxyMapping → bodies[]
关键复用：aiProviderService.callAi() / extractJson()、EMOTION_COLORS 颜色表、spiralPosition 布局

## 前端数据契约（必须遵守）

前端只认 `{bodies: [...], galaxyType, spiralArms}` 扁平结构，每个 body：
- id/nodeId, type(10种 celestial), name, position:[x,y,z]
- visual:{radius, colorHex:#RRGGBB, emissiveIntensity, temperature?, flickerFreq?, opacity?, density?, particleCount?}
- motion:{parentBodyId, orbitRadius, orbitInclination, orbitSpeed, orbitPhase, eccentricity}
- meta:{} 自由结构
- 前端不认 nodes/edges/metrics/semantic_features

## 文件清单

| 文件 | 操作 | 卡片 |
|------|------|------|
| server/types/mindGalaxyTypes.js | 追加 | C1 |
| server/services/mindGalaxy/galaxyEnginePrompt.js | 新建 | C2 |
| server/services/mindGalaxy/galaxyEngineMapper.js | 新建 | C3 |
| server/services/mindGalaxy/galaxyEngineService.js | 新建 | C4 |
| server/controllers/mindGalaxyController.js | 追加 | C5 |
| server/routes/mindGalaxy.js | 追加 | C5 |

---

## 卡片 C1：类型定义 + 校验器 ✅ done

**目标**：在 mindGalaxyTypes.js 追加 UGME 引擎的类型契约和校验器。

**改文件**：server/types/mindGalaxyTypes.js（文件尾部追加，不动现有内容）

**数据契约**：

```js
// 新增常量
const ENGINE_DOMAINS = ['MindGalaxy', 'KnowledgeGalaxy', 'RelationshipGalaxy', 'OrgGalaxy'];
const CELESTIAL_ROLES = ['BlackHole', 'MainStar', 'Planet', 'Nebula', 'Asteroid', 'DarkMatter'];

// LLM 输出的语义特征（不 含 任 何 物 理 参 数）
/**
 * @typedef {Object} SemanticFeatures
 * @property {number} frequency - 出现频次（整数）
 * @property {number} sentiment_polarity - 情感极性 [-1, 1]
 * @property {number} degree_centrality - 关联边数（整数）
 * @property {number} first_seen_month - 首次出现距今天数（整数，0=本月）
 * @property {string[]} emotion_labels - 情绪标签（来自 20 种枚举，用于代码查表出颜色）
 * @property {string} celestial_role - 天体语义角色（CELESTIAL_ROLES 之一）
 * @property {number[]} source_evidence - 原始数据 ID 数组
 * @property {string} insight - AI 洞察文字
 */

/**
 * @typedef {Object} EngineNode - LLM 输出的节点（只含语义层）
 * @property {string} id
 * @property {string} name
 * @property {string} celestial_role
 * @property {string|null} parent_id
 * @property {SemanticFeatures} semantic_features
 */

/**
 * @typedef {Object} EngineEdge
 * @property {string} source
 * @property {string} target
 * @property {string} relation_type - triggers|supports|correlates|derives|represses
 * @property {number} strength - [0,1]
 */

/**
 * @typedef {Object} EngineSnapshot - 单时间切片
 * @property {string} time_snapshot - "YYYY-MM"
 * @property {string} overall_type - Spiral|Elliptical|BarredSpiral|Irregular
 * @property {Object} structural_metrics - {entropy, density, active_index} [0,1]
 * @property {string} summary
 * @property {EngineNode[]} nodes
 * @property {EngineEdge[]} edges
 */

/**
 * @typedef {Object} EngineMultiSnapshot - 多时间切片输出
 * @property {string} domain
 * @property {EngineSnapshot[]} snapshots
 */
```

**新增校验器**：
- `validateSemanticFeatures(data)` → 校验 frequency≥0, sentiment_polarity∈[-1,1], degree_centrality≥0, emotion_labels 是数组, celestial_role ∈ CELESTIAL_ROLES
- `validateEngineSnapshot(data)` → 校验 time_snapshot 非空, overall_type 合法, structural_metrics 三值 [0,1], nodes 数组每个有 id/name/celestial_role/semantic_features
- `validateEngineMultiSnapshot(data)` → 校验 domain ∈ ENGINE_DOMAINS, snapshots 非空数组

**验收清单**：
- [x] ENGINE_DOMAINS / CELESTIAL_ROLES 常量导出
- [x] 3 个校验器导出且对非法输入返回 {valid:false, errors}
- [x] 不改动现有 validateMentalGraph / validateGalaxySnapshot

**禁区**：不修改现有类型定义和校验器。

**边界情况**：emotion_labels 为空数组时校验通过（颜色回落白色）；nodes 为空数组时 snapshot 校验通过。

---

## 卡片 C2：UGME v2.0 分层 prompt 模板 ✅ done

**目标**：新建 prompt 模块，包含 4 域解构矩阵 + 分层 prompt 构建函数。LLM 只输出 semantic_features，绝不输出 size/brightness/color 等物理参数。

**改文件**：server/services/mindGalaxy/galaxyEnginePrompt.js（新建）

**数据契约**：

```js
// 4 域解构矩阵：每个域定义 6 种天体角色的提取逻辑
export const DOMAIN_MATRIX = {
  MindGalaxy: { BlackHole: '核心自我', MainStar: '核心信念', Planet: '子观点', Nebula: '情绪场', Asteroid: '碎片记忆', DarkMatter: '潜意识阴影' },
  KnowledgeGalaxy: { BlackHole: '第一性原理', MainStar: '核心学科', Planet: '技术栈工具', Nebula: '好奇心热点', Asteroid: '碎片知识', DarkMatter: '隐性知识' },
  RelationshipGalaxy: { BlackHole: '主体自我', MainStar: '深度羁绊', Planet: '社交网格', Nebula: '社交氛围', Asteroid: '泛泛之交', DarkMatter: '隐秘牵绊' },
  OrgGalaxy: { BlackHole: '核心使命', MainStar: '核心业务', Planet: '子项目', Nebula: '组织氛围', Asteroid: '信息流碎片', DarkMatter: '隐形壁垒' }
};

// 20 种情绪枚举（与 galaxyMappingService.EMOTION_COLORS 对齐）
export const EMOTION_ENUM = ['joy','calm','satisfaction','gratitude','hope','love','pride','interest','surprise','sadness','anger','anxiety','fear','shame','guilt','disgust','loneliness','jealousy','boredom','awe'];

/**
 * 构建引擎 prompt
 * @param {string} domain - ENGINE_DOMAINS 之一
 * @param {Array<{snapshot:string, items:Array}>} timeBuckets - 按时间分桶的语料
 * @returns {{systemPrompt:string, userMessage:string}}
 */
export function buildEnginePrompt(domain, timeBuckets) { ... }
```

**prompt 核心约束（写入 systemPrompt）**：
1. 你是通用星系转译引擎 UGME v2.0
2. **只输出 semantic_features，禁止输出 size/brightness/color/orbit_radius 等物理参数**——这些由代码计算
3. emotion_labels 必须从 20 种枚举中选取，用于代码查表生成颜色
4. 支持多时间切片：每个 snapshot 对应一个 time_snapshot，节点命名跨切片保持一致（同一概念用相同 id）
5. 零文字残留：只输出 JSON

**userMessage 结构**：
```
# 业务域: {domain}
# 域解构矩阵: {DOMAIN_MATRIX[domain] 的 6 角色说明}

# 输入语料（按时间分桶）
{每个 timeBucket 的 snapshot 标签 + 语料条目}

# 输出 JSON Schema
{EngineMultiSnapshot 的 schema 说明，强调 semantic_features 字段}
```

**验收清单**：
- [x] DOMAIN_MATRIX 4 域 × 6 角色完整
- [x] EMOTION_ENUM 20 项与现有 EMOTION_COLORS 对齐
- [x] buildEnginePrompt 返回 {systemPrompt, userMessage}
- [x] systemPrompt 明确禁止 LLM 输出物理参数
- [x] userMessage 包含分桶语料 + schema 说明

**禁区**：prompt 中不出现任何数学公式（ln、乘法链等）——LLM 不算数学。

**边界情况**：timeBuckets 只有 1 个桶时仍正常输出（单 snapshot）；timeBuckets 为空时返回空语料提示。

---

## 卡片 C3：后处理映射纯函数 ✅ done

**目标**：新建纯函数模块，把 LLM 输出的 semantic_features 映射成 bodies[] 的 visual/motion 物理参数。全部确定性计算，不调 LLM。

**改文件**：server/services/mindGalaxy/galaxyEngineMapper.js（新建）

**数据契约**：

```js
import { EMOTION_COLORS, EMOTION_LIST } from './galaxyMappingService.js'; // 复用现有颜色表

// 角色→天体类型映射
const ROLE_TO_CELESTIAL = {
  BlackHole: 'black_hole', MainStar: 'giant_star', Planet: 'planet_system',
  Nebula: 'nebula', Asteroid: 'asteroid_belt', DarkMatter: 'dark_matter'
};

/**
 * semantic_features → visual metrics
 * 公式（代码执行，非 LLM）：
 *   size = clamp(0.5 + ln(frequency+1) * 1.2 * lengthFactor * timeDecay, 0.5, 10)
 *   brightness = clamp(0.1 + degree_centrality * 0.15 + abs(sentiment_polarity) * 0.5, 0.1, 2.5)
 *   color = EMOTION_COLORS[emotion_labels[0]] || polarityColor(sentiment_polarity)
 *   blink_frequency = 0.05 + abs(sentiment_polarity) * 0.2
 */
export function mapFeaturesToMetrics(features) { ... }

/**
 * EngineNode[] → bodies[]（含 position 布局、visual、motion）
 * 复用 spiralPosition 对数螺旋布局
 */
export function mapNodesToBodies(nodes, edges, snapshot) { ... }

/**
 * 计算 structural_metrics（entropy/density/active_index）
 * entropy = -Σ p(x)ln(p(x)) 归一化到 [0,1]
 * density = 2*edges/(nodes*(nodes-1)) 归一化
 * active_index = 近期节点占比
 */
export function computeStructuralMetrics(nodes, edges, snapshot) { ... }

/**
 * overall_type 推断：节点类型分布熵 + 核心节点占比
 */
export function inferOverallType(nodes) { ... }

/**
 * 单 snapshot 完整映射：EngineSnapshot → GalaxySnapshot(bodies[])
 */
export function mapSnapshotToBodies(engineSnapshot) { ... }
```

**验收清单**：
- [x] mapFeaturesToMetrics 输出 {size, brightness, color, blink_frequency}，全部在合法范围
- [x] 颜色来自查表，不依赖 LLM 生成 HEX
- [x] mapNodesToBodies 输出 bodies[] 符合前端契约（id/type/name/position/visual/motion）
- [x] BlackHole 节点 position=[0,0,0]，其他走 spiralPosition
- [x] Planet 节点 motion.parentBodyId 填充最近的 MainStar
- [x] computeStructuralMetrics 三值在 [0,1]
- [x] 纯函数，无副作用，无 LLM 调用，无 IO

**禁区**：不调用 callAi；不读写数据库；不 import 不必要的模块。

**边界情况**：nodes 为空返回空数组；frequency=0 时 size 取下限 0.5；emotion_labels 为空时 color 按 polarity 兜底。

---

## 卡片 C4：引擎核心服务 ✅ done

**目标**：新建引擎服务，串联数据准备 → prompt 构建 → LLM 调用 → JSON 解析 → 后处理映射 → 多 snapshot 组装。

**改文件**：server/services/mindGalaxy/galaxyEngineService.js（新建）

**数据契约**：

```js
import { callAi, extractJson } from '../aiProviderService.js';
import { buildEnginePrompt } from './galaxyEnginePrompt.js';
import { mapSnapshotToBodies } from './galaxyEngineMapper.js';
import { validateEngineMultiSnapshot } from '../../types/mindGalaxyTypes.js';
import MindGalaxyRepository from '../../repositories/mindGalaxyRepository.js';

const repo = new MindGalaxyRepository();

/**
 * @param {number} userId
 * @param {Object} params
 * @param {string} params.domain - ENGINE_DOMAINS 之一
 * @param {Array<{id:number, timestamp:string, content:string}>} params.sources - 原始数据
 * @param {string} [params.bucketBy] - 'month'|'week'，默认 month
 * @param {string} [params.model] - LLM 模型
 * @returns {Promise<{domain, snapshots: GalaxySnapshot[]}>}
 */
export async function generateGalaxyEngine(userId, params) { ... }
```

**内部流程**：
1. 按_bucketBy 将 sources 分桶 → timeBuckets: [{snapshot:'YYYY-MM', items:[...]}]
2. buildEnginePrompt(domain, timeBuckets) → {systemPrompt, userMessage}
3. callAi({userId, model, systemPrompt, userMessage, temperature:0.3, maxTokens:8192, stream:false})
4. extractJson(response.text) → EngineMultiSnapshot
5. validateEngineMultiSnapshot(parsed) → 若 invalid 抛错带 errors
6. 对每个 engineSnapshot: mapSnapshotToBodies(snapshot) → GalaxySnapshot(bodies[])
7. 持久化每个 snapshot 到 repo.saveSnapshot
8. 返回 {domain, snapshots: GalaxySnapshot[]}

**降级策略**：LLM 调用失败时重试一次（temperature 降至 0.2）；仍失败则抛 AI_UNAVAILABLE 错误，不返回假数据。

**验收清单**：
- [x] generateGalaxyEngine 导出且可被 controller 调用
- [x] 按月分桶逻辑正确（同月数据进同桶）
- [x] LLM 返回经 validateEngineMultiSnapshot 校验
- [x] 多 snapshot 输出，每个含 bodies[]
- [x] 每个 snapshot 持久化到 repo
- [x] LLM 失败时重试一次后抛错

**禁区**：不修改现有 generateGalaxyFromNotes/generateGalaxyFromKnowledgeBase；不改动 nlpDeepService。

**边界情况**：sources 为空返回 {domain, snapshots:[]}；单桶时输出单 snapshot；LLM 返回的 nodes 超过 50 个时只取前 50（防爆渲染）。

---

## 卡片 C5：controller + route ✅ done

**目标**：新增 engine generate handler 和 route，与现有 endpoint 并行。

**改文件**：
- server/controllers/mindGalaxyController.js（追加 import + handler + default 导出）
- server/routes/mindGalaxy.js（追加 route）

**数据契约**：

```js
// controller 新增
export const generateByEngine = asyncHandler(async (req, res) => {
  const { domain, sources, bucketBy, model } = req.body || {};
  if (!domain) return fail(res, '缺少 domain', 400);
  if (!Array.isArray(sources) || sources.length === 0) return fail(res, '缺少 sources', 400);
  const result = await generateGalaxyEngine(req.user.id, { domain, sources, bucketBy, model });
  return success(res, result);
});

// route 新增
router.post('/engine/generate', authMiddleware, generateByEngine);
```

**验收清单**：
- [x] POST /api/mind-galaxy/engine/generate 可调
- [x] 缺 domain/sources 时返回 400
- [x] 成功返回 {success:true, data:{domain, snapshots}}
- [x] 不影响现有 route

**禁区**：不修改现有 handler 和 route。

**边界情况**：sources 超过 200 条时只取前 200（防爆 token）；domain 非法时返回 400。

---

## 卡片 C6：验证 ✅ done

**目标**：lint + typecheck + 冒烟测试。

**步骤**：
1. 检查 server/package.json 的 lint/typecheck 脚本
2. 运行 lint，修复报错
3. 运行 typecheck（如有）
4. 冒烟测试：node -e 验证 galaxyEngineMapper 纯函数输出合法
5. 验证 import 链无断裂

**验收清单**：
- [x] lint 通过
- [x] typecheck 通过（如项目有配置）
- [x] galaxyEngineMapper.mapFeaturesToMetrics 对样例输入输出合法 metrics
- [x] 所有新文件 import 路径正确

---

## 执行顺序

C1 → C2 → C3 → C4 → C5 → C6

每完成一张卡片执行收尾三步：git commit + 更新本计划标记 ✅ + 更新 PROGRESS.md。

## 关键设计决策

1. **LLM 不算数学**：prompt 只要求输出 frequency/sentiment_polarity/degree_centrality/emotion_labels 等语义特征，size/brightness/color 全部代码计算
2. **颜色查表**：emotion_labels → EMOTION_COLORS 表，不让 LLM 生成 HEX（避免 #FF8C0O 这种非法色值）
3. **多时间切片一致性**：一次 LLM 调用输出所有 snapshot，LLM 在同一上下文内保持节点命名一致
4. **前端零改动**：引擎最终输出 bodies[] 扁平数组，前端现有渲染管线直接消费
5. **与现有路径并行**：新 endpoint /engine/generate，不碰现有 /analyze-stream 路径
