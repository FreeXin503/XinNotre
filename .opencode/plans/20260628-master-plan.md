# 心智星系 · 工程 Master Plan V2

> 本文档由 G.2 规划、人工审核。Orchestrator（DeepSeek Pro）加载本文档后按 DAG 分批 spawn 子 agent 执行。
> 每个 plan 的详细实现由 orchestrator 在 spawn 时根据契约 + 文件上下文锚点动态拼装。

---

## 〇、执行总览

- 目标：将「心智星系」需求文档（567 行）全部落地，补齐现有代码缺口。
- 现状：后端 v2 服务 8 个已 100% 实现；前端 10 天体渲染已就绪；主要缺口在交互、渲染增强、报告/导出、NLP 深化、编辑、远期扩展。
- 总 plan 数：**54 个**，分 **6 个 Phase**。
- 执行批次：**5 批核心 + 1 批远期**（远期可选跑）。
- 验收基线：每批结束跑 `node server/test/smoke.js` + lint（若可用）。
- 全部 plan 文件存放于 `.opencode/plans/`，命名规则 `YYYYMMDD-<功能简称>.md`。

---

## 一、依赖拓扑 DAG

```
Phase 0 (A1~A10) ──全并行──┐
                            │
       ┌────────────────────┼────────────────────┐
       ▼                    ▼                     ▼
 Phase 1 (B1~B8)     Phase 2 (C13~C28)      Phase 3 (C17~C22)
  [核心交互修复]       [NLP 深度增强]          [渲染增强]
       │                    │                     │
       └──────────┬─────────┴──────────┬──────────┘
                  ▼                     ▼
          Phase 4 (C23~C26+C9~C12)   Phase 5 (C29~C35)
           [报告+导出+分享]            [隐私+编辑+配置]
                       │                    │
                       └─────────┬──────────┘
                                 ▼
                        Phase 6 (D1~D10)
                          [远期扩展]
```

**关键串行链**（不可拆开）：
- B2 → B3, B4, B8（B2 产出的标签层被后续引用）
- B5 → B6, B7（B5 产出的 raycaster 被详情/聚焦依赖）
- B8 → C17（时间轴渲染就绪才能做演化插值）
- C13~C28 → C23（NLP 增强产出供报告图表消费）
- P3 渲染 → C10, C12（视频/H5 导出依赖渲染管线）
- C9 → C25（截图能力就绪才能做分享模板）

**可全并行簇**：
- A1~A10（10 个，纯文档，无代码依赖）
- C18, C19, C20, C21, C22（5 个渲染优化，改不同文件/函数）
- C29, C30, C31, C32, C33, C34, C35（7 个编辑/隐私功能，独立模块）
- D1~D10（远期，彼此独立）

---

## 二、分批执行表

| 批次 | Plan 列表 | 数量 | 触发条件 |
|------|----------|------|---------|
| **批0** | A1∥A2∥A3∥A4∥A5∥A6∥A7∥A8∥A9∥A10 | 10 | 直接跑 |
| **批1** | B1∥B2∥B5 ∥ C13∥C14∥C15∥C16∥C27∥C28 ∥ C18∥C19∥C20∥C21∥C22 ∥ C24∥C9∥C11 ∥ C29∥C30∥C31∥C32∥C33∥C34∥C35 | 23 | 批0完成 |
| **批2** | B3, B4, B6, B7, B8, C17, C10, C12, C23 | 9 | 批1完成 |
| **批3** | C25, C26 | 2 | 批2完成 |
| **批4** | D1~D10 | 10 | 批3完成（可选） |

**批1 是主战场**——23 个并行，但每个改动独立文件/函数，不会冲突。

---

## 三、Plan 详单

### Phase 0：代码契约梳理（A1~A10）

> 不写新代码，只产出契约文档到 `.opencode/plans/A1-xxx.md` 等。供后续 plan 引用。

### A1 · preprocess_contract
- **对象**：`server/services/mindGalaxy/preprocessService.js`
- **产出**：函数签名 + 输入/输出类型 + 脱敏规则表 + 分段规则
- **验收**：文档包含 `preprocess()` 完整签名、`isTemplateText()` 正则清单、`isPureSymbolOrEmoji()` 阈值、脱敏映射、分段算法描述
- **下游消费者**：C13~C16, C28, C29, C30, C32
- **并行**：是

