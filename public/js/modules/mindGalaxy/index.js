/**
 * 心智星系 v2 · 主模块
 */
import { initRenderer, disposeScene } from './renderer.js';
import { createBlackHole, createGiantStar, createMainSequence, createPlanetSystem, createNebula } from './celestialBodies.js';
import { createBinaryCompanion, createAsteroidBelt, createDarkMatter, createSupernovaRemnant, createNeutronStar } from './celestialBodies2.js';
import { spiralPosition } from './layout.js';
import { initInteraction, updateInteraction, disposeInteraction } from './interaction.js';
import { initUI } from './uiPanels.js';

let scene, camera, renderer, controls, clock, rs;
let animFrameId = null, mounted = false;
const celestialItems = [];

const FACTORY = {
  black_hole: createBlackHole, giant_star: createGiantStar, main_sequence: createMainSequence,
  planet_system: createPlanetSystem, nebula: createNebula, binary_companion: createBinaryCompanion,
  asteroid_belt: createAsteroidBelt, dark_matter: createDarkMatter,
  supernova_remnant: createSupernovaRemnant, neutron_star: createNeutronStar
};

const EXAMPLE = {
  galaxyType: 'S', spiralArms: 3,
  bodies: [
    { id: 'b0', type: 'black_hole', nodeId: 'core', name: '银心', position: [0,0,0], visual: { radius: 6, colorHex: '#000000', emissiveIntensity: 5 }, spawnAnimation: 'none', meta: {} },
    { id: 'b1', type: 'giant_star', nodeId: 'b_growth', name: '个人成长', position: [0,0,0], visual: { radius: 3, colorHex: '#FFD700', emissiveIntensity: 2.2 }, spawnAnimation: 'none', meta: { belief: { level: 'core', polarity: 'pos', strength: 0.85, formedAt: '2024-03' } } },
    { id: 'b2', type: 'giant_star', nodeId: 'b_relation', name: '亲密关系', position: [0,0,0], visual: { radius: 2.8, colorHex: '#FF69B4', emissiveIntensity: 1.9 }, spawnAnimation: 'none', meta: {} },
    { id: 'b3', type: 'main_sequence', nodeId: 't_work', name: '工作事业', position: [0,0,0], visual: { radius: 2.2, colorHex: '#FF6347', emissiveIntensity: 1.5 }, spawnAnimation: 'none', meta: { theme: { importance: 0.7, trend: 'stable' } } },
    { id: 'b4', type: 'main_sequence', nodeId: 't_health', name: '身心健康', position: [0,0,0], visual: { radius: 1.9, colorHex: '#00CED1', emissiveIntensity: 1.3 }, spawnAnimation: 'none', meta: {} },
    { id: 'b5', type: 'nebula', nodeId: 'e_joy', name: '喜悦星云', position: [0,0,0], visual: { radius: 0.2, colorHex: '#FFD700', emissiveIntensity: 1, density: 0.7, particleCount: 3000 }, spawnAnimation: 'none', meta: {} },
    { id: 'b6', type: 'nebula', nodeId: 'e_sorrow', name: '忧郁星云', position: [0,0,0], visual: { radius: 0.2, colorHex: '#4169E1', emissiveIntensity: 0.7, density: 0.5, particleCount: 2000 }, spawnAnimation: 'none', meta: {} },
    { id: 'b7', type: 'planet_system', nodeId: 'p_learn', name: '技能精进', position: [0,0,0], visual: { radius: 0.9, colorHex: '#98FB98', emissiveIntensity: 1 }, motion: { parentBodyId: 'b1', orbitRadius: 5, orbitInclination: 0.2, orbitSpeed: 0.5, orbitPhase: 1, eccentricity: 0.15 }, spawnAnimation: 'none', meta: {} },
    { id: 'b8', type: 'planet_system', nodeId: 'p_comm', name: '沟通艺术', position: [0,0,0], visual: { radius: 0.8, colorHex: '#FFB6C1', emissiveIntensity: 0.9 }, motion: { parentBodyId: 'b2', orbitRadius: 4.2, orbitInclination: -0.15, orbitSpeed: 0.6, orbitPhase: 2, eccentricity: 0.1 }, spawnAnimation: 'none', meta: {} },
    { id: 'b9', type: 'asteroid_belt', nodeId: 'm_frags', name: '记忆碎片带', position: [0,0,0], visual: { radius: 0.05, colorHex: '#8888AA', emissiveIntensity: 0.5, particleCount: 600 }, spawnAnimation: 'none', meta: {} },
    { id: 'b10', type: 'binary_companion', nodeId: 'p_mia', name: 'Mia', position: [0,0,0], visual: { radius: 1.6, colorHex: '#FFA07A', emissiveIntensity: 1.2 }, spawnAnimation: 'none', meta: { person: { intimacy: 0.75, polarity: 0.8, influence: 0.7 } } },
    { id: 'b11', type: 'dark_matter', nodeId: 's_hidden', name: '暗区', position: [0,0,0], visual: { radius: 0.1, colorHex: '#222244', emissiveIntensity: 0.2, opacity: 0.35 }, spawnAnimation: 'none', meta: { shadow: { repression: 0.7, energy: 0.5 } } },
    { id: 'b12', type: 'supernova_remnant', nodeId: 'g_shift', name: '观念革新余晖', position: [0,0,0], visual: { radius: 0.35, colorHex: '#FF6347', emissiveIntensity: 0.9, particleCount: 1800 }, spawnAnimation: 'none', meta: {} },
    { id: 'b13', type: 'neutron_star', nodeId: 't_old', name: '旧日伤痛', position: [0,0,0], visual: { radius: 0.25, colorHex: '#FFFFFF', emissiveIntensity: 0.7 }, spawnAnimation: 'none', meta: {} },
    { id: 'b14', type: 'nebula', nodeId: 'e_awe', name: '敬畏星云', position: [0,0,0], visual: { radius: 0.2, colorHex: '#800080', emissiveIntensity: 0.8, density: 0.6, particleCount: 2500 }, spawnAnimation: 'none', meta: {} }
  ]
};

