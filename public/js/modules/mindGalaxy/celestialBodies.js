/**
 * 心智星系 v2 · 天体工厂(1/2)
 * 职责：black_hole / giant_star / main_sequence / planet_system / nebula
 */
import { generateGlowTexture, generateStarSurfaceTexture } from './textures.js';

const THREE = () => window.THREE;

// ── helpers ──

function hexToColor(hex) {
  const T = THREE();
  return new T.Color(hex);
}

function createGlow(parent, colorHex, size, opacity = 0.4) {
  const T = THREE();
  const tex = generateGlowTexture(colorHex, 'rgba(0,0,0,0)');
  const mat = new T.SpriteMaterial({ map: tex, blending: T.AdditiveBlending, depthWrite: false, opacity });
  const sprite = new T.Sprite(mat);
  sprite.scale.set(size, size, 1);
  parent.add(sprite);
  return sprite;
}

function disposeObj(obj) {
  if (!obj) return;
  if (obj.traverse) {
    obj.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });
  }
  if (obj.geometry) obj.geometry.dispose();
  if (obj.material) obj.material.dispose();
}

// ── black_hole ──

export function createBlackHole(body) {
  const T = THREE();
  const group = new T.Group();
  const r = body.visual?.radius || 5;
  const color = hexToColor(body.visual?.colorHex || '#4B0082');

  const coreGeo = new T.SphereGeometry(r * 0.3, 64, 64);
  const coreMat = new T.MeshBasicMaterial({ color: 0x000000 });
  const core = new T.Mesh(coreGeo, coreMat);
  group.add(core);

  // Accretion disk (torus)
  const diskGeo = new T.TorusGeometry(r * 0.8, r * 0.15, 32, 64);
  const diskMat = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: T.DoubleSide });
  const disk = new T.Mesh(diskGeo, diskMat);
  disk.rotation.x = Math.PI / 2;
  group.add(disk);

  createGlow(group, body.visual?.colorHex || '#4B0082', r * 3, 0.3);

  group.userData = { type: 'black_hole' };
  return {
    group,
    update(delta) {
      disk.rotation.z += delta * 0.3;
      core.rotation.y += delta * 0.1;
    },
    dispose() { disposeObj(group); }
  };
}

// ── giant_star / main_sequence ──

function createStarCommon(body, emissiveBoost = 1) {
  const T = THREE();
  const group = new T.Group();
  const r = body.visual?.radius || 2;
  const color = hexToColor(body.visual?.colorHex || '#FFD700');

  const tex = generateStarSurfaceTexture(0.15);
  const geo = new T.SphereGeometry(r, 48, 48);
  const mat = new T.MeshStandardMaterial({
    map: tex,
    color,
    emissive: color,
    emissiveIntensity: (body.visual?.emissiveIntensity || 1) * emissiveBoost,
    roughness: 0.3,
    metalness: 0.1
  });
  const mesh = new T.Mesh(geo, mat);
  mesh.castShadow = false;
  group.add(mesh);

  // Glow layers
  const glowSizes = [r * 2.5, r * 4, r * 6];
  const glowOps = [0.5, 0.25, 0.1];
  for (let i = 0; i < 3; i++) {
    createGlow(group, body.visual?.colorHex || '#FFD700', glowSizes[i], glowOps[i]);
  }

  return { group, mesh, r, color };
}

export function createGiantStar(body) {
  const { group, mesh } = createStarCommon(body, 1.5);
  group.userData = { type: 'giant_star' };
  return {
    group,
    update(delta) { mesh.rotation.y += delta * 0.15; },
    dispose() { disposeObj(group); }
  };
}

export function createMainSequence(body) {
  const { group, mesh } = createStarCommon(body, 0.8);
  group.userData = { type: 'main_sequence' };
  return {
    group,
    update(delta) { mesh.rotation.y += delta * 0.2; },
    dispose() { disposeObj(group); }
  };
}

// ── planet_system ──

export function createPlanetSystem(body) {
  const T = THREE();
  const group = new T.Group();
  const r = body.visual?.radius || 1.5;
  const color = hexToColor(body.visual?.colorHex || '#4488CC');

  const geo = new T.SphereGeometry(r, 32, 32);
  const mat = new T.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.2 });
  const mesh = new T.Mesh(geo, mat);
  group.add(mesh);

  // Atmosphere shell
  const atmoGeo = new T.SphereGeometry(r * 1.2, 32, 32);
  const atmoMat = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.15, side: T.BackSide });
  group.add(new T.Mesh(atmoGeo, atmoMat));

  createGlow(group, body.visual?.colorHex || '#4488CC', r * 3, 0.25);

  group.userData = { type: 'planet_system', orbit: body.motion };
  return {
    group,
    mesh,
    update(delta) { mesh.rotation.y += delta * 0.3; },
    dispose() { disposeObj(group); }
  };
}

// ── nebula ──

export function createNebula(body) {
  const T = THREE();
  const group = new T.Group();
  const count = Math.min(8000, body.visual?.particleCount || 3000);
  const isDark = body.type === 'dark_matter';
  const color = hexToColor(body.visual?.colorHex || '#6644AA');
  const bound = body.visual?.density ? 5 + body.visual.density * 20 : 12;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = bound * Math.pow(Math.random(), 0.5) * 2;
    positions[i * 3] = Math.cos(theta) * Math.sin(phi) * radius;
    positions[i * 3 + 1] = Math.sin(theta) * Math.sin(phi) * radius;
    positions[i * 3 + 2] = Math.cos(phi) * radius;
    const c = isDark ? new T.Color().setHSL(0.7, 0.1, 0.1 + Math.random() * 0.1) : color.clone().multiplyScalar(0.6 + Math.random() * 0.4);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(positions, 3));
  geo.setAttribute('color', new T.BufferAttribute(colors, 3));
  const mat = new T.PointsMaterial({
    size: 0.4,
    vertexColors: true,
    blending: T.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: isDark ? 0.4 : 0.7
  });
  const points = new T.Points(geo, mat);
  group.add(points);
  group.userData = { type: isDark ? 'dark_matter' : 'nebula' };

  return {
    group,
    points,
    update(delta) {
      group.rotation.y += delta * 0.05;
      group.rotation.x += delta * 0.02;
    },
    dispose() { disposeObj(group); }
  };
}
