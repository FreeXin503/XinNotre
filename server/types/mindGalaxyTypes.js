/**
 * 心智星系 v2 · 类型契约
 *
 * 本文件为纯 JavaScript，通过 JSDoc 提供类型信息。
 * 使用方式:
 *   import { validateMentalGraph, validateGalaxySnapshot } from '../types/mindGalaxyTypes.js';
 */

// ════════════════════════════════════════════════════════════
// 枚举常量
// ════════════════════════════════════════════════════════════

const NODE_TYPES = ['CoreSelf', 'Belief', 'Theme', 'Emotion', 'Person', 'Memory', 'Shadow'];
const EDGE_TYPES = ['supports', 'triggers', 'correlates', 'represses', 'derives'];
const CELESTIAL_TYPES = ['black_hole', 'giant_star', 'main_sequence', 'planet_system', 'nebula',
  'binary_companion', 'asteroid_belt', 'dark_matter', 'supernova_remnant', 'neutron_star'];
const GALAXY_TYPES = ['E', 'S', 'SB', 'Irr', 'Merger'];
const SPAWN_ANIM_TYPES = ['birth', 'supernova', 'none'];
const BELIEF_LEVELS = ['core', 'middle', 'concrete'];
const TREND_TYPES = ['rising', 'stable', 'fading'];
const PRIVACY_MODES = ['local', 'cloud'];
const TEMPLATE_TYPES = ['default', 'psychology', 'art', 'minimal'];

// ════════════════════════════════════════════════════════════
// JSDoc 类型定义
// ════════════════════════════════════════════════════════════

/**
 * @typedef {Object} MindNode — 心智图谱节点
 * @property {string} id
 * @property {'CoreSelf'|'Belief'|'Theme'|'Emotion'|'Person'|'Memory'|'Shadow'} type
 * @property {string} label
 * @property {number} weight
 * @property {Object} centrality
 * @property {number} centrality.degree
 * @property {number} centrality.betweenness
 * @property {number} centrality.eigenvector
 * @property {Object} attributes
 * @property {Object} [attributes.coreSelf] - { strength, stability, integration: number }
 * @property {Object} [attributes.belief] - { level:'core'|'middle'|'concrete', strength:number, polarity:'pos'|'neg', formedAt?:string }
 * @property {Object} [attributes.theme] - { importance, heat:number, trend:'rising'|'stable'|'fading' }
 * @property {Object} [attributes.emotion] - { intensity, frequency, persistence:number, vector20:number[] }
 * @property {Object} [attributes.person] - { intimacy, polarity, influence:number }
 * @property {Object} [attributes.memory] - { importance, vividness:number }
 * @property {Object} [attributes.shadow] - { repression, energy:number }
 * @property {Object[]} sourceRefs
 * @property {'notes'|'knowledge'|'chat'|'social'|'voice'} sourceRefs[].sourceType
 * @property {string} sourceRefs[].recordId
 * @property {string} sourceRefs[].excerpt
 * @property {string} createdAt
 */

/**
 * @typedef {Object} MindEdge — 心智图谱边
 * @property {string} id
 * @property {'supports'|'triggers'|'correlates'|'represses'|'derives'} type
 * @property {string} from - 源节点 id
 * @property {string} to - 目标节点 id
 * @property {number} weight
 */

/**
 * @typedef {Object} MentalGraph — 心智图谱
 * @property {string} userId
 * @property {MindNode[]} nodes
 * @property {MindEdge[]} edges
 * @property {Object} timeRange
 * @property {string} timeRange.start
 * @property {string} timeRange.end
 * @property {string} corpusHash
 * @property {string} computedAt
 */

