/**
 * 心智星系 v2 · 星系映射服务
 * 职责：MentalGraph → GalaxySnapshot 10 类天体 + 螺旋布局 + 视觉参数 + 哈勃类型推断
 */
import crypto from 'crypto';
import MindGalaxyRepository from '../../repositories/mindGalaxyRepository.js';

const repo = new MindGalaxyRepository();

// ── 天体类型映射表 ──
const NODE_TO_CELESTIAL = {
  CoreSelf: 'black_hole',
  Belief: body => {
    const level = body.meta?.level || 'concrete';
    return level === 'core' ? 'giant_star' : 'planet_system';
  },
  Theme: 'main_sequence',
  Emotion: 'nebula',
  Person: 'binary_companion',
  Memory: 'asteroid_belt',
  Shadow: 'dark_matter',
  growth: 'supernova_remnant',
  trauma: 'neutron_star'
};

// ── 情绪→颜色映射 ──
const EMOTION_COLORS = {
  joy: '#FFD700', calm: '#ADD8E6', satisfaction: '#98FB98', gratitude: '#FFB347',
  hope: '#87CEEB', love: '#FF69B4', pride: '#FF8C00', interest: '#7FFFD4',
  surprise: '#FFA500', sadness: '#4169E1', anger: '#8B0000', anxiety: '#9370DB',
  fear: '#4B0082', shame: '#A0522D', guilt: '#708090', disgust: '#556B2F',
  loneliness: '#483D8B', jealousy: '#228B22', boredom: '#808080', awe: '#800080'
};

const EMOTION_LIST = Object.keys(EMOTION_COLORS);

// ── 哈勃类型推断 ──
function inferHubbleType(graph, armCount, tightness, bulge) {
  if (!graph || !graph.nodes) return 'S';

  const totalNodes = graph.nodes.length;
  const coreBeliefs = graph.nodes.filter(n =>
    n.type === 'Belief' && n.attributes?.belief?.level === 'core'
  ).length;

  // 结构熵：节点类型分布越均匀越规整
  const typeCounts = {};
  for (const n of graph.nodes) {
    typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
  }
  const typeDist = Object.values(typeCounts).map(c => c / totalNodes);
  const entropy = -typeDist.reduce((s, p) => s + (p > 0 ? p * Math.log(p) : 0), 0);

  if (entropy < 0.5 && coreBeliefs >= 3 && bulge > 7) return 'E';   // 椭圆：高度统一
  if (armCount === 2 && tightness > 0.6 && bulge > 5) return 'SB'; // 棒旋：有主轴
  if (entropy < 1.0 && armCount >= 3 && tightness < 0.5) return 'S';// 旋涡
  if (entropy > 1.5 || bulge < 2) return 'Irr';                     // 不规则
  return 'S';
}

/**
 * 主题簇分旋臂分配
 */
function assignSpiralArm(node, topics, armsCount) {
  if (!node.attributes?.theme && node.type !== 'Theme') return 0;
  const idx = topics.findIndex(t => t.name === node.label);
  return idx >= 0 ? idx % armsCount : Math.floor(Math.random() * armsCount);
}

/**
 * 对数螺旋坐标: r = a * e^(b * theta)
 */
function spiralPosition(armIndex, armsCount, baseAngle, radius, armWidth, perturbation = 0) {
  const armAngle = (armIndex / armsCount) * Math.PI * 2 + baseAngle;
  const theta = radius * 0.8 + armAngle;
  const r = 1.2 * Math.exp(0.3 * radius) * armWidth;
  const px = Math.cos(theta) * (r + (Math.random() - 0.5) * perturbation * 2);
  const py = (Math.random() - 0.5) * 0.8 * armWidth;
  const pz = Math.sin(theta) * (r + (Math.random() - 0.5) * perturbation * 2);
  return [Number(px.toFixed(3)), Number(py.toFixed(3)), Number(pz.toFixed(3))];
}

/**
 * @param {string} userId
 * @param {Object} graph - MentalGraph
 * @param {Object} [config]
 * @returns {Promise<Object>} GalaxySnapshot
 */
