# 批6 · 宇宙模块高保真美化 + Bug 修复

## 1. 需求摘要

将 cosmos（心智星相图）与 mind-galaxy（心智星系）两个宇宙模块的视觉风格提升为「哈勃真实天文照片风」（写实星云粒子 + 真实色谱 + 恒星表面湍流 + 银河带深空背景 + 强 bloom + 轻微 vignette/grain 胶片质感），同时修复已定位的 14 项 cosmos bug 与 5 项 mind-galaxy bug。bug 修复与美化并发推进，每个文件改一次就把 bug 和美化一起做完。

## 2. 构建拓扑图

```
Phase 0 · cosmos 模块（单文件 cosmos.js + 新增 cosmosTextures.js，4 卡严格串行）
  Card 0A ──→ Card 0B ──→ Card 0C ──→ Card 0D
  (ESM import + 字段错配) → (逻辑 bug) → (新建 textures 文件) → (后处理 + 贴图应用 + 雾效 + skybox)

Phase 1 · mind-galaxy 模块（5 卡，部分并行）
  Card 1A（git add analyzer.js）必须最先执行
    └─→ 之后 Card 1B ∥ 1C ∥ 1D ∥ 1E 可并行（4 文件无交叉依赖）
  (exporter.js) (renderer.js) (interaction.js) (textures.js + celestialBodies)
```

**同文件叠加顺序**：
- `public/js/modules/cosmos.js` 被 Card 0A → 0B → 0D 依次修改，每张卡在前一张基础上继续
- `public/js/modules/mindGalaxy/textures.js` 被 Card 1E 单独修改
- 其余文件均单卡触及

## 3. 数据契约总览

```typescript
// ========= 共享类型定义 =========

// Cosmos 快照（后端 cosmosService.js 实际产出，前端必须按此读取字段）
interface CosmosSnapshot {
  user_id: string;
  analyzed_diary_count: number;
  time_range: { start_date: string; end_date: string };
  sun: {
    id: string;
    render_type: 'YELLOW_GIANT' | 'BLUE_SUPERGIANT' | 'BLACK_HOLE';
    geometry: { radius: number };
    material_properties: {
      base_color: string;
      emissive_intensity: number;
      shader_noise_scale: number;
    };
    physical_fields: {
      gravity_coefficient: number;
      accretion_disk_active: boolean;
    };
    psychological_meta: {
      cbt_schema_type: string;
      core_belief_text: string;
      swallow_rate: number;
    };
  };
  planets: Array<{
    id: string;
    life_domain: string;
    kepler_orbit: {
      semi_major_axis: number;
      eccentricity: number;
      inclination: number;
      initial_anomaly: number;
    };
    visual_layer: {
      radius: number;
      atmosphere_glow_color: string;
      atmosphere_density: number;
      crater_count: number;
    };
    psychological_meta: {
      cognitive_dissonance_score: number;
      diagnosis_text: string;
      defense_mechanisms: string[];
      emotional_volatility: number;
      semantic_relation_score: number;
    };
  }>;
  satellites: Array<{
    id: string;
    parent_planet_id: string;
    orbit_radius: number;
    geometry: { radius: number; current_angle: number };
    particle_tail: { stream_color: string; length: number; intensity: number };
    psychological_meta: { text: string; distortion_tags: string[] };
  }>;
  nebulas: Array<{
    id: string;
    center_position: [number, number, number];
    particle_system: { count: number; bounding_radius: number; is_dark_nebula: boolean };
    psychological_meta: { dominant_raw_emotions: string[]; zeigarnik_text: string };
  }>;
  desire_clumps: Array<{
    parent_planet_id: string;
    lagrange_point: 'L4' | 'L5';
    particle_density: number;
    shader_reflectance: number;
    desire_tags: string[];
  }>;
}

// cosmosTextures.js 导出签名（Card 0C 产出，Card 0D 消费）
interface CosmosTextures {
  generateStarSurface(baseColor: string, noiseScale: number, size?: number): THREE.CanvasTexture;
  generateNebulaCloud(emotionColors: string[], isDark: boolean, size?: number): THREE.CanvasTexture;
  generateBlackHoleDisk(baseColor: string, size?: number): THREE.CanvasTexture;
  generateAtmosphereGlow(glowColor: string, density: number, size?: number): THREE.CanvasTexture;
}
```

## 4. 任务卡片

---

🛠️ **Card 0A: cosmos.js ESM import 改造 + 字段名错配修复** ✅ done
构建优先级：P0
改动性质：既有重构（局部 Diff）
前置依赖卡片：无
可并行执行：否（cosmos.js 第 1 张卡）
单卡片代码量预估：~45 行
受影响已有文件：`public/js/modules/cosmos.js` — 顶部 import 区 + 4 处 label 取值 + formatSunLabel 函数
必须导入的模块/路径：
- `import * as THREE from 'three';`
- `import { OrbitControls } from 'three/addons/controls/OrbitControls.js';`

核心功能 / 目标：让 cosmos 模块在主页能渲染（修 THREE 未定义致命 bug），并修掉 4 处前后端字段名错配使 label 正确显示

硬性接口契约 / 修改点：

1. **顶部 import 替换**（cosmos.js:10）
   原：`import { ApiClient } from '../api.js';`
   改为：
   ```js
   import * as THREE from 'three';
   import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
   import { ApiClient } from '../api.js';
   ```

2. **OrbitControls 构造**（cosmos.js:215）
   原：`new THREE.OrbitControls(camera, renderer.domElement)`
   改为：`new OrbitControls(camera, renderer.domElement)`

3. **行星 label 字段**（cosmos.js:489）
   原：`markClickable(group, { label: formatPlanetLabel(p.type), type: 'planet', clickable: true });`
   改为：`markClickable(group, { label: formatPlanetLabel(p.life_domain), type: 'planet', clickable: true, meta: p.psychological_meta });`

4. **卫星 label 字段**（cosmos.js:497）
   原：`markClickable(group, { label: formatSatelliteLabel(s.distortion_type), type: 'satellite', clickable: true });`
   改为：`markClickable(group, { label: formatSatelliteLabel(s.psychological_meta?.distortion_tags?.[0]), type: 'satellite', clickable: true, meta: s.psychological_meta });`

5. **星云 label 字段**（cosmos.js:504）
   原：`nebulaPoints.userData = { label: n.title || '潜意识暗星云', type: 'nebula', clickable: true };`
   改为：`nebulaPoints.userData = { label: n.psychological_meta?.dominant_raw_emotions?.[0] || '潜意识暗星云', type: 'nebula', clickable: true, meta: n.psychological_meta };`