/**
 * @typedef {Object} CelestialBody — 星系天体
 * @property {string} id
 * @property {'black_hole'|'giant_star'|'main_sequence'|'planet_system'|'nebula'|'binary_companion'|'asteroid_belt'|'dark_matter'|'supernova_remnant'|'neutron_star'} type
 * @property {string} nodeId
 * @property {string} name
 * @property {number[]} position - [x, y, z]
 * @property {Object} visual
 * @property {number} visual.radius
 * @property {string} visual.colorHex - #RRGGBB
 * @property {number} visual.emissiveIntensity
 * @property {number} [visual.temperature]
 * @property {number} [visual.flickerFreq]
 * @property {number} [visual.opacity]
 * @property {number} [visual.density]
 * @property {number} [visual.particleCount]
 * @property {Object} [motion]
 * @property {string} [motion.parentBodyId]
 * @property {number} [motion.orbitRadius]
 * @property {number} [motion.orbitInclination]
 * @property {number} [motion.orbitSpeed]
 * @property {number} [motion.orbitPhase]
 * @property {number} [motion.eccentricity]
 * @property {'birth'|'supernova'|'none'} spawnAnimation
 * @property {Object} meta
 */

/**
 * @typedef {Object} GalaxySnapshot — 星系快照
 * @property {string} id
 * @property {string} userId
 * @property {string} versionTag
 * @property {'E'|'S'|'SB'|'Irr'|'Merger'} galaxyType
 * @property {number} spiralArms
 * @property {number} windingTightness
 * @property {number} coreBulgeSize
 * @property {number} flatness
 * @property {CelestialBody[]} bodies
 * @property {Object} timeRange
 * @property {string} timeRange.start
 * @property {string} timeRange.end
 * @property {number} analyzedDiaryCount
 * @property {string} corpusHash
 * @property {string} createdAt
 */

/**
 * @typedef {Object} ObservationReport
 * @property {string} id
 * @property {string} galaxySnapshotId
 * @property {Object} overview
 * @property {'high'|'mid'|'low'} overview.confidence
 * @property {Object[]} coreBeliefs
 * @property {Object} emotionSpectrum
 * @property {Object} relationshipGalaxy
 * @property {Object} evolutionTimeline
 * @property {Object} shadows
 * @property {Object} typology
 */

/**
 * @typedef {Object} GalaxyConfig
 * @property {string} id
 * @property {string} userId
 * @property {string} name
 * @property {'default'|'psychology'|'art'|'minimal'} template
 * @property {Object<string,string>} colorScheme
 * @property {number} spiralArms
 * @property {number} windingTightness
 * @property {string[]} hiddenNodeIds
 * @property {Object<string,string>} renamedNodes
 * @property {'local'|'cloud'} privacyMode
 * @property {boolean} deleteAfterAnalysis
 * @property {string} updatedAt
 */

// ════════════════════════════════════════════════════════════
// 工具函数
// ════════════════════════════════════════════════════════════

