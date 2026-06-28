# A2 · nlpBasic_contract
> 文档化 `server/services/mindGalaxy/nlpBasicService.js` 的完整接口契约

## 需求摘要
梳理基础 NLP 分析（分词/TF-IDF/K-Means/20维情绪/实体/时间模式）的函数签名与输出结构，供 C13~C16, C27, C28 引用。

## 构建拓扑图
```
[串行] A2 → C13, C14, C15, C16, C27, C28
[并行] A2 ∥ A3 ∥ A4
```

## 数据契约总览

```typescript
interface BasicAnalysisResult {
  keywords: KeywordItem[];        // TOP 50 关键词
  topics: TopicItem[];           // 主题聚类（最多 8 个簇）
  emotions20: {
    globalVector: number[];      // 20 维全局情绪向量
    segmentVectors: number[][];  // 每段落的 20 维向量
  };
  entities: {
    persons: EntityItem[];       // TOP 10 人物
    locations: EntityItem[];     // TOP 10 地点
    events: EntityItem[];        // TOP 15 事件
  };
  timePatterns: {
    byHour: { hour: number; count: number; topEmotion: string }[];
    byWeekday: { weekday: number; count: number }[];
    anomalyPoints: { segmentIndex: number; diff: number; beforeEmo: string; afterEmo: string }[];
  };
}

interface KeywordItem {
  word: string;
  score: number;     // TF-IDF 分值
}

interface TopicItem {
  name: string;      // TOP 3 关键词用 · 连接
  keywords: string[];
  centroid: number[];
  size: number;
}

interface EntityItem {
  name: string;
  frequency: number;
}
```

## 函数签名清单

```javascript
export async function analyzeBasic(segments) → BasicAnalysisResult

// 内部函数
function tokenize(text) → string[]                           // unigram + bigram
function computeTFIDF(segments) → KeywordItem[]               // TOP 50
function kMeansClustering(segments, keywords, k) → TopicItem[] // k-means++ 最多 20 轮
function analyzeEmotion20(segments) → { globalVector, segmentVectors }
function extractEntities(segments) → { persons, locations, events }
function analyzeTimePatterns(segments) → { byHour, byWeekday, anomalyPoints }
```

## 20 维情绪清单（顺序固定）
```
joy, calm, satisfaction, gratitude, hope, love, pride, interest,
surprise, sadness, anger, anxiety, fear, shame, guilt, disgust,
loneliness, jealousy, boredom, awe
```
**索引约定**：`emotions20.globalVector[0]` = joy, `[9]` = sadness, `[19]` = awe

## 实体识别规则

| 类型 | 正则 | 说明 |
|------|------|------|
| 人物 | `/[人物][A-Z]/g` | 脱敏后的代号 |
| 地点 | `/[\u4e00-\u9fff]{2,}(?:市|省|县|区|镇|村|公园|广场...)/g` | 后缀匹配 |
| 事件 | `/[\u4e00-\u9fff]{3,}(?:了|过|完)/g` | "了/过/完"结尾短语 |

## 时间模式规则

- `byHour`：24 维数组，`hour ∈ [0,23]`
- `byWeekday`：7 维数组，`weekday ∈ [0,6]`（0=周日）
- `anomalyPoints`：滑动窗口 size=5，相邻窗口情绪差 > 0.5 标记

## 验收清单
- [输入] 给定空数组 → 返回全空结果结构（不 throw）
- [输入] 给定 100 段中文 → keywords 至少 10 个，topics ≥ 1
- [输入] 给定含"开心""难过"的段落 → globalVector[joy] > 0 且 globalVector[sadness] > 0

## 影响分析
- **关键文件**：`nlpBasicService.js` 被 C13~C16+C27+C28 共 6 个 plan 同时修改
- 新增函数应**追加到文件末尾**，不修改现有函数体
- 子 agent 必须按 C13→C14→C15→C16→C27→C28 顺序叠加

## 风险提示
- K-Means 初始化用随机数，聚类结果不稳定——子 agent 新增函数时应设固定 seed
- `analyzeEmotion20` 被 `analyzeTimePatterns` 内部再次调用（per-segment），性能 O(n²)
- 新增函数**不要**在现有 `analyzeBasic` 主入口内调用，应让 controller 层决定
