# A7 · frontend_core_contract
> 文档化 renderer.js + layout.js + index.js 的完整接口契约

## 需求摘要
梳理前端 3D 核心的场景/相机/控制器/动画循环/后处理接口，供 B1, B2, B8, C17, C18, C22 引用。

## 构建拓扑图
```
[串行] A7 → B1, B2, B8, C17, C18, C22
[并行] A7 ∥ A8 ∥ A9
```

## 数据契约总览

```typescript
interface RendererState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: THREE.OrbitControls;
  raycaster: THREE.Raycaster;
  clock: THREE.Clock;
  mouse: THREE.Vector2;
  _resizeFn: () => void;
  getComposer: () => EffectComposer | null;
  setComposer: (c: EffectComposer | null) => void;
}

interface PostProcessingState {
  composer: EffectComposer;
  bloomPass: UnrealBloomPass;
}
```

## 函数签名

```javascript
// renderer.js
export function initRenderer(container) → RendererState
export function initPostProcessing(rs, params?) → PostProcessingState
export function disposePostProcessing(rs) → void
export function disposeScene(scene, renderer, controls) → void

// layout.js
export function spiralPosition(body, bodies) → [number, number, number]

// index.js
export function mountMindGalaxy() → void
export function unmountMindGalaxy() → void
```

## 场景配置常量

```javascript
scene.background = new THREE.Color(0x050510)
scene.fog = new THREE.FogExp2(0x050510, 0.00015)

camera = PerspectiveCamera(55, aspect, 0.5, 300)
camera.position = (8, 12, 22)

controls.minDistance = 3
controls.maxDistance = 120
controls.maxPolarAngle = Math.PI * 0.85
controls.enableDamping = true; controls.dampingFactor = 0.08

renderer.setPixelRatio = min(devicePixelRatio, 2)
renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9
```

## 光照配置

```javascript
ambientLight = AmbientLight(0x223344, 0.6)
keyLight = DirectionalLight(0xffeedd, 0.8) position: (20, 30, 10)
fillLight = DirectionalLight(0x334466, 0.4) position: (-15, -5, -10)
```

## Raycaster 配置

```javascript
raycaster.params.Points.threshold = 0.3
raycaster.params.Line.threshold = 0.15
```

## 主模块生命周期

```javascript
function boot() {
  rs = initRenderer(container)
  initPostProcessing(rs, { strength: 0.5, radius: 0.4, threshold: 0.0 })
  createStarfield(scene)             // 3000 粒子星空
  celestialItems = buildGalaxy(EXAMPLE)
  initInteraction(rs); initUI(); initExporter(rs)
  animate()
}
async function tryLoadServer() { /* 异步加载服务端快照，成功后替换 */ }
export function mountMindGalaxy() { boot(); tryLoadServer() }
export function unmountMindGalaxy() { /* RAF cancel + dispose 全部 */ }
```

## 动画循环

```javascript
function animate() {
  animFrameId = requestAnimationFrame(animate)
  delta = min(clock.getDelta(), 0.1)
  advanceTime(delta); t = getNormalizedTime()
  applyTimeAnimation(t)              // 脉动+漂移
  for (item of celestialItems) item.update?.(delta)
  updateInteraction(delta); controls.update()
  composer.render() || renderer.render()
}
```

## FACTORY 注册表 + buildGalaxy 流程

```javascript
const FACTORY = {
  black_hole, giant_star, main_sequence, planet_system, nebula,
  binary_companion, asteroid_belt, dark_matter, supernova_remnant, neutron_star
}
function buildGalaxy(snapshot) {
  bodies.map(body => {
    if (position 全 0) body.position = spiralPosition(body, bodies)
    factory = FACTORY[body.type]; item = factory(body)
    item.group.position.set(position); scene.add(item.group)
    bodyBaseStates.set(body.id, { position, color, scale })
    return item
  }).filter(Boolean)
}
```

## 验收清单
- [输入] initRenderer(null) → throw 'Three.js not loaded'
- [输入] mountMindGalaxy() 两次 → 第二次被 mounted flag 拦截
- [输入] unmountMindGalaxy() → cancelAnimationFrame + dispose 全部

## 影响分析
- renderer.js 被 B1/C18/C22 修改
- index.js 被 B1/B8/C17/C18 修改
- 用 window.THREE，不用 import * as THREE

## 风险提示
- window.THREE 全局注入，子 agent 不要用 import * as THREE
- tryLoadServer() 异步不阻塞，改 celestialItems 需注意竞态
