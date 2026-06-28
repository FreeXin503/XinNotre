---
name: task-complete
description: 完成当前子任务后自动执行三步收尾：git commit + 更新 plan 文档 + 更新 PROGRESS.md
---

## 职责

当任意子任务完成（编码、修复、测试、重构等），执行以下三步。

## 执行步骤

### 第一步：git commit

1. 识别本次任务改动了哪些文件
2. `git add` 仅 stage 本次任务相关的文件（不 stage 无关文件）
3. 写语义化英文 commit message，格式为 `类型: 简短描述`
   - 类型：`feat` / `fix` / `refactor` / `style` / `docs` / `chore`
   - 描述：不超过 80 字符，说清楚改了啥
   - body（可选）：如果有必要补充说明，用空行分隔
4. 执行 `git commit`

### 第二步：更新 plan 文档

1. 找到 `.opencode/plans/` 中与本次任务对应的计划文件
2. 将该计划文件中已完成的子任务标记为 `✅ done`
3. 可选：在备注中记录实际改动与计划的差异

### 第三步：更新 PROGRESS.md

1. 在 PROGRESS.md 中找到对应模块的行
2. 更新状态（`✅` / `🔄` / `❌`）
3. 追加一条记录，格式：
   ```markdown
   ### YYYY-MM-DD：完成了什么
   - **改动文件**：xxx.js, xxx.md
   - **关键决策**：为什么这么实现
   - **下一步**：下一个要做什么
   ```

## 何时调用

- 当用户说"做完了"或"提交"时
- 当用户使用 `/complete` 命令时
- 当 AI 判断当前子任务已达成验收标准时，主动问用户："任务完成，要不要跑 `/complete` 收尾？"
