# 精准落实「心智星系」遗留需求实施计划

根据对《需求文档.md》与现有代码的对比分析，为彻底补齐缺失的业务闭环并提升系统表现，我将为您实施以下三大核心任务：

## User Review Required
> [!IMPORTANT]
> **资源开销预警**：引入 Three.js 的高级后处理（EffectComposer + 多种 Pass）会增加 GPU 开销，我们将在滤镜面板中提供全局的“性能模式”开关，默认在移动端关闭。
> 
> 请您评估：D5双人关系/D6多人星系 目前前端仅有 API 包装而无入口，我将在顶部工具栏增设「关系网络」按钮并弹出管理面板，此设计是否符合预期？

## 提出的改动

---

### 一、 D10 数字心智（跨时空对话）UI 闭环
后端已有 `/digital-twin/chat` 等接口，前端完全缺失入口。

#### [NEW] `public/js/modules/mindGalaxy/digitalTwin.js`
- 封装调用后端的聊天接口逻辑，维护聊天记录状态。
- 实现聊天气泡的 DOM 生成与自动滚动。
- 处理“演化 (Evolve)”孪生体的请求。

#### [MODIFY] `public/mind-galaxy.html`
- 在 `.top-controls` 工具栏追加“数字孪生”控制按钮。
- 新增 `#digital-twin-panel` 聊天浮窗（UI风格延续毛玻璃拟态），包含历史对话框、输入框及“进化”触发按键。

#### [MODIFY] `public/js/modules/mindGalaxy/uiPanels.js`
- 绑定“数字孪生”按钮点击事件，控制面板显示/隐藏。

---

### 二、 D5/D6 社交化多人星系 UI 闭环
后端关系邀请、合并图谱计算逻辑已就绪。

#### [MODIFY] `public/mind-galaxy.html`
- 增设“社交关系”按钮及弹窗面板 `#social-panel`。
- 面板包含两个 Tab：「双人引力（发送邀请码/接受邀请）」和「群体星系（输入提取码聚合）」。

#### [MODIFY] `public/js/modules/mindGalaxy/relationship.js` / `aggregator.js`
- 补充前端 API 调用的 UI 反馈（防抖、加载态展示、成功提示并重新加载星系场景）。

---

### 三、 高级后处理滤镜 UI 与渲染引擎升级
落实需求文档 7.2 节的“科幻大片级”视觉可调性。

#### [MODIFY] `public/js/modules/mindGalaxy/renderer.js`
- 引入 Three.js 的 `EffectComposer` 替换原生的渲染管线。
- 增加 `UnrealBloomPass` (辉光，原本已有但可精细调参)。
- 增加 `BokehPass` (景深 DoF)。
- 增加 `ShaderPass` 用于实现 Vignette (暗角) 和 Film Grain (胶片颗粒) / 色散。

#### [MODIFY] `public/mind-galaxy.html`
- 在已有设置面板（或新建滤镜面板）中，增加以上 4 种效果的滑块（Slider）和独立开关。

#### [MODIFY] `public/js/modules/mindGalaxy/uiPanels.js`
- 绑定滤镜面板滑块事件，实时通知 `renderer.js` 更新 Uniform 变量，做到所见即所得。

## 验证方案

### 本地前端验证
- 手动点击工具栏“数字孪生”，开启与大模型的对话，确保上下文拼接正常且 UI 显示无误。
- 调整“景深”、“胶片颗粒”拉条，检查 3D 渲染画面帧率及视觉变化是否平滑。
- 通过 Mock 生成假的关系邀请码，在社交面板尝试接受，观察星系数据重载及 UI 提示。