6. **碎石带 label 字段**（cosmos.js:513）
   原：`clumpPoints.userData = { label: c.object_name || '欲望碎石带', type: 'clump', clickable: true };`
   改为：`clumpPoints.userData = { label: c.desire_tags?.[0] || '欲望碎石带', type: 'clump', clickable: true, meta: c };`

7. **formatSunLabel 字段**（cosmos.js:899-903）整个函数改为：
   ```js
   function formatSunLabel(sunData) {
     const meta = sunData?.psychological_meta;
     if (meta?.cbt_schema_type) return meta.cbt_schema_type;
     if (meta?.core_belief_text) return meta.core_belief_text.slice(0, 16);
     return '认知核心';
   }
   ```

8. **详情面板显示 meta**（cosmos.js:359 附近，showDetail 函数内）
   在显示 label + type 之后追加：若 `data.meta` 存在，遍历 `Object.entries(data.meta)` 渲染键值对到 detail panel。注意数组用 `value.join('、')`，字符串超 100 字符截断。

本卡片产出物被后续卡片消费情况：
- 产出：cosmos.js 可加载并正确显示 label → 被 Card 0B/0D 继续在成果上叠加修改

验收清单：
- [输入] 主页点"心智星相图"图标 → [预期] 不再显示"❌ 加载失败"，进入 3D 场景（空快照时显示空状态提示而非崩溃）
- [输入] 有快照数据时 → [预期] 行星 label 显示"事业野心/亲密关系"等中文名而非"未知行星"
- [输入] 卫星 label → [预期] 显示"灾难化思维"等而非"自动思维"
- [输入] 点击星体 → [预期] 详情面板显示 label + type + psychological_meta 键值对

🚫 禁区声明：
- 以下字段名【绝对禁止重命名】：后端的 `life_domain`、`distortion_tags`、`dominant_raw_emotions`、`desire_tags`、`psychological_meta`（前端必须适配后端，不可反向）
- 以下文件【绝对禁止改动】：`server/services/cosmosService.js`、`server/types/cosmosTypes.js`
- 以下新增依赖【绝对禁止引入】：无

防翻车边界 Case：
- `s.psychological_meta?.distortion_tags?.[0]` 多层可选链，distortion_tags 为空数组时返回 undefined → formatSatelliteLabel 接 undefined 走 `if (!distortionType) return '自动思维'` 兜底，OK
- `n.psychological_meta` 可能不存在（旧快照）→ 全部用可选链 `?.` 兜底
- import 后 THREE 不再是全局，但 cosmos.js 内 80+ 处 `THREE.*` 引用照常工作（import * as THREE 等价于全局 THREE 命名空间）

参考依赖 Context：
主页 importmap 已配置（`public/index.html:13-20`）：
```html
<script type="importmap">
{ "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
} }
</script>
```
故 `import * as THREE from 'three'` 和 `import { OrbitControls } from 'three/addons/controls/OrbitControls.js'` 可直接解析。

⚠️【执行工兵严格指令】：你当前仅负责落地本文件的代码。你必须严格遵守架构师给出的数据结构和 Diff 指示，【严禁】私自修改任何未授权的字段名、参数顺序或函数签名。代码必须写全异常捕获与空值检查！

---

🛠️ **Card 0B: cosmos.js 逻辑 bug 修复** ✅ done
构建优先级：P0
改动性质：既有重构（局部 Diff）
前置依赖卡片：Card 0A
可并行执行：否（cosmos.js 第 2 张卡，叠加在 0A 成果上）
单卡片代码量预估：~95 行
受影响已有文件：`public/js/modules/cosmos.js` — 状态变量声明、buildCosmos、createLagrangeClump、animate、loadAndRender、renderMainView
**文件锚点**（Card 0A 修改后）：前 3 行为 `/** 注释 */` / `import * as THREE from 'three';` / `import { OrbitControls } from 'three/addons/controls/OrbitControls.js';`；后 3 行为 `}` (formatSatelliteLabel 结束) / 空行 / 空行

核心功能 / 目标：修复内存泄漏、碎石带定位、卫星公转、空快照崩溃、刷新按钮不触发生成 5 项逻辑 bug

硬性接口契约 / 修改点：

1. **多星云/碎石带内存泄漏**（cosmos.js:39-40 状态变量）
   原：`let nebulaPoints = null;` / `let clumpPoints = null;`
   改为：`let nebulaPointsList = [];` / `let clumpPointsList = [];`

2. **buildCosmos 清理段**（cosmos.js:470-471）
   原：
   ```js
   if (nebulaPoints) { scene.remove(nebulaPoints); nebulaPoints.geometry.dispose(); nebulaPoints.material.dispose(); nebulaPoints = null; }
   if (clumpPoints) { scene.remove(clumpPoints); clumpPoints.geometry.dispose(); clumpPoints.material.dispose(); clumpPoints = null; }
   ```
   改为：
   ```js
   nebulaPointsList.forEach(p => { scene.remove(p); p.geometry.dispose(); p.material.dispose(); });
   nebulaPointsList = [];
   clumpPointsList.forEach(p => { scene.remove(p); p.geometry.dispose(); p.material.dispose(); });
   clumpPointsList = [];
   ```

3. **星云 forEach**（cosmos.js:501-507）
   原内 `nebulaPoints = createNebula(n); if (nebulaPoints) { ... scene.add(nebulaPoints); }`
   改为：`const np = createNebula(n); if (np) { np.userData = {...}; scene.add(np); nebulaPointsList.push(np); }`（不再覆盖单变量）

4. **碎石带 forEach**（cosmos.js:510-516）同理改为 push 到 `clumpPointsList`

5. **碎石带拉格朗日点定位**（cosmos.js:760-791 createLagrangeClump 函数）
   在函数内计算 L4/L5 位置并赋给 Points：
   ```js
   const planet = planetIdMap?.get(clump.parent_planet_id);
   let pos = new THREE.Vector3(0, 0, 0);
   if (planet) {
     const a = planet.kepler_orbit?.semi_major_axis || 30;
     const angle = (clump.lagrange_point === 'L5' ? -60 : 60) * Math.PI / 180;
     pos.set(a * Math.cos(angle), 0, a * Math.sin(angle));
   }
   points.position.copy(pos);
   ```
   注意：createLagrangeClump 现有签名 `(clump, planetIdMap)`，需确认 planetIdMap 已传入（cosmos.js:511 调用处 `createLagrangeClump(c, planetIdMap)` ✓）