### A2 · nlpBasic_contract
- **对象**：`server/services/mindGalaxy/nlpBasicService.js`
- **产出**：5 个分析函数签名 + TF-IDF/K-Means/情绪词典/实体识别/时间模式算法描述
- **验收**：函数清单：`tokenize`, `extractKeywords`, `clusterTopics`, `analyzeEmotion`, `extractEntities`, `analyzeTimePattern`, `detectEmotionShift`
- **下游消费者**：C13~C16, C27, C28
- **并行**：是

### A3 · nlpDeep_contract
- **对象**：`server/services/mindGalaxy/nlpDeepService.js`
- **产出**：4 个 LLM prompt 模板 + 响应 JSON schema + 降级机制
- **验收**：包含 `analyzeDeep()` 完整签名、信念层级结构、认知偏差 8 类、防御机制 8 类
- **下游消费者**：A4, A6
- **并行**：是

### A4 · mindGraph_contract
- **对象**：`server/services/mindGalaxy/mindGraphService.js`
- **产出**：7 类节点 + 5 类边的 TypeScript 类型定义 + 权重公式 + 中心性算法
- **验收**：包含 `MindGraph` interface、`buildMindGraph()` 签名、`saveGraph()` 签名
- **下游消费者**：A5, A8
- **并行**：是

### A5 · galaxyMapping_contract
- **对象**：`server/services/mindGalaxy/galaxyMappingService.js`
- **产出**：10 天体映射表 + 视觉参数表 + 对数螺旋公式 + 哈勃类型推断
- **验收**：包含 `GalaxySnapshot` interface、`mapToGalaxy()` 签名、情绪 20 色 Hex 表
- **下游消费者**：A8, C35
- **并行**：是

### A6 · report_export_config_contract
- **对象**：`reportService.js` + `exportService.js` + `configService.js`
- **产出**：报告 8 章结构 + 导出格式枚举 + 配置 CRUD 接口
- **验收**：包含 `ReportData` interface、`exportData()` 签名、`exportReportPDF()` 签名
- **下游消费者**：C23, C24, C26
- **并行**：是

### A7 · frontend_core_contract
- **对象**：`renderer.js` + `layout.js` + `index.js`
- **产出**：场景/相机/控制器/动画循环/后处理接口
- **验收**：包含 `initRenderer()` 返回结构、`spiralPosition()` 签名、`mountMindGalaxy()` 生命周期
- **下游消费者**：B1, B2, B8, C17, C18, C22
- **并行**：是

### A8 · celestialFactory_contract
- **对象**：`celestialBodies.js` + `celestialBodies2.js`
- **产出**：10 个工厂函数签名 + `visual` 参数结构 + `motion` 参数结构
- **验收**：`createBlackHole(body)` 等 10 个函数签名 + 返回 `{group, update, dispose}` 结构
- **下游消费者**：C19, C20, C21, C11
- **并行**：是

### A9 · frontend_ui_contract
- **对象**：`uiPanels.js` + `interaction.js` + `exporter.js`
- **产出**：时间轴、tooltip、详情面板、导出函数接口
- **验收**：`initUI()`, `initInteraction(rs)`, `initExporter(rs)` 签名 + `advanceTime()` / `getNormalizedTime()`
- **下游消费者**：B1~B4, B8, C9, C25
- **并行**：是

### A10 · cosmos_contract
- **对象**：`public/js/modules/cosmos.js` + `server/services/cosmosService.js`
- **产出**：心理→物理映射规则 + `mountCosmos()` 生命周期 + 5 类天体工厂签名
- **验收**：包含 `createBlackHole/Planet/Satellite/Nebula/LagrangeClump` 签名、`convertPsychologyToPhysics()` 关键映射
- **下游消费者**：B5, B6, B7
- **并行**：是

---

### Phase 1：核心交互修复（B1~B8）

### B1 · mg_orbit_lines
- **目标**：渲染行星轨道环线（`LineLoop` / `TubeGeometry`），支持按钮开关
- **改文件**：`renderer.js`（新增 `createOrbitLine()` 函数）, `index.js`（调用 + 按钮 binding）
- **依赖**：A7
- **验收**：
  1. 所有 `type=planet_system` 天体显示半透明轨道环
  2. 点击 `#btn-orbits` 切换显隐
  3. 无 planet 时不报错
- **禁区**：不改 OrbitControls 配置；不改 `buildGalaxy()` 主流程
- **并行**：是（批1）

