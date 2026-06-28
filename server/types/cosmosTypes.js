/**
 * 心迹星图 · 3D 心智星相图类型契约
 *
 * 本文件为纯 JavaScript，通过 JSDoc 提供类型信息。
 * 所有几何参数均考虑 3D 视口缩放。
 *
 * 使用方式:
 *   import { validateCosmosSnapshot } from '../types/cosmosTypes.js';
 *   const result = validateCosmosSnapshot(data);
 *   if (!result.valid) { (handle errors) }
 */

// ════════════════════════════════════════════════════════════
// JSDoc 类型定义
// ════════════════════════════════════════════════════════════

/**
 * @typedef {Object} ThreeCoreSun — 核心信念恒星/黑洞
 * @property {string} id - UUID
 * @property {'YELLOW_GIANT'|'BLUE_SUPERGIANT'|'BLACK_HOLE'} render_type
 *   对应心理：稳定/偏执过激/认知塌缩
 * @property {Object} geometry
 * @property {number} geometry.radius - [5.0, 15.0], 情绪控制权重
 * @property {Object} material_properties
 * @property {string} material_properties.base_color - 如 "#4B0082"
 * @property {number} material_properties.emissive_intensity - [0.0, 5.0]
 * @property {number} [material_properties.shader_noise_scale] - 噪点参数
 * @property {Object} physical_fields
 * @property {number} physical_fields.gravity_coefficient
 * @property {boolean} physical_fields.accretion_disk_active
 * @property {Object} psychological_meta
 * @property {string} psychological_meta.cbt_schema_type
 * @property {string} psychological_meta.core_belief_text
 */

/**
 * @typedef {Object} ThreeDomainPlanet — 生活领域公转行星
 * @property {string} id - UUID
 * @property {'CAREER_AMBITION'|'INTIMACY_RELATIONSHIP'|'EGO_IDENTITY'|'SOCIAL_MASK'} life_domain
 * @property {Object} kepler_orbit
 * @property {number} kepler_orbit.semi_major_axis - [20, 80]
 * @property {number} kepler_orbit.eccentricity - [0.0, 0.95]
 * @property {number} kepler_orbit.inclination - [0, PI/6 ≈ 0.5236]
 * @property {number} kepler_orbit.initial_anomaly - [0, 2*PI]
 * @property {Object} visual_layer
 * @property {number} visual_layer.radius - [1.5, 4.0]
 * @property {string} visual_layer.atmosphere_glow_color
 * @property {number} visual_layer.atmosphere_density - [0.0, 1.0]
 * @property {number} visual_layer.crater_count
 * @property {Object} psychological_meta
 * @property {number} psychological_meta.cognitive_dissonance_score
 * @property {string} psychological_meta.diagnosis_text
 */

/**
 * @typedef {Object} ThreeThoughtSatellite — 自动思维绕行卫星
 * @property {string} id - UUID
 * @property {string} parent_planet_id
 * @property {number} orbit_radius - [5.0, 8.0]
 * @property {Object} geometry
 * @property {number} geometry.radius
 * @property {number} geometry.current_angle
 * @property {Object} particle_tail
 * @property {string} particle_tail.stream_color
 * @property {number} particle_tail.length
 * @property {number} particle_tail.intensity
 * @property {Object} psychological_meta
 * @property {string} psychological_meta.text
 * @property {string[]} psychological_meta.distortion_tags
 */

/**
 * @typedef {Object} ThreeSubconsciousNebula — 潜意识未加工情绪粒子星云
 * @property {string} id - UUID
 * @property {number[]} center_position - [x, y, z]
 * @property {Object} particle_system
 * @property {number} particle_system.count - [2000, 15000]
 * @property {number} particle_system.bounding_radius - [15.0, 40.0]
 * @property {boolean} particle_system.is_dark_nebula
 * @property {Object} psychological_meta
 * @property {string[]} psychological_meta.dominant_raw_emotions
 */

