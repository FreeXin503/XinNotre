/**
 * 心智星系 v2 · 空间布局引擎
 * 职责：对数螺旋布局 + 轨道计算 + 重叠检测
 */
const THREE = () => window.THREE;

/**
 * 对数螺旋坐标: r = a * e^(b * theta)
 */
export function spiralPosition(body, bodies, params = {}) {
  const {
    arms = 3,
    tightness = 0.3,
    armWidth = 3,
    perturbation = 0.5
  } = params;

  const idx = bodies.indexOf(body);
  const normalized = bodies.length > 1 ? idx / (bodies.length - 1) : 0;
  const armIdx = idx % arms;
  const armAngle = (armIdx / arms) * Math.PI * 2;
  const theta = normalized * Math.PI * 4 + armAngle;
  const r = 2 + normalized * 25;

  const x = Math.cos(theta) * r + (Math.random() - 0.5) * perturbation;
  const y = (Math.random() - 0.5) * armWidth * 0.3;
  const z = Math.sin(theta) * r + (Math.random() - 0.5) * perturbation;

  return [Number(x.toFixed(2)), Number(y.toFixed(2)), Number(z.toFixed(2))];
}

/**
 * 计算行星轨道参数
 */
export function computeOrbit(planetBody, parentPosition) {
  const m = planetBody.motion || {};
  return {
    radius: m.orbitRadius || 3 + Math.random() * 5,
    inclination: m.orbitInclination || (Math.random() - 0.5) * 0.6,
    speed: m.orbitSpeed || 0.2 + Math.random() * 0.5,
    phase: m.orbitPhase || Math.random() * Math.PI * 2,
    eccentricity: m.eccentricity || 0.1,
    parentPos: parentPosition || [0, 0, 0]
  };
}

/**
 * 更新轨道位置
 */
export function updateOrbitPosition(meshObj, center, delta, orbitData) {
  const o = orbitData;
  if (!o || !o.radius) return;
  o._phase = (o._phase || o.phase) + o.speed * delta;
  const angle = o._phase;
  const T = THREE();
  const r = o.radius / (1 + o.eccentricity * Math.cos(angle));
  meshObj.position.set(
    center[0] + Math.cos(angle) * r,
    center[1] + Math.sin(o.inclination) * Math.sin(angle) * r,
    center[2] + Math.cos(o.inclination) * Math.sin(angle) * r * 0.5
  );
}
