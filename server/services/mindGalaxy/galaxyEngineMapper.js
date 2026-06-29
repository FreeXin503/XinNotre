/**
 * UGME v2.0 通用星系转译引擎 · 后处理映射纯函数
 *
 * 职责：把 LLM 输出的 semantic_features 映射成 bodies[] 的物理参数。
 * 全部确定性计算，不调 LLM，无 IO，无副作用。
 *
 * 颜色查表（不让 LLM 生成 HEX），size/brightness 公式化计算。
 */
import crypto from 'crypto';

// ── 角色→天体类型映射 ──
const ROLE_TO_CELESTIAL = {
  BlackHole: 'black_hole',
  MainStar: 'giant_star',
  Planet: 'planet_system',
  Nebula: 'nebula',
  Asteroid: 'asteroid_belt',
  DarkMatter: 'dark_matter'
};

// ── 情绪→颜色映射表（与 galaxyMappingService.EMOTION_COLORS 保持对齐）──
const EMOTION_COLORS_MAP = {
  joy: '#FFD700', calm: '#ADD8E6', satisfaction: '#98FB98', gratitude: '#FFB347',
  hope: '#87CEEB', love: '#FF69B4', pride: '#FF8C00', interest: '#7FFFD4',
  surprise: '#FFA500', sadness: '#4169E1', anger: '#8B0000', anxiety: '#9370DB',
  fear: '#4B0082', shame: '#A0522D', guilt: '#708090', disgust: '#556B2F',
  loneliness: '#483D8B', jealousy: '#228B22', boredom: '#808080', awe: '#800080'
};

// 极性兜底颜色
const POLARITY_COLORS = {
  positive: '#FFD700',
  negative: '#4169E1',
  neutral: '#FFFFFF'
};

// ── 工具函数 ──
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * semantic_features → visual metrics
 *
 * 公式（代码执行，非 LLM）：
 *   timeDecay = 1 / (1 + 0.05 * first_seen_month)
 *   size = clamp(0.5 + ln(frequency+1) * 1.2 * timeDecay, 0.5, 10)
 *   brightness = clamp(0.1 + degree_centrality * 0.15 + abs(sentiment_polarity) * 0.5, 0.1, 2.5)
 *   color = EMOTION_COLORS_MAP[emotion_labels[0]] || polarityColor(sentiment_polarity)
 *   blink_frequency = 0.05 + abs(sentiment_polarity) * 0.2
 *
 * @param {Object} features - SemanticFeatures
 * @returns {{size:number, brightness:number, color:string, blink_frequency:number}}
 */
export function mapFeaturesToMetrics(features) {
  const freq = Number(features.frequency) || 0;
  const polarity = clamp(Number(features.sentiment_polarity) || 0, -1, 1);
  const degree = Math.max(0, Number(features.degree_centrality) || 0);
  const monthsAgo = Math.max(0, Number(features.first_seen_month) || 0);

  const timeDecay = 1 / (1 + 0.05 * monthsAgo);
  const size = clamp(0.5 + Math.log(freq + 1) * 1.2 * timeDecay, 0.5, 10);
  const brightness = clamp(0.1 + degree * 0.15 + Math.abs(polarity) * 0.5, 0.1, 2.5);

  const emotionLabels = Array.isArray(features.emotion_labels) ? features.emotion_labels : [];
  let color = emotionLabels.length > 0 && EMOTION_COLORS_MAP[emotionLabels[0]]
    ? EMOTION_COLORS_MAP[emotionLabels[0]]
    : (polarity > 0.1 ? POLARITY_COLORS.positive
       : polarity < -0.1 ? POLARITY_COLORS.negative
       : POLARITY_COLORS.neutral);

  const blink_frequency = 0.05 + Math.abs(polarity) * 0.2;

  return {
    size: Number(size.toFixed(2)),
    brightness: Number(brightness.toFixed(2)),
    color,
    blink_frequency: Number(blink_frequency.toFixed(3))
  };
}

/**
 * 对数螺旋坐标布局（与 galaxyMappingService.spiralPosition 同构）
 * r = a * e^(b * theta)，theta 随 armIndex 和半径变化
 */
function spiralPosition(armIndex, armsCount, radius, perturbation = 1.0) {
  const armAngle = (armIndex / armsCount) * Math.PI * 2;
  const theta = radius * 0.8 + armAngle;
  const r = 1.2 * Math.exp(0.3 * radius) * 0.6;
  const px = Math.cos(theta) * (r + (Math.random() - 0.5) * perturbation * 2);
  const py = (Math.random() - 0.5) * 0.8;
  const pz = Math.sin(theta) * (r + (Math.random() - 0.5) * perturbation * 2);
  return [Number(px.toFixed(3)), Number(py.toFixed(3)), Number(pz.toFixed(3))];
}

