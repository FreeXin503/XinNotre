/**
 * 心智星系 v2 · 主模块
 */
import { initRenderer, initPostProcessing, disposePostProcessing, disposeScene, createOrbitLine, disposeOrbitLine, createSkybox, disposeSkybox, createGalaxyBackdrop, updateGalaxyBackdrop, disposeGalaxyBackdrop } from './renderer.js';
import { createBlackHole, createGiantStar, createMainSequence, createPlanetSystem, createNebula } from './celestialBodies.js';
import { createBinaryCompanion, createAsteroidBelt, createDarkMatter, createSupernovaRemnant, createNeutronStar } from './celestialBodies2.js';
import { spiralPosition } from './layout.js';
import { initInteraction, updateInteraction, disposeInteraction, initLabels, renderLabels, disposeLabels, setLabelsVisible, focusOnBody, setCelestialItemsProvider, setVisibilityChangeHandler } from './interaction.js';
import { initUI, advanceTime, getNormalizedTime } from './uiPanels.js';
import { initExporter } from './exporter.js';

let scene, camera, renderer, controls, clock, rs;
let animFrameId = null, mounted = false, _transitionRAF = null;
let backdrop = null;
const celestialItems = [];
const bodyBaseStates = new Map(); // id → { position, color, scale }
const orbitLines = []; // THREE.Line[] 轨道环
const connectionLines = []; // THREE.Line[] 父子关系连线

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

function createConnectionLine(fromItem, toItem, colorHex = '#7fb8ff', opacity = 0.22) {
  const T = window.THREE;
  if (!fromItem?.group || !toItem?.group) return null;
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3));
  const mat = new T.LineBasicMaterial({
    color: new T.Color(colorHex),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: T.AdditiveBlending
  });
  const line = new T.Line(geo, mat);
  line.userData = { fromItem, toItem };
  updateConnectionLine(line);
  return line;
}

function updateConnectionLine(line) {
  const from = line.userData?.fromItem?.group;
  const to = line.userData?.toItem?.group;
  if (!from || !to) return;
  line.visible = from.visible && to.visible && !!document.getElementById('btn-orbits')?.classList.contains('active');
  const fromPos = new window.THREE.Vector3();
  const toPos = new window.THREE.Vector3();
  from.getWorldPosition(fromPos);
  to.getWorldPosition(toPos);
  const attr = line.geometry.attributes.position;
  attr.array[0] = fromPos.x;
  attr.array[1] = fromPos.y;
  attr.array[2] = fromPos.z;
  attr.array[3] = toPos.x;
  attr.array[4] = toPos.y;
  attr.array[5] = toPos.z;
  attr.needsUpdate = true;
}

function rebuildOrbitAndConnectionLines() {
  orbitLines.forEach(line => { disposeOrbitLine(line); });
  orbitLines.length = 0;
  connectionLines.forEach(line => { disposeOrbitLine(line); });
  connectionLines.length = 0;

  const itemById = new Map();
  celestialItems.forEach(item => {
    const id = item.body?.id || item.body?.nodeId;
    if (id) itemById.set(id, item);
  });
  for (const item of celestialItems) {
    const parentId = item.body?.motion?.parentBodyId;
    if (!parentId) continue;
    const parent = itemById.get(parentId);
    const parentPos = parent?.group?.position || new window.THREE.Vector3(0, 0, 0);
    const orbit = createOrbitLine(item.body, parentPos);
    if (orbit) {
      orbit.userData.ownerItem = item;
      orbit.userData.parentItem = parent;
      scene.add(orbit);
      orbitLines.push(orbit);
    }
    const line = createConnectionLine(parent, item, item.body?.visual?.colorHex || '#7fb8ff');
    if (line) { scene.add(line); connectionLines.push(line); }
  }

  const isActive = document.getElementById('btn-orbits')?.classList.contains('active');
  orbitLines.forEach(line => { line.visible = !!isActive && line.userData?.ownerItem?.group?.visible !== false; });
  connectionLines.forEach(updateConnectionLine);
}

