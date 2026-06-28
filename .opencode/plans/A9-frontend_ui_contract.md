# A9 · frontend_ui_contract
> 文档化 uiPanels.js + interaction.js + exporter.js 的接口契约

## 需求摘要
梳理时间轴、tooltip、详情面板、导出接口，供 B1~B4, B8, C9, C25 引用。

## 构建拓扑图
```
[串行] A9 → B1, B2, B3, B4, B8, C9, C25
[并行] A9 ∥ A7 ∥ A8
```

## 数据契约总览

```typescript
interface TimeState {
  current: number;     // 0-1000
  max: number;         // 1000
  playing: boolean;
  speed: number;       // 0.25 | 0.5 | 1.0
}
```

## 函数签名

```javascript
// uiPanels.js
export const timeState: TimeState
export function initUI() → void
export function advanceTime(delta: number) → void
export function getNormalizedTime() → number
export function updateTimeDisplay() → void

// interaction.js
export function initInteraction(rs: RendererState) → void
export function disposeInteraction() → void
export function focusOnBody(targetPos, distance = 5) → void
export function updateInteraction(delta: number) → void
```

## 核心 ID 清单

```
#top-bar, #btn-play, #btn-view-full, #btn-orbits, #btn-labels, #btn-reset
#btn-screenshot, #btn-export-json
#left-panel, #btn-import-notes/kb/mixed, #diary-input, #btn-analyze, #btn-example
#analyzer-preview, #ap-keywords, #ap-emotions, #ap-char-count, #ap-warning
#import-status
#right-panel, #detail-close, #detail-empty, #detail-content
#bottom-panel, #time-slider, .tc-speed-btn, #tc-time-current, #tc-time-total
#loading-screen, #tooltip
```

## 时间轴关键逻辑

```javascript
advanceTime(delta): if (!playing) return; current += delta × speed × 100; if (current >= max) current = 0
getNormalizedTime(): return max > 0 ? min(1, current / max) : 0
```

## Raycaster hover/click/dblclick 流程

```javascript
// hover
onMouseMove: raycaster.intersectObjects(scene clickables) → emissive ×2 + tooltip show
resetHover: emissive 恢复 + tooltip hide

// click
onClick: 排除 UI panel 区域 → intersect → updateDetailPanel(userData) 或 panel.close

// dblclick
onDoubleClick: selectedObj? → focusOnBody(pos, dist) // giant_star=8, nebula=15, default=5

// camera tween
focusOnBody: start/end/targetStart/targetEnd/progress=0/duration=1.2 → controls disabled
updateInteraction: easeOutQuad lerp → progress≥1 → controls enabled
```

## 详情面板 HTML

```javascript
updateDetailPanel(data):
  if (!data): panel.collapsed
  else: innerHTML = `
    <h3>${name}</h3><span>${type}</span>
    meta.coreSelf? "自我强度/稳定性" : meta.belief? "信念层级/极性" : meta.theme? "重要度/趋势"
  `
```

## 实时分析预览（300ms 防抖）

```javascript
analyzePreview(text) → { charCount, warning, keywords, emotions }
// EMOTION_COLORS 在 uiPanels.js 内定义（20 色，与后端不完全一致）
```

## 验收清单
- [输入] initUI() → 所有按钮 listener 绑定成功
- [输入] advanceTime(0.016) playing=false → current 不变
- [输入] focusOnBody(pos, 8) → 1.2s 后 camera 靠近目标
- [输入] disposeInteraction() → 所有 listener 移除

## 影响分析
- interaction.js 被 B2/B3/B4/C17 修改
- uiPanels.js 被 B4/B8/C9/C25 修改
- exporter.js 被 C9/C10/C11 修改

## 风险提示
- timeState 是 export const，模块级共享——不要重定义
- updateDetailPanel innerHTML 存在 XSS——新增字段需转义
- EMOTION_COLORS 前后端两套色值不完全一致
