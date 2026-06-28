/**
 * 心智星系 v2 · 配置服务
 * 职责：CRUD + 应用到快照
 */
import MindGalaxyRepository from '../../repositories/mindGalaxyRepository.js';

const repo = new MindGalaxyRepository();

/**
 * 创建/更新配置
 */
async function create(userId, config) {
  if (!config.name) throw new Error('配置名称为必填');
  return repo.saveConfig(userId, {
    ...config,
    id: config.id || '',
    userId,
    template: config.template || 'default',
    colorScheme: config.colorScheme || {},
    spiralArms: config.spiralArms || 3,
    windingTightness: config.windingTightness || 0.5,
    hiddenNodeIds: config.hiddenNodeIds || [],
    renamedNodes: config.renamedNodes || {},
    privacyMode: config.privacyMode || 'local',
    deleteAfterAnalysis: config.deleteAfterAnalysis || false,
    updatedAt: new Date().toISOString()
  });
}

/**
 * 应用配置到快照(过滤/重命名/覆盖颜色)
 */
function applyToSnapshot(snapshot, config) {
  if (!snapshot || !config) return snapshot;

  const bodies = (snapshot.bodies || []).filter(b =>
    !config.hiddenNodeIds?.includes(b.nodeId)
  );

  for (const body of bodies) {
    if (config.renamedNodes?.[body.nodeId]) {
      body.name = config.renamedNodes[body.nodeId];
    }
    if (config.colorScheme?.[body.type]) {
      body.visual.colorHex = config.colorScheme[body.type];
    }
  }

  return { ...snapshot, bodies };
}

export default { create, applyToSnapshot };
