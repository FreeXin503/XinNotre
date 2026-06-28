# A4 · mindGraph_contract
> 文档化 `server/services/mindGalaxy/mindGraphService.js` 的完整接口契约

## 需求摘要
梳理心智图谱的 7 类节点 + 5 类边 + 权重公式 + 中心性算法，供 A5, A8 引用。

## 构建拓扑图
```
[串行] A3 → A4 → A5
[并行] A4 ∥ A2 ∥ A3
```

## 数据契约总览

```typescript
interface MindGraph {
  userId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  timeRange: { start: string; end: string };
  corpusHash: string;
  computedAt: string;
}

interface GraphNode {
  id: string;
  type: 'CoreSelf' | 'Belief' | 'Theme' | 'Emotion' | 'Person' | 'Memory' | 'Shadow';
  label: string;
  weight: number;
  centrality: { degree: number; betweenness: number; eigenvector: number };
  attributes: {
    coreSelf?: { strength: number; stability: number; integration: number };
    belief?: { level: string; strength: number; polarity: 'pos'|'neg'; formedAt: string };
    theme?: { importance: number; heat: number; trend: 'rising'|'stable'|'fading' };
    emotion?: { intensity: number; frequency: number; persistence: number; vector20: number[] };
    person?: { intimacy: number; polarity: number; influence: number };
    memory?: { importance: number; vividness: number };
    shadow?: { repression: number; energy: number };
  };
  sourceRefs: { sourceType: string; recordId: string; excerpt: string }[];
  createdAt: string;
}

interface GraphEdge {
  id: string;
  type: 'supports' | 'triggers' | 'correlates' | 'represses' | 'derives';
  from: string;
  to: string;
  weight: number;
}
```

## 函数签名

```javascript
export async function buildMindGraph({ basic, deep, segments }) → MindGraph
export async function saveGraph(userId, graph) → void
```

## 节点构建规则

| 节点类型 | 来源 | 数量上限 | 权重公式 |
|---------|------|---------|---------|
| CoreSelf | 固定 1 个 | 1 | weight: 10.0 |
| Belief | deep.beliefs | 全部 | freq × avgLen × timeDecay × (1+avgEmotion) × log(i+2) |
| Theme | basic.topics | 全部 | size × 0.5 |
| Emotion | basic.emotions20.globalVector | TOP 3 (v > 0.3) | v × 5 |
| Person | basic.entities.persons | TOP 5 | min(10, freq × 0.5) |
| Memory | segments 非碎片 | TOP 10 | 0.2 + random × 0.3 |
| Shadow | deep.beliefs 负极性 | TOP 3 | strength × 3 |

## 边构建规则

| 边类型 | from → to | 条件 | 权重 |
|-------|-----------|------|------|
| supports | coreBelief → CoreSelf | level === 'core' | belief.strength |
| derives | coreBelief → subBelief | level !== 'core' | 0.3 + random × 0.4 |
| correlates | Theme → Belief | 每主题连接前 3 个信念 | 0.3 + random × 0.5 |
| triggers | Emotion → Belief | 每 Emotion 连接前 2 个 Belief | emotionIntensity × belief.strength |
| triggers | Person → Emotion | 所有 Person × dominantEmotions | 0.4 |
| represses | Shadow → positiveBelief | 负极性 → 正极性 | shadow.strength |

## 中心性计算

```javascript
degree = edges.filter(e => e.from === node.id || e.to === node.id).length
betweenness = degree / Math.max(1, nodes.length)
eigenvector = degree × node.weight / Math.max(1, sum(all weights))
```

## 时间衰减

```javascript
timeDecay(createdAt) = 1 / (1 + 0.3 × max(0, daysPast / 365))
```

## 验收清单
- [输入] 空 basic + 空 deep → 仅返回 CoreSelf 单节点图
- [输入] basic 有 3 主题 + deep 有 5 信念 → nodes.length ≥ 9
- [输入] 任意输入 → edges 中 supports 边数 = core 信念数

## 影响分析
- mindGraphService.js 无后续 plan 修改
- A5 galaxyMappingService 消费 MindGraph.nodes/edges
- A8 前端天体工厂消费 GalaxySnapshot.bodies 的 meta 字段

## 风险提示
- Person 节点的 intimacy 和 polarity 当前用 Math.random()，不可复现—C16 应替换
- Emotion 节点 label 硬编码情绪名数组，索引偏移有风险