6. **卫星公转**（cosmos.js:795-827 animate 函数）
   在行星公转循环之后追加卫星绕行星公转：
   ```js
   satelliteGroups.forEach(g => {
     if (g._parentPlanet && g._orbitRadius != null && g._satAngle != null) {
       g._satAngle += 0.02 * g._satSpeed;
       g.position.set(
         g._parentPlanet.position.x + Math.cos(g._satAngle) * g._orbitRadius,
         g._parentPlanet.position.y,
         g._parentPlanet.position.z + Math.sin(g._satAngle) * g._orbitRadius
       );
     }
   });
   ```
   并在 createSatellite（cosmos.js:656-706）内给 group 挂载：`g._parentPlanet = parentPlanetGroup; g._orbitRadius = s.orbit_radius; g._satAngle = s.geometry?.current_angle || 0; g._satSpeed = 0.5 + Math.random()*0.5;`（需在 createSatellite 内找到 parentPlanetGroup，通过 planetIdMap 查 parent_planet_id 对应的 planetGroups 项）

7. **空快照崩溃**（cosmos.js:461-462 buildCosmos 头部）
   原：`if (!scene || !data) return;`
   改为：`if (!scene || !data) return; if (!data.sun) { showEmptyState('暂无心智星相图快照，请先写日记后点击"刷新快照"生成'); return; }`
   并新增 showEmptyState 函数（在场景中央用 DOM overlay 显示提示，~10 行）

8. **刷新按钮触发生成**（cosmos.js:140 renderMainView 按钮 + loadAndRender）
   原"🔄 刷新快照"按钮 onclick 调 `window.refreshCosmos = () => loadAndRender()`
   改为：`window.refreshCosmos = () => generateCosmos()`，新增 `generateCosmos` 函数：
   ```js
   async function generateCosmos() {
     if (!abortCtrl) abortCtrl = new AbortController();
     const stream = await ApiClient.subscribeGenerateCosmos({ force: true }, { signal: abortCtrl.signal });
     // 用 SSE onMessage 更新进度，完成后 loadAndRender 读取新快照
   }
   ```
   参考 `public/js/api.js:522-527` `subscribeGenerateCosmos` 已有方法，它返回 SSE 流。处理后端 `status`/`result`/`done` 事件（见 `server/controllers/cosmosController.js:71-154`）。弹一个进度提示 DOM。

本卡片产出物被后续卡片消费情况：
- 产出：cosmos.js 逻辑正确，无内存泄漏/崩溃 → 被 Card 0D 继续叠加美化

验收清单：
- [输入] 多个星云的快照 → unmount 后 → [预期] 所有星云 Points 被 dispose，scene.children 无残留
- [输入] 碎石带快照 → [预期] 碎石带 Points 定位在 parent planet 的 L4/L5 点而非原点
- [输入] 有卫星的快照 → animate 运行 → [预期] 卫星绕 parent planet 公转
- [输入] 无快照（GET /snapshot 返回 cached:false）→ [预期] 显示"暂无快照"提示而非 TypeError 崩溃
- [输入] 点击"刷新快照" → [预期] 触发 POST /generate SSE 流式生成，完成后重新渲染

🚫 禁区声明：
- 以下函数签名【绝对禁止修改】：`mountCosmos(container)` / `unmountCosmos()` / `buildCosmos(data)` / `createBlackHole(sunData)` / `createPlanet(p)` / `createSatellite(s, planetIdMap)` / `createNebula(n)` / `createLagrangeClump(clump, planetIdMap)`
- 以下文件【绝对禁止改动】：`server/controllers/cosmosController.js`、`server/services/cosmosHookService.js`
- 新增依赖：无

防翻车边界 Case：
- satelliteGroups 中元素若无 `_parentPlanet`（createSatellite 未成功匹配 parent）→ 公转代码 `if (g._parentPlanet && ...)` 兜底跳过，OK
- generateCosmos 的 SSE 连接被 abort（用户 unmount）→ catch AbortError 静默退出
- showEmptyState 必须在 unmount 时清理其 DOM（在 unmountCosmos 内追加 `document.querySelector('.cosmos-empty-state')?.remove()`）

参考依赖 Context：
`public/js/api.js:522-527` subscribeGenerateCosmos：
```js
async subscribeGenerateCosmos(data, handlers) {
  return this._sse('/cosmos/generate', { method:'POST', headers:this.getHeaders(), body:JSON.stringify(data), signal:handlers?.signal }, handlers);
}
```
SSE 事件序列（cosmosController.js:71-154）：`status` →（多）`chunk` → `result{snapshotId,...}` → `done`。Card 0B 的 generateCosmos 应监听 `result` 事件拿到 snapshotId 后调 loadAndRender。

⚠️【执行工兵严格指令】：你当前仅负责落地本文件的代码。你必须严格遵守架构师给出的数据结构和 Diff 指示，【严禁】私自修改任何未授权的字段名、参数顺序或函数签名。代码必须写全异常捕获与空值检查！

---

🛠️ **Card 0C: 新建 cosmosTextures.js 纹理库**
构建优先级：P1
改动性质：纯新增
前置依赖卡片：无（纯新增独立文件）
可并行执行：是（与 0A/0B 并行，因不修改 cosmos.js，但 0D 依赖它）
单卡片代码量预估：~160 行
受影响已有文件：无（新增 `public/js/modules/cosmosTextures.js`）
必须导入的模块/路径：`import * as THREE from 'three';`

核心功能 / 目标：为 cosmos 天体提供哈勃写实风程序化纹理 —— 恒星表面湍流、星云体积云团、黑洞吸积盘、大气辉光。参考但独立于 `mindGalaxy/textures.js`。

硬性接口契约 / 导出：
```js
import * as THREE from 'three';

export function generateStarSurface(baseColor, noiseScale = 1, size = 256) {
  // HSL 解析 baseColor，叠多层 sin/cos 噪声 + fbm 模拟太阳米粒组织湍流
  // 返回 THREE.CanvasTexture，wrapS/wrapT = RepeatWrapping
}

export function generateNebulaCloud(emotionColors, isDark = false, size = 512) {
  // 默认 emotionColors = ['#FF6B35','#F7931E','#FFD700']（哈勃鹰状星云橙红黄）
  // 多层径向渐变叠加 + Perlin 风格噪声扰动 + isDark 时降低 alpha 0.3
  // 返回 THREE.CanvasTexture
}

export function generateBlackHoleDisk(baseColor = '#FF8C00', size = 512) {
  // 椭圆径向渐变模拟引力透镜吸积盘，中心黑 + 外环橙紫
  // 返回 THREE.CanvasTexture
}

export function generateAtmosphereGlow(glowColor, density = 0.5, size = 256) {
  // 径向渐变 + density 控制 alpha 衰减斜率
  // 返回 THREE.CanvasTexture
}

export function generateGalaxyBackground(size = 1024) {
  // 生成银河带背景：横向渐变 + 数千星点 + 星云团块（哈勃深空场风）
  // 返回 THREE.CanvasTexture（用于 createSkybox 的 6 面）
}
```

