import { success, fail, asyncHandler } from '../utils/response.js';
import MindGalaxyRepository from '../repositories/mindGalaxyRepository.js';
import { query } from '../config/database.js';

const repo = new MindGalaxyRepository();

export const createShareToken = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const snapshot = await repo.getLatestSnapshot(userId);
  if (!snapshot) return fail(res, '暂无星系快照', 404);

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await query(
    'INSERT INTO share_tokens (user_id, snapshot_id, token, expires_at) VALUES (?, ?, ?, ?)',
    [userId, snapshot.id, token, expiresAt]
  );

  return success(res, { token, expiresAt, url: `/share/${token}` });
});

export const getSharedSnapshot = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { rows } = await query(
    'SELECT snapshot_id, expires_at FROM share_tokens WHERE token = ?',
    [token]
  );
  if (!rows.length) return fail(res, '无效的分享链接', 404);

  const row = rows[0];
  if (new Date(row.expires_at) < new Date()) {
    await query('DELETE FROM share_tokens WHERE token = ?', [token]);
    return fail(res, '分享链接已过期', 410);
  }

  const snapshot = await repo.getSnapshotById(row.snapshot_id);
  if (!snapshot) return fail(res, '快照数据不存在', 404);

  const json = typeof snapshot.snapshot_json === 'string'
    ? JSON.parse(snapshot.snapshot_json) : snapshot.snapshot_json;

  return success(res, { snapshot: json });
});

function generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
