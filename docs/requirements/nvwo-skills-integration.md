# 需求文档: nvwo 视角 Skills 蒸馏配置到项目

**冻结时间**: 2026-06-04

---

## 目标 (Goal)

将 `nvwo/.agents/skills/` 下的全部 24 个视角 Skills 蒸馏配置到 XinNote 项目中，使其既能在 IDE 中通过 Skill 工具调用，也能在前端 AI 对话面板中多选使用。

## 交付物 (Deliverable)

1. **IDE Skills 配置**: 将 24 个视角 Skills 复制到 `.trae/skills/` 目录，使其在 Trae IDE 中可通过 Skill 工具调用
2. **前端多模式对话增强**: 在现有"联席会诊模式"基础上，新增三种对话交互模式：
   - 群聊模式（已部分实现，需完善）
   - 多标签页模式（新增）
   - 轮流对话模式（新增）
3. **服务端 Skills 加载**: 更新 `skillController.js` 从 `.trae/skills/` 也加载 Skills

## 约束 (Constraints)

- 技术栈: Node.js 后端 + 原生 HTML/CSS/JS 前端
- 不破坏现有功能
- 不修改 nvwo 原始文件
- Xins-Software-Dev-All-Stars 中的同名 Skills 全部保留
- 全部 24 个视角 Skills 必须都迁移

## 验收标准 (Acceptance Criteria)

1. `.trae/skills/` 目录下存在全部 24 个视角 Skill 目录（含 SKILL.md 和 research 文件）
2. 前端 AI 对话面板支持三种对话模式切换（群聊/多标签页/轮流）
3. 视角选择器下拉列表包含全部 24+ 个视角
4. 多个视角同时选中后能正常对话
5. 服务端正常启动，`/api/skills` 接口返回包含所有视角的数据

## 非目标 (Non-Goals)

- 不修改 nvwo 原始 skills 文件内容
- 不修改 Skill 的 SKILL.md 内部逻辑
- 不涉及 CDN/部署相关变更

## 24 个迁入视角清单

| # | 目录名 | 中文名 |
|---|--------|--------|
| 1 | aristotle-perspective | 亚里士多德 |
| 2 | cai-lun-perspective | 蔡伦 |
| 3 | caizhixin-perspective | 蔡智鑫 |
| 4 | charles-darwin-perspective | 达尔文 |
| 5 | charles-munger-perspective | 查理·芒格 |
| 6 | chen-pingan-perspective | 陈平安 |
| 7 | confucius-perspective | 孔子 |
| 8 | einstein-perspective | 爱因斯坦 |
| 9 | elon-musk-perspective | 埃隆·马斯克 |
| 10 | galileo-perspective | 伽利略 |
| 11 | genghis-khan-perspective | 成吉思汗 |
| 12 | guiguzi-perspective | 鬼谷子 |
| 13 | gutenberg-perspective | 古腾堡 |
| 14 | hanfeizi-perspective | 韩非子 |
| 15 | huashu-nuwa | 女娲造人 |
| 16 | isaac-newton-perspective | 牛顿 |
| 17 | jeff-bezos-perspective | 杰夫·贝索斯 |
| 18 | laozi-perspective | 老子 |
| 19 | sakyamuni-perspective | 释迦牟尼 |
| 20 | steve-jobs-perspective | 史蒂夫·乔布斯 |
| 21 | warren-buffett-perspective | 沃伦·巴菲特 |
| 22 | xunzi-perspective | 荀子 |
| 23 | zhang-xiaolong-perspective | 张小龙 |
| 24 | zhuangzi-perspective | 庄子 |

## 开放问题

- 多标签页模式和轮流对话模式的具体 UI 设计细节待执行阶段确认