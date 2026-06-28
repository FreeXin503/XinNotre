import { success, fail, asyncHandler } from '../utils/response.js';
import { evolveDigitalTwin, chatWithPastSelf, listDigitalTwins } from '../services/mindGalaxy/digitalTwinService.js';

export const evolveDigitalTwinHandler = asyncHandler(async (req, res) => {
  const data = await evolveDigitalTwin(req.user.id);
  return success(res, data);
});

export const chatWithPastSelfHandler = asyncHandler(async (req, res) => {
  const { epoch, message } = req.body;
  if (!epoch || !message) return fail(res, '缺少 epoch 或 message', 400);
  const data = await chatWithPastSelf(req.user.id, epoch, message);
  return success(res, data);
});

export const listDigitalTwinsHandler = asyncHandler(async (req, res) => {
  const { limit } = req.query;
  const data = await listDigitalTwins(req.user.id, parseInt(limit) || 20);
  return success(res, { items: data });
});