### B2 · mg_css_labels
- **目标**：引入 `CSS2DRenderer`，为每个天体渲染名称标签
- **改文件**：`interaction.js`（新增 `LabelManager`）, `mind-galaxy.html`（引入 CSS2DRenderer CDN）
- **依赖**：A7
- **验收**：
  1. 每个天体上方显示名称
  2. `#btn-labels` 切换显隐
  3. 标签跟随天体漂移动画
  4. `unmountMindGalaxy()` 正确清理 CSS2DRenderer
- **禁区**：不改 `celestialBodies*.js`
- **并行**：是（批1）

### B3 · mg_view_presets
- **目标**：实现 5 种相机视角预设（全景/核心聚焦/侧视/上帝/第一人称 VR 预留）
- **改文件**：`interaction.js`（新增 `flyToPreset(name)`）, `uiPanels.js`（按钮绑定）
- **依赖**：B2（需复用标签位置计算）
- **验收**：
  1. 5 个按钮各自切换相机
  2. 切换是 easeOutQuad 平滑过渡（~1s）
  3. 第一人选视角显示"VR 模式预留"提示
- **并行**：否（批2，依赖 B2）

### B4 · mg_search_filter
- **目标**：搜索栏按关键词高亮天体；按类型/情绪筛选显隐
- **改文件**：`uiPanels.js`（搜索 UI）, `interaction.js`（高亮逻辑）
- **依赖**：B2
- **验收**：
  1. 输入关键词→匹配天体闪烁高亮 3 次
  2. 相机自动移至首个匹配
  3. 类型筛选下拉框（恒星/星云/人物/暗物质）切换后其他天体 `visible=false`
  4. 清空搜索恢复正常
- **并行**：否（批2）

### B5 · cosmos_raycaster
- **目标**：为 Cosmos 前端补上 Raycaster + 悬停高亮 + tooltip
- **改文件**：`public/js/modules/cosmos.js`（新增 `onMouseMove`, `tooltip` DOM）
- **依赖**：A10
- **验收**：
  1. 悬停天体→材质 `emissiveIntensity` ×2
  2. 显示 tooltip 跟随鼠标
  3. 移开后恢复
  4. `unmountCosmos()` 正确清理事件
- **禁区**：不改后端 cosmosService.js
- **并行**：是（批1）

### B6 · cosmos_click_detail
- **目标**：点击天体弹出右侧详情面板（天体名/类型/元数据）
- **改文件**：`cosmos.js` + `index.html`（新增 `#cosmos-detail-panel` DOM）
- **依赖**：B5
- **验收**：
  1. 点击天体→面板滑入
  2. 显示天体名、类型、`meta` 字段
  3. 点击空白或 Escape 关闭
- **并行**：否（批2）

### B7 · cosmos_dblclick_focus
- **目标**：双击天体相机平滑聚焦
- **改文件**：`cosmos.js`（`onDoubleClick` + `flyToBody()`）
- **依赖**：B5
- **验收**：
  1. 双击→相机移动到距天体 5 单位的视点
  2. 过渡 ~1s easeOutQuad
  3. 双击空白→恢复全景
- **并行**：否（批2）

### B8 · mg_evolution_timeline
- **目标**：连接 `/api/mind-galaxy/evolution` 后端，底部时间轴渲染快照切换
- **改文件**：`uiPanels.js`（时间轴数据加载）, `index.js`（快照替换 + 插值动画钩子）
- **依赖**：A7
- **验收**：
  1. 时间轴显示所有快照节点
  2. 拖动滑块→加载对应快照→重建场景
  3. 关键节点（哈勃类型变化时）在轴上高亮标记
  4. 网络失败→显示 toast + 保留当前场景
- **并行**：否（批2）

---

### Phase 2：NLP 深度增强（C13~C28）

### C13 · nlp_topic_evolution
- **目标**：按月/季/年时间窗口分别 K-Means 聚类，输出主题诞生/兴盛/衰退曲线
- **改文件**：`nlpBasicService.js`（新增 `clusterTopicsByWindow()`）
- **依赖**：A2
- **接口契约**：`clusterTopicsByWindow(segments, windowSize)` → `Array<{ window, topics: [{name, importance, trend, born|rising|stable|fading}] }>`
- **验收**：
  1. 输入 100 篇日记跨 3 个月→输出 3 个窗口的聚类
  2. 主题 trend 正确识别（后窗口重要性比前窗口高=rising）
  3. 窗口内日记 < 3 篇→返回降级 `trend: 'unknown'`
- **禁区**：不改现有 `clusterTopics()` 函数
- **并行**：是（批1）