function syncOrbitVisibility() {
  const isActive = !!document.getElementById('btn-orbits')?.classList.contains('active');
  orbitLines.forEach(line => {
    const ownerVisible = line.userData?.ownerItem?.group?.visible !== false;
    const parentVisible = line.userData?.parentItem?.group?.visible !== false;
    line.visible = isActive && ownerVisible && parentVisible;
  });
  connectionLines.forEach(updateConnectionLine);
}

function updateOrbitLines() {
  const isActive = !!document.getElementById('btn-orbits')?.classList.contains('active');
  orbitLines.forEach(line => {
    const parent = line.userData?.parentItem?.group;
    const owner = line.userData?.ownerItem?.group;
    if (parent) line.position.copy(parent.position);
    line.visible = isActive && owner?.visible !== false && parent?.visible !== false;
  });
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

    bodyBaseStates.set(body.id, {
      position: new window.THREE.Vector3(body.position[0], body.position[1], body.position[2]),
      color: body.visual?.colorHex || '#ffffff',
      scale: body.visual?.radius || 1
    });

    scene.add(item.group);
    return item;
  }).filter(Boolean);
}

function applyTimeAnimation(t) {
  const T = window.THREE;
  for (const item of celestialItems) {
    if (!item?.body) continue;
    const base = bodyBaseStates.get(item.body.id);
    if (!base) continue;
    const phase = item.body.id.charCodeAt(0) + (item.body.id.charCodeAt(item.body.id.length - 1) || 0);
    const orbitT = t * Math.PI * 2;
    const pulse = 1 + 0.06 * Math.sin(orbitT * 0.5 + phase);
    const driftX = 0.3 * Math.sin(orbitT * 0.3 + phase * 0.1);
    const driftZ = 0.3 * Math.cos(orbitT * 0.25 + phase * 0.13);
    const driftY = 0.15 * Math.sin(orbitT * 0.2 + phase * 0.07);
    item.group.position.set(
      base.position.x + driftX,
      base.position.y + driftY,
      base.position.z + driftZ
    );
    item.group.scale.set(pulse, pulse, pulse);
  }
}

// ── B8: 演化时间轴 ──

let _currentSnapshot = null;
let _snapshots = [];

export function setSnapshots(snaps) {
  _snapshots = snaps || [];
  renderEvolutionMarkers();
}

function renderEvolutionMarkers() {
  const container = document.getElementById('evolution-markers');
  if (!container) return;
  if (_snapshots.length === 0) {
    container.innerHTML = '<span style="color:#888;font-size:0.75rem;">暂无演化快照</span>';
    return;
  }
  const prevType = { val: null };
  container.innerHTML = _snapshots.map((snap, i) => {
    const json = typeof snap.snapshot_json === 'string' ? JSON.parse(snap.snapshot_json) : snap.snapshot_json;
    const type = json?.galaxyType || '?';
    const isKey = prevType.val !== type;
    prevType.val = type;
    const date = snap.created_at ? new Date(snap.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) : '?';
    return `<div class="evo-marker ${isKey ? 'key' : ''}" data-index="${i}" title="${type}型 · ${date}" style="${isKey ? 'border:2px solid #4fc3f7;' : ''}">
      <div class="evo-dot" style="background:${type === 'S' ? '#4fc3f7' : type === 'SB' ? '#ff9800' : '#888'};width:${isKey ? '14px' : '8px'};height:${isKey ? '14px' : '8px'}"></div>
      <span style="font-size:0.65rem;color:#aaa;margin-top:4px;">${date}</span>
    </div>`;
  }).join('');

  container.querySelectorAll('.evo-marker').forEach(marker => {
    marker.addEventListener('click', async () => {
      const idx = parseInt(marker.dataset.index);
      await replaceWithSnapshot(idx);
    });
  });
}

