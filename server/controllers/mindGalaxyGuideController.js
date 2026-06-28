import { success, fail, asyncHandler } from '../utils/response.js';
import { setupSSE, sendSSE } from '../utils/sse.js';
import { guideStream } from '../services/mindGalaxy/galaxyGuideService.js';

export const aiGuideStream = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { question } = req.body || {};

  setupSSE(res);
  let aborted = false;
  req.on('close', () => { aborted = true; });

  if (!question || typeof question !== 'string') {
    sendSSE(res, 'error', { error: '缺少 question 字段' });
    return res.end();
  }

  if (question.length > 500) {
    sendSSE(res, 'error', { error: '问题不能超过 500 字' });
    return res.end();
  }

  try {
    const trimmed = question.trim();
    const cmdMatch = trimmed.match(/^\/(\w+)\s*(.*)/);
    if (cmdMatch) {
      const [, cmd, arg] = cmdMatch;
      handleCommand(cmd, arg, res);
      sendSSE(res, 'done', {});
      return res.end();
    }

    await guideStream(userId, trimmed, {
      signal: AbortSignal.timeout(60000),
      onText: (text) => {
        if (aborted) return;
        sendSSE(res, 'text', { text });
      },
      onAction: (action) => {
        if (aborted) return;
        sendSSE(res, 'action', action);
      }
    });

    if (aborted) return;
    sendSSE(res, 'done', {});
  } catch (err) {
    if (aborted) return;
    const statusCode = err.statusCode || 500;
    const message = statusCode === 500 ? 'AI 向导服务不可用' : err.message;
    sendSSE(res, 'error', { error: message });
  }

  res.end();
});

function handleCommand(cmd, arg, res) {
  switch (cmd) {
    case 'focus':
      if (arg) sendSSE(res, 'action', { bodyId: arg.trim(), action: 'focus', params: {} });
      break;
    case 'highlight':
      if (arg) sendSSE(res, 'action', { bodyId: arg.trim(), action: 'highlight', params: {} });
      break;
    default:
      sendSSE(res, 'text', { text: `未知命令 /${cmd}。支持：/focus <bodyId>, /highlight <bodyId>` });
  }
}