/**
 * 推断星系整体类型
 * @param {Array} nodes - EngineNode[]
 * @returns {string} Spiral|Elliptical|BarredSpiral|Irregular
 */
export function inferOverallType(nodes) {
  if (!nodes || nodes.length === 0) return 'Spiral';

  const roleCounts = {};
  for (const n of nodes) {
    const role = n.celestial_role || n.semantic_features?.celestial_role || 'Planet';
    roleCounts[role] = (roleCounts[role] || 0) + 1;
  }

  const total = nodes.length;
  const blackHoles = roleCounts.BlackHole || 0;
  const mainStars = roleCounts.MainStar || 0;
  const roles = Object.values(roleCounts);
  const entropy = -roles.reduce((s, c) => s + (c > 0 ? (c / total) * Math.log(c / total) : 0), 0);

  if (blackHoles >= 1 && mainStars <= 2 && entropy < 0.8) return 'BarredSpiral';
  if (entropy < 0.5 && mainStars <= 2) return 'Elliptical';
  if (entropy > 1.5 || blackHoles === 0) return 'Irregular';
  return 'Spiral';
}

/**
 * 计算 structural_metrics
 * @param {Array} nodes
 * @param {Array} edges
 * @returns {{entropy:number, density:number, active_index:number}}
 */
export function computeStructuralMetrics(nodes, edges) {
  const n = nodes.length;
  if (n === 0) return { entropy: 0, density: 0, active_index: 0 };

  const roleCounts = {};
  for (const node of nodes) {
    const role = node.celestial_role || 'Planet';
    roleCounts[role] = (roleCounts[role] || 0) + 1;
  }
  const probs = Object.values(roleCounts).map(c => c / n);
  const entropy = clamp(-probs.reduce((s, p) => s + (p > 0 ? p * Math.log(p) : 0), 0) / Math.log(6), 0, 1);

  const maxEdges = n * (n - 1) / 2;
  const density = clamp(maxEdges > 0 ? (edges?.length || 0) / maxEdges : 0, 0, 1);

  const recent = nodes.filter(node => {
    const m = Number(node.semantic_features?.first_seen_month) || 0;
    return m <= 1;
  }).length;
  const active_index = clamp(n > 0 ? recent / n : 0, 0, 1);

  return {
    entropy: Number(entropy.toFixed(2)),
    density: Number(density.toFixed(2)),
    active_index: Number(active_index.toFixed(2))
  };
}

/**
 * EngineNode[] + EngineEdge[] → bodies[]（前端契约格式）
 *
 * @param {Array} engineNodes - LLM 输出的节点
 * @param {Array} engineEdges - LLM 输出的边
 * @param {string} timeSnapshot - "YYYY-MM"
 * @returns {Array} bodies[] 符合前端契约
 */