function checkRange(val, min, max, label) {
  const errors = [];
  if (typeof val !== 'number' || isNaN(val)) {
    errors.push(`${label} 必须为数字`);
  } else if (val < min || val > max) {
    errors.push(`${label} 超出范围 [${min}, ${max}]，实际值 ${val}`);
  }
  return errors;
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// ════════════════════════════════════════════════════════════
// 校验器
// ════════════════════════════════════════════════════════════

/**
 * @param {*} data
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateMentalGraph(data) {
  const errors = [];
  if (!isPlainObject(data)) return { valid: false, errors: ['数据必须为非空对象'] };

  if (!isNonEmptyString(data.userId)) errors.push('userId 为必填非空字符串');
  if (!isNonEmptyString(data.corpusHash)) errors.push('corpusHash 为必填非空字符串');
  if (!isNonEmptyString(data.computedAt)) errors.push('computedAt 为必填非空字符串');

  const timeRange = data.timeRange;
  if (!isPlainObject(timeRange)) {
    errors.push('timeRange 为必填对象');
  } else {
    if (!isNonEmptyString(timeRange.start)) errors.push('timeRange.start 为必填非空字符串');
    if (!isNonEmptyString(timeRange.end)) errors.push('timeRange.end 为必填非空字符串');
  }

  if (!Array.isArray(data.nodes)) {
    errors.push('nodes 必须为数组');
  } else {
    data.nodes.forEach((n, i) => {
      const pre = `nodes[${i}]`;
      if (!isNonEmptyString(n.id)) errors.push(`${pre}.id 为必填非空字符串`);
      if (!NODE_TYPES.includes(n.type)) errors.push(`${pre}.type 必须为 ${NODE_TYPES.join('|')}，实际为 ${n.type}`);
      if (!isNonEmptyString(n.label)) errors.push(`${pre}.label 为必填`);
      errors.push(...checkRange(n.weight, -Infinity, Infinity, `${pre}.weight`));
      if (isNaN(n.weight)) errors.push(`${pre}.weight 必须为数字`);
      if (isPlainObject(n.centrality)) {
        errors.push(...checkRange(n.centrality.degree, 0, Infinity, `${pre}.centrality.degree`));
        errors.push(...checkRange(n.centrality.betweenness, 0, Infinity, `${pre}.centrality.betweenness`));
        errors.push(...checkRange(n.centrality.eigenvector, 0, Infinity, `${pre}.centrality.eigenvector`));
      } else {
        errors.push(`${pre}.centrality 为必填对象`);
      }
      if (isPlainObject(n.attributes)) {
        const attr = n.attributes;
        if (attr.emotion && Array.isArray(attr.emotion.vector20)) {
          if (attr.emotion.vector20.length !== 20) errors.push(`${pre}.attributes.emotion.vector20 长度必须为 20`);
          attr.emotion.vector20.forEach((v, vi) => {
            if (typeof v !== 'number' || v < 0 || v > 1) errors.push(`${pre}.attributes.emotion.vector20[${vi}] 必须在 [0,1]`);
          });
        }
        if (attr.belief && !BELIEF_LEVELS.includes(attr.belief.level)) errors.push(`${pre}.attributes.belief.level 必须为 ${BELIEF_LEVELS.join('|')}`);
        if (attr.theme && attr.theme.trend && !TREND_TYPES.includes(attr.theme.trend)) errors.push(`${pre}.attributes.theme.trend 必须为 ${TREND_TYPES.join('|')}`);
      }
    });
  }

  if (!Array.isArray(data.edges)) {
    errors.push('edges 必须为数组');
  } else {
    data.edges.forEach((e, i) => {
      const pre = `edges[${i}]`;
      if (!isNonEmptyString(e.id)) errors.push(`${pre}.id 为必填`);
      if (!EDGE_TYPES.includes(e.type)) errors.push(`${pre}.type 必须为 ${EDGE_TYPES.join('|')}`);
      if (!isNonEmptyString(e.from)) errors.push(`${pre}.from 为必填`);
      if (!isNonEmptyString(e.to)) errors.push(`${pre}.to 为必填`);
      errors.push(...checkRange(e.weight, 0, 1, `${pre}.weight`));
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * @param {*} data
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateGalaxySnapshot(data) {
  const errors = [];
  if (!isPlainObject(data)) return { valid: false, errors: ['数据必须为非空对象'] };

  if (!isNonEmptyString(data.id)) errors.push('id 为必填');
  if (!isNonEmptyString(data.userId)) errors.push('userId 为必填');
  if (!isNonEmptyString(data.versionTag)) errors.push('versionTag 为必填');
  if (!GALAXY_TYPES.includes(data.galaxyType)) errors.push(`galaxyType 必须为 ${GALAXY_TYPES.join('|')}，实际为 ${data.galaxyType}`);
  errors.push(...checkRange(data.spiralArms, 2, 4, 'spiralArms'));
  errors.push(...checkRange(data.windingTightness, 0, 1, 'windingTightness'));
  errors.push(...checkRange(data.coreBulgeSize, 0, 10, 'coreBulgeSize'));
  errors.push(...checkRange(data.flatness, 0, 1, 'flatness'));
  errors.push(...checkRange(data.analyzedDiaryCount, 0, Infinity, 'analyzedDiaryCount'));
  if (!isNonEmptyString(data.corpusHash)) errors.push('corpusHash 为必填');
  if (!isNonEmptyString(data.createdAt)) errors.push('createdAt 为必填');

  if (!isPlainObject(data.timeRange)) {
    errors.push('timeRange 为必填对象');
  } else {
    if (!isNonEmptyString(data.timeRange.start)) errors.push('timeRange.start 为必填字符串');
    if (!isNonEmptyString(data.timeRange.end)) errors.push('timeRange.end 为必填字符串');
  }

  if (!Array.isArray(data.bodies)) {
    errors.push('bodies 必须为数组');
  } else {
    data.bodies.forEach((b, i) => {
      const pre = `bodies[${i}]`;
      if (!isNonEmptyString(b.id)) errors.push(`${pre}.id 为必填`);
      if (!CELESTIAL_TYPES.includes(b.type)) errors.push(`${pre}.type 必须为 ${CELESTIAL_TYPES.join('|')}，实际为 ${b.type}`);
      if (!isNonEmptyString(b.nodeId)) errors.push(`${pre}.nodeId 为必填`);
      if (!isNonEmptyString(b.name)) errors.push(`${pre}.name 为必填`);
      if (!Array.isArray(b.position) || b.position.length !== 3) {
        errors.push(`${pre}.position 必须为 [x, y, z]`);
      } else {
        b.position.forEach((v, vi) => {
          if (typeof v !== 'number' || isNaN(v)) errors.push(`${pre}.position[${vi}] 必须为数字`);
        });
      }
      if (!SPAWN_ANIM_TYPES.includes(b.spawnAnimation)) errors.push(`${pre}.spawnAnimation 必须为 ${SPAWN_ANIM_TYPES.join('|')}`);
      if (!isPlainObject(b.visual)) {
        errors.push(`${pre}.visual 为必填对象`);
      } else {
        const vis = b.visual;
        errors.push(...checkRange(vis.radius, 0.1, 20, `${pre}.visual.radius`));
        if (!/^#[0-9A-Fa-f]{6}$/.test(vis.colorHex)) errors.push(`${pre}.visual.colorHex 必须为 #RRGGBB，实际为 ${vis.colorHex}`);
        errors.push(...checkRange(vis.emissiveIntensity, 0, 5, `${pre}.visual.emissiveIntensity`));
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * @param {*} data
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateObservationReport(data) {
  const errors = [];
  if (!isPlainObject(data)) return { valid: false, errors: ['数据必须为非空对象'] };

  if (!isNonEmptyString(data.id)) errors.push('id 为必填');
  if (!isNonEmptyString(data.galaxySnapshotId)) errors.push('galaxySnapshotId 为必填');

  if (!isPlainObject(data.overview)) {
    errors.push('overview 为必填对象');
  } else {
    const ov = data.overview;
    if (ov.confidence && !['high', 'mid', 'low'].includes(ov.confidence)) errors.push('overview.confidence 必须为 high|mid|low');
  }
  if (!Array.isArray(data.coreBeliefs)) errors.push('coreBeliefs 必须为数组');
  if (!isPlainObject(data.emotionSpectrum)) errors.push('emotionSpectrum 为必填');
  if (!isPlainObject(data.relationshipGalaxy)) errors.push('relationshipGalaxy 为必填');
  if (!isPlainObject(data.evolutionTimeline)) errors.push('evolutionTimeline 为必填');
  if (!isPlainObject(data.shadows)) errors.push('shadows 为必填');
  if (!isPlainObject(data.typology)) errors.push('typology 为必填');

  return { valid: errors.length === 0, errors };
}

/**
 * @param {*} data
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateGalaxyConfig(data) {
  const errors = [];
  if (!isPlainObject(data)) return { valid: false, errors: ['数据必须为非空对象'] };

  if (!isNonEmptyString(data.id)) errors.push('id 为必填');
  if (!isNonEmptyString(data.userId)) errors.push('userId 为必填');
  if (!isNonEmptyString(data.name)) errors.push('name 为必填');
  if (!TEMPLATE_TYPES.includes(data.template)) errors.push(`template 必须为 ${TEMPLATE_TYPES.join('|')}`);
  if (!Array.isArray(data.hiddenNodeIds)) errors.push('hiddenNodeIds 必须为数组');
  if (!isPlainObject(data.renamedNodes)) errors.push('renamedNodes 必须为对象');
  if (!PRIVACY_MODES.includes(data.privacyMode)) errors.push(`privacyMode 必须为 ${PRIVACY_MODES.join('|')}`);
  if (typeof data.deleteAfterAnalysis !== 'boolean') errors.push('deleteAfterAnalysis 必须为 boolean');
  if (!isNonEmptyString(data.updatedAt)) errors.push('updatedAt 为必填');

  return { valid: errors.length === 0, errors };
}

// ════════════════════════════════════════════════════════════
// UGME v2.0 通用星系转译引擎 · 类型与校验
// ════════════════════════════════════════════════════════════

const ENGINE_DOMAINS = ['MindGalaxy', 'KnowledgeGalaxy', 'RelationshipGalaxy', 'OrgGalaxy'];
const CELESTIAL_ROLES = ['BlackHole', 'MainStar', 'Planet', 'Nebula', 'Asteroid', 'DarkMatter'];
const OVERALL_TYPES = ['Spiral', 'Elliptical', 'BarredSpiral', 'Irregular'];
const ENGINE_EDGE_TYPES = ['triggers', 'supports', 'correlates', 'derives', 'represses'];

/**
 * @typedef {Object} SemanticFeatures — LLM 输出的语义特征（不含物理参数）
 * @property {number} frequency - 出现频次
 * @property {number} sentiment_polarity - 情感极性 [-1, 1]
 * @property {number} degree_centrality - 关联边数
 * @property {number} first_seen_month - 首次出现距今天数
 * @property {string[]} emotion_labels - 情绪标签（20 种枚举）
 * @property {string} celestial_role - 天体语义角色
 * @property {number[]} source_evidence - 原始数据 ID
 * @property {string} insight - AI 洞察
 */

/**
 * @typedef {Object} EngineNode — LLM 输出节点（只含语义层）
 * @property {string} id
 * @property {string} name
 * @property {string} celestial_role
 * @property {string|null} parent_id
 * @property {SemanticFeatures} semantic_features
 */

/**
 * @typedef {Object} EngineEdge
 * @property {string} source
 * @property {string} target
 * @property {string} relation_type
 * @property {number} strength
 */

/**
 * @typedef {Object} EngineSnapshot — 单时间切片
 * @property {string} time_snapshot
 * @property {string} overall_type
 * @property {Object} structural_metrics
 * @property {number} structural_metrics.entropy
 * @property {number} structural_metrics.density
 * @property {number} structural_metrics.active_index
 * @property {string} summary
 * @property {EngineNode[]} nodes
 * @property {EngineEdge[]} edges
 */

/**
 * @typedef {Object} EngineMultiSnapshot — 多时间切片输出
 * @property {string} domain
 * @property {EngineSnapshot[]} snapshots
 */

/**
 * @param {*} data
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSemanticFeatures(data) {
  const errors = [];
  if (!isPlainObject(data)) return { valid: false, errors: ['semantic_features 必须为非空对象'] };

  errors.push(...checkRange(data.frequency, 0, Infinity, 'frequency'));
  errors.push(...checkRange(data.sentiment_polarity, -1, 1, 'sentiment_polarity'));
  errors.push(...checkRange(data.degree_centrality, 0, Infinity, 'degree_centrality'));
  errors.push(...checkRange(data.first_seen_month, 0, Infinity, 'first_seen_month'));

  if (!Array.isArray(data.emotion_labels)) {
    errors.push('emotion_labels 必须为数组');
  }
  if (!CELESTIAL_ROLES.includes(data.celestial_role)) {
    errors.push(`celestial_role 必须为 ${CELESTIAL_ROLES.join('|')}，实际为 ${data.celestial_role}`);
  }
  if (!Array.isArray(data.source_evidence)) {
    errors.push('source_evidence 必须为数组');
  }
  if (typeof data.insight !== 'string') {
    errors.push('insight 必须为字符串');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * @param {*} data
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateEngineSnapshot(data) {
  const errors = [];
  if (!isPlainObject(data)) return { valid: false, errors: ['EngineSnapshot 必须为非空对象'] };

  if (!isNonEmptyString(data.time_snapshot)) errors.push('time_snapshot 为必填非空字符串');
  if (!OVERALL_TYPES.includes(data.overall_type)) {
    errors.push(`overall_type 必须为 ${OVERALL_TYPES.join('|')}，实际为 ${data.overall_type}`);
  }

  const sm = data.structural_metrics;
  if (!isPlainObject(sm)) {
    errors.push('structural_metrics 为必填对象');
  } else {
    errors.push(...checkRange(sm.entropy, 0, 1, 'structural_metrics.entropy'));
    errors.push(...checkRange(sm.density, 0, 1, 'structural_metrics.density'));
    errors.push(...checkRange(sm.active_index, 0, 1, 'structural_metrics.active_index'));
  }

  if (typeof data.summary !== 'string') errors.push('summary 必须为字符串');

  if (!Array.isArray(data.nodes)) {
    errors.push('nodes 必须为数组');
  } else {
    data.nodes.forEach((n, i) => {
      const pre = `nodes[${i}]`;
      if (!isNonEmptyString(n.id)) errors.push(`${pre}.id 为必填`);
      if (!isNonEmptyString(n.name)) errors.push(`${pre}.name 为必填`);
      if (!CELESTIAL_ROLES.includes(n.celestial_role)) {
        errors.push(`${pre}.celestial_role 必须为 ${CELESTIAL_ROLES.join('|')}`);
      }
      if (n.parent_id !== null && !isNonEmptyString(n.parent_id)) {
        errors.push(`${pre}.parent_id 必须为 null 或非空字符串`);
      }
      const sf = validateSemanticFeatures(n.semantic_features);
      if (!sf.valid) errors.push(...sf.errors.map(e => `${pre}.semantic_features: ${e}`));
    });
  }

  if (!Array.isArray(data.edges)) {
    errors.push('edges 必须为数组');
  } else {
    data.edges.forEach((e, i) => {
      const pre = `edges[${i}]`;
      if (!isNonEmptyString(e.source)) errors.push(`${pre}.source 为必填`);
      if (!isNonEmptyString(e.target)) errors.push(`${pre}.target 为必填`);
      if (!ENGINE_EDGE_TYPES.includes(e.relation_type)) {
        errors.push(`${pre}.relation_type 必须为 ${ENGINE_EDGE_TYPES.join('|')}`);
      }
      errors.push(...checkRange(e.strength, 0, 1, `${pre}.strength`));
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * @param {*} data
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateEngineMultiSnapshot(data) {
  const errors = [];
  if (!isPlainObject(data)) return { valid: false, errors: ['EngineMultiSnapshot 必须为非空对象'] };

  if (!ENGINE_DOMAINS.includes(data.domain)) {
    errors.push(`domain 必须为 ${ENGINE_DOMAINS.join('|')}，实际为 ${data.domain}`);
  }
  if (!Array.isArray(data.snapshots) || data.snapshots.length === 0) {
    errors.push('snapshots 必须为非空数组');
  } else {
    data.snapshots.forEach((s, i) => {
      const r = validateEngineSnapshot(s);
      if (!r.valid) errors.push(...r.errors.map(e => `snapshots[${i}]: ${e}`));
    });
  }

  return { valid: errors.length === 0, errors };
}

export { ENGINE_DOMAINS, CELESTIAL_ROLES, OVERALL_TYPES, ENGINE_EDGE_TYPES };
