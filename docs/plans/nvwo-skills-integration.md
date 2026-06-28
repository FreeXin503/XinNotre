# 执行计划: nvwo 视角 Skills 蒸馏配置

**冻结时间**: 2026-06-04
**任务复杂度**: L (多步)

---

## 波次 1: Skills 文件迁移（纯文件操作，无依赖）

### 步骤 1.1: 复制 24 个视角 Skills 到 .trae/skills/

- 从 `nvwo/.agents/skills/<skill-name>/` 复制到 `.trae/skills/<skill-name>/`
- 仅复制 SKILL.md 和 references/ 目录（排除 .backup/, ai_tasks/, staging/, assets/ 等运行时产物）
- 验证: `ls .trae/skills/` 确认 24 个目录存在

### 步骤 1.2: 更新 skillController.js 加载 .trae/skills/

- 在 `getSkills` 函数中新增加载 `.trae/skills/` 路径
- 验证: 重启服务端，`curl /api/skills` 返回包含所有视角

---

## 波次 2: 前端多模式对话增强（依赖波次 1 完成）

### 步骤 2.1: 新增对话模式切换 UI

- 在 multi-agent-bar 中新增模式切换按钮组（群聊/标签页/轮流）
- 在 app.js 中新增模式状态管理
- 验证: 浏览器中模式切换按钮正常显示和切换

### 步骤 2.2: 实现多标签页模式

- 当选中多个视角时，每个视角独立显示一个可切换的标签页
- 每个标签页维护独立的对话历史
- 验证: 选中 3 个视角，每个标签页独立对话

### 步骤 2.3: 实现轮流对话模式

- 选中多个视角后，按顺序逐一轮流提问
- 视角 A 回答完，自动切换到视角 B
- 验证: 选中 3 个视角，轮流对话流程正常

---

## 波次 3: 验证与清理

### 步骤 3.1: 端到端验证

- 验证: 服务端启动正常，视角列表完整
- 验证: 前端三种模式均可正常对话

### 步骤 3.2: 清理

- 清理临时文件
- 输出交付验收报告

---

## 回滚策略

- Skills 迁移是纯新增文件，可直接删除 `.trae/skills/` 下新增目录回滚
- skillController.js 修改可 git revert
- 前端修改可 git revert

## 验证命令

```bash
# 验证 .trae/skills/ 目录
ls .trae/skills/ | wc -l

# 验证服务端
curl -s http://localhost:3000/api/skills | jq '.skills | length'
```