export async function replaceWithSnapshot(index, smooth = false) {
  const snap = _snapshots[index];
  if (!snap) return;
  const json = typeof snap.snapshot_json === 'string' ? JSON.parse(snap.snapshot_json) : snap.snapshot_json;
  if (!json?.bodies) return;

  if (smooth && _currentSnapshot) {
    await transitionToSnapshot(json, 800);
  _currentSnapshot = json;
  window.__mgSnapshot = json;
    return;
  }

  _currentSnapshot = json;
  disposeLabels();
  celestialItems.forEach(item => { if (item.dispose) item.dispose(); });
  celestialItems.length = 0;
  window.__mgSnapshot = json;

  const newItems = buildGalaxy(json);
  celestialItems.push(...newItems);
  rebuildOrbitAndConnectionLines();

  newItems.forEach(item => {
    item.group.traverse(obj => {
      if (obj.isMesh && obj.material && item.body) {
        obj.userData = { ...item.body, clickable: true };
      }
    });
  });

  initLabels(rs, celestialItems);
  const isLabelsActive = document.getElementById('btn-labels')?.classList.contains('active');
  setLabelsVisible(!!isLabelsActive);
}

// ── C17: 演化插值动画 ──

async function transitionToSnapshot(nextJson, durationMs = 800) {
  const T = window.THREE;
  const currentIds = new Map();
  celestialItems.forEach(item => {
    if (item.body) currentIds.set(item.body.id || item.body.nodeId, item);
  });

  const nextBodies = nextJson.bodies || [];
  const nextIds = new Set(nextBodies.map(b => b.id || b.nodeId));

  const disappearItems = [];
  const appearBodies = [];
  const keepPairs = [];

  for (const [id, item] of currentIds) {
    if (!nextIds.has(id)) disappearItems.push(item);
    else {
      const next = nextBodies.find(b => (b.id || b.nodeId) === id);
      if (next) keepPairs.push({ item, next, id });
    }
  }
  for (const body of nextBodies) {
    const id = body.id || body.nodeId;
    if (!currentIds.has(id)) appearBodies.push(body);
  }

  const startTime = performance.now();

  return new Promise(resolve => {
    function step(now) {
      if (!mounted) { resolve(); return; }
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      disappearItems.forEach(item => {
        const s = (1 - ease);
        item.group.scale.set(s, s, s);
      });

      appearBodies.forEach(body => {
        const factory = FACTORY[body.type];
        if (!factory) return;
        const s = ease;
        if (t < 0.02) {
          if (!body.position || body.position.every(v => v === 0)) {
            body.position = spiralPosition(body, nextBodies);
          }
          const item = factory(body);
          item.group.position.set(body.position[0], body.position[1], body.position[2]);
          item.body = body;
          item.group.scale.set(0.01, 0.01, 0.01);
          scene.add(item.group);
          body._newItem = item;
        }
        if (body._newItem) {
          body._newItem.group.scale.set(s, s, s);
          body._newItem.group.traverse(obj => {
            if (obj.isMesh) {
              if (obj.material.opacity != null) obj.material.opacity = s;
            }
          });
        }
      });

      keepPairs.forEach(({ item, next }) => {
        if (next.visual?.colorHex && item.body?.visual?.colorHex && next.visual.colorHex !== item.body.visual.colorHex) {
          const from = new T.Color(item.body.visual.colorHex);
          const to = new T.Color(next.visual.colorHex);
          const lerped = from.clone().lerp(to, ease);
          item.group.traverse(obj => {
            if (obj.isMesh && obj.material.color) obj.material.color.copy(lerped);
          });
        }
      });

      if (t < 1) {
        _transitionRAF = requestAnimationFrame(step);
      } else {
        disappearItems.forEach(item => { if (item.dispose) item.dispose(); });
        celestialItems.length = 0;
        celestialItems.push(...(nextBodies.map(b => b._newItem).filter(Boolean)));
        keepPairs.forEach(({ item }) => celestialItems.push(item));
        appearBodies.forEach(b => { delete b._newItem; });
        _currentSnapshot = nextJson;
        // 重建 bodyBaseStates 防止过渡后星体漂回旧坐标
        bodyBaseStates.clear();
        celestialItems.forEach(item => {
          if (item?.body?.id) {
            bodyBaseStates.set(item.body.id, {
              position: item.group.position.clone(),
              color: item.body.visual?.colorHex || '#ffffff',
              scale: item.body.visual?.radius || 1
            });
          }
        });
        resolve();
      }
    }
    _transitionRAF = requestAnimationFrame(step);
  });
}