export function mapNodesToBodies(engineNodes, engineEdges, timeSnapshot) {
  if (!Array.isArray(engineNodes) || engineNodes.length === 0) return [];

  const nodes = engineNodes.slice(0, 50);
  const armsCount = Math.min(4, Math.max(2, nodes.filter(n => n.celestial_role === 'MainStar').length || 3));

  const nodeIdToBodyId = new Map();
  const bodyIdToParentNodeId = new Map();
  const bodies = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const role = node.celestial_role || node.semantic_features?.celestial_role || 'Planet';
    const celestialType = ROLE_TO_CELESTIAL[role] || 'planet_system';
    const features = node.semantic_features || {};

    const metrics = mapFeaturesToMetrics(features);

    let position;
    if (celestialType === 'black_hole') {
      position = [0, 0, 0];
    } else {
      const armIdx = i % armsCount;
      const radius = (1 - i / Math.max(1, nodes.length)) * 20 + 2;
      const perturb = celestialType === 'nebula' ? 3.0
        : celestialType === 'asteroid_belt' ? 4.0
        : celestialType === 'dark_matter' ? 2.0
        : 1.0;
      position = spiralPosition(armIdx, armsCount, radius, perturb);
    }

    const visual = {
      radius: celestialType === 'black_hole' ? Math.max(3, metrics.size * 1.5)
        : celestialType === 'nebula' ? 0.2
        : celestialType === 'dark_matter' ? 0.1
        : celestialType === 'asteroid_belt' ? 0.05
        : metrics.size * 0.3,
      colorHex: metrics.color,
      emissiveIntensity: celestialType === 'black_hole' ? 5.0
        : celestialType === 'giant_star' ? clamp(metrics.brightness * 2, 0.5, 5)
        : clamp(metrics.brightness, 0.1, 3),
      flickerFreq: metrics.blink_frequency,
      opacity: celestialType === 'dark_matter' ? 0.3
        : celestialType === 'nebula' ? 0.6
        : undefined,
      density: celestialType === 'nebula' ? clamp(Math.abs(features.sentiment_polarity || 0), 0.1, 1) : undefined,
      particleCount: celestialType === 'nebula' ? 2000 + Math.floor(metrics.brightness * 3000)
        : celestialType === 'asteroid_belt' ? 300 + Math.floor(metrics.size * 50)
        : undefined
    };

    let motion = undefined;
    if (celestialType === 'planet_system') {
      motion = {
        parentBodyId: null,
        orbitRadius: 3 + metrics.size * 0.8,
        orbitInclination: (Math.random() - 0.5) * 0.5,
        orbitSpeed: 0.3 + metrics.brightness * 0.5,
        orbitPhase: Math.random() * Math.PI * 2,
        eccentricity: 0.1
      };
    }

    const bodyId = `body-${crypto.randomUUID().substring(0, 8)}`;
    nodeIdToBodyId.set(node.id, bodyId);
    if (node.parent_id) {
      bodyIdToParentNodeId.set(bodyId, node.parent_id);
    }

    bodies.push({
      id: bodyId,
      type: celestialType,
      nodeId: node.id,
      name: node.name || '未名天体',
      position,
      visual,
      motion,
      spawnAnimation: 'none',
      meta: {
        celestial_role: role,
        time_snapshot: timeSnapshot,
        semantic_features: features,
        insight: features.insight || '',
        source_evidence: Array.isArray(features.source_evidence) ? features.source_evidence : []
      }
    });
  }

  const potentialParents = bodies.filter(b => b.type === 'giant_star' || b.type === 'main_sequence');
  for (const body of bodies) {
    if (body.type === 'planet_system' && body.motion) {
      const parentNodeId = bodyIdToParentNodeId.get(body.id);
      if (parentNodeId && nodeIdToBodyId.has(parentNodeId)) {
        body.motion.parentBodyId = nodeIdToBodyId.get(parentNodeId);
        continue;
      }
      let closest = null, minDist = Infinity;
      for (const parent of potentialParents) {
        const dx = body.position[0] - parent.position[0];
        const dy = body.position[1] - parent.position[1];
        const dz = body.position[2] - parent.position[2];
        const dist = dx * dx + dy * dy + dz * dz;
        if (dist < minDist) { minDist = dist; closest = parent; }
      }
      if (closest && minDist < 400) {
        body.motion.parentBodyId = closest.id;
      }
    }
  }

  return bodies;
}

/**
 * 单 EngineSnapshot → GalaxySnapshot(bodies[]) 完整映射
 *
 * @param {Object} engineSnapshot - LLM 输出的单时间切片
 * @param {string} userId
 * @param {string} domain
 * @returns {Object} GalaxySnapshot 符合前端契约
 */
export function mapSnapshotToBodies(engineSnapshot, userId, domain) {
  const nodes = engineSnapshot.nodes || [];
  const edges = engineSnapshot.edges || [];
  const timeSnapshot = engineSnapshot.time_snapshot || new Date().toISOString().substring(0, 7);

  const bodies = mapNodesToBodies(nodes, edges, timeSnapshot);

  const overallType = engineSnapshot.overall_type || inferOverallType(nodes);
  const structuralMetrics = engineSnapshot.structural_metrics && typeof engineSnapshot.structural_metrics.entropy === 'number'
    ? engineSnapshot.structural_metrics
    : computeStructuralMetrics(nodes, edges);

  const armsCount = Math.min(4, Math.max(2, nodes.filter(n => n.celestial_role === 'MainStar').length || 3));

  return {
    id: `snap-${Date.now().toString(36)}-${timeSnapshot.replace(/[^0-9]/g, '')}`,
    userId,
    versionTag: `ugme-${domain}-${timeSnapshot}`,
    galaxyType: mapOverallToHubble(overallType),
    spiralArms: armsCount,
    windingTightness: Number(clamp(0.3 + structuralMetrics.density * 0.4, 0.1, 1).toFixed(2)),
    coreBulgeSize: Number(clamp(2 + nodes.filter(n => n.celestial_role === 'BlackHole').length * 2, 0, 10).toFixed(2)),
    flatness: Number(clamp(0.3 + structuralMetrics.entropy * 0.4, 0, 1).toFixed(2)),
    bodies,
    timeRange: { start: timeSnapshot, end: timeSnapshot },
    analyzedDiaryCount: nodes.length,
    corpusHash: '',
    createdAt: new Date().toISOString(),
    domain,
    time_snapshot: timeSnapshot,
    structural_metrics: structuralMetrics,
    summary: engineSnapshot.summary || ''
  };
}

function mapOverallToHubble(overall) {
  const map = { Spiral: 'S', Elliptical: 'E', BarredSpiral: 'SB', Irregular: 'Irr' };
  return map[overall] || 'S';
}