/**
 * @typedef {Object} ThreeDesireLagrangeClump — 拉格朗日点欲望碎石粒子群
 * @property {string} parent_planet_id
 * @property {'L4'|'L5'} lagrange_point
 * @property {number} particle_density - [0.0, 1.0]
 * @property {number} shader_reflectance
 * @property {string[]} desire_tags
 */

/**
 * @typedef {Object} ThreeCosmosSnapshotV3 — 全量 3D 快照
 * @property {string} user_id
 * @property {number} analyzed_diary_count
 * @property {Object} time_range
 * @property {string} time_range.start_date - YYYY-MM-DD
 * @property {string} time_range.end_date - YYYY-MM-DD
 * @property {ThreeCoreSun} sun
 * @property {ThreeDomainPlanet[]} planets
 * @property {ThreeThoughtSatellite[]} satellites
 * @property {ThreeSubconsciousNebula[]} nebulas
 * @property {ThreeDesireLagrangeClump[]} desire_clumps
 */

// ════════════════════════════════════════════════════════════
// 运行时校验器
// ════════════════════════════════════════════════════════════

const SUN_RENDER_TYPES = ['YELLOW_GIANT', 'BLUE_SUPERGIANT', 'BLACK_HOLE'];
const DOMAIN_TYPES = ['CAREER_AMBITION', 'INTIMACY_RELATIONSHIP', 'EGO_IDENTITY', 'SOCIAL_MASK'];

/**
 * 校验单个数值是否在范围内
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @param {string} label
 * @returns {string[]}
 */
function checkRange(val, min, max, label) {
  const errors = [];
  if (typeof val !== 'number' || isNaN(val)) {
    errors.push(`${label} 必须为数字`);
  } else if (val < min || val > max) {
    errors.push(`${label} 超出范围 [${min}, ${max}]，实际值 ${val}`);
  }
  return errors;
}