实现细节硬要求（防弱模型自由发挥）：
- 所有函数用 `document.createElement('canvas')` + `getContext('2d')`
- `generateStarSurface`：用 4 层 sin/cos 叠加（各层频率 1.3/2.7/5.1/9.7）模拟 fbm，亮度映射到 baseColor 的 HSL 亮度分量
- `generateNebulaCloud`：至少叠 8 个径向渐变云团，每团随机 alpha 0.1-0.35，颜色从 emotionColors 轮取
- `generateBlackHoleDisk`：中心 0-0.05 黑，0.05-0.5 橙红，0.5-0.85 紫，0.85-1 透明
- `generateGalaxyBackground`：先用 `createLinearGradient(0, size*0.4, 0, size*0.6)` 画银河带（深蓝→淡紫→深蓝），再随机 5000 星点（white+blue+yellow 混），再 15 个星云团（橙/紫/青）
- 每个函数末尾 `tex.needsUpdate = true; return tex;`

本卡片产出物被后续卡片消费情况：
- 产出文件 `cosmosTextures.js` + 5 个导出函数 → 被 Card 0D 消费（cosmos.js 顶部 import）

验收清单：
- [输入] `generateStarSurface('#FFD700', 1, 256)` → [预期] 返回 CanvasTexture，canvas 256×256，非全色（有亮度变化）
- [输入] `generateNebulaCloud(['#FF6B35','#F7931E'], false, 512)` → [预期] 512×512，多处云团可见
- [输入] `generateBlackHoleDisk()` → [预期] 中心黑外环橙
- [输入] `generateAtmosphereGlow('#4169E1', 0.8)` → [预期] 径向渐变，中心亮边缘透明
- [输入] `generateGalaxyBackground()` → [预期] 1024×1024，含银河带+星点+星云

🚫 禁区声明：
- 以下文件【绝对禁止改动】：`public/js/modules/mindGalaxy/textures.js`（mind-galaxy 有自己的纹理库， cosmos 独立）
- 禁止引入第三方噪声库（simplex-noise 等），全部用原生 canvas 2D + sin/cos
- 新增依赖：无

防翻车边界 Case：
- emotionColors 为空数组 → 用默认 `['#FF6B35','#F7931E','#FFD700']`
- baseColor 非 hex（如 'rgb(...)' ) → try/catch 解析失败时 fallback 到 '#FFFFFF'

⚠️【执行工兵严格指令】：你当前仅负责落地本文件的代码。你必须严格遵守架构师给出的数据结构和 Diff 指示，【严禁】私自修改任何未授权的字段名、参数顺序或函数签名。代码必须写全异常捕获与空值检查！

---

🛠️ **Card 0D: cosmos.js 哈勃视觉升级（后处理 + 贴图 + 雾效 + skybox）**
构建优先级：P1
改动性质：既有重构（追加 import + 修改 initThreeScene/create*/animate/createStarField）
前置依赖卡片：Card 0A + 0B + 0C（叠加在 0B 成果上，import 0C 的纹理）
可并行执行：否（cosmos.js 第 4 张卡）
单卡片代码量预估：~180 行
受影响已有文件：`public/js/modules/cosmos.js` — 顶部 import、initThreeScene、createBlackHole、createPlanet、createNebula、createSatellite、createLagrangeClump、createStarField、animate
**文件锚点**（Card 0A/0B 修改后）：前 4 行为注释 + 3 个 import（THREE/OrbitControls/ApiClient）；状态变量区含 `nebulaPointsList`/`clumpPointsList`/`satelliteGroups`（0B 改后）

必须导入的模块/路径（在 cosmos.js 顶部追加）：
```js
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { generateStarSurface, generateNebulaCloud, generateBlackHoleDisk, generateAtmosphereGlow, generateGalaxyBackground } from './cosmosTextures.js';
```

核心功能 / 目标：为宇宙加入哈勃写真级视觉 —— bloom 光晕、FogExp2 深空雾、6 面 skybox 银河带、所有天体应用程序化纹理

硬性接口契约 / 修改点：

1. **initThreeScene 加雾效 + 后处理**（cosmos.js:185-397）
   - 在 `new THREE.Scene()` 后追加：`scene.fog = new THREE.FogExp2(0x050510, 0.0002); scene.background = generateSkybox();`
   - 新增 `generateSkybox()` 函数（用 generateGalaxyBackground 生成 1 张 CanvasTexture，构造 `new THREE.CubeTextureLoader().load` 或手动 6 面 `new THREE.MeshBasicMaterial({map: tex})` 的 BoxGeometry，~25 行）
   - 在 renderer 创建后追加 EffectComposer：
     ```js
     composer = new EffectComposer(renderer);
     composer.addPass(new RenderPass(scene, camera));
     const bloomPass = new UnrealBloomPass(new THREE.Vector2(containerEl.clientWidth, containerEl.clientHeight), 0.7, 0.5, 0.15);
     composer.addPass(bloomPass);
     const vignettePass = new ShaderPass(new THREE.ShaderMaterial({
       uniforms: { tDiffuse: { value: null }, intensity: { value: 0.25 } },
       vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
       fragmentShader: 'varying vec2 vUv; uniform sampler2D tDiffuse; uniform float intensity; void main(){ vec4 t=texture2D(tDiffuse,vUv); float d=length(vUv-0.5); t.rgb*=1.0-d*intensity; gl_FragColor=t; }'
     }));
     composer.addPass(vignettePass);
     ```
   - 状态变量区追加 `let composer = null;`

2. **animate 用 composer.render**（cosmos.js:795-827 末尾）
   原末尾 `renderer.render(scene, camera);`
   改为：`if (composer) composer.render(); else renderer.render(scene, camera);`

3. **createBlackHole 应用吸积盘纹理**（cosmos.js:521-586）
   - 吸积盘 TorusGeometry 的材质从 `MeshBasicMaterial` 改为 `MeshBasicMaterial({ map: generateBlackHoleDisk(sunData.material_properties.base_color), transparent: true, blending: THREE.AdditiveBlending })`
   - 黑洞球体加 ShaderMaterial 事件视界扭曲（可选，复杂则保留原 emissive 但加 `emissiveIntensity *= 1.5` 增强发光）

4. **createPlanet 应用恒星表面纹理 + 大气**（cosmos.js:590-652）
   - 主球体 MeshStandardMaterial 追加 `map: generateStarSurface(p.visual_layer?.atmosphere_glow_color || '#4169E1', 1.2)`
   - glow 层改用 `SpriteMaterial({ map: generateAtmosphereGlow(p.visual_layer?.atmosphere_glow_color, p.visual_layer?.atmosphere_density), blending: AdditiveBlending, transparent: true })` 取代 BackSide 球壳

