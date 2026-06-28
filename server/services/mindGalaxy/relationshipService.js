import crypto from 'crypto';
import { query } from '../../config/database.js';
import MindGalaxyRepository from '../../repositories/mindGalaxyRepository.js';

const repo = new MindGalaxyRepository();

async function getSharedSnapshot(snapshotId) {
  const snap = await repo.getSnapshotByIdPublic(snapshotId);
  return snap ? JSON.parse(snap.snapshot_json || '{}') : null;
}

function findBridgeNodes(aBodies, bBodies) {
  const aPersons = new Set((aBodies || []).filter(b => b.type === 'person').map(b => b.label));
  const bPersons = new Set((bBodies || []).filter(b => b.type === 'person').map(b => b.label));
  const common = [...aPersons].filter(p => bPersons.has(p));
  return common;
}

export async function inviteUser(inviterId, inviteeId) {
  if (inviterId === inviteeId) {
    throw Object.assign(new Error('不能与自己建立关系'), { statusCode: 400 });
  }

  const existing = await query(
    'SELECT id, status FROM relationship_invitations WHERE inviter_id = ? AND invitee_id = ?',
    [inviterId, inviteeId]
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    if (row.status === 'accepted') {
      throw Object.assign(new Error('邀请已接受'), { statusCode: 410 });
    }
    if (row.status === 'pending') {
      throw Object.assign(new Error('已有待处理的邀请'), { statusCode: 409 });
    }
    // revoked → re-invite: update
    const token = crypto.randomBytes(16).toString('base64url');
    await query(
      'UPDATE relationship_invitations SET status = ?, share_token = ?, accepted_at = NULL WHERE id = ?',
      ['pending', token, row.id]
    );
    return { invitationId: row.id, shareToken: token };
  }

  const token = crypto.randomBytes(16).toString('base64url');
  const result = await query(
    'INSERT INTO relationship_invitations (inviter_id, invitee_id, status, share_token) VALUES (?, ?, ?, ?)',
    [inviterId, inviteeId, 'pending', token]
  );

  return { invitationId: result.rows.insertId, shareToken: token };
}

export async function acceptInvitation(invitationId, userId) {
  const rows = await query(
    'SELECT id, inviter_id, invitee_id, status, share_token FROM relationship_invitations WHERE id = ?',
    [invitationId]
  );

  if (rows.rows.length === 0) {
    throw Object.assign(new Error('邀请不存在'), { statusCode: 404 });
  }

  const inv = rows.rows[0];

  if (inv.invitee_id !== userId) {
    throw Object.assign(new Error('无权操作此邀请'), { statusCode: 403 });
  }

  if (inv.status !== 'pending') {
    throw Object.assign(new Error('邀请已处理'), { statusCode: 410 });
  }

  await query(
    'UPDATE relationship_invitations SET status = ?, accepted_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['accepted', invitationId]
  );

  return { shareToken: inv.share_token, ok: true };
}

export async function revokeInvitation(invitationId, userId) {
  const rows = await query(
    'SELECT id, inviter_id FROM relationship_invitations WHERE id = ?',
    [invitationId]
  );

  if (rows.rows.length === 0) {
    throw Object.assign(new Error('邀请不存在'), { statusCode: 404 });
  }

  const inv = rows.rows[0];
  if (inv.inviter_id !== userId) {
    throw Object.assign(new Error('无权操作'), { statusCode: 403 });
  }

  await query(
    'UPDATE relationship_invitations SET status = ? WHERE id = ?',
    ['revoked', invitationId]
  );

  return { ok: true };
}

export async function listRelationships(userId) {
  const rows = await query(
    `SELECT r.id, r.status, r.share_token, r.inviter_id, r.invitee_id, r.created_at, r.accepted_at,
            u.username AS partner_name
     FROM relationship_invitations r
     JOIN users u ON u.id = CASE WHEN r.inviter_id = ? THEN r.invitee_id ELSE r.inviter_id END
     WHERE (r.inviter_id = ? OR r.invitee_id = ?) AND r.status IN ('pending','accepted')
     ORDER BY r.created_at DESC`,
    [userId, userId, userId]
  );

  return rows.rows.map(r => ({
    invitationId: r.id,
    partnerId: r.inviter_id === userId ? r.invitee_id : r.inviter_id,
    partnerName: r.partner_name,
    status: r.status,
    token: r.share_token,
    createdAt: r.created_at,
    acceptedAt: r.accepted_at
  }));
}

export async function getRelationshipGraph(token) {
  const rows = await query(
    'SELECT inviter_id, invitee_id FROM relationship_invitations WHERE share_token = ? AND status = ?',
    [token, 'accepted']
  );

  if (rows.rows.length === 0) {
    throw Object.assign(new Error('无效或已撤销的分享链接'), { statusCode: 410 });
  }

  const { inviter_id: inviterId, invitee_id: inviteeId } = rows.rows[0];

  const snapshotRows = await query(
    `SELECT user_id, snapshot_json FROM cosmos_snapshots
     WHERE user_id IN (?, ?) AND is_latest = TRUE
     ORDER BY created_at DESC`,
    [inviterId, inviteeId]
  );

  const snapshots = {};
  for (const row of snapshotRows.rows) {
    if (!snapshots[row.user_id]) {
      snapshots[row.user_id] = JSON.parse(row.snapshot_json || '{}');
    }
  }

  const aBodies = snapshots[inviterId]?.bodies || [];
  const bBodies = snapshots[inviteeId]?.bodies || [];
  const bridge = findBridgeNodes(aBodies, bBodies);

  const allBodyIds = new Set();
  const bodies = [];
  for (const b of [...aBodies, ...bBodies]) {
    if (b.id && !allBodyIds.has(b.id)) {
      allBodyIds.add(b.id);
      const isBridge = b.type === 'person' && bridge.includes(b.label);
      bodies.push({
        ...b,
        _userId: b._userId || (snapshots[inviterId]?.bodies?.find(x => x.id === b.id) ? inviterId : inviteeId),
        isBridge
      });
    }
  }

  return { cores: [inviterId, inviteeId], bridge, bodies };
}
