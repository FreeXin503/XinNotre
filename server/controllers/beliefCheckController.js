import { success, fail, asyncHandler } from '../utils/response.js';
import { checkBelief, getBeliefHistory } from '../services/mindGalaxy/beliefCheckService.js';

export const checkBeliefHandler = asyncHandler(async (req, res) => {
  const { beliefText } = req.body;
  if (!beliefText) return fail(res, '缺少 beliefText', 400);
  const data = await checkBelief(req.user.id, beliefText);
  return success(res, data);
});

export const getBeliefHistoryHandler = asyncHandler(async (req, res) => {
  const { limit } = req.query;
  const data = await getBeliefHistory(req.user.id, parseInt(limit) || 20);
  return success(res, { items: data });
});