### C14 · nlp_emotion_periodicity
- **目标**：检测情绪的周/月/季节周期性
- **改文件**：`nlpBasicService.js`（新增 `detectEmotionPeriodicity()`）
- **依赖**：A2
- **接口契约**：`detectEmotionPeriodicity(emotionSeries)` → `{ weekly: {period, confidence}, monthly, seasonal }`
- **验收**：
  1. 输入 90 天情绪序列→检测出周周期（周一焦虑/周日平静模式）
  2. 置信度 < 0.3 → `period: null`
  3. 数据 < 30 天→返回 `{ confidence: 'low' }`
- **并行**：是（批1）

### C15 · nlp_emotion_trigger_chain
- **目标**：分析"什么话题/事件→触发什么情绪"
- **改文件**：`nlpBasicService.js`（新增 `buildEmotionTriggerChain()`）
- **依赖**：A2
- **接口契约**：`buildEmotionTriggerChain(segments, topics)` → `Array<{ topic, emotion, strength, confidence }>`
- **验收**：
  1. 输入 100 段→输出 TOP 10 触发链
  2. strength = 共现频率 × 情感强度
  3. 无关联的 topic-emotion 对不输出
- **并行**：是（批1）

### C16 · nlp_relationship_network
- **目标**：人物共现网络 + 中介中心度 + 提及方式分析（直呼/昵称/代词）
- **改文件**：`nlpBasicService.js`（新增 `buildRelationshipNetwork()`）
- **依赖**：A2
- **接口契约**：`buildRelationshipNetwork(segments)` → `{ nodes: [{name, degree, betweenness, intimacy}], edges: [{a, b, cooccurrence, polarity}] }`
- **验收**：
  1. 输入包含"张三""李四"的 50 篇→输出共现边
  2. 中介中心度用简化算法（degree / totalNodes）
  3. intimacy = 频率 × 0.4 + 极性 × 0.3 + 亲密度方式分 × 0.3
- **并行**：是（批1）

### C27 · nlp_content_rhythm
- **目标**：时段-主题/情绪交叉分析（周一焦虑、周日反思）
- **改文件**：`nlpBasicService.js`（新增 `analyzeContentRhythm()`）
- **依赖**：A2
- **接口契约**：`analyzeContentRhythm(segments)` → `{ hourly: [...], weekday: [...], topPatterns: [...] }`
- **验收**：
  1. 输出 24 小时主题分布热力
  2. 输出 7 天情绪倾向
  3. 标记 top 3 模式（如"23 点偏焦虑"）
- **并行**：是（批1）

### C28 · nlp_multi_event_detection
- **目标**：综合情绪/主题/字数三维突变检测重大节点
- **改文件**：`nlpBasicService.js`（新增 `detectMajorEvents()`）
- **依赖**：C13, C14, C15（使用其输出）
- **接口契约**：`detectMajorEvents(segments, { emotionShifts, topicShifts })` → `Array<{ date, type: 'emotion'|'topic'|'wordcount'|'multi', severity, description }>`
- **验收**：
  1. 输入有情绪突降+主题切换的连续 5 段→输出 multi 类型事件
  2. severity ∈ [0,1]
  3. 同一日期多个类型合并为一条 multi
- **并行**：否（批2，依赖 C13~C15）

---

### Phase 3：渲染管线增强（C17~C22）

### C17 · mg_evolution_anim
- **目标**：快照间插值动画（恒星诞生 scale 0→1、变暗 emissive 渐变、超新星爆发 scale 暴涨、星云颜色过渡）
- **改文件**：`index.js`（新增 `transitionToSnapshot(nextSnap, durationMs)`）, `interaction.js`（动画钩子）
- **依赖**：B8
- **验收**：
  1. 切换快照时 0.8s 动画过渡
  2. 新增天体 spawnAnimation=birth → 从 scale=0 渐入
  3. 消失天体 → scale→0 后移除
  4. 星云颜色用 `THREE.Color.lerp` 过渡
  5. 动画中禁止用户操作（loading 状态）
- **禁区**：不改 `celestialBodies*.js` 工厂
- **并行**：否（批2）

### C18 · mg_cubemap_skybox
- **目标**：CubeMap 深空背景 + 银河光带
- **改文件**：`renderer.js`（新增 `createSkybox()`）, `index.js`（替换 `createStarfield`）
- **依赖**：A7
- **验收**：
  1. 场景背景显示 6 面 CubeMap（可程序生成或内置资源）
  2. 银河光带用半透明粒子带模拟
  3. 性能不下降（贴图尺寸 ≤ 1024）
  4. `unmount` 正确释放贴图
