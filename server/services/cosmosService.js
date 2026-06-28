/**
 * 心迹星图 · 心智宇宙 AI 分析服务
 * 职责：
 *   1. 定义 COSMOS_PSYCHOLOGY_SYSTEM_PROMPT → AI 心理语义提取
 *   2. convertPsychologyToPhysics → 心理得分 → 3D 物理常量转换
 *   3. analyzeDiariesForCosmos → 完整分析管线
 */
import { query } from '../config/database.js';
import { callAi, extractJson } from './aiProviderService.js';
import { getCorpus } from './corpusService.js';
import { validateCosmosSnapshot } from '../types/cosmosTypes.js';
import crypto from 'crypto';

// ════════════════════════════════════════════════════════════
// COSMOS_PSYCHOLOGY_SYSTEM_PROMPT — AI Prompt
// ════════════════════════════════════════════════════════════

export const COSMOS_PSYCHOLOGY_PROMPT = `你是一位资深认知行为治疗师（CBT）兼荣格学派心理分析师。你的任务是从用户的日记文本中提取心理宇宙学映射数据。

## 同构映射规则

### 1. 核心信念层（恒星/黑洞）
提取日记中反复出现的核心信念，判定健康度（0-100）：
- 80-100 → YELLOW_GIANT：健康信念发光
- 40-79 → BLUE_SUPERGIANT：偏执过激但未塌缩
- 0-39 → BLACK_HOLE：认知严重塌缩（启动吞噬进程）

若判定为 BLACK_HOLE，计算 swallow_rate = 近期负面情绪日记数 / 总日记数 * 100
提取 cbt_schema_type（核心图式）：VALUE_DEFECTIVENESS | ABANDONMENT | MISTRUST_ABUSE | EMOTIONAL_DEPRIVATION | SOCIAL_ISOLATION | FAILURE_TO_ACHIEVE

### 2. 场域认知层（行星）
识别日记涉及的生命领域：CAREER_AMBITION | INTIMACY_RELATIONSHIP | EGO_IDENTITY | SOCIAL_MASK
对每个领域计算：
- atmosphere_density（防御强度，0-1）：越高=越多回避、否认、合理化
- cognitive_dissonance_score（认知失调指数，0-100）
- crater_count：日记中明确提及的近期受挫事件频次
- diagnosis_text：一句话心理诊断
- emotional_volatility（情绪波动指数，0-1）：日记中情绪在正面/负面间的摆动剧烈程度
- defense_mechanisms：使用的防御机制数组 ["否认","合理化","投射","理智化"]
- semantic_relation_score（与其他领域的语义关联度，0-1）：若领域A受挫直接导致领域B受影响

### 3. 应激反应层（卫星）
识别自动思维，每个形成一颗绕行行星的卫星：
- 灾难化 CATASTROPHIZING → stream_color: '#8B0000'，若伴随愤怒则 intensity 增加
- 两极化 POLARIZED_THINKING → '#2F4F4F'，非黑即白表述越多 length 越长
- 过度概括 OVERGENERALIZATION → '#4A0080'，"总是"、"从不"等绝对化语言
- 读心术 MIND_READING → '#8B4513'，自以为知道他人想法
- 情绪推理 EMOTIONAL_REASONING → '#800080'，把情绪当事实
- 标签化 LABELING → '#B22222'，给自己或他人贴标签

必须包含 psychological_meta.text（从日记中提取原文）和 parent_domain（所属领域）

### 4. 客体关系层（星云/碎石带）
- 未竟事件（蔡格尼克效应）→ is_dark_nebula: true，记录 dominant_raw_emotions 和 zeigarnik_text
- 关系中失去完美镜像投射 → 在该领域行星的 L4/L5 生成 desire_clump，desire_tags 提取执念关键词

## 输出格式
严格输出以下 JSON，禁止添加 markdown 或额外文字：

{
  "sun": {
    "render_type": "YELLOW_GIANT|BLUE_SUPERGIANT|BLACK_HOLE",
    "health_score": 0-100,
    "emissive_intensity": 0.0-5.0,
    "gravity_coefficient": 0.0-1.0,
    "accretion_disk_active": true/false,
    "cbt_schema_type": "VALUE_DEFECTIVENESS等",
    "core_belief_text": "一句话核心信念",
    "swallow_rate": 0.0-100.0,
    "shader_noise_scale": 0.5-4.0
  },
  "planets": [{
    "life_domain": "CAREER_AMBITION等",
    "atmosphere_density": 0.0-1.0,
    "cognitive_dissonance_score": 0-100,
    "crater_count": 0-50,
    "diagnosis_text": "一句话诊断",
    "emotional_volatility": 0.0-1.0,
    "defense_mechanisms": ["否认","合理化"],
    "semantic_relation_score": 0.0-1.0
  }],
  "satellites": [{
    "parent_domain": "CAREER_AMBITION等",
    "orbit_radius": 5.0-8.0,
    "severity": 0.0-1.0,
    "stream_color": "#RRGGBB",
    "tail_length": 1.0-5.0,
    "intensity": 0.0-1.0,
    "text": "日记原句",
    "distortion_tags": ["CATASTROPHIZING"]
  }],
  "nebulas": [{
    "is_dark_nebula": true/false,
    "dominant_raw_emotions": ["情绪1"],
    "zeigarnik_text": "对未竟事件的描述",
    "size": 15.0-40.0
  }],
  "desire_clumps": [{
    "parent_domain": "INTIMACY_RELATIONSHIP等",
    "lagrange_point": "L4|L5",
    "particle_density": 0.0-1.0,
    "shader_reflectance": 0.0-1.0,
    "desire_tags": ["标签1"]
  }]
}`;

