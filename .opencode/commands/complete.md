---
description: 完成当前子任务后自动执行三步收尾：git commit + 更新 plan + 更新 PROGRESS.md
---

## 任务收尾三步

### 当前 git 状态
!`git status --short`

### 最近变更文件统计
!`git diff --stat`

### 当前最新 plan 文件
!`dir /b .opencode\plans\*.md`

### 当前 PROGRESS.md 内容摘要
!`type PROGRESS.md | head -20`

---

请执行 `task-complete` 技能的三步收尾流程：

**第一步：git commit**
- 识别本次任务改动了哪些文件（参考上面的 git status）
- stage 相关文件，写语义化英文 commit message
- 执行 commit

**第二步：更新 plan 文档**
- 找到 `.opencode/plans/` 中对应的计划文件
- 将已完成的任务标记为 ✅ done

**第三步：更新 PROGRESS.md**
- 更新对应模块的状态
- 追加一条日期记录，写明：改动文件 / 关键决策 / 下一步

完成后告知用户结果。
