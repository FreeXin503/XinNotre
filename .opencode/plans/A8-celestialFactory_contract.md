# A8 · celestialFactory_contract
> 文档化 celestialBodies.js + celestialBodies2.js 的 10 个工厂函数签名与参数结构

## 需求摘要
梳理 10 种天体的 3D 工厂函数输入/输出结构，供 C19, C20, C21, C11 引用。

## 构建拓扑图
```
[串行] A8 → C19, C20, C21, C11
[并行] A8 ∥ A7 ∥ A9
```

## 数据契约总览

```typescript
interface BodyInput {
  id: string; type: CelestialType; nodeId: string; name: string;
  position: [number, number, number];
  visual: VisualParams; motion?: MotionParams;
  spawnAnimation: 'none' | 'birth'; meta: object;
}

interface CelestialItem {
  group: THREE.Group;
  update?: (delta: number) => void;
  dispose?: () => void;
  body: BodyInput;
}
```

## 10 个工厂函数签名

```javascript
// celestialBodies.js（5 个）
export function createBlackHole(body) → CelestialItem
export function createGiantStar(body) → CelestialItem
export function createMainSequence(body) → CelestialItem
export function createPlanetSystem(body) → CelestialItem
export function createNebula(body) → CelestialItem

// celestialBodies2.js（5 个）
export function createBinaryCompanion(body) → CelestialItem
export function createAsteroidBelt(body) → CelestialItem
export function createDarkMatter(body) → CelestialItem
export function createSupernovaRemnant(body) → CelestialItem
export function createNeutronStar(body) → CelestialItem
```

## 各天体渲染细节

### black_hole
- 核心 SphereGeometry 黑色 + 吸积盘 TorusGeometry ×2 + 800 粒子环 + 光晕 Sprite
- update: rotation.y += delta × 0.3

### giant_star
- SphereGeometry + emissive + Sprite 光晕 + generateStarSurfaceTexture()
- update: rotation.y += delta × 0.15

### main_sequence
- SphereGeometry + emissive + Sprite 光晕
- update: rotation.y += delta × 0.2

### planet_system
- SphereGeometry 行星 + Sprite 光晕 + BackSide 大气层
- update: 公转 orbitAngle += delta × motion.orbitSpeed (开普勒推进)

### nebula
- PointsMaterial 粒子云 (2000-8000) + AdditiveBlending
- update: rotation.y += delta × 0.05

### binary_companion
- 独立 SphereGeometry + Sprite 光晕 + 公转

### asteroid_belt
- PointsMaterial 粒子环 (300-1000)
- update: rotation.y += delta × 0.1

### dark_matter
- 透明球壳 opacity: 0.3 + 内部雾粒子 + 缓慢脉动

### supernova_remnant
- 膨胀粒子壳 (2000-4000)
- update: 粒子位置 × 1.02 × delta

### neutron_star
- 小球体 + 脉冲光束 CylinderGeometry + 光环 TorusGeometry
- update: opacity = 0.5 + sin(Date.now() × 0.01) × 0.3

## visual 参数消费表

| 参数 | 消费天体 | 用途 |
|------|---------|------|
| radius | 全部 | SphereGeometry 半径 |
| colorHex | 全部 | material.color |
| emissiveIntensity | 恒星/黑洞/行星 | material.emissiveIntensity |
| temperature | giant_star / main_sequence | 色温（间接用 emissive） |
| flickerFreq | neutron_star | 闪烁频率 |
| opacity | dark_matter / nebula | material.opacity |
| density | nebula | bound 计算 |
| particleCount | nebula/asteroid/supernova | 粒子数 |

## motion 参数消费表（仅 planet_system）

| 参数 | 用途 |
|------|------|
| parentBodyId | 公转中心 body id |
| orbitRadius | 公转半径 |
| orbitInclination | 轨道倾角 |
| orbitSpeed | 公转角速度 |
| orbitPhase | 初始相位 |
| eccentricity | 轨道偏心率 |

## 验收清单
- [输入] 任意 body 含合法 visual → 返回 { group, update, dispose }
- [输入] visual = undefined → 工厂不应崩溃，用默认值
- [输入] dispose() → geometry/material/texture 全部释放

## 影响分析
- celestialBodies.js 被 C20/C21 修改
- celestialBodies2.js 被 C19/C20 修改
- C11 遍历所有 group 的 mesh

## 风险提示
- 工厂不要 scene.add()，由 buildGalaxy 负责
- dispose 必须清理全部资源
- 用 window.THREE