// ── animate ──
function animate() {
  animFrameId = requestAnimationFrame(animate);
  if (!mounted) return;
  const delta = Math.min(clock.getDelta(), 0.1);
  advanceTime(delta);
  const t = getNormalizedTime();
  updateGalaxyBackdrop(backdrop, delta);
  applyTimeAnimation(t);
  for (const item of celestialItems) { if (item.update) item.update(delta); }
  updateOrbitLines();
  connectionLines.forEach(updateConnectionLine);
  updateInteraction(delta);
  renderLabels();
  if (controls) controls.update();
  const composer = rs?.getComposer();
  if (composer) { composer.render(); }
  else if (renderer && scene && camera) { renderer.render(scene, camera); }
}

window.__mgRenderOnce = () => {
  const c = rs?.getComposer();
  if (c) c.render();
  else if (renderer && scene && camera) renderer.render(scene, camera);
};

function boot() {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  rs = initRenderer(container);
  scene = rs.scene; camera = rs.camera; renderer = rs.renderer;
  controls = rs.controls; clock = rs.clock;
  window.__mgRenderer = renderer;

  const pp = initPostProcessing(rs, { strength: 0.35, radius: 0.4, threshold: 0.3 });
  renderer.__pp = pp;

  window.addEventListener('mg-post-processing-change', () => {
    if (!window.mgPostProcessing) return;
    const s = window.mgPostProcessing;
    if (pp.bloomPass) {
      pp.bloomPass.strength = s.bloom.enabled ? s.bloom.strength : 0;
    }
    if (pp.passes) {
      if (pp.passes.dof) {
        pp.passes.dof.enabled = s.dof.enabled;
        pp.passes.dof.uniforms.blur.value = s.dof.aperture * 100;
        // DoF focus distance is a bit complex in basic shaders, we just map blur scale here
      }
      if (pp.passes.grain) {
        pp.passes.grain.enabled = s.film.enabled;
      }
      if (pp.passes.vignette) {
        pp.passes.vignette.enabled = s.film.enabled;
        pp.passes.vignette.uniforms.intensity.value = s.film.enabled ? 0.35 : 0;
      }
    }
  });

  createSkybox(scene);
  backdrop = createGalaxyBackdrop(scene);

  const items = buildGalaxy(EXAMPLE);
  celestialItems.push(...items);
  rebuildOrbitAndConnectionLines();

  items.forEach(item => {
    item.group.traverse(obj => {
      if (obj.isMesh && obj.material && item.body) {
        obj.userData = { ...item.body, clickable: true };
      }
    });
  });

  initInteraction(rs);
  setCelestialItemsProvider(() => celestialItems);
  setVisibilityChangeHandler(syncOrbitVisibility);
  initUI();
  initExporter(rs);

  // CSS2D 标签初始化
  initLabels(rs, celestialItems);

  // 轨道线开关
  const btnOrbits = document.getElementById('btn-orbits');
  if (btnOrbits) {
    btnOrbits.addEventListener('click', () => {
      btnOrbits.classList.toggle('active');
      syncOrbitVisibility();
    });
    syncOrbitVisibility();
  }

  // 标签开关
  const btnLabels = document.getElementById('btn-labels');
  if (btnLabels) {
    btnLabels.addEventListener('click', () => {
      const visible = btnLabels.classList.toggle('active');
      setLabelsVisible(visible);
    });
    const isLabelsActive = btnLabels.classList.contains('active');
    setLabelsVisible(isLabelsActive);
  }

  // 移除加载画面
  const ls = document.getElementById('loading-screen');
  if (ls) { ls.classList.add('hidden'); setTimeout(() => ls.remove(), 800); }

  animate();
}