export async function mapToGalaxy(userId, graph, config) {
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    return null;
  }

  const nodes = graph.nodes;
  const topics = nodes.filter(n => n.type === 'Theme');
  const armsCount = Math.min(4, Math.max(2, topics.length));
  const coreBeliefs = nodes.filter(n => n.type === 'Belief' && n.attributes?.belief?.level === 'core');
  const windingTightness = Math.min(1, Math.max(0.1, coreBeliefs.length / Math.max(1, nodes.length)));
  const coreBulgeSize = Math.min(10, Math.max(0, 2 + coreBeliefs.length * 1.5));
  const flatness = Math.min(1, Math.max(0, 0.2 + topics.length * 0.05));
  const galaxyType = inferHubbleType(graph, armsCount, windingTightness, coreBulgeSize);

  const bodies = [];
  const nodeIdToBodyId = new Map();

  // 权重排序：大权重靠中心
  const sortedNodes = [...nodes].sort((a, b) => b.weight - a.weight);

  for (let i = 0; i < sortedNodes.length; i++) {
    const node = sortedNodes[i];
    const normWeight = Math.min(1, i / Math.max(1, sortedNodes.length));
    let bodyType, armIdx = 0;

    // ── 类型映射 ──
    if (typeof NODE_TO_CELESTIAL[node.type] === 'function') {
      bodyType = NODE_TO_CELESTIAL[node.type]({ meta: node.attributes?.belief || {} });
    } else {
      bodyType = NODE_TO_CELESTIAL[node.type] || 'planet_system';
    }

    // ── 空间位置 ──
    let position;
    if (bodyType === 'black_hole') {
      position = [0, 0, 0];
    } else {
      armIdx = assignSpiralArm(node, topics, armsCount);
      const radius = normWeight * 25 + 2;
      const perturb = bodyType === 'nebula' ? 3.0 : bodyType === 'asteroid_belt' ? 4.0 : 1.0;
      position = spiralPosition(armIdx, armsCount, 0, radius, 3, perturb);
    }

    // ── 情绪→颜色 ──
    let colorHex = '#FFFFFF';
    if (node.attributes?.emotion?.vector20) {
      const vec = node.attributes.emotion.vector20;
      const maxIdx = vec.indexOf(Math.max(...vec));
      colorHex = EMOTION_COLORS[EMOTION_LIST[maxIdx]] || '#FFFFFF';
    } else if (node.type === 'Belief') {
      colorHex = node.attributes?.belief?.polarity === 'neg' ? '#4169E1' : '#FFD700';
    } else if (node.type === 'Theme') {
      colorHex = ['#FF6347', '#FFD700', '#00CED1', '#9370DB', '#FF8C00', '#7B68EE'][armIdx % 6];
    }

    // ── 视觉参数 ──
    const visual = {
      radius: bodyType === 'black_hole' ? Math.min(15, 5 + (node.attributes?.coreSelf?.strength || 50) / 10)
        : bodyType === 'neutron_star' ? 0.3
        : bodyType === 'dark_matter' ? 0.1
        : bodyType === 'asteroid_belt' ? 0.05
        : bodyType === 'nebula' ? 0.2
        : 0.5 + Math.log(Math.max(1, node.weight + 0.5)),
      colorHex,
      emissiveIntensity: bodyType === 'black_hole' ? 5.0
        : bodyType === 'giant_star' ? Math.min(5, 1.5 + node.weight)
        : Math.min(3, 0.5 + node.weight),
      temperature: bodyType === 'giant_star' ? 3000 + node.weight * 5000
        : bodyType === 'main_sequence' ? 4000 + node.weight * 3000
        : undefined,
      flickerFreq: node.attributes?.emotion?.intensity
        ? 0.5 + node.attributes.emotion.intensity * 2
        : undefined,
      opacity: bodyType === 'dark_matter' ? 0.3 : bodyType === 'nebula' ? 0.6 : undefined,
      density: bodyType === 'nebula' ? node.attributes?.emotion?.intensity || 0.5 : undefined,
      particleCount: bodyType === 'nebula' ? 2000 + Math.floor((node.attributes?.emotion?.intensity || 0.5) * 5000)
        : bodyType === 'asteroid_belt' ? 500 + Math.floor(node.weight * 100)
        : undefined
    };

    // ── 运动参数 ──
    let motion;
    if (bodyType === 'planet_system') {
      motion = {
        parentBodyId: null, // 后续 pass 填充
        orbitRadius: 3 + (node.attributes?.theme?.importance || 0.3) * 5,
        orbitInclination: (Math.random() - 0.5) * 0.5,
        orbitSpeed: 0.3 + node.weight * 0.7,
        orbitPhase: Math.random() * Math.PI * 2,
        eccentricity: node.attributes?.belief
          ? Math.max(0.05, 1 - (node.attributes.belief.strength || 0.5))
          : 0.1
      };
    }

    // ── 生长动画 ──
    let spawnAnimation = 'none';
    if (node.type === 'Belief' && node.attributes?.belief?.level === 'core') {
      const days = node.createdAt
        ? (Date.now() - new Date(node.createdAt).getTime()) / 86400000
        : Infinity;
      spawnAnimation = days < 30 ? 'birth' : 'none';
    }

    const body = {
      id: `body-${crypto.randomUUID().substring(0, 8)}`,
      type: bodyType,
      nodeId: node.id,
      name: node.label || '未名天体',
      position,
      visual,
      motion: motion || undefined,
      spawnAnimation,
      meta: node.attributes || {}
    };

    nodeIdToBodyId.set(node.id, body.id);
    bodies.push(body);
  }

  // ── 第二遍: 填充父天体引用 ──
  // Planet 的父天体: 最近的 giant_star 或 main_sequence
  const potentialParents = bodies.filter(b =>
    b.type === 'giant_star' || b.type === 'main_sequence'
  );
  for (const body of bodies) {
    if (body.type === 'planet_system' && body.motion) {
      let closest = null, minDist = Infinity;
      for (const parent of potentialParents) {
        const dx = body.position[0] - parent.position[0];
        const dy = body.position[1] - parent.position[1];
        const dz = body.position[2] - parent.position[2];
        const dist = dx * dx + dy * dy + dz * dz;
        if (dist < minDist) {
          minDist = dist;
          closest = parent;
        }
      }
      if (closest && minDist < 400) {
        body.motion.parentBodyId = closest.id;
      }
    }
  }

  const snapshot = {
    id: `snap-${Date.now().toString(36)}`,
    userId,
    versionTag: `v2-${new Date().toISOString().substring(0, 10)}`,
    galaxyType,
    spiralArms: armsCount,
    windingTightness: Number(windingTightness.toFixed(2)),
    coreBulgeSize: Number(coreBulgeSize.toFixed(2)),
    flatness: Number(flatness.toFixed(2)),
    bodies,
    timeRange: graph.timeRange || { start: '', end: '' },
    analyzedDiaryCount: graph.nodes.length,
    corpusHash: graph.corpusHash || '',
    createdAt: new Date().toISOString()
  };

  // 持久化
  try {
    await repo.saveSnapshot(userId, snapshot);
  } catch {/* 持久化失败不阻塞 */}

  return snapshot;
}
