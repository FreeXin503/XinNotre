# 20260627 - 修复黑洞天体 core 变量未定义

## 1. 需求摘要

修复 `celestialBodies.js` 中 `createBlackHole` 函数的 `ReferenceError: core is not defined` 错误。根因：第 51 行的 `new T.Mesh(coreGeo, coreMat)` 直接传入 `group.add()` 而未赋给变量，导致闭包内第 67 行 `core.rotation.y` 引用失败。

## 2. 构建拓扑图

```
[串行] 卡片 1（唯一卡片，无依赖）
```

## 3. 数据契约总览

本次为纯 Bug 修复，不涉及跨文件数据结构变更。

## 4. 任务卡片列表

---

🛠️ [1] 任务卡片：`public/js/modules/mindGalaxy/celestialBodies.js`
构建优先级：P0 - 底层依赖（Three.js 天体工厂）
改动性质：局部 Diff 修复
前置依赖卡片：无
可并行执行：否
单卡片代码量预估：3 行（仅修改一行）
受影响已有文件：无其他文件受影响
必须导入的模块/路径：无新增
核心功能 / 目标：修复 `createBlackHole` 函数中 `core` 变量未声明导致的 `ReferenceError`

硬性接口契约 / 修改点：

**文件：** `public/js/modules/mindGalaxy/celestialBodies.js`

**当前代码（第 49-51 行）：**

```js
  const coreGeo = new T.SphereGeometry(r * 0.3, 64, 64);
  const coreMat = new T.MeshBasicMaterial({ color: 0x000000 });
  group.add(new T.Mesh(coreGeo, coreMat));
```

**替换为：**

```js
  const coreGeo = new T.SphereGeometry(r * 0.3, 64, 64);
  const coreMat = new T.MeshBasicMaterial({ color: 0x000000 });
  const core = new T.Mesh(coreGeo, coreMat);
  group.add(core);
```

**修改说明：** 仅将第 51 行的 `group.add(new T.Mesh(coreGeo, coreMat))` 拆为两行——先声明 `const core = new T.Mesh(coreGeo, coreMat)`，再 `group.add(core)`。`disk` 变量（第 56 行）已是正确模式，本修改与之保持一致。

本卡片产出物被后续卡片消费情况：无后续消费者

验收清单（弱模型判定完成的标准）：
1. 页面加载后不再抛出 `Uncaught ReferenceError: core is not defined`
2. 黑洞天体（black_hole 类型）的吸积盘持续旋转（`disk.rotation.z` 正常更新）
3. 黑洞核心球体能正常旋转（`core.rotation.y` 正常更新）
4. 其他天体类型（star, planet, nebula 等）的渲染与动画不受影响

🚫 禁区声明：
以下函数/变量/接口【绝对禁止修改】：`createStar`, `createPlanet`, `createNebula`, `createGalaxy`, `createGlow`, `createLabel`, `hexToColor`, `disposeObj`, `createOrbitRing` 等文件中其他所有函数
以下文件【绝对禁止改动】：`public/js/modules/mindGalaxy/index.js`, `public/js/modules/mindGalaxy/celestialBodies2.js`
以下字段名【绝对禁止重命名】：`disk`, `coreGeo`, `coreMat`, `update`, `dispose`, `group`, `userData`
以下新增依赖【绝对禁止引入】：无

防翻车边界 Case（必写）：
- 必须确保 `core` 变量类型为 `THREE.Mesh`，支持 `.rotation.y` 属性
- 必须确保 `core` 在 `group.add(core)` 之后依然可访问（闭包引用正常）
- 不得改变 `group.add()` 的添加顺序

参考依赖 Context：
项目中同文件内第 54-58 行的 `disk` 变量即为正确声明模式，可参考：
```js
  const diskGeo = new T.TorusGeometry(r * 0.8, r * 0.15, 32, 64);
  const diskMat = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: T.DoubleSide });
  const disk = new T.Mesh(diskGeo, diskMat);
  disk.rotation.x = Math.PI / 2;
  group.add(disk);
```

⚠️【执行模型硬约束】：
「【执行工兵严格指令】：你当前仅负责落地本文件的代码。你必须严格遵守架构师给出的数据结构和 Diff 指示，【严禁】私自修改任何未授权的字段名、参数顺序或函数签名。代码必须写全异常捕获与空值检查！」

---

## 5. 影响分析

| 受影响文件 | 影响类型 | 说明 |
|-----------|---------|------|
| `public/js/modules/mindGalaxy/celestialBodies.js` | 局部修改 | 第 49-51 行，3 行变更 |
| 其他文件 | 无影响 | 错误本身已阻止后续动画循环，修复后所有功能自动恢复 |

无存量数据兼容问题。

## 6. 风险提示

1. **最大风险：执行者误改其他函数** — `celestialBodies.js` 文件包含 200 行代码，多个天体工厂函数。执行者必须严格定位到第 49-51 行的 `createBlackHole` 函数，不触碰其他任何代码。
2. **预防措施：** 使用精确的 `oldString` / `newString` 匹配替换，确保只命中目标位置。`celestialBodies2.js` 文件虽名称相似但与此 Bug 无关，禁止修改。