/**
 * 校验 3D 快照数据是否符合契约
 * @param {*} data - 待校验的数据
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCosmosSnapshot(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['数据必须为非空对象'] };
  }

  // user_id
  if (!data.user_id && data.user_id !== 0) {
    errors.push('user_id 为必填项');
  }

  // analyzed_diary_count
  if (typeof data.analyzed_diary_count !== 'number') {
    errors.push('analyzed_diary_count 必须为数字');
  }

  // time_range
  if (!data.time_range || typeof data.time_range !== 'object') {
    errors.push('time_range 为必填项');
  } else {
    if (!data.time_range.start_date) errors.push('time_range.start_date 为必填项');
    if (!data.time_range.end_date) errors.push('time_range.end_date 为必填项');
  }

  // ── sun 校验 ──
  if (!data.sun || typeof data.sun !== 'object') {
    errors.push('sun 为必填项');
  } else {
    const sun = data.sun;
    if (!sun.id) errors.push('sun.id 为必填项');
    if (!SUN_RENDER_TYPES.includes(sun.render_type)) {
      errors.push(`sun.render_type 必须为 ${SUN_RENDER_TYPES.join('|')}，实际为 ${sun.render_type}`);
    }
    if (sun.geometry) {
      errors.push(...checkRange(sun.geometry.radius, 5.0, 15.0, 'sun.geometry.radius'));
    } else {
      errors.push('sun.geometry 为必填项');
    }
    if (sun.material_properties) {
      errors.push(...checkRange(sun.material_properties.emissive_intensity, 0.0, 5.0, 'sun.material_properties.emissive_intensity'));
      if (typeof sun.material_properties.base_color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(sun.material_properties.base_color)) {
        errors.push('sun.material_properties.base_color 必须为有效十六进制颜色 #RRGGBB');
      }
    } else {
      errors.push('sun.material_properties 为必填项');
    }
    if (!sun.physical_fields) errors.push('sun.physical_fields 为必填项');
    if (!sun.psychological_meta) errors.push('sun.psychological_meta 为必填项');
  }

  // ── planets 校验 ──
  if (!Array.isArray(data.planets)) {
    errors.push('planets 必须为数组');
  } else {
    data.planets.forEach((p, i) => {
      const prefix = `planets[${i}]`;
      if (!p.id) errors.push(`${prefix}.id 为必填项`);
      if (!DOMAIN_TYPES.includes(p.life_domain)) {
        errors.push(`${prefix}.life_domain 必须为 ${DOMAIN_TYPES.join('|')}`);
      }
      if (p.kepler_orbit) {
        errors.push(...checkRange(p.kepler_orbit.semi_major_axis, 20.0, 80.0, `${prefix}.kepler_orbit.semi_major_axis`));
        errors.push(...checkRange(p.kepler_orbit.eccentricity, 0.0, 0.95, `${prefix}.kepler_orbit.eccentricity`));
        errors.push(...checkRange(p.kepler_orbit.inclination, 0.0, Math.PI / 6, `${prefix}.kepler_orbit.inclination`));
        errors.push(...checkRange(p.kepler_orbit.initial_anomaly, 0.0, 2 * Math.PI, `${prefix}.kepler_orbit.initial_anomaly`));
      } else {
        errors.push(`${prefix}.kepler_orbit 为必填项`);
      }
      if (p.visual_layer) {
        errors.push(...checkRange(p.visual_layer.radius, 1.5, 4.0, `${prefix}.visual_layer.radius`));
        errors.push(...checkRange(p.visual_layer.atmosphere_density, 0.0, 1.0, `${prefix}.visual_layer.atmosphere_density`));
      } else {
        errors.push(`${prefix}.visual_layer 为必填项`);
      }
      if (!p.psychological_meta) errors.push(`${prefix}.psychological_meta 为必填项`);
    });
  }

  // ── satellites 校验 ──
  if (!Array.isArray(data.satellites)) {
    errors.push('satellites 必须为数组');
  } else {
    data.satellites.forEach((s, i) => {
      const prefix = `satellites[${i}]`;
      if (!s.id) errors.push(`${prefix}.id 为必填项`);
      if (!s.parent_planet_id) errors.push(`${prefix}.parent_planet_id 为必填项`);
      errors.push(...checkRange(s.orbit_radius, 5.0, 8.0, `${prefix}.orbit_radius`));
      if (s.geometry) {
        errors.push(...checkRange(s.geometry.radius, 0.1, 3.0, `${prefix}.geometry.radius`));
      } else {
        errors.push(`${prefix}.geometry 为必填项`);
      }
      if (!s.particle_tail) errors.push(`${prefix}.particle_tail 为必填项`);
      if (!s.psychological_meta) errors.push(`${prefix}.psychological_meta 为必填项`);
    });
  }

  // ── nebulas 校验 ──
  if (!Array.isArray(data.nebulas)) {
    errors.push('nebulas 必须为数组');
  } else {
    data.nebulas.forEach((n, i) => {
      const prefix = `nebulas[${i}]`;
      if (!n.id) errors.push(`${prefix}.id 为必填项`);
      if (!Array.isArray(n.center_position) || n.center_position.length !== 3) {
        errors.push(`${prefix}.center_position 必须为 [x, y, z] 数组`);
      }
      if (n.particle_system) {
        errors.push(...checkRange(n.particle_system.count, 2000, 15000, `${prefix}.particle_system.count`));
        errors.push(...checkRange(n.particle_system.bounding_radius, 15.0, 40.0, `${prefix}.particle_system.bounding_radius`));
      } else {
        errors.push(`${prefix}.particle_system 为必填项`);
      }
      if (!n.psychological_meta) errors.push(`${prefix}.psychological_meta 为必填项`);
    });
  }

  // ── desire_clumps 校验 ──
  if (!Array.isArray(data.desire_clumps)) {
    errors.push('desire_clumps 必须为数组');
  } else {
    data.desire_clumps.forEach((c, i) => {
      const prefix = `desire_clumps[${i}]`;
      if (!c.parent_planet_id) errors.push(`${prefix}.parent_planet_id 为必填项`);
      if (c.lagrange_point !== 'L4' && c.lagrange_point !== 'L5') {
        errors.push(`${prefix}.lagrange_point 必须为 L4 或 L5`);
      }
      errors.push(...checkRange(c.particle_density, 0.0, 1.0, `${prefix}.particle_density`));
    });
  }

  return { valid: errors.length === 0, errors };
}