- **并行**：是（批1）

### C19 · mg_instanced_stardust
- **目标**：星尘层用 `InstancedMesh` 替换 `Points`（性能优化）
- **改文件**：`celestialBodies2.js`（重写 `createAsteroidBelt`）
- **依赖**：A8
- **验收**：
  1. 1000+ 粒子时帧率提升 ≥ 30%
  2. 外观与原 Points 版本相近
  3. 单天体粒子数 ≤ 1000，防止内存爆
- **并行**：是（批1）

### C20 · mg_custom_shaders
- **目标**：黑洞/中子星/超新星遗迹改用自定义 `ShaderMaterial`
- **改文件**：`celestialBodies.js`（黑洞部分）, `celestialBodies2.js`（中子星/超新星）
- **依赖**：A8
- **验收**：
  1. 黑洞吸积盘用 shader 实现旋转纹理
  2. 中子星脉冲用 shader uniform 控制
  3. 超新星遗迹用 shader 实现膨胀散射
  4. shader 在 WebGL1 失败时回退到标准 material
- **禁区**：不改工厂函数签名
- **并行**：是（批1）

### C21 · mg_volume_nebula
- **目标**：星云从 Points 改为体积雾 + 2D 精灵层组合
- **改文件**：`celestialBodies.js`（重写 `createNebula`）
- **依赖**：A8
- **验收**：
  1. 视觉上有体积感（半透明渐变球 + 内部粒子）
  2. 密度参数控制不透明度
  3. 范围参数控制球半径
  4. 旋转湍流速度受 `motionSpeed` 控制
- **并行**：是（批1）

### C22 · mg_postprocessing
- **目标**：景深/暗角/胶片颗粒/色差 4 个 EffectComposer pass
- **改文件**：`renderer.js`（扩展 `initPostProcessing()`）
- **依赖**：A7
- **验收**：
  1. 4 个 pass 可独立开关
  2. 强度参数在 UI 控制
  3. 帧率 ≥ 30fps（中端设备）
  4. 默认强度：景深弱、暗角弱、颗粒极弱、色差极弱
- **并行**：是（批1）

---

### Phase 4：报告、导出与分享（C23~C26 + C9~C12）

### C23 · report_chart_embed
- **目标**：报告 PDF 内嵌可视化图表（信念结构树/情绪饼图/关系星系图三张）
- **改文件**：`reportService.js`（生成图表描述）, `exportService.js`（PDFKit 绘图）
- **依赖**：A6, 批2 完成（需 NLP 数据完整）
- **验收**：
  1. PDF 第 2 章包含信念结构树图（节点+连线）
  2. 第 3 章包含情绪分布饼图
  3. 第 4 章包含关系网络图
  4. 降级方案：无数据→显示"样本不足"
- **并行**：否（批2）

### C24 · mg_data_import
- **目标**：JSON 数据导入恢复（备份还原）
- **改文件**：`server/controllers/mindGalaxyController.js`（新增 `importData`）, `server/routes/mindGalaxy.js`（注册端点）, 前端 `uiPanels.js`（导入按钮）
- **依赖**：A6
- **验收**：
  1. 导入 JSON→重建图谱+快照
  2. 同名快照覆盖（带 version 自增）
  3. 格式错误→返回 400 + 错误明细
  4. 文件 > 10MB→拒绝
- **并行**：是（批1）

### C9 · export_image
- **目标**：截屏导出为静态图片（1080p/2K/4K/手机壁纸尺寸）
- **改文件**：`exporter.js`（新增 `exportImage(resolution)`）
- **依赖**：A9
- **验收**：
  1. 4 个分辨率预设可选
  2. 手机壁纸尺寸（1080×1920）
  3. 用 `renderer.domElement.toBlob` + antialiasing 多采样
  4. 下载文件名为 `mind-galaxy-<timestamp>.png`
- **并行**：是（批1）

### C10 · export_video
- **目标**：录屏导出为视频（1080p 30fps / 4K 60fps，5-30s）
- **改文件**：`exporter.js`（新增 `exportVideo(duration, fps)`）, `index.js`（动画录制钩子）
- **依赖**：A9, C22（渲染管线就绪）
- **验收**：
  1. 录制 5/15/30s 三档
  2. 用 `MediaRecorder` + canvas.captureStream
  3. 输出 WebM（兼容性最好）
  4. 长视频进度条
