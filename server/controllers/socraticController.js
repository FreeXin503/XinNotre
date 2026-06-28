import { success, fail, asyncHandler } from '../utils/response.js';
import { createSession, socraticStep } from '../services/mindGalaxy/socraticService.js';

export const startSocraticSession = asyncHandler(async (req, res) => {
  const { topic } = req.body;
  if (!topic || typeof topic !== 'string') {
    return fail(res, '缺少 topic 字段', 400);
  }
  const data = await createSession(req.user.id, topic);
  return success(res, data);
});

export const socraticStepHandler = asyncHandler(async (req, res) => {
  const { sessionId, userUtterance } = req.body;
  if (!sessionId || !userUtterance) {
    return fail(res, '缺少 sessionId 或 userUtterance', 400);
  }
  const data = await socraticStep({ sessionId, userId: req.user.id, userUtterance });
  return success(res, data);
});