// ════════════════════════════════════════════════════════════
// 心理 → 物理参数转换器
// ════════════════════════════════════════════════════════════

/**
 * @typedef {Object} ConverterContext
 * @property {string} userId
 * @property {Object} timeRange
 * @property {string} [timeRange.start_date]
 * @property {string} [timeRange.end_date]
 */

/**
 * 将 AI 提取的心理评分 JSON → 完整 ThreeCosmosSnapshotV3
 * @param {Object} aiOutput - AI 返回的原始 JSON
 * @param {ConverterContext} ctx
 * @returns {Object} 完整 snapshot
 */
export function convertPsychologyToPhysics(aiOutput, ctx) {
  const errors = [];
  const idGen = createIdGenerator();
  const planetIdMap = new Map();

  // ── 空值兜底 ──
  if (!aiOutput || typeof aiOutput !== 'object') {
    aiOutput = {};
  }
  if (!aiOutput.sun) {
    aiOutput.sun = { render_type: 'BLUE_SUPERGIANT', health_score: 55, emissive_intensity: 2.0, gravity_coefficient: 0.4, accretion_disk_active: false, cbt_schema_type: 'UNSPECIFIED', core_belief_text: '未检测到核心信念', swallow_rate: 0, shader_noise_scale: 2.0 };
  }

  // ── Sun ──
  const sunAI = aiOutput.sun || {};
  const healthScore = clamp(sunAI.health_score, 0, 100);
  let renderType = 'YELLOW_GIANT';
  if (healthScore < 40) renderType = 'BLACK_HOLE';
  else if (healthScore < 80) renderType = 'BLUE_SUPERGIANT';

  const sunRadius = 5 + (healthScore / 100) * 10; // 5-15
  const sun = {
    id: idGen.next('sun'),
    render_type: renderType,
    geometry: { radius: clamp(sunRadius, 5, 15) },
    material_properties: {
      base_color: renderType === 'BLACK_HOLE' ? '#4B0082'
        : renderType === 'BLUE_SUPERGIANT' ? '#4169E1' : '#FFD700',
      emissive_intensity: clamp(sunAI.emissive_intensity ?? (renderType === 'BLACK_HOLE' ? 0.5 : 3.0), 0, 5),
      shader_noise_scale: clamp(sunAI.shader_noise_scale ?? 2.0, 0.5, 4.0)
    },
    physical_fields: {
      gravity_coefficient: clamp(sunAI.gravity_coefficient ?? (renderType === 'BLACK_HOLE' ? 0.9 : 0.3), 0, 1),
      accretion_disk_active: sunAI.accretion_disk_active ?? (renderType === 'BLACK_HOLE')
    },
    psychological_meta: {
      cbt_schema_type: sunAI.cbt_schema_type || 'UNSPECIFIED',
      core_belief_text: sunAI.core_belief_text || '未检测到核心信念',
      swallow_rate: clamp(sunAI.swallow_rate, 0, 100)
    }
  };

  // ── Planets ──
  const planets = (aiOutput.planets || []).map(p => {
    const dissonance = clamp(p.cognitive_dissonance_score, 0, 100);
    const volatility = clamp(p.emotional_volatility ?? 0.3, 0, 1);
    const defense = clamp(p.atmosphere_density ?? 0.3, 0, 1);

    // (1) eccentricity: dissonance越高 + volatility越高 → 轨道越扁
    const e_base = dissonance / 100;
    const e = clamp(e_base + volatility * 0.5, 0, 0.95);

    // (2) semi_major_axis: 防御越强 → 越靠近核心（内耗回溯）
    const semiMajorAxis = 80 - defense * 60;

    // (3) 行星大小
    const planetRadius = 1.5 + (dissonance / 100) * 2.5;

    const pid = idGen.next('planet');
    planetIdMap.set(p.life_domain || 'UNKNOWN', pid);

    return {
      id: pid,
      life_domain: p.life_domain || 'EGO_IDENTITY',
      kepler_orbit: {
        semi_major_axis: clamp(semiMajorAxis, 20, 80),
        eccentricity: e,
        inclination: clamp(Math.random() * 0.3, 0, Math.PI / 6),
        initial_anomaly: clamp(Math.random() * Math.PI * 2, 0, 2 * Math.PI)
      },
      visual_layer: {
        radius: clamp(planetRadius, 1.5, 4.0),
        atmosphere_glow_color: p.life_domain === 'INTIMACY_RELATIONSHIP' ? '#6A5ACD'
          : p.life_domain === 'CAREER_AMBITION' ? '#4682B4'
          : p.life_domain === 'SOCIAL_MASK' ? '#8FBC8F' : '#CD853F',
        atmosphere_density: defense,
        crater_count: Math.round(clamp(p.crater_count ?? 0, 0, 50))
      },
      psychological_meta: {
        cognitive_dissonance_score: dissonance,
        diagnosis_text: p.diagnosis_text || '',
        defense_mechanisms: p.defense_mechanisms || [],
        emotional_volatility: volatility,
        semantic_relation_score: clamp(p.semantic_relation_score ?? 0, 0, 1)
      }
    };
  });

  // 至少一个默认行星
  if (planets.length === 0) {
    const pid = idGen.next('planet');
    planetIdMap.set('EGO_IDENTITY', pid);
    planets.push({
      id: pid,
      life_domain: 'EGO_IDENTITY',
      kepler_orbit: { semi_major_axis: 50, eccentricity: 0.3, inclination: 0.1, initial_anomaly: 0 },
      visual_layer: { radius: 2.0, atmosphere_glow_color: '#CD853F', atmosphere_density: 0.3, crater_count: 0 },
      psychological_meta: { cognitive_dissonance_score: 20, diagnosis_text: '基础自我认知稳定', defense_mechanisms: [], emotional_volatility: 0.2, semantic_relation_score: 0 }
    });
  }

  // ── Satellites ──
  const satellites = (aiOutput.satellites || []).map(s => {
    const parentDomain = s.parent_domain || 'EGO_IDENTITY';
    const parentPlanet = planets.find(p => p.life_domain === parentDomain);
    const parentId = parentPlanet ? parentPlanet.id : planetIdMap.get('EGO_IDENTITY') || planets[0]?.id;

    return {
      id: idGen.next('satellite'),
      parent_planet_id: parentId,
      orbit_radius: clamp(s.orbit_radius ?? 6.0, 5, 8),
      geometry: {
        radius: clamp(0.5 + (s.severity ?? 0.5) * 2.5, 0.5, 3.0),
        current_angle: clamp(Math.random() * Math.PI * 2, 0, 2 * Math.PI)
      },
      particle_tail: {
        stream_color: s.stream_color || '#8B0000',
        length: clamp(s.tail_length ?? 2.0, 1, 5),
        intensity: clamp(s.intensity ?? 0.5, 0, 1)
      },
      psychological_meta: {
        text: s.text || '',
        distortion_tags: s.distortion_tags || []
      }
    };
  });

  // ── Nebulas ──
  const nebulas = (aiOutput.nebulas || []).map(n => ({
    id: idGen.next('nebula'),
    center_position: [
      60 + Math.random() * 30,
      -15 + Math.random() * 15,
      20 + Math.random() * 30
    ],
    particle_system: {
      count: Math.round(clamp(n.size ?? 25, 15, 40) * 400),
      bounding_radius: clamp(n.size ?? 25, 15, 40),
      is_dark_nebula: n.is_dark_nebula ?? false
    },
    psychological_meta: {
      dominant_raw_emotions: n.dominant_raw_emotions || [],
      zeigarnik_text: n.zeigarnik_text || ''
    }
  }));

  // 蔡格尼克效应：如果有 dark_nebula，往关联行星追加陨石坑
  if (nebulas.some(n => n.particle_system.is_dark_nebula)) {
    planets.forEach(p => {
      if (p.life_domain === 'INTIMACY_RELATIONSHIP') {
        p.visual_layer.crater_count += 1;
      }
    });
  }

  // ── Desire clumps ──
  const desireClumps = (aiOutput.desire_clumps || []).map(c => {
    const parentPlanet = planets.find(p => p.life_domain === c.parent_domain);
    const parentId = parentPlanet ? parentPlanet.id : planets[0]?.id || '';
    return {
      parent_planet_id: parentId,
      lagrange_point: c.lagrange_point === 'L4' ? 'L4' : 'L5',
      particle_density: clamp(c.particle_density ?? 0.5, 0, 1),
      shader_reflectance: clamp(c.shader_reflectance ?? 0.5, 0, 1),
      desire_tags: c.desire_tags || []
    };
  });

  // ── 黑洞引力关联：若两颗行星的 semantic_relation_score > 0.7，添加引力连接弦 ──
  // 注：引力弦在前端的 Three.js 中渲染，后端在 psychological_meta 中标记
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const scoreIJ = planets[i].psychological_meta.semantic_relation_score || 0;
      const scoreJI = planets[j].psychological_meta.semantic_relation_score || 0;
      const avgScore = (scoreIJ + scoreJI) / 2;
      if (avgScore > 0.7) {
        planets[i].psychological_meta._gravity_bridge_to = planets[j].id;
        planets[j].psychological_meta._gravity_bridge_to = planets[i].id;
      }
    }
  }

  const snapshot = {
    user_id: ctx.userId,
    analyzed_diary_count: 0,
    time_range: {
      start_date: ctx.timeRange?.start_date || '',
      end_date: ctx.timeRange?.end_date || ''
    },
    sun,
    planets,
    satellites,
    nebulas,
    desire_clumps: desireClumps
  };

  // 运行期校验
  const validation = validateCosmosSnapshot(snapshot);
  if (!validation.valid) {
    console.error('[cosmosService] 转换结果校验失败:', validation.errors.slice(0, 5).join('; '));
    // 回退：至少保证一个默认行星，避免下游渲染崩溃
    if (!snapshot.planets || snapshot.planets.length === 0) {
      snapshot.planets.push({
        id: 'fallback-planet',
        life_domain: 'EGO_IDENTITY',
        kepler_orbit: { semi_major_axis: 50, eccentricity: 0.3, inclination: 0.1, initial_anomaly: 0 },
        visual_layer: { radius: 2.0, atmosphere_glow_color: '#CD853F', atmosphere_density: 0.3, crater_count: 0 },
        psychological_meta: { cognitive_dissonance_score: 20, diagnosis_text: '回退默认', defense_mechanisms: [], emotional_volatility: 0.2, semantic_relation_score: 0 }
      });
    }
  }

  return snapshot;
}