- **并行**：否（批2）

### C11 · export_3dmodel
- **目标**：glTF/OBJ 格式导出
- **改文件**：`exporter.js`（新增 `exportGLTF()` / `exportOBJ()`）
- **依赖**：A8
- **验收**：
  1. 用 Three.js `GLTFExporter` 导出全场景
  2. OBJ 仅导出 mesh
  3. 文件正确含纹理坐标
- **并行**：是（批1）

### C25 · share_posters
- **目标**：4 种分享模板（星系海报/时间对比/信念星图/情绪光谱）
- **改文件**：`exporter.js`（新增 `renderShareTemplate(type)`）, `uiPanels.js`（模板选择 UI）
- **依赖**：C9
- **验收**：
  1. 海报：星系大图+类型+一句话解读
  2. 时间对比：两个时间点星系并排
  3. 信念星图：TOP 10 信念图
  4. 情绪光谱：情绪分布条形图
  5. 输出 1080×1080 PNG
- **并行**：否（批3）

### C12 · share_h5_page
- **目标**：独立 H5 可交互分享页
- **改文件**：新建 `public/mind-galaxy-share.html` + 新增 `server/controllers/shareController.js` + 路由
- **依赖**：C22（渲染就绪）
- **验收**：
  1. 访问 `/share/<token>` 加载只读星系
  2. 支持 OrbitControls 旋转/缩放
  3. token 30 天有效
  4. 无需登录
- **并行**：否（批2）

### C26 · report_click_source
- **目标**：报告结论点击跳转到星系位置 + 原始日记证据
- **改文件**：`mindGalaxyController.js`（扩展 report 接口加 `sourceRef`）, 前端 report 渲染器
- **依赖**：C23
- **验收**：
  1. 报告每条结论后附「定位到星系」+「查看日记」按钮
  2. 点击「定位」→打开 mind-galaxy.html?focus=<bodyId>
  3. 点击「查看」→弹出日记原文 modal
- **并行**：否（批3）

---

### Phase 5：隐私、编辑与配置（C29~C35）

### C29 · privacy_local_mode
- **目标**：本地分析模式开关（数据不上传）
- **改文件**：前端 `uiPanels.js`（开关 UI）, `server/config/index.js`（新增 `localMode` 字段）, `aiProviderService.js`（检查开关）
- **依赖**：A1
- **验收**：
  1. 开关在设置面板
  2. 开启后所有 LLM 调用走前端（基础分析）+ 不发送原始文本
  3. 深度分析在该模式禁用并提示
- **并行**：是（批1）

### C30 · privacy_after_delete
- **目标**：分析后自动删除原始文本，只保留分析结果
- **改文件**：`preprocessService.js`（新增 `purgeRawText(userId, sourceId)`）, `mindGalaxyController.js`（开关端点）
- **依赖**：A1
- **验收**：
  1. 开关端点 `POST /api/mind-galaxy/privacy/after-delete`
  2. 开启后每次 analyze 完成自动 `DELETE FROM data_sources WHERE user_id`
  3. 快照/图谱/向量库**保留**（只删原始文本）
- **并行**：是（批1）

### C31 · edit_star_rename
- **目标**：星体重命名 API + UI
- **改文件**：`mindGalaxyController.js`（新增 `renameBody`）, `mindGalaxyRepository.js`（更新 `body_name` 字段）, 前端 详情面板
- **依赖**：A7
- **验收**：
  1. 详情面板新增「重命名」按钮
  2. 改名后下次刷新保留
  3. 长度限制 20 字符
- **并行**：是（批1）

### C32 · edit_manual_classify
- **目标**：手动将便签归类到主题
- **改文件**：`mindGalaxyController.js`（新增 `classifyNoteToTopic`）, 前端分类 UI
- **依赖**：A1
- **验收**：
  1. 便签详情有「归类到主题」下拉
  2. 手动分类后下次生成星系使用新分类
  3. 系统自动分类 + 手动分类可共存（带 `manual: true` 标记）
- **并行**：是（批1）

### C33 · edit_hide_show
- **目标**：隐藏/显示星体过滤
- **改文件**：`uiPanels.js`（隐藏列表 UI）, `interaction.js`（`group.visible` 控制）
- **依赖**：A7
- **验收**：
  1. 详情面板新增「隐藏此星体」按钮
  2. 隐藏后存 localStorage
  3. 设置面板可查看隐藏列表并取消隐藏
