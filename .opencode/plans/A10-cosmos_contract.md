# A10 · cosmos_contract
> 文档化 public/js/modules/cosmos.js + server/services/cosmosService.js 的完整接口契约

## 需求摘要
梳理心智星相图的心理→物理映射管线 + 前端 5 类天体渲染接口，供 B5, B6, B7 修复前端交互缺失。

## 构建拓扑图
```
[串行] A10 → B5, B6, B7
[并行] A10 ∥ A7 ∥ A8 ∥ A9
```

## 数据契约总览

```typescript
interface CosmosSnapshot {
  user_id: number;
  snapshot_json: {
    psychology: PsychologyResult;
    physics: PhysicsResult;
    entities: EntityRegistry[];
    generated_at: string;
  };
}

interface PsychologyResult {
  sun: { health_score: number; gravity_coefficient: number; cbt_schema_type: string; swallow_rate?: number };
  planets: PlanetPsy[];      // CAREER_AMBITION | INTIMACY_RELATIONSHIP | EGO_IDENTITY | SOCIAL_MASK
  satellites: SatellitePsy[];
  nebulas: NebulaPsy[];
  lagrange_clumps: LagrangePsy[];
}

interface PlanetPsy {
  type: string;
  atmosphere_density: number;          // 防御 0-1
  cognitive_dissonance_score: number;  // 0-100
  crater_count: number;
  diagnosis_text: string;
  emotional_volatility: number;
  defense_mechanisms: string[];
  semantic_relation_score: number;
  _gravity_bridge_to?: string;
}

interface SatellitePsy {
  parent_planet: string;
  distortion_type: 'CATASTROPHIZING' | 'POLARIZED_THINKING' | 'OVERGENERALIZATION'
    | 'MIND_READING' | 'EMOTIONAL_REASONING' | 'LABELING';
  severity: number; tail_length: number;
}

interface NebulaPsy {
  related_planet: string; title: string; severity: number;
  particle_density: number; type: 'dark' | 'light';
}

interface LagrangePsy {
  related_planet: string; lagrange_point: 'L4' | 'L5';
  object_name: string; density: number;
}

interface PhysicsResult {
  sun: { radius: number; color: number; emissive_intensity: number; show_accretion_disk: boolean };
  planets: PlanetPhys[]; satellites: SatellitePhys[]; nebulas: NebulaPhys[]; lagrange_clumps: LagrangePhys[];
}
```

## 函数签名

```javascript
// cosmos.js（前端）
export function mountCosmos(container) → void
export function unmountCosmos() → void
// 内部: createBlackHole, createPlanet, createSatellite, createNebula, createLagrangeClump, createStarField

// cosmosService.js（后端）
export const COSMOS_PSYCHOLOGY_PROMPT: string
export async function analyzeDiariesForCosmos(userId) → CosmosSnapshot
export function convertPsychologyToPhysics(psychologyResult) → PhysicsResult
```

## 心理→物理关键映射

| 心理参数 | 物理参数 | 映射 |
|---------|---------|------|
| health_score | 黑洞 radius | 5-15 线性 |
| health_score 0-39 | 黑洞 color | 黑色 BLACK_HOLE |
| health_score 40-79 | 黑洞 color | 蓝色 BLUE_SUPERGIANT |
| health_score 80-100 | 黑洞 color | 黄色 YELLOW_GIANT |
| gravity_coefficient | show_accretion_disk | > 0.5 |
| cognitive_dissonance_score | eccentricity | 0-100 → 0-0.95 |
| atmosphere_density | semi_major_axis | 0-1 → 80-20（反向） |
| emotional_volatility | eccentricity 叠加 | + |
| severity | satellite radius | 0-1 → 0.5-3.0 |
| tail_length | 尾迹粒子数 | × 20 |
| particle_density | 碎石带密度 | × 400 |

## 前端交互状态（B5-B7 需补全）

```javascript
// ❌ 当前缺失：
// - Raycaster onMouseMove（悬停高亮 + tooltip）
// - Raycaster onClick（点击详情面板）
// - Raycaster onDoubleClick（相机平滑聚焦）
// - Keyboard Escape
// - 详情面板 DOM
```

## 已实现的动画

| 天体 | 动画 |
|------|------|
| 黑洞 | rotation.y += delta × 0.15 |
| 行星 | 开普勒公转 _orbitAngle += delta × 0.15 |
| 卫星 | 静态（固定在父行星） |
| 星云 | 静态 |
| 碎石带 | 静态 |

## 前端生命周期

```javascript
export function unmountCosmos() {
  cancelAnimationFrame → dispose geometry/material/renderer → 移除 resize listener → container.innerHTML = ''
}
```

## 后端 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/cosmos/snapshot | 获取最新快照 |
| POST | /api/cosmos/generate | SSE 流式生成 |
| GET | /api/cosmos/evolution | 演化历史 |
| GET | /api/cosmos/snapshot/:id | 按 ID 获取 |

## 验收清单
- [输入] mountCosmos(container) → 黑洞+行星+星空可见
- [输入] unmountCosmos() → 无内存泄漏
- [输入] health_score=90 → 黑洞为黄色形态
- [输入] health_score=20 → 黑洞为黑色 + 吞噬动画

## 影响分析
- cosmos.js 被 B5/B6/B7 串行修改（同文件）
- 后端 cosmosService.js 不改
- cosmos.js 用 import * as THREE，与 Mind Galaxy 的 window.THREE 不同

## 风险提示
- cosmos.js 已有 648 行，B5-B7 新增约 150 行，若超 200 行限制需拆文件
- 5 类天体 Group 没有 userData.clickable 标记—B5 需添加
- OrbitControls 距离限制 20-250（场景更大）