// ════════════════════════════════════════════════════════════
// 完整分析管线
// ════════════════════════════════════════════════════════════

/**
 * 完整分析管线：语料 → AI 分析 → 物理转换 → 校验
 * @param {number} userId
 * @param {Object} [options]
 * @param {string} [options.model='deepseek-chat']
 * @param {string} [options.startDate]
 * @param {string} [options.endDate]
 * @param {boolean} [options.force=false]
 * @param {string} [options.lengthMode]
 * @param {AbortSignal} [options.signal]
 * @param {function} [options.onChunk]
 * @param {function} [options.onStatus]
 * @returns {Promise<{ snapshot: Object, corpusHash: string, noteCount: number }>}
 */
export async function analyzeDiariesForCosmos(userId, options = {}) {
  const {
    model = 'deepseek-chat',
    startDate, endDate,
    force = false,
    lengthMode = '',
    signal = null,
    onChunk = null,
    onStatus = null
  } = options;

  // 1. 获取语料
  if (onStatus) onStatus('正在读取日记语料...');
  const corpus = await getCorpus(userId, {
    mode: startDate ? 'range' : 'all',
    dateStart: startDate || null,
    dateEnd: endDate || null,
    limit: 200,
    perNoteChars: 300
  });

  if (!corpus.notes || corpus.notes.length < 3) {
    throw new Error(`日记不足(需≥3，当前${corpus?.notes?.length || 0})，无法生成心智星相图`);
  }

  const corpusText = corpus.corpusText;
  const corpusHash = crypto.createHash('sha256').update(corpusText, 'utf8').digest('hex');

  if (onStatus) onStatus(`正在分析 ${corpus.notes.length} 篇日记的心理特征...`);

  // 2. AI 心理语义提取
  const aiResult = await callAi({
    userId,
    model,
    systemPrompt: COSMOS_PSYCHOLOGY_PROMPT,
    userMessage: `请分析以下用户的日记语料，输出心理宇宙学映射 JSON——\n\n${corpusText.substring(0, 10000)}`,
    stream: true,
    temperature: 0.3,
    maxTokens: 4096,
    signal,
    onChunk: (delta) => {
      if (delta && onChunk) onChunk(delta);
    }
  });

  if (!aiResult?.text) {
    throw new Error('AI 分析无返回结果');
  }

  if (onStatus) onStatus('正在解析分析结果...');

  // 3. 尝试两次 JSON 提取
  let parsed = extractJson(aiResult.text);
  if (!parsed) {
    // 重试一次
    if (onStatus) onStatus('重新解析...');
    const retryResult = await callAi({
      userId, model,
      systemPrompt: COSMOS_PSYCHOLOGY_PROMPT + '\n重要：你必须仅输出 JSON，不要包含任何其他文字。',
      userMessage: `请分析以下日记语料并输出 JSON——\n\n${corpusText.substring(0, 10000)}`,
      stream: false,
      temperature: 0.2,
      maxTokens: 4096
    });
    parsed = extractJson(retryResult?.text || '');
    if (!parsed) {
      throw new Error('AI 无法生成有效的心理分析 JSON');
    }
  }

  // 4. 心理 → 物理转换
  if (onStatus) onStatus('正在计算物理参数...');
  const timeRange = {
    start_date: startDate || corpus.notes[0]?.created_at || '',
    end_date: endDate || corpus.notes[corpus.notes.length - 1]?.created_at || ''
  };

  const snapshot = convertPsychologyToPhysics(parsed, { userId, timeRange });
  snapshot.analyzed_diary_count = corpus.notes.length;

  return { snapshot, corpusHash, noteCount: corpus.notes.length };
}