- **并行**：是（批1）

### C34 · edit_person_manage
- **目标**：人物合并/标签/亲密度调整 UI
- **改文件**：`mindGalaxyController.js`（新增 `mergePersons`, `updatePersonIntimacy`）, 前端面板
- **依赖**：A2
- **验收**：
  1. 列表显示所有人物实体
  2. 选择两人→合并按钮
  3. 滑块调整亲密度
  4. 保存后影响下次星系生成
- **并行**：是（批1）

### C35 · mg_mapping_rules_ui
- **目标**：手动调整映射规则（什么对应什么天体/颜色方案/形态参数）
- **改文件**：`configService.js`（扩展配置 schema）, `uiPanels.js`（规则编辑器 UI）
- **依赖**：A5
- **验收**：
  1. 设置面板新增"映射规则"tab
  2. 可改：节点类型→天体类型映射、颜色方案、旋臂数/缠绕度
  3. 保存后下次生成星系生效
  4. 预设方案可一键恢复
- **并行**：是（批1）

---

### Phase 6：远期扩展（D1~D10，批4，可选）

| # | Plan 名 | 目标 | 关键改动 | 依赖 |
|---|---------|------|---------|------|
| D1 | `import_dayone` | DayOne JSON 导入 | 新增 `server/services/import/dayoneImport.js` + controller | 批3 |
| D2 | `import_notion` | Notion/Obsidian/印象笔记/飞书导入 | 新增 `import/notionImport.js` 等 + 统一 `Importer` 接口 | 批3 |
| D3 | `import_chatlog` | 微信导出 txt 导入 | 新增 `import/chatlogImport.js` | 批3 |
| D4 | `import_voice` | 语音转文字 + 情感 | 新增 `import/voiceImport.js` + Whisper API 接入 | 批3 |
| D5 | `multiplayer_relation` | 双人关系星系引力互动 | 新增 `mindGalaxy/relationshipService.js` | 批3 |
| D6 | `multiplayer_group` | 群体匿名聚合星系 | 新增 `aggregateService.js`（匿名化） | 批3 |
| D7 | `ai_galaxy_guide` | 自然语言星系向导 | 复用 `aiController.js` + 新增 `galaxyContextPrompt` | 批3 |
| D8 | `ai_socratic` | 苏格拉底引导探索 | 新增 `socraticService.js` + prompt 模板 | 批3 |
| D9 | `ai_belief_check` | 信念合理性检验 | 新增 `beliefCheckService.js` | 批3 |
| D10 | `digital_twin_evolve` | 持续演化数字心智 + 跨时空对话 | 新增 `digitalTwinService.js` + 定时合并快照 | 批3 |

**远期 plan 详细契约待 Phase 5 完成后单独规划**，本表仅列意图。

---

## 四、文件改动影响矩阵

| 文件 | 被影响 plan | 串行叠加顺序（按要求） |
|------|------------|--------------------|
| `nlpBasicService.js` | C13, C14, C15, C16, C27, C28 | C13→C14→C15→C16→C27→C28（同文件多卡片，执行时按此顺序叠加，每张卡片需带上前一张修改后的文件锚点） |
| `celestialBodies.js` | C20, C21 | C21→C20 |
| `renderer.js` | B1, C18, C22 | B1→C18→C22 |
| `interaction.js` | B2, B3, B4, C17 | B2→B3→B4→C17 |
| `uiPanels.js` | B4, B8, C9, C25, C29, C31, C33, C35 | 任意序，但 B4 改了搜索 UI 区，C29 改设置面板区，区域分离可按 plan 顺序依次 |
| `index.js` | B1, B8, C17, C18 | B1→B8→C17→C18 |
| `cosmos.js` | B5, B6, B7 | B5→B6→B7（同文件必须串行） |
| `exporter.js` | C9, C10, C11, C25 | C9→C11→C10→C25 |
| `mindGalaxyController.js` | C24, C26, C30, C31, C32, C34 | 各自新增独立端点，但同文件叠加串行：C24→C30→C31→C32→C34→C26 |

**重要**：同文件多卡片的叠加顺序必须严格按上表执行，每次新建子 agent 时在 prompt 内注入前一张卡片修改后的文件前 3 行 + 后 3 行作为锚点。

---

## 五、风险与防范

