import keyRepository from '../repositories/keyRepository.js';
import { encrypt } from '../services/cryptoService.js';
import { getDecryptedKey, logUsage } from '../services/keyService.js';
import { success, fail, asyncHandler } from '../utils/response.js';

export const listKeys = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const keys = await keyRepository.findByUserId(userId);
  success(res, { keys });
});

export const setKey = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { provider, key } = req.body;
  if (!provider || !key) return fail(res, 'provider and key required', 400);

  const encrypted = encrypt(key);
  const keyHint = key.substring(0, 5) + '...' + key.substring(key.length - 3);

  await keyRepository.upsert(userId, provider, encrypted, keyHint);
  success(res, { key_hint: keyHint, message: 'Key saved' });
});

export const deleteKey = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { provider } = req.params;
  await keyRepository.delete(userId, provider);
  success(res, { message: 'Key deleted' });
});

export const getUsageStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const [daily, monthly] = await Promise.all([
    keyRepository.getDailyUsage(userId),
    keyRepository.getMonthlyUsage(userId)
  ]);
  success(res, { daily, monthly });
});