// ── 后台尝试加载服务端数据 ──
async function tryLoadServer() {
  try {
    const { ApiClient } = await import('../../api.js');
    const client = ApiClient;
    const res = await client.getGalaxySnapshot();
    if (!res?.success || !res.data?.snapshot_json) return;
    const snap = typeof res.data.snapshot_json === 'string' ? JSON.parse(res.data.snapshot_json) : res.data.snapshot_json;
    if (!snap?.bodies) return;

    // 清理旧体
    disposeLabels();
    celestialItems.forEach(item => { if (item.dispose) item.dispose(); });
    celestialItems.length = 0;

    const newItems = buildGalaxy(snap);
    celestialItems.push(...newItems);
    rebuildOrbitAndConnectionLines();
    newItems.forEach(item => {
      item.group.traverse(obj => {
        if (obj.isMesh && obj.material && item.body) {
          obj.userData = { ...item.body, clickable: true };
        }
      });
    });

    // 重建标签
    initLabels(rs, celestialItems);
    const isLabelsActive = document.getElementById('btn-labels')?.classList.contains('active');
    setLabelsVisible(!!isLabelsActive);
  } catch { /* server data optional */ }
}

export function mountMindGalaxy() {
  if (mounted) return;
  mounted = true;

  const params = new URLSearchParams(window.location.search);
  const relToken = params.get('rel');

  if (relToken) {
    boot();
    loadRelationship(relToken);
  } else {
    boot();
    tryLoadServer();
  }
}

async function loadRelationship(relToken) {
  try {
    const { loadRelationshipGalaxy, renderBridgeLegend } = await import('./relationship.js');
    const { ApiClient } = await import('../../api.js');
    const res = await fetch(`/api/mind-galaxy/relationship/graph/${encodeURIComponent(relToken)}`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.success || !data.data?.bodies) return;

    const { bridge, bodies: rawBodies } = data.data;
    const mergedBodies = rawBodies.map(b => ({
      ...b,
      position: b.position || [0, 0, 0],
      visual: {
        ...b.visual,
        colorHex: b.isBridge ? '#FFD700' : (b.visual?.colorHex || '#888888'),
        emissiveIntensity: b.isBridge ? 2.5 : (b.visual?.emissiveIntensity || 1)
      },
      meta: { ...b.meta, isBridge: !!b.isBridge }
    }));

    const snap = { galaxyType: 'S', spiralArms: 3, bodies: mergedBodies };

    disposeLabels();
    celestialItems.forEach(item => { if (item.dispose) item.dispose(); });
    celestialItems.length = 0;

    const newItems = buildGalaxy(snap);
    celestialItems.push(...newItems);
    newItems.forEach(item => {
      item.group.traverse(obj => {
        if (obj.isMesh && obj.material && item.body) {
          obj.userData = { ...item.body, clickable: false };
        }
      });
    });

    initLabels(rs, celestialItems);
    const isLabelsActive = document.getElementById('btn-labels')?.classList.contains('active');
    setLabelsVisible(!!isLabelsActive);
    renderBridgeLegend(bridge);
  } catch { /* rel mode optional */ }
}

export function unmountMindGalaxy() {
  mounted = false;
  if (_transitionRAF) cancelAnimationFrame(_transitionRAF);
  _transitionRAF = null;
  if (animFrameId) cancelAnimationFrame(animFrameId);
  animFrameId = null;
  disposeInteraction();
  setVisibilityChangeHandler(null);
  setCelestialItemsProvider(null);
  disposeLabels();
  disposePostProcessing(rs);
  if (controls) controls.dispose();
  celestialItems.forEach(item => { if (item.dispose) item.dispose(); });
  celestialItems.length = 0;
  bodyBaseStates.clear();
  orbitLines.forEach(line => { disposeOrbitLine(line); });
  orbitLines.length = 0;
  connectionLines.forEach(line => { disposeOrbitLine(line); });
  connectionLines.length = 0;
  disposeGalaxyBackdrop(backdrop);
  backdrop = null;
  disposeSkybox(scene);
  disposeScene(scene, renderer, controls);
  scene = camera = renderer = controls = clock = rs = null;
}

