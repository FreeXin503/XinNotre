# Original User Request

## Initial Request — 2026-06-05T11:27:31+08:00

对 `preview.html` 笔记系统进行第一阶段的 Layout 布局重构，严格保持原有背景色主题并引入四维响应式骨架。

Working directory: e:/GzrjxyGzrjxyGzrjxyGzrjxy/Project documents for all departments/AInything/OPPO便签导出系统
Integrity mode: development

## Requirements

### R1. 保持背景色与核心色彩规范
- 必须完全沿用原项目 `preview.html` 中定义的 CSS 变量和背景色主题（暗色/亮色样式）。
- 只能改变布局结构、组件间距、圆角与折叠控制逻辑。

### R2. 四维响应式骨架
- **最左侧**：常驻一层 Icon 导航栏。
- **二级抽屉面板**：点击侧边栏的「知识库」或「专家团」时，向右无缝展开无边框的“二级侧边栏/抽屉面板”，展示对应的节点目录 or 专家列表。
- **中间区域**：主内容面板，呈现流式卡片容器。
- **右侧区域**：常驻 AI 深度对齐与多维思辨（Clarify & Refine）面板。

### R3. 微观视觉与间距
- 各个面板与大栏目之间保持 16px - 20px 的通透间距（Gap）。
- 整体圆角规范统一调整为现代 of 12px - 16px 弧度。

## Acceptance Criteria

### Layout 布局正确性 (Verified by Code Reviewer Agent)
- [ ] 页面在 100vh 高度下无多余全局滚动条，各面板独立滚动。
- [ ] 点击「知识库」或「专家团」可以平滑切换并展开二级抽屉面板，点击关闭按钮或空白处可以收起。
- [ ] 面板圆角均处于 12px 到 16px 之间，面板间的间隙保持在 16px 到 20px 之间。
- [ ] 主题切换（亮色/暗色）时背景色和核心色彩与重构前完全一致。