// ── starfield ──
function createStarfield(scene) {
  const T = window.THREE;
  const n = 3000, p = new Float32Array(n * 3), c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 50 + Math.random() * 150;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    p[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    p[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    p[i * 3 + 2] = r * Math.cos(phi);
    const col = new T.Color().setHSL(0.05 + Math.random() * 0.3, 0.2 + Math.random() * 0.3, 0.5 + Math.random() * 0.5);
    c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(p, 3));
  geo.setAttribute('color', new T.BufferAttribute(c, 3));
  scene.add(new T.Points(geo, new T.PointsMaterial({ size: 0.25, vertexColors: true, blending: T.AdditiveBlending, depthWrite: false })));
}

// ── build ──
function buildGalaxy(snapshot) {
  const bodies = snapshot.bodies || [];
  return bodies.map((body, i) => {
    if (!body.position || body.position.every(v => v === 0)) {
      body.position = spiralPosition(body, bodies);
    }
    const factory = FACTORY[body.type];
    if (!factory) return null;
    const item = factory(body);
    item.group.position.set(body.position[0], body.position[1], body.position[2]);
    item.body = body;
    scene.add(item.group);
    return item;
  }).filter(Boolean);
}

// ── animate ──
function animate() {
  animFrameId = requestAnimationFrame(animate);
  if (!mounted) return;
  const delta = Math.min(clock.getDelta(), 0.1);
  for (const item of celestialItems) { if (item.update) item.update(delta); }
  updateInteraction(delta);
  if (controls) controls.update();
  if (renderer && scene && camera) renderer.render(scene, camera);
}

// ── bootstrap (同步，不阻塞) ──
function boot() {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  rs = initRenderer(container);
  scene = rs.scene; camera = rs.camera; renderer = rs.renderer;
  controls = rs.controls; clock = rs.clock;

  createStarfield(scene);

  const items = buildGalaxy(EXAMPLE);
  celestialItems.push(...items);

  items.forEach(item => {
    item.group.traverse(obj => {
      if (obj.isMesh && obj.material && item.body) {
        obj.userData = { ...item.body, clickable: true };
      }
    });
  });

  initInteraction(rs);
  initUI();

  // 移除加载画面
  const ls = document.getElementById('loading-screen');
  if (ls) { ls.classList.add('hidden'); setTimeout(() => ls.remove(), 800); }

  animate();
}

// ── 后台尝试加载服务端数据 ──
async function tryLoadServer() {
  try {
    const { ApiClient } = await import('../../api.js');
    const client = new ApiClient();
    const res = await client.getGalaxySnapshot();
    if (!res?.success || !res.data?.snapshot_json) return;
    const snap = typeof res.data.snapshot_json === 'string' ? JSON.parse(res.data.snapshot_json) : res.data.snapshot_json;
    if (!snap?.bodies) return;

    // 清理旧体
    celestialItems.forEach(item => { if (item.dispose) item.dispose(); });
    celestialItems.length = 0;

    const newItems = buildGalaxy(snap);
    celestialItems.push(...newItems);
    newItems.forEach(item => {
      item.group.traverse(obj => {
        if (obj.isMesh && obj.material && item.body) {
          obj.userData = { ...item.body, clickable: true };
        }
      });
    });
  } catch { /* server data optional */ }
}

export function mountMindGalaxy() {
  if (mounted) return;
  mounted = true;
  boot();
  tryLoadServer(); // 不阻塞，加载成功后自动替换
}

export function unmountMindGalaxy() {
  mounted = false;
  if (animFrameId) cancelAnimationFrame(animFrameId);
  animFrameId = null;
  disposeInteraction();
  if (controls) controls.dispose();
  celestialItems.forEach(item => { if (item.dispose) item.dispose(); });
  celestialItems.length = 0;
  disposeScene(scene, renderer, controls);
  scene = camera = renderer = controls = clock = rs = null;
}
