# A3 · nlpDeep_contract
> 文档化 `server/services/mindGalaxy/nlpDeepService.js` 的完整接口契约

## 需求摘要
梳理 LLM 深度分析的 prompt 模板、响应 JSON schema、降级机制，供 A4, A6 引用。

## 构建拓扑图
```
[串行] A3 → A4, A6
[并行] A3 ∥ A2
```

## 数据契约总览

```typescript
interface DeepAnalysisResult {
  beliefs: Belief[];
  cognitivePatterns: CognitivePatterns | null;
  relationshipDynamics: RelationshipDynamics | null;
  growthNodes: GrowthNode[];
  traumas: Trauma[];
  downgraded: boolean;
  downgradeReason?: string;
}

interface Belief {
  id: string;
  label: string;
  level: 'core' | 'middle' | 'concrete';
  strength: number;       // 0-1
  polarity: 'pos' | 'neg';
  formedAt: string;       // "YYYY-MM"
  evidence: string[];
  confidence: number;     // 0-1
}

interface CognitivePatterns {
  attributionStyle: 'internal' | 'external' | 'mixed';
  attributionNote: string;
  biases: {
    name: string;
    evidence: string[];
    confidence: number;
  }[];
  timePerspective: 'past' | 'present' | 'future' | 'mixed';
  selfTalkTone: 'critical' | 'supportive' | 'neutral' | 'mixed';
  selfTalkEvidence: string[];
}

interface RelationshipDynamics {
  patterns: string[];
  unfinishedBusiness: string[];
  projections: { target: string; likelyProjection: string; confidence: number }[];
}

interface GrowthNode {
  time: string;
  description: string;
  from: string;
  to: string;
  triggerEvent: string;
  confidence: number;
}

interface Trauma {
  theme: string;
  emotionIntensity: number;
  evidence: string[];
  defenseMechanisms: string[];
  confidence: number;
}
```

## 函数签名

```javascript
export async function analyzeDeep(userId, { segments, basicResult, options }) → DeepAnalysisResult
// options: { model: 'deepseek-chat', signal: AbortSignal, onChunk: function }
```

## LLM Prompt 结构

```
System: "只返回 JSON，不要任何解释文字。"
User: DEEP_ANALYSIS_PROMPT + '\n\n' + corpus
```

`DEEP_ANALYSIS_PROMPT` 约 70 行，要求严格 JSON 输出，包含 5 个顶层字段。

## 降级机制

| 条件 | 行为 |
|------|------|
| `segments.length === 0` | 返回空结果 + `downgraded: true` |
| `totalChars < 5000` | 返回默认值 + `downgraded: true` |
| LLM 第一次失败 | 降温度 0.3→0.2 重试 |
| LLM 重试失败 | throw `AI_UNAVAILABLE` |

## 语料截断

- `buildCorpusText(segments, maxChars=8000)`：按时间排序，累加到 8000 字截断
- 每段格式：`[timestamp] text`

## 验收清单
- [输入] 空 segments → `downgraded: true, downgradeReason: '无文本输入'`
- [输入] 4000 字 → `downgraded: true, downgradeReason 含 '4000'`
- [输入] 8000 字 + 正常 LLM → 返回完整 5 字段结构

## 影响分析
- 本文件无后续 plan 修改（深度分析已完整）
- A4 `mindGraphService` 消费 `DeepAnalysisResult.beliefs`
- A6 `reportService` 消费 `DeepAnalysisResult` 提取报告章节

## 风险提示
- LLM 返回非法 JSON 时用 `extractJson()` 容错解析
- `callAi` 来自 `aiProviderService.js`，需 userId 做计费路由
