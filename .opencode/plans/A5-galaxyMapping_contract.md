# A5 · galaxyMapping_contract
> 文档化 `server/services/mindGalaxy/galaxyMappingService.js` 的完整接口契约

## 需求摘要
梳理 10 类天体映射表 + 视觉参数生成 + 对数螺旋布局 + 哈勃类型推断，供 A8, C35 引用。

## 构建拓扑图
```
[串行] A4 → A5 → A8
[并行] A5 ∥ A6
```

## 数据契约总览

```typescript
interface GalaxySnapshot {
  id: string;
  userId: string;
  versionTag: string;
  galaxyType: 'E' | 'S' | 'SB' | 'Irr' | 'Merger';
  spiralArms: number;            // 2-4
  windingTightness: number;      // 0.1-1.0
  coreBulgeSize: number;         // 0-10
  flatness: number;              // 0-1
  bodies: GalaxyBody[];
  timeRange: { start: string; end: string };
  analyzedDiaryCount: number;
  corpusHash: string;
  createdAt: string;
}

interface GalaxyBody {
  id: string;
  type: CelestialType;
  nodeId: string;
  name: string;
  position: [number, number, number];
  visual: VisualParams;
  motion?: MotionParams;
  spawnAnimation: 'none' | 'birth';
  meta: object;
}

type CelestialType =
  | 'black_hole' | 'giant_star' | 'main_sequence' | 'planet_system'
  | 'nebula' | 'binary_companion' | 'asteroid_belt' | 'dark_matter'
  | 'supernova_remnant' | 'neutron_star';

interface VisualParams {
  radius: number;
  colorHex: string;
  emissiveIntensity: number;
  temperature?: number;
  flickerFreq?: number;
  opacity?: number;
  density?: number;
  particleCount?: number;
}

interface MotionParams {
  parentBodyId: string | null;
  orbitRadius: number;
  orbitInclination: number;
  orbitSpeed: number;
  orbitPhase: number;
  eccentricity: number;
}
```

## 函数签名

```javascript
export async function mapToGalaxy(userId, graph, config?) → GalaxySnapshot | null
```

## 天体映射表

| GraphNode.type | → CelestialType | 条件 |
|----------------|---------------|------|
| CoreSelf | black_hole | 固定 |
| Belief (core) | giant_star | level === 'core' |
| Belief (other) | planet_system | 否则 |
| Theme | main_sequence | 固定 |
| Emotion | nebula | 固定 |
| Person | binary_companion | 固定 |
| Memory | asteroid_belt | 固定 |
| Shadow | dark_matter | 固定 |
| growth (特殊) | supernova_remnant | - |
| trauma (特殊) | neutron_star | - |

## 情绪→颜色映射（20 色 Hex）

```
joy:#FFD700 calm:#ADD8E6 satisfaction:#98FB98 gratitude:#FFB347
hope:#87CEEB love:#FF69B4 pride:#FF8C00 interest:#7FFFD4
surprise:#FFA500 sadness:#4169E1 anger:#8B0000 anxiety:#9370DB
fear:#4B0082 shame:#A0522D guilt:#708090 disgust:#556B2F
loneliness:#483D8B jealousy:#228B22 boredom:#808080 awe:#800080
```

## 对数螺旋公式

```javascript
spiralPosition(armIndex, armsCount, baseAngle, radius, armWidth, perturbation):
  armAngle = (armIndex / armsCount) × 2π + baseAngle
  theta = radius × 0.8 + armAngle
  r = 1.2 × e^(0.3 × radius) × armWidth
  px = cos(theta) × (r + random × perturbation)
  py = (random - 0.5) × 0.8 × armWidth
  pz = sin(theta) × (r + random × perturbation)
```

## 哈勃类型推断

| 条件 | 类型 |
|------|------|
| entropy < 0.5 && coreBeliefs ≥ 3 && bulge > 7 | E（椭圆） |
| armCount === 2 && tightness > 0.6 && bulge > 5 | SB（棒旋） |
| entropy < 1.0 && armCount ≥ 3 && tightness < 0.5 | S（旋涡） |
| entropy > 1.5 \|\| bulge < 2 | Irr（不规则） |
| 默认 | S |

## 视觉参数映射关键值

| 天体 | radius 公式 | emissiveIntensity |
|------|------------|------------------|
| black_hole | min(15, 5 + strength/10) | 5.0 |
| giant_star | 0.5 + log(weight+0.5) | min(5, 1.5 + weight) |
| main_sequence | 0.5 + log(weight+0.5) | min(3, 0.5 + weight) |
| nebula | 0.2 | min(3, 0.5 + weight) |
| neutron_star | 0.3 | - |
| dark_matter | 0.1 | - |
| asteroid_belt | 0.05 | - |

## 行星运动参数

```javascript
motion = {
  parentBodyId: null,            // 第二遍填充：最近 giant_star / main_sequence
  orbitRadius: 3 + importance × 5,
  orbitInclination: (random - 0.5) × 0.5,
  orbitSpeed: 0.3 + weight × 0.7,
  orbitPhase: random × 2π,
  eccentricity: max(0.05, 1 - belief.strength)
}
```

## 验收清单
- [输入] 空 graph → 返回 null
- [输入] 10 节点 graph → bodies.length === 10
- [输入] core 信念 3 个 → galaxyType 可能是 E 或 SB
- [输入] 有 planet_system → motion.parentBodyId 非空

## 影响分析
- 本文件无后续 plan 修改
- A8 前端天体工厂消费 GalaxyBody.visual + motion 参数
- C35 映射规则 UI 需暴露 NODE_TO_CELESTIAL 和 EMOTION_COLORS 可编辑

## 风险提示
- spawnAnimation: 'birth' 判定 = 30 天内新信念
- parentBodyId 第二遍填充用距离匹配，若 giant_star 不存在则留 null