let _guideAbortController = null;

function findBodyIdByName(name) {
  for (const item of celestialItems) {
    if (item?.body?.name === name || item?.body?.label === name) {
      return item.body.id || item.body.nodeId;
    }
  }
  return null;
}

function getBodyWorldPosition(bodyId) {
  for (const item of celestialItems) {
    const id = item?.body?.id || item?.body?.nodeId;
    if (id === bodyId) {
      const pos = new window.THREE.Vector3();
      item.group.getWorldPosition(pos);
      return pos;
    }
  }
  return null;
}

export async function startGalaxyGuide(question) {
  const outputEl = document.getElementById('guide-output');
  if (!outputEl) return;

  if (_guideAbortController) {
    _guideAbortController.abort();
  }
  _guideAbortController = new AbortController();
  const signal = _guideAbortController.signal;

  outputEl.innerHTML = '<div class="guide-thinking">思考中...</div>';

  try {
    const { ApiClient } = await import('../../api.js');
    const client = ApiClient;
    const token = client.getToken();

    const response = await fetch('/api/mind-galaxy/ai-guide', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ question }),
      signal
    });

    if (!response.ok) {
      outputEl.innerHTML = '<div class="guide-error">AI 向导服务不可用</div>';
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let fullText = '';
    let reading = true;
    let currentEvent = '';

    while (reading) {
      const { done, value } = await reader.read();
      if (done) { reading = false; break; }
      buf += decoder.decode(value, { stream: true });

      const lines = buf.split('\n');
      buf = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('event: ')) {
          currentEvent = trimmed.substring(7).trim();
          if (currentEvent === 'done') {
            reading = false;
            break;
          }
          continue;
        }

        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.substring(6);
          let data;
          try { data = JSON.parse(dataStr); } catch { continue; }

          if (data.error) {
            outputEl.innerHTML = `<div class="guide-error">${data.error}</div>`;
            reading = false;
            break;
          }

          if (data.text) {
            fullText += data.text;
            outputEl.innerHTML = `<div class="guide-response">${fullText}</div>`;
          }

          if (data.bodyId !== undefined && data.action) {
            handleGuideAction(data);
          }
        }
      }
    }

    if (fullText) {
      outputEl.innerHTML = `<div class="guide-response">${fullText}</div>`;
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
    outputEl.innerHTML = '<div class="guide-error">连接中断</div>';
  }
}

export function abortGalaxyGuide() {
  if (_guideAbortController) {
    _guideAbortController.abort();
    _guideAbortController = null;
  }
}

function handleGuideAction(action) {
  if (!action.bodyId) return;

  const T = window.THREE;
  if (action.action === 'focus') {
    const pos = getBodyWorldPosition(action.bodyId);
    if (pos) {
      focusOnBody(pos, 5);
    } else {
      const name = action.bodyId;
      const foundId = findBodyIdByName(name);
      if (foundId) {
        const foundPos = getBodyWorldPosition(foundId);
        if (foundPos) focusOnBody(foundPos, 5);
      }
    }
  }

  if (action.action === 'highlight') {
    scene.traverse(obj => {
      if (obj.userData?.nodeId === action.bodyId || obj.userData?.id === action.bodyId) {
        if (obj.material) {
          obj.material.emissiveIntensity = Math.min(5, (obj.material.emissiveIntensity || 1) * 3);
          setTimeout(() => {
            if (obj.material) obj.material.emissiveIntensity = Math.max(0.5, (obj.material.emissiveIntensity || 1) / 3);
          }, 2000);
        }
      }
    });
  }

  if (action.action === 'timeline' && action.params?.targetTime) {
    const markers = document.querySelectorAll('.evo-marker');
    if (markers.length > 0) {
      markers[0].scrollIntoView({ behavior: 'smooth' });
    }
  }
}