5. **createNebula 用星云纹理**（cosmos.js:710-756）
   - 在 Points 材质基础上叠加一个内层 SphereGeometry shell 用 `MeshBasicMaterial({ map: generateNebulaCloud(n.psychological_meta?.dominant_raw_emotions?.map(e=>EMOTION_COLOR_MAP[e]) || ['#FF6B35','#F7931E','#FFD700'], n.particle_system?.is_dark_nebula), transparent: true, opacity: 0.6, blending: AdditiveBlending })`
   - EMOTION_COLOR_MAP 硬编码 8 种情绪色（哈勃色谱）：joy=#FFD700 / sadness=#4169E1 / anger=#FF4500 / fear=#9400D3 / surprise=#00CED1 / disgust=#7CFC00 / trust=#FF69B4 / anticipation=#FFA500

6. **createStarField 升级**（cosmos.js:428-457）
   - 粒子数 2000 → 5000
   - 颜色分布加入蓝白黄混合（哈勃深空场）：60% white + 25% blue (#A0C8FF) + 15% yellow (#FFE4A0)
   - size 0.8 → 1.2，opacity 0.9 → 0.8

7. **createLagrangeClump 颜色升级**（cosmos.js:760-791）
   粒子颜色 `#FFD700` → 根据 desire_tags 取色（贪婪金/欲望红）：`desire_tags?.[0]==='POSSESSIVE' ? '#DC143C' : '#FFD700'`，size 0.08 → 0.12

本卡片产出物被后续卡片消费情况：
- 无后续消费者（cosmos 模块最终态）

验收清单：
- [输入] 进入心智星相图 → [预期] 看到深空 skybox 银河带背景 + bloom 光晕（星体发光柔和不刺眼）
- [输入] 有 sun.render_type=BLACK_HOLE 的快照 → [预期] 黑洞吸积盘呈橙紫渐变
- [输入] 有 planets 的快照 → [预期] 行星表面有湍流纹理，大气层有柔和辉光
- [输入] 有 nebulas 的快照 → [预期] 星云呈橙红黄多团云团（哈勃鹰状星云风），非纯色
- [输入] 滚轮缩放 → [预期] 远处星体受 FogExp2 衰减变暗

🚫 禁区声明：
- 以下函数签名【绝对禁止修改】：见 Card 0B 禁区
- 后处理参数【禁止超出】：bloom strength≤0.8 / radius≤0.6 / threshold≥0.1，vignette intensity≤0.3（过强会糊成一团）
- 以下文件【绝对禁止改动】：`server/services/cosmosService.js`、`public/js/modules/mindGalaxy/*`
- 新增依赖：无（postprocessing 走 three/addons ESM）

防翻车边界 Case：
- WebGL 不支持后处理（EffectComposer 构造失败）→ try/catch 回退 `composer=null`，animate 用 renderer.render
- generateStarSurface/... 返回 null（canvas 失败）→ 材质 fallback 到原纯色（保留 `|| baseColor` 兜底）
- BoxGeometry skybox 若 6 面用同一 texture 看起来重复 → 接受（与 mind-galaxy/renderer.js:232-273 一致做法）
- composer.setSize 必须在 onResize 中同步调用（若有 resize 监听）

参考依赖 Context：
mind-galaxy renderer.js 已验证的 bloom 配置（`public/js/modules/mindGalaxy/renderer.js:77-137`）：
```js
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  params.strength ?? 0.5,   // cosmos 用 0.7（写实风更强发光）
  params.radius ?? 0.4,     // cosmos 用 0.5
  params.threshold ?? 0.0   // cosmos 用 0.15（避免全屏泛白，借鉴 mind-galaxy threshold=0 的教训）
);
```

⚠️【执行工兵严格指令】：你当前仅负责落地本文件的代码。你必须严格遵守架构师给出的数据结构和 Diff 指示，【严禁】私自修改任何未授权的字段名、参数顺序或函数签名。代码必须写全异常捕获与空值检查！

---

🛠️ **Card 1A: git add analyzer.js（跟踪未提交文件）** ✅ done
构建优先级：P0
改动性质：纯新增（git 跟踪）
前置依赖卡片：无（最先执行）
可并行执行：否（必须最先，否则后续 commit 会漏文件）
单卡片代码量预估：0 行代码（仅 git 操作）
受影响已有文件：无代码改动
必须导入的模块/路径：无

核心功能 / 目标：`public/js/modules/mindGalaxy/analyzer.js` 当前未被 git 跟踪（`git status` 显示 `??`），但 `uiPanels.js:6` 通过 `import { analyzePreview } from './analyzer.js'` 静态引用。干净 clone 会导致 module 加载失败页面白屏。本卡只做 `git add` 使文件进入版本库。

硬性接口契约 / 修改点：
- 命令：`git add public/js/modules/mindGalaxy/analyzer.js`
- 文件内容不动（analyzer.js 已存在且可用，参考调研 F1）

本卡片产出物被后续卡片消费情况：
- 产出：analyzer.js 进入 git 索引 → 被 Card 1B-1E 的 commit 一并带上

验收清单：
- [输入] `git status public/js/modules/mindGalaxy/analyzer.js` → [预期] 不再显示 `??`，显示已跟踪（可能 modified 或 clean）

🚫 禁区声明：
- 【绝对禁止修改】analyzer.js 文件内容（本卡只 add 不改）
- 【绝对禁止】用本卡改动其他文件

防翻车边界 Case：
- analyzer.js 若实际不存在（被误删）→ 停止，告知用户需要先恢复文件

⚠️【执行工兵严格指令】：你当前仅负责落地本文件的代码。你必须严格遵守架构师给出的数据结构和 Diff 指示，【严禁】私自修改任何未授权的字段名、参数顺序或函数签名。代码必须写全异常捕获与空值检查！

---

🛠️ **Card 1B: exporter.js 截图分辨率 + 视频按钮 SVG 修复**
构建优先级：P1
改动性质：既有重构（局部 Diff）
前置依赖卡片：Card 1A
可并行执行：是（与 1C/1D/1E 并行，独立文件）
单卡片代码量预估：~65 行
受影响已有文件：`public/js/modules/mindGalaxy/exporter.js` — `exportImage`（:40-79）、`startRecording`/`stopRecording`（:280-320 附近）
必须导入的模块/路径：无新增

核心功能 / 目标：修复截图选 1080p/2K/4K 出来都是当前 canvas 尺寸的 bug；修复视频录制按钮点完后 SVG 图标永久丢失

硬性接口契约 / 修改点：

1. **exportImage 分辨率生效**（exporter.js:40-79）
   现状：定义了 `const presets = { '1080p':{w:1920,h:1080}, '2K':{w:2560,h:1440}, '4K':{w:3840,h:2160}, 'mobile':{w:720,h:1280} }` 但函数体直接 `canvas = renderer.domElement; canvas.toBlob`，从未用 size。
   修改：保留原 renderer 状态，临时 setSize → 渲染一帧 → toBlob → 恢复原 size：
   ```js
   export function exportImage(renderer, resolution = '1080p') {
     const presets = { '1080p':{w:1920,h:1080}, '2K':{w:2560,h:1440}, '4K':{w:3840,h:2160}, 'mobile':{w:720,h:1280} };
     const size = presets[resolution] || presets['1080p'];
     const origW = renderer.domElement.width, origH = renderer.domElement.height;
     const origPR = renderer.getPixelRatio();
     try {
       renderer.setPixelRatio(1);
       renderer.setSize(size.w, size.h, false);
       // 触发一次渲染（调用方传入 render 回调或用全局 animate）
       if (typeof window.__mgRenderOnce === 'function') window.__mgRenderOnce();
       return new Promise(resolve => renderer.domElement.toBlob(blob => {
         renderer.setPixelRatio(origPR);
         renderer.setSize(origW, origH, false);
         resolve(blob);
       }, 'image/png'));
     } catch (e) {
       renderer.setPixelRatio(origPR);
       renderer.setSize(origW, origH, false);
       return null;
     }
   }
   ```
   并在 `index.js` animate 循环附近暴露 `window.__mgRenderOnce = () => composer.render();`（或在 Card 1C 处理，本卡 exporter 内消费）

2. **视频按钮 SVG 保留**（exporter.js:280-320 附近的 startRecording/stopRecording）
   现状（调研 F1-3）：`recordBtn.textContent = '停止'` 清空 SVG；停止后 `recordBtn.textContent = '视频'` 永久丢 SVG。
   修改：用 `recordBtn.dataset.recording = 'true'` 标记状态 + CSS 切换样式，不改 textContent；或者保存原 innerHTML 在录制开始时，停止时恢复：
   ```js
   let _origBtnHtml = null;
   function startRecording() {
     const btn = document.getElementById('btn-export-video');
     if (!btn) return;
     _origBtnHtml = btn.innerHTML;
     btn.classList.add('recording');
     // 不动 innerHTML，靠 CSS .recording 加红点
   }
   function stopRecording() {
     const btn = document.getElementById('btn-export-video');
     if (btn && _origBtnHtml) { btn.innerHTML = _origBtnHtml; _origBtnHtml = null; }
     btn?.classList.remove('recording');
   }
   ```

本卡片产出物被后续卡片消费情况：
- 产出 `window.__mgRenderOnce` 约定 → 被 Card 1C 在 animate 暴露（如不在本卡处理则 1C 处理）

验收清单：
- [输入] 选 4K 截图 → [预期] 输出 PNG 3840×2160 而非当前 canvas 尺寸
- [输入] 开始录制 → [预期] 按钮加红点样式，SVG 仍在
- [输入] 停止录制 → [预期] 按钮恢复原 SVG，无纯文字"视频"

🚫 禁区声明：
- 以下函数签名【绝对禁止修改】：`exportImage(renderer, resolution)`、`startRecording()`、`stopRecording()`
- 以下文件【绝对禁止改动】：`public/mind-galaxy.html`（不在本卡改 HTML，CSS 在 1C 配套或单独加）
- 新增依赖：无

防翻车边界 Case：
- toBlob 在 Safari 可能失败 → 返回 null 上层 toast 提示
- setSize(false) 不修改 canvas style 避免布局抖动 ✓
- _origBtnHtml 若 startRecording 被重复调用 → 第二次不覆盖 `_origBtnHtml = btn.innerHTML`（已含红点）→ 用 `if(!_origBtnHtml)` 守卫

⚠️【执行工兵严格指令】：你当前仅负责落地本文件的代码。你必须严格遵守架构师给出的数据结构和 Diff 指示，【严禁】私自修改任何未授权的字段名、参数顺序或函数签名。代码必须写全异常捕获与空值检查！

---

🛠️ **Card 1C: renderer.js bloom 调参 + 启用 vignette/grain**
构建优先级：P1
改动性质：既有重构（局部 Diff）
前置依赖卡片：Card 1A
可并行执行：是（与 1B/1D/1E 并行）
单卡片代码量预估：~45 行
受影响已有文件：`public/js/modules/mindGalaxy/renderer.js` — `initPostProcessing`（:77-137）、新增 animate 渲染钩子
必须导入的模块/路径：无新增

核心功能 / 目标：把 bloom threshold 从 0 调到 0.15 避免全屏泛白；启用 vignette + grain 两个 pass 提升胶片质感（哈勃写实风的暗角与噪点）；暴露 `window.__mgRenderOnce` 供 Card 1B 截图使用

硬性接口契约 / 修改点：

1. **bloom 参数调整**（renderer.js:84-89 调用方在 index.js:331）
   `index.js:331` `initPostProcessing(rs, { strength: 0.5, radius: 0.4, threshold: 0.0 })`
   改为：`initPostProcessing(rs, { strength: 0.7, radius: 0.5, threshold: 0.15 })`
   （注：index.js 改动归本卡，因为 initPostProcessing 的调用点在 index.js）

2. **vignettePass 默认启用**（renderer.js:109）
   原：`vignettePass.enabled = false;`
   改为：`vignettePass.enabled = true;` 且 uniforms.intensity.value = 0.25

3. **grainPass 默认启用**（renderer.js:119）
   原：`grainPass.enabled = false;`
   改为：`grainPass.enabled = true;` 且 uniforms.intensity.value = 0.04（轻微噪点）

4. **grain time uniform 驱动**（renderer.js animate 钩子，需在 index.js animate 中 tick）
   在 `initPostProcessing` 返回对象中追加 `grainPass` 引用，让 index.js animate 中 `grainPass.uniforms.time.value += delta`（index.js 改动归本卡）

5. **暴露 renderOnce**（index.js animate 附近）
   追加：`window.__mgRenderOnce = () => { if (composer) composer.render(); else rs.renderer.render(rs.scene, rs.camera); };`

本卡片产出物被后续卡片消费情况：
- 产出 `window.__mgRenderOnce` → 被 Card 1B exporter.js 截图消费

验收清单：
- [输入] 进入心智星系 → [预期] 星体发光柔和，整个画面不发白不发糊（threshold=0.15 生效）
- [输入] 观察画面边缘 → [预期] 有轻微暗角（vignette 启用）
- [输入] 观察细看 → [预期] 有轻微胶片噪点（grain 启用，不刺眼）

🚫 禁区声明：
- 以下参数【绝对禁止超出】：bloom strength≤0.8、vignette intensity≤0.3、grain intensity≤0.05（过强破坏可读性）
- rgbShift 与 dof【绝对禁止启用】（rgbShift 色偏刺眼，dof 性能差，保持 false）
- 以下函数签名【绝对禁止修改】：`initRenderer`、`initPostProcessing`
- 文件【绝对禁止改动】：无（本卡可改 renderer.js + index.js 两文件）

防翻车边界 Case：
- 老设备 bloom threshold=0.15 仍可能糊 → 提供 UI 设置面板可调（不在本卡）
- grain time uniform 不 tick → 噪点静态反而像贴图，必须 tick

⚠️【执行工兵严格指令】：你当前仅负责落地本文件的代码。你必须严格遵守架构师给出的数据结构和 Diff 指示，【严禁】私自修改任何未授权的字段名、参数顺序或函数签名。代码必须写全异常捕获与空值检查！

---

🛠️ **Card 1D: interaction.js 双击拾取过滤 + mousemove 性能优化**
构建优先级：P1
改动性质：既有重构（局部 Diff）
前置依赖卡片：Card 1A
可并行执行：是（与 1B/1C/1E 并行）
单卡片代码量预估：~55 行
受影响已有文件：`public/js/modules/mindGalaxy/interaction.js` — `onDoubleClick`（:114-129）、`onMouseMove`（:50-85）
必须导入的模块/路径：无新增

核心功能 / 目标：双击只拾取 clickable 天体，不击中轨道线/标签/粒子；mousemove 不再每帧 traverse 整个 scene，缓存 clickables

硬性接口契约 / 修改点：

1. **双击过滤 clickable**（interaction.js:122）
   原：`const hits = ray.intersectObjects(scene.children, true);`
   改为：
   ```js
   const clickables = [];
   scene.traverse(o => { if (o.userData?.clickable) clickables.push(o); });
   const hits = ray.intersectObjects(clickables, true);
   ```
   （注：raycaster 不支持 Points 递归，但 intersectObjects 第二参 true 已处理 children；clickables 是天体 mesh 组的根，其下子 mesh 通过 traverse 标记 clickable 由 celestialBodies 设置）

2. **mousemove 缓存 clickables**（interaction.js:50-85）
   现状：每次 mousemove 都 `scene.traverse` 收集 clickables。
   修改：模块级 `let _clickablesCache = null; let _cacheFrame = 0;`，mousemove 时若 `_clickablesCache && _cacheFrame < 30`（30 帧 TTL）复用，否则重建：
   ```js
   if (!_clickablesCache || _cacheFrame++ > 30) {
     _clickablesCache = [];
     scene.traverse(o => { if (o.userData?.clickable) _clickablesCache.push(o); });
     _cacheFrame = 0;
   }
   const hits = ray.intersectObjects(_clickablesCache, true);
   ```
   在 unmount 时 `_clickablesCache = null;`

3. **ESC 空格键 bug**（interaction.js:131-141）
   空格 preventDefault 但无暂停逻辑 → 删除空格监听（避免无功能副作用）

本卡片产出物被后续卡片消费情况：
- 无后续消费者（interaction 最终态）

验收清单：
- [输入] 双击轨道线/标签 sprite → [预期] 不误聚焦，拾取只命中天体
- [输入] 鼠标在画面上快速移动 → [预期] 30 帧内复用缓存，traverse 调用次数大幅下降（可用 console.count 验证）
- [输入] 按 ESC → [预期] 清选中
- [输入] 按空格 → [预期] 不再触发 preventDefault

🚫 禁区声明：
- 以下函数签名【绝对禁止修改】：`initInteraction`、`onMouseMove`、`onClick`、`onDoubleClick`、`focusOnBody`、`updateDetailPanel`、`updateInteraction`
- 以下文件【绝对禁止改动】：`public/mind-galaxy.html`、`index.js`、`celestialBodies.js`、`celestialBodies2.js`
- 新增依赖：无

防翻车边界 Case：
- 缓存 30 帧 TTL 内若天体动态增删 → 接受短暂滞后（访问场景无天体运行时增删）
- 仍可能受 Points 天体拾取阈值影响（raycaster.params.Points.threshold=0.3）→ 不在本卡调
- 双击若 clickables 为空 → hits=[] 走原逻辑

⚠️【执行工兵严格指令】：你当前仅负责落地本文件的代码。你必须严格遵守架构师给出的数据结构和 Diff 指示，【严禁】私自修改任何未授权的字段名、参数顺序或函数签名。代码必须写全异常捕获与空值检查！

---

🛠️ **Card 1E: textures.js 启用死代码 + celestialBodies 接入 + 哈勃星云色谱**
构建优先级：P1
改动性质：既有重构（局部 Diff）
前置依赖卡片：Card 1A
可并行执行：是（与 1B/1C/1D 并行）
单卡片代码量预估：~90 行
受影响已有文件：`public/js/modules/mindGalaxy/textures.js`、`celestialBodies.js`（nebula 工厂）、`celestialBodies2.js`（black_hole disk 优先用贴图）
必须导入的模块/路径：无新增

核心功能 / 目标：把 textures.js 中定义但未使用的 `generateNebulaCloud`/`generateBlackHoleDiskTexture` 接入天体工厂；增强 `generateStarSurfaceTexture` 为 4 层 fbm 模拟太阳米粒组织（哈勃写实风）；为 nebula 工厂接入哈勃鹰状星云色谱

硬性接口契约 / 修改点：

1. **textures.js 重命名 + 增强**（textures.js:54-90）
   - `generateNebulaTexture` → 重命名为 `generateNebulaTexture`（保持），增强为多层 fbm 云团（参考 cosmosTextures 0C 思路），接受 `emotionColors` 参数
   - `generateBlackHoleDiskTexture` 保持名，增强中心黑+橙紫环
   - 注意：textures.js 被 celestialBodies.js/celestialBodies2.js 通过 `import { generateGlowTexture, generateStarSurfaceTexture } from './textures.js'` 引用 —— 本卡新增 `generateNebulaTexture, generateBlackHoleDiskTexture` 到 import 列表

2. **celestialBodies.js nebula 工厂应用星云纹理**（celestialBodies.js:189-220 附近 createNebula）
   - 内层 shell 的 MeshBasicMaterial 追加 `map: generateNebulaTexture(emotionColors)`，emotionColors 从 nebula.userData.emotionMeta?.dominant_raw_emotions 映射哈勃色谱（joy=#FFD700/sadness=#4169E1/anger=#FF4500/fear=#9400D3/surprise=#00CED1/disgust=#7CFC00/trust=#FF69B4/anticipation=#FFA500）
   - 默认 emotionColors = ['#FF6B35','#F7931E','#FFD700']（哈勃鹰状星云橙红黄）

3. **celestialBodies2.js black_hole disk 优先贴图**（celestialBodies2.js 中的 black_hole 工厂，若与 celestialBodies.js:49-71 的 ShaderMaterial 共存）
   - 在 ShaderMaterial try/catch 失败的 fallback 路径用 `MeshBasicMaterial({ map: generateBlackHoleDiskTexture(), transparent: true, blending: AdditiveBlending })` 替代纯色 MeshBasicMaterial

4. **celestialBodies.js generateStarSurfaceTexture 增强**（textures.js:24-52）
   - 4 层 sin/cos 叠加（频率 1.3/2.7/5.1/9.7）模拟 fbm
   - 亮度映射改进：用 HSL 而非简单 r/g/b（保留暖色调但加入湍流细节）

本卡片产出物被后续卡片消费情况：
- 无后续消费者

验收清单：
- [输入] 加载含 nebula 天体的星系 → [预期] 星云呈橙红黄多团云团（哈勃鹰状星云风）
- [输入] ShaderMaterial 不支持的设备 → black_hole disk fallback 用贴图而非纯色
- [输入] giant_star/main_sequence → [预期] 表面有更细腻湍流纹理

🚫 禁区声明：
- 以下函数签名【绝对禁止修改】：`generateGlowTexture`、`generateStarSurfaceTexture`、`generateNebulaTexture`、`generateBlackHoleDiskTexture`、天体工厂函数 `createBlackHole/createGiantStar/...`
- 以下文件【绝对禁止改动】：`index.js`、`renderer.js`、`interaction.js`、`server/services/mindGalaxy/*`
- 新增依赖：无

防翻车边界 Case：
- generateNebulaTexture 返回 null → fallback 到原纯色 shell
- 哈勃色谱 emotionColors 映射若情绪名不在表 → 用默认橙红黄
- 4 层 fbm 在 128×128 canvas 上性能 OK（< 5ms）

⚠️【执行工兵严格指令】：你当前仅负责落地本文件的代码。你必须严格遵守架构师给出的数据结构和 Diff 指示，【严禁】私自修改任何未授权的字段名、参数顺序或函数签名。代码必须写全异常捕获与空值检查！

## 5. 影响分析

| 文件 | 改动类型 | 风险 | 存量数据兼容 |
|------|---------|------|-------------|
| `public/js/modules/cosmos.js` | 0A+0B+0D 3 张卡串行叠加 ≈320 行改动 | 中 — 单文件大改，需严格按叠加顺序 | 旧快照无 psychological_meta 时全部 `?.` 兜底 |
| `public/js/modules/cosmosTextures.js` | 0C 纯新增 ≈160 行 | 低 — 独立新文件 | 无 |
| `public/js/modules/mindGalaxy/analyzer.js` | 1A 仅 git add | 低 | 无 |
| `public/js/modules/mindGalaxy/exporter.js` | 1B ≈65 行 | 低 — 局部修改 | 无 |
| `public/js/modules/mindGalaxy/renderer.js` | 1C ≈45 行 | 低 — 参数调整 | 无 |
| `public/js/modules/mindGalaxy/index.js` | 1C 改 animate 钩子 + bloom 调参 ≈10 行 | 中 — animate 是核心循环 | 无 |
| `public/js/modules/mindGalaxy/interaction.js` | 1D ≈55 行 | 低 — 局部优化 | 无 |
| `public/js/modules/mindGalaxy/textures.js` | 1E ≈40 行 | 低 | 无 |
| `public/js/modules/mindGalaxy/celestialBodies.js` | 1E ≈30 行 | 低 — nebula 工厂追加 map | 旧 snapshot 无 emotionMeta 时用默认橙红黄 |
| `public/js/modules/mindGalaxy/celestialBodies2.js` | 1E ≈10 行 | 低 — black_hole fallback 路径 | 无 |

**未波及**：所有后端文件（server/*）、所有其他前端模块、index.html、mind-galaxy.html

## 6. 风险提示

1. **cosmos.js 3 张卡叠加顺序不可错** —— 0A 必须先（否则 0B/0D 在不可加载文件上改无意义）；0C 必须在 0D 前（0D import 0C 的导出）。执行者若乱序会导致 import 未定义或字段错配残留。
2. **bloom threshold=0.15 是经验值** —— 太低泛白，太高发光弱。mind-galaxy 当前 threshold=0 是已知问题，cosmos 用 0.15，mind-galaxy 也调到 0.15。
3. **哈勃写实风的色谱是橙红黄主调 + 蓝紫点缀** —— 执行者易自由发挥成蓝紫科幻风。Plan 已硬编码具体色值（#FF6B35/#F7931E/#FFD700/#4169E1/#9400D3），必须照用。
4. **后处理性能** —— EffectComposer 在低端 GPU 上可能掉帧。cosmos 用 try/catch 回退到 renderer.render，前端不强制 bloom。
5. **generateCosmos SSE 处理** —— 后端 `/cosmos/generate` 是流式端点（cosmosController.js:71-154），事件序列 status→chunk→result→done。执行者易只读 result 不处理 status 进度。Plan 已要求弹进度提示 DOM。
6. **窗口缩放** —— composer.setSize 必须在 onResize 同步调用，否则 bloom 分辨率与 canvas 不匹配会出现锯齿/泛光错位。
7. **unmount 清理** —— Card 0B 的 showEmptyState DOM、Card 0D 的 skybox、composer 都需在 unmountCosmos dispose，否则切回其他模块内存泄漏。每张卡的卡片要求都注明了 unmount 清理项。
8. **弱模型易把 generateStarSurfaceTexture 改成引入 simplex-noise** —— Plan 明文禁止第三方噪声库，全部用原生 canvas 2D + sin/cos fbm。

## 准出检查清单

- [x] 每张卡片包含前置依赖声明
- [x] 每张卡片包含禁区声明
- [x] 每张卡片包含 3-5 条验收条件（Card 1A 例外，纯 git 操作 2 条）
- [x] 每张卡片包含"本卡片产出物被后续卡片消费情况"
- [x] 每张卡片含具体代码或行号修改指示
- [x] 每张卡片改动量 ≤ 200 行（最大 0D 180 行）
- [x] 构建拓扑标注串行/并行
- [x] 数据契约总览用代码块（TypeScript interface）
- [x] 同文件多卡叠加标注顺序与锚点（cosmos.js 4 张卡）
- [x] 无"适当处理""合理优化"等模糊表述
- [x] 单卡不跨多文件（除 1C renderer.js+index.js 同一 animate 钩子改动，强耦合不可拆）
- [x] 数据契约精确到字段名和类型
- [x] 弱模型视角：每张卡都有具体色值、函数签名、行号、兜底条件，无歧义