// ════════════════════════════════════════════════════════════
// 工具函数
// ════════════════════════════════════════════════════════════

function clamp(val, min, max) {
  if (val === undefined || val === null) return min;
  return Math.max(min, Math.min(max, Number(val)));
}

function createIdGenerator() {
  let counter = 0;
  return {
    next: (prefix) => {
      counter++;
      return `cosmos-${prefix}-${counter}-${Date.now().toString(36)}`;
    }
  };
}

/**
 * 注册当前快照中所有天体到 cosmos_entity_registry
 * 支持 sun/planet/satellite/nebula/desire_clump 五类
 * @param {Function} q - query 函数
 * @param {number} userId
 * @param {number} snapshotId
 * @param {Object} snapshot - ThreeCosmosSnapshotV3
 */
export async function registerEntities(q, userId, snapshotId, snapshot) {
  const entities = [];

  // Sun
  entities.push({
    id: snapshot.sun.id,
    type: 'sun',
    hash: crypto.createHash('sha256').update(
      `sun:${snapshot.sun.render_type}:${snapshot.sun.psychological_meta.cbt_schema_type}`, 'utf8').digest('hex')
  });

  // Planets
  (snapshot.planets || []).forEach(p => {
    entities.push({
      id: p.id, type: 'planet',
      hash: crypto.createHash('sha256').update(`planet:${p.life_domain}`, 'utf8').digest('hex')
    });
  });

  // Satellites
  (snapshot.satellites || []).forEach(s => {
    const tagStr = (s.psychological_meta.distortion_tags || []).sort().join(',');
    entities.push({
      id: s.id, type: 'satellite',
      hash: crypto.createHash('sha256').update(`satellite:${tagStr || 'unknown'}`, 'utf8').digest('hex')
    });
  });

  // Nebulas
  (snapshot.nebulas || []).forEach(n => {
    entities.push({
      id: n.id, type: 'nebula',
      hash: crypto.createHash('sha256').update(
        `nebula:${n.particle_system?.is_dark_nebula ? 'dark' : 'normal'}`, 'utf8').digest('hex')
    });
  });

  // Desire clumps（无 id 字段，用 parent_planet_id + lagrange_point + idx 合成稳定 ID）
  (snapshot.desire_clumps || []).forEach((c, idx) => {
    const synthId = `clump-${c.parent_planet_id}-${c.lagrange_point}-${idx}`;
    const synthHash = crypto.createHash('sha256').update(
      `desire_clump:${c.parent_planet_id}:${c.lagrange_point}:${(c.desire_tags || []).sort().join(',')}`, 'utf8').digest('hex');
    entities.push({ id: synthId, type: 'desire_clump', hash: synthHash });
  });

  // 批量 upsert
  for (const ent of entities) {
    try {
      await q(
        `INSERT INTO cosmos_entity_registry
         (user_id, entity_id, entity_type, stable_identity_hash, first_seen_at_snapshot_id, last_seen_at_snapshot_id)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           last_seen_at_snapshot_id = VALUES(last_seen_at_snapshot_id),
           is_active = TRUE`,
        [userId, ent.id, ent.type, ent.hash, snapshotId, snapshotId]
      );
    } catch (err) {
      console.error(`[cosmos] register entity ${ent.type}:${ent.id} 失败:`, err.message);
    }
  }
}
