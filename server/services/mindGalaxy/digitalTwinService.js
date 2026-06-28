import { query } from '../../config/database.js';
import { config } from '../../config/index.js';
import { preprocess } from './preprocessService.js';
import { analyzeBasic } from './nlpBasicService.js';
import { analyzeDeep } from './nlpDeepService.js';
import { callAi } from '../aiProviderService.js';
import MindGalaxyRepository from '../../repositories/mindGalaxyRepository.js';

const repo = new MindGalaxyRepository();

function getCurrentEpoch() {
  const now = new Date();
  const day = now.getUTCDay() || 7;
  const diff = now.getUTCDate() - day + 1;
  const monday = new Date(now);
  monday.setUTCDate(diff);
  monday.setUTCHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { epoch: monday, epochEnd: sunday };
}

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

export async function evolveDigitalTwin(userId) {
  const { epoch, epochEnd } = getCurrentEpoch();
  const epochStr = formatDate(epoch);
  const epochEndStr = formatDate(epochEnd);

  const existing = await query(
    'SELECT id FROM digital_twin_snapshots WHERE user_id = ? AND epoch = ?',
    [userId, epochStr]
  );
  if (existing.rows.length > 0) {
    return { skipped: true, reason: '本周已演化' };
  }

  const lastEpoch = await query(
    'SELECT epoch_end FROM digital_twin_snapshots WHERE user_id = ? ORDER BY epoch DESC LIMIT 1',
    [userId]
  );
  const sinceDate = lastEpoch.rows.length > 0
    ? formatDate(new Date(lastEpoch.rows[0].epoch_end))
    : formatDate(new Date(Date.now() - 7 * 86400000));

  const dataSources = await query(
    'SELECT text, timestamp, source_type FROM data_sources WHERE user_id = ? AND created_at > ? ORDER BY created_at ASC LIMIT 200',
    [userId, sinceDate]
  );

  if (dataSources.rows.length === 0) {
    return { skipped: true, reason: '无新数据' };
  }

  const text = dataSources.rows.map(r => r.text).filter(Boolean).join('\n');
  if (!text || text.length < 200) {
    return { skipped: true, reason: '新数据不足' };
  }

  const { segments } = await preprocess(userId, {
    sources: [{ type: 'notes', text, ref: 'digital-twin', timestamp: new Date().toISOString() }]
  });

  const basic = await analyzeBasic(segments);
  let deep = null;
  try {
    deep = await analyzeDeep(userId, { segments, basicResult: basic });
  } catch { /* deep optional */ }

  const topEmotions = Object.entries(basic.emotionScores || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, v]) => ({ emotion: k, score: v }));

  const topBeliefs = (deep?.beliefs || []).slice(0, 3).map(b => ({
    label: b.label, level: b.level, polarity: b.polarity, strength: b.strength
  }));

  const latestSnapshot = await repo.getLatestSnapshot(userId);
  const sourceSnapshotId = latestSnapshot?.id || null;

  const persona = {
    epoch: epochStr,
    topEmotions,
    topBeliefs,
    topicCount: basic.topics?.length || 0,
    topTopics: (basic.topics || []).slice(0, 5).map(t => t.label || t.name || t),
    totalSegments: segments.length,
    generatedAt: new Date().toISOString()
  };

  await query(
    'INSERT INTO digital_twin_snapshots (user_id, epoch, epoch_end, persona_json, source_snapshot_id) VALUES (?, ?, ?, ?, ?)',
    [userId, epochStr, epochEndStr, JSON.stringify(persona), sourceSnapshotId]
  );

  return { epoch: epochStr, topEmotions, topBeliefs: topBeliefs.length, segments: segments.length };
}

export async function chatWithPastSelf(userId, epoch, message) {
  if (!message || typeof message !== 'string') {
    throw Object.assign(new Error('缺少消息内容'), { statusCode: 400 });
  }

  const rows = await query(
    'SELECT u.username, dt.persona_json FROM digital_twin_snapshots dt JOIN users u ON u.id = dt.user_id WHERE dt.user_id = ? AND dt.epoch = ?',
    [userId, epoch]
  );

  if (rows.rows.length === 0) {
    throw Object.assign(new Error('该时期的数字人格不存在'), { statusCode: 404 });
  }

  const { username, persona_json: personaJson } = rows.rows[0];
  const persona = typeof personaJson === 'string' ? JSON.parse(personaJson) : personaJson;

  const emotionDesc = (persona.topEmotions || []).map(e => `${e.emotion}(${Math.round(e.score * 100)}%)`).join('、');
  const beliefDesc = (persona.topBeliefs || []).map(b => b.label).filter(Boolean).join('、');

  const systemPrompt = `你是 ${username || '用户'} 在 ${epoch} 时期的内心状态。
当时的情绪状态：${emotionDesc || '未知'}
核心信念：${beliefDesc || '未知'}
关注话题：${(persona.topTopics || []).join('、') || '未知'}

请以这个时期的你的身份回答。用第一人称，自然、真实。`;

  try {
    const response = await callAi({
      userId,
      model: 'deepseek-chat',
      systemPrompt,
      userMessage: message,
      temperature: 0.7,
      maxTokens: 1024,
      stream: false
    });

    const text = typeof response === 'object' ? (response.text || '') : String(response);
    return { epoch, reply: text, persona: { topEmotions: persona.topEmotions, topBeliefs: persona.topBeliefs } };
  } catch {
    throw new Error('数字人格对话服务不可用');
  }
}

export async function listDigitalTwins(userId, limit = 20) {
  const rows = await query(
    'SELECT id, epoch, epoch_end, created_at FROM digital_twin_snapshots WHERE user_id = ? ORDER BY epoch DESC LIMIT ?',
    [userId, Math.min(limit, 100)]
  );
  return rows.rows.map(r => ({
    id: r.id, epoch: formatDate(r.epoch), epochEnd: formatDate(r.epoch_end), createdAt: r.created_at
  }));
}

export async function startDigitalTwinCron() {
  if (!config.digitalTwin?.enabled) {
    console.log('[digitalTwin] Cron disabled via config');
    return;
  }

  if (global._digitalTwinCronStarted) {
    console.log('[digitalTwin] Cron already started, skipping');
    return;
  }

  let cron;
  try { cron = await import('node-cron'); } catch {
    console.warn('[digitalTwin] node-cron not available, skipping');
    return;
  }

  const cronExpr = config.digitalTwin?.cron || '0 3 * * *';
  cron.schedule(cronExpr, async () => {
    console.log(`[digitalTwin] Running scheduled evolution at ${new Date().toISOString()}`);
    try {
      const users = await query('SELECT id FROM users WHERE 1=1');
      for (const u of users.rows) {
        try {
          const result = await evolveDigitalTwin(u.id);
          if (!result.skipped) {
            console.log(`[digitalTwin] User ${u.id}: evolved (${result.segments} segments)`);
          } else {
            console.log(`[digitalTwin] User ${u.id}: skipped (${result.reason})`);
          }
        } catch (uErr) {
          console.error(`[digitalTwin] User ${u.id} error:`, uErr.message);
        }
      }
    } catch (err) {
      console.error('[digitalTwin] Cron run error:', err.message);
    }
  });

  global._digitalTwinCronStarted = true;
  console.log(`[digitalTwin] Cron scheduled: ${cronExpr}`);
}
