# XinNote 前端视觉升级 — 执行计划

> 关联需求: [frontend-visual-upgrade.md](../requirements/frontend-visual-upgrade.md) | 复杂度: L | 日期: 2026-06-04

---

## 任务评级: L

多步骤、串行执行。涉及 2 个文件修改 + 1 个新文件。纯 CSS 和 HTML 微调，无 JS 逻辑变更。

---

## 波次结构

### Wave 1: CSS 深邃主题底层 (style.css)

**文件**: `public/css/style.css`

| 步骤 | 改动 | 描述 |
|------|------|------|
| 1.1 | CSS 变量重构 | 暗色变量升级：`--bg-base: #08080c` 径向渐变基色、`--bg-deeper: #050508`、新增 `--glass-bg`, `--glass-border` 等玻璃拟态变量 |
| 1.2 | body 背景 | `background: radial-gradient(ellipse at 50% 0%, #0f0f18 0%, #08080c 60%, #040408 100%)` |
| 1.3 | 玻璃拟态面板 | sidebar/notes-panel/reader-panel 改为 `backdrop-filter: blur(20px)` + 半透明背景 |
| 1.4 | 边框发光 | `--border-color` 改为带 alpha 的微弱发光色，border 从 `1px solid` 改为 `1px solid rgba(255,255,255,0.06)` |
| 1.5 | 明亮主题同步 | `body.light-theme` 变量同步更新为清爽版本 |

### Wave 2: 间距与布局优化 (style.css + index.html)

| 步骤 | 改动 | 文件 |
|------|------|------|
| 2.1 | 面板宽度缩小 | sidebar: 280→260px, notes-panel: 340→310px | style.css |
| 2.2 | Header 增高 | 60→64px, padding 28→32px | style.css |
| 2.3 | 便签卡片间距 | gap 6→10px, padding 16→20px | style.css |
| 2.4 | 分类列表间距 | category-item padding 12→14px, margin-bottom 4→6px | style.css |
| 2.5 | 阅读区调整 | max-width 820→780px, line-height 1.85→1.9, padding 36→48px | style.css |
| 2.6 | 统计卡 3→2 列 | stats-grid: `grid-template-columns: repeat(2, 1fr)` | style.css |
| 2.7 | 全局 gap/padding | main 面板之间的 gap、通用组件 padding 增大 20-30% | style.css |

### Wave 3: 动画与动效系统 (新建 animations.css)

| 步骤 | 改动 | 描述 |
|------|------|------|
| 3.1 | 创建 `public/css/animations.css` | 独立动效样式文件 |
| 3.2 | 卡片 glow hover | note-card hover: `box-shadow: 0 0 20px rgba(138,180,248,0.08), inset 0 0 0 1px rgba(138,180,248,0.1)` |
| 3.3 | 按钮反馈 | button click: `transform: scale(0.96); transition: transform 0.1s` |
| 3.4 | 选中脉冲 | note-card.active: `animation: subtlePulse 3s infinite` |
| 3.5 | 页面入场 | main 区域 `animation: fadeSlideIn 0.5s ease` |
| 3.6 | 平滑过渡 | 统一 transition 时间 `var(--transition-speed)` 变量 |
| 3.7 | 在 index.html 引入 | `<link rel="stylesheet" href="css/animations.css">` |

### Wave 4: HTML 结构微调 (index.html)

| 步骤 | 改动 | 描述 |
|------|------|------|
| 4.1 | 引入 animations.css | 在 style.css 之后加一行 link |
| 4.2 | 移除内联样式 | 将部分内联 style 属性移到 CSS 类中（可选，不影响功能） |

---

## 验证命令

| 步骤 | 验证方式 |
|------|---------|
| 全部完成后 | 启动 `node server/index.js`，浏览器打开 `http://localhost:3000`，目视检查 4 个 AC |
| 暗色/亮色 | 点击主题切换按钮，确认双主题正常 |
| 响应式 | 缩放浏览器窗口确认布局不崩 |
| 功能 | 点击便签、发 AI 消息、切换分类，确认无 JS 报错 |

---

## 交付验收计划

- 开发者目视验证 4 个验收标准
- 截图对比（可选）
- 用户最终在浏览器中确认视觉效果

## 回滚策略

- 所有改动集中在 CSS 文件和 `index.html` 第 1 行 `<link>` 引用
- 如需回滚：`git checkout -- public/css/style.css public/index.html` 并删除 `public/css/animations.css`

## 清理预期

- 删除 `docs/plans/` 下的本计划文件
- 保留 `docs/requirements/frontend-visual-upgrade.md` 作为变更记录
- 删除 `public/css/animations.css`（如有必要）
- 无临时文件需要清理