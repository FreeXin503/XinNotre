import { tool } from "@opencode-ai/plugin";

export const AutoCompactPlugin = async ({ client }) => {
  return {
    tool: {
      auto_compact: tool({
        description:
          "触发当前会话的上下文压缩，释放 token 空间。当对话较长或感觉上下文使用率接近 70% 时主动调用。",
        args: {
          reason: tool.schema
            .string()
            .optional()
            .describe("触发压缩的原因，用于记录"),
        },
        async execute(args, context) {
          const { sessionID } = context;
          if (!sessionID) return "错误：无法获取当前会话 ID";

          try {
            await client.session.summarize({ path: { id: sessionID } });
            return args.reason
              ? `已触发自动上下文压缩（${args.reason}）`
              : "已触发自动上下文压缩";
          } catch (e) {
            const msg =
              e && typeof e === "object" && "message" in e
                ? e.message
                : String(e);
            return `压缩失败：${msg}`;
          }
        },
      }),
    },
    "experimental.session.compacting": async (input, output) => {
      output.context.push(`## 项目进度上下文（注入于压缩时）

当前最新 PROGRESS.md 记录了所有模块的完成状态和剩余工作。
最新计划文件位于 .opencode/plans/ 目录。

新会话启动后应：
1. 读取 .opencode/AGENTS.md 了解项目全貌和编码规范
2. 读取 PROGRESS.md 确认当前进度
3. 读取 .opencode/plans/ 中最新的计划文件了解下一步要做什么
4. 运行 git log --oneline -5 确认最新提交`);
    },
  };
};