### 风险 1：nlpBasicService.js 多卡片叠加混乱
- **触发**：C13~C28 6 个 plan 改同一文件
- **影响**：后执行的卡片覆盖前面的修改
- **缓解**：批1 中 6 个卡片改 `nlpBasicService.js` 必须**串行**（即使其余并行）。orchestrator 在 spawn 时明确告知"建立在 C13 修改之后"
- **替代**：若担心叠加风险，改用**为每个新增函数新建独立文件**（e.g. `nlpBasicService.topicEvolution.js`），由 `nlpBasicService.js` import

### 风险 2：Three.js Shader 渲染失败回退
- **触发**：C20 自定义 shader 在低端 GPU 失败
- **缓解**：所有 shader 必须有 try/catch + 标准 material 回退路径；增加前置 `gl.getContext().getParameter(...)` 检测

### 风险 3：MediaRecorder API 浏览器兼容性
- **触发**：C10 视频导出在不支持 `canvas.captureStream` 的浏览器失败
- **缓解**：检测 `typeof MediaRecorder !== 'undefined'`，否则提示用户用 Chrome

### 风险 4：上下文膨胀
- **触发**：orchestrator 上下文随子 agent 返回累积
- **缓解**：每个子 agent 返回必须为「✅/❌ + 改了哪些文件 + 行数」；返回后调 `auto_compact`；每批结束保存进度到 `PROGRESS.md`

### 风险 5：Cosmos 和 Mind Galaxy 双前端架构割裂
- **触发**：Cosmos 和 Mind Galaxy 共享后端但前端各跑各的，新增功能要么做两遍要么遗漏一边
- **缓解**：本 Master Plan 中 Cosmos 只补交互（B5-B7）；Mind Galaxy 是主战场。远期 Cosmos 可改为内嵌嵌入 Mind Galaxy 子模式

---

## 六、orchestrator 执行协议（给 DeepSeek Pro）

### 入口指令模板（用户对 Pro 说）
> "请加载 .opencode/plans/20260628-master-plan.md，然后调用buildskill 开始执行。按 Phase 0→5 顺序分批 spawn 子 agent。每个子 agent 任务模板：`<plan 名 + 该 plan 完整契约段 + 涉及文件的当前代码锚点>`，要求子 agent 返回格式为 `✅/❌ + 修改文件清单 + 行数`。"

### 子 agent prompt 必须包含
1. plan 序号 + 名 + 目标
2. 改动文件清单 + 函数定位（行号或附近代码）
3. 数据契约（接口签名、类型定义）
4. 验收清单（3-5 条）
5. 禁区声明（不要改的字段/函数）
6. 防翻车边界Case
7. 末尾硬约束提示词（plan skill 模板中的工兵指令）

### Orchestrator 维护状态
- `PROGRESS.md`：每批结束追加 `{ batch, plan, status, files_changed, lines, errors }`
- 失败的 plan 重试 1 次；二次失败标记 `blocked` 等人工介入
- 每批开始前打印"批次 X 开始：plan 列表"
- 每批结束打印"批次 X 完成：成功 N 个，失败 M 个，跳过 K 个"

---

## 七、产出物清单（最终交付）

| 类型 | 位置 | 说明 |
|------|------|------|
| 契约文档 × 10 | `.opencode/plans/A1-*.md` ~ `A10-*.md` | 现有代码接口契约 |
| 实施 plan × 44 | `.opencode/plans/B1-*.md` ~ `D10-*.md` | 详细任务卡 |
| 进度记录 | `PROGRESS.md` | orchestrator 维护 |
| 后端新增 | `server/services/import/*.js` 等 | 远期扩展 |
| 前端新增 | `public/mind-galaxy-share.html`, `public/js/modules/mindGalaxy/*.js`（可能新增文件） | 渲染/导出/分享 |
| 文档 | `README.md`（更新模块清单） | 完成后同步 |

---

## 八、最终核验（deliverable）

完成全部 Phase 0~5 后执行：

1. `node serve-static.js` → 启动轻量模式，验证 mind-galaxy.html 加载正常
2. `node server/index.js` → 启动完整模式，跑 smoke test
3. 手动：打开 Cosmos 模块→悬停/点击/双击有反馈
4. 手动：打开 mind-galaxy.html→渲染流畅→各按钮可用
5. 手动：生成报告 → PDF 含三张图表
6. 手动：导出图片 → 4 个分辨率可选
7. 性能：首次加载 < 5s + 中端设备 ≥ 30fps（C29 应自动跑 benchmark）

---
