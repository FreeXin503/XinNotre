/**
 * 心迹星图 · 3D 心智星相图前端模块
 * 职责：使用 Three.js 渲染用户心智星相图，支持鼠标交互
 *
 * 渲染项：黑洞（中心）、行星（公转）、卫星（粒子尾迹）、暗星云、碎石带
 *
 * 生命周期：mount → unmount（自动释放 Three.js 资源）
 * 降级：WebGL 不支持时显示文字提示
 */
import { ApiClient } from '../api.js';

// ── 模块状态 ────────────────────────────────────────────

let containerEl = null;
let abortCtrl = null;
let scene = null;
let camera = null;
let renderer = null;
let controls = null;
let animFrameId = null;
let clock = null;
let cosmosData = null;
let raycaster = null;
let hoveredObj = null;
let _origEmissive = null;
let _tooltipEl = null;
let _onMouseMoveFn = null;
let _onMouseLeaveFn = null;

// 3D 对象引用（用于动画和清理）
let sunGroup = null;
let planetGroups = [];
let satelliteGroups = [];
let nebulaPoints = null;
let clumpPoints = null;

// ── 生命周期 ────────────────────────────────────────────

export function mountCosmos(container) {
  containerEl = container;
  renderMainView();
}

export function unmountCosmos() {
  if (abortCtrl) { abortCtrl.abort(); abortCtrl = null; }
  if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }

  // 清理 Raycaster 事件
  if (renderer?.domElement && _onMouseMoveFn) {
    renderer.domElement.removeEventListener('mousemove', _onMouseMoveFn);
  }
  if (renderer?.domElement && _onMouseLeaveFn) {
    renderer.domElement.removeEventListener('mouseleave', _onMouseLeaveFn);
  }
  _onMouseMoveFn = null;
  _onMouseLeaveFn = null;
  hoveredObj = null;
  _origEmissive = null;
  raycaster = null;

  // 清理 tooltip
  if (_tooltipEl?.parentNode) {
    _tooltipEl.parentNode.removeChild(_tooltipEl);
  }
  _tooltipEl = null;

  if (controls) { controls.dispose(); controls = null; }
  if (renderer) {
    renderer.setAnimationLoop(null);
    renderer.dispose();
    renderer = null;
  }
  scene = null;
  camera = null;
  clock = null;
  cosmosData = null;
  sunGroup = null;
  planetGroups = [];
  satelliteGroups = [];
  nebulaPoints = null;
  clumpPoints = null;
  containerEl = null;
  delete window.refreshCosmos;
}

// ── 主视图 ──────────────────────────────────────────────

function renderMainView() {
  if (!containerEl) return;
  containerEl.innerHTML = `
    <div style="max-width:960px;margin:0 auto;padding:20px 0;">
      <!-- 顶部 -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
        <div>
          <h2 style="font-size:22px;font-weight:700;margin:0;background:linear-gradient(135deg,#8ab4f8,#4B0082);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">🌀 心智星相图</h2>
          <p style="color:var(--text-muted);font-size:13px;margin:4px 0 0 0;">你的内心宇宙，化作一片触手可及的星辰</p>
        </div>
        <button id="btn-refresh-cosmos" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:7px 16px;color:var(--text-main);font-size:13px;cursor:pointer;transition:all 0.2s;">
          🔄 刷新快照
        </button>
      </div>

      <!-- 加载 -->
      <div id="cosmos-loading" style="display:flex;justify-content:center;align-items:center;height:400px;color:var(--text-muted);font-size:14px;">
        <span class="typing-loading">正在构建心智宇宙...</span>
      </div>

      <!-- 3D 场景容器 -->
      <div id="cosmos-3d-container" style="display:none;width:100%;height:500px;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);position:relative;background:rgba(0,0,0,0.3);"></div>

      <!-- 图例 -->
      <div id="cosmos-legend" style="display:none;margin-top:12px;display:flex;flex-wrap:wrap;gap:10px;font-size:11px;color:var(--text-muted);padding:8px 0;"></div>

      <!-- 错误 -->
      <div id="cosmos-error" style="display:none;justify-content:center;align-items:center;height:200px;color:#ea4335;font-size:13px;"></div>
    </div>
  `;

  document.getElementById('btn-refresh-cosmos')?.addEventListener('click', () => loadAndRender());

  window.refreshCosmos = loadAndRender;

  loadAndRender();
}

// ── 数据加载 + 3D 渲染 ─────────────────────────────────

async function loadAndRender() {
  if (!containerEl) return;

  const loadingEl = document.getElementById('cosmos-loading');
  const container3d = document.getElementById('cosmos-3d-container');
  const errorEl = document.getElementById('cosmos-error');

  if (loadingEl) loadingEl.style.display = 'flex';
  if (container3d) container3d.style.display = 'none';
  if (errorEl) errorEl.style.display = 'none';

  if (abortCtrl) abortCtrl.abort();
  abortCtrl = new AbortController();

  try {
    const res = await ApiClient.getCosmosSnapshot({});
    cosmosData = res?.data || res;

    if (loadingEl) loadingEl.style.display = 'none';
    if (container3d) container3d.style.display = 'block';

    initThreeScene(container3d);
    buildCosmos(cosmosData);
    renderLegend(cosmosData);
  } catch (err) {
    console.error('[cosmos] 加载失败:', err);
    if (loadingEl) loadingEl.style.display = 'none';
    if (errorEl) {
      errorEl.style.display = 'flex';
      errorEl.textContent = `❌ 加载失败: ${err.message || '未知错误'}`;
    }
  }
}

// ── Three.js 场景初始化 ─────────────────────────────────

function initThreeScene(container) {
  // 清理旧场景
  if (renderer) {
    renderer.setAnimationLoop(null);
    renderer.dispose();
  }
  if (controls) { controls.dispose(); }
  scene = null;
  camera = null;

  const w = container.clientWidth || 800;
  const h = container.clientHeight || 500;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 500);
  camera.position.set(0, 60, 100);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x050510);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  // 清空容器并挂载 canvas
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  // OrbitControls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotate = false;
  controls.minDistance = 20;
  controls.maxDistance = 250;
  controls.target.set(0, 0, 0);

  clock = new THREE.Clock();

  // 灯光
  const ambientLight = new THREE.AmbientLight(0x222244, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0x8ab4f8, 1.5);
  dirLight.position.set(50, 80, 60);
  scene.add(dirLight);

  const backLight = new THREE.DirectionalLight(0x4B0082, 0.5);
  backLight.position.set(-50, -30, -40);
  scene.add(backLight);

  // 星空背景
  createStarField();

  // 动画循环
  renderer.setAnimationLoop(() => animate());

  // resize
  const onResize = () => {
    const w2 = container.clientWidth;
    const h2 = container.clientHeight;
    if (w2 > 0 && h2 > 0) {
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
      renderer.setSize(w2, h2);
    }
  };
  window.addEventListener('resize', onResize);
  renderer._onResize = onResize;

  // ── Raycaster + Tooltip ──
  raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 0.5;

  _tooltipEl = document.createElement('div');
  _tooltipEl.id = 'cosmos-tooltip';
  _tooltipEl.style.cssText = 'position:absolute;z-index:30;pointer-events:none;background:hsla(240,20%,8%,0.88);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid hsla(260,30%,40%,0.35);border-radius:0.65rem;padding:0.55rem 0.8rem;font-size:0.78rem;color:#e0e0e0;font-family:"Noto Serif SC",serif;letter-spacing:0.04em;white-space:nowrap;display:none;transition:opacity 0.15s;';
  container.appendChild(_tooltipEl);

  const mouse = new THREE.Vector2();

  _onMouseMoveFn = (event) => {
    if (!raycaster || !camera || !scene) return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const clickables = [];
    scene.traverse(obj => { if (obj.userData?.clickable && (obj.isMesh || obj.isPoints)) clickables.push(obj); });
    const intersects = raycaster.intersectObjects(clickables, false);

    if (intersects.length > 0) {
      const obj = intersects[0].object;
      if (hoveredObj !== obj) {
        resetHover();
        hoveredObj = obj;
        if (obj.material) {
          _origEmissive = obj.material.emissiveIntensity != null ? obj.material.emissiveIntensity : 0;
          obj.material.emissiveIntensity = Math.min(3, _origEmissive * 2);
        }
        // Points material has no emissiveIntensity, highlight via opacity
        if (obj.material && obj.material.opacity != null && obj.material.emissiveIntensity == null) {
          _origEmissive = obj.material.opacity;
          obj.material.opacity = Math.min(1, _origEmissive * 1.6);
        }
      }
      const label = obj.userData?.label || '';
      const typeLabel = obj.userData?.type || '';
      if (_tooltipEl) {
        _tooltipEl.innerHTML = '<div style="font-weight:600;">' + label + '</div><div style="font-size:0.65rem;color:hsla(240,6%,55%,1);margin-top:0.15rem;">' + typeLabel + '</div>';
        _tooltipEl.style.display = 'block';
        _tooltipEl.style.left = Math.min(event.clientX - rect.left + 15, rect.width - 180) + 'px';
        _tooltipEl.style.top = Math.max(event.clientY - rect.top - 55, 5) + 'px';
      }
    } else {
      resetHover();
      hoveredObj = null;
      if (_tooltipEl) _tooltipEl.style.display = 'none';
    }
  };

  _onMouseLeaveFn = () => {
    resetHover();
    hoveredObj = null;
    if (_tooltipEl) _tooltipEl.style.display = 'none';
  };

  renderer.domElement.addEventListener('mousemove', _onMouseMoveFn, { passive: true });
  renderer.domElement.addEventListener('mouseleave', _onMouseLeaveFn);
}

// ── 星空背景 ────────────────────────────────────────────

function createStarField() {
  const starCount = 2000;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const radius = 100 + Math.random() * 200;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    const brightness = 0.3 + Math.random() * 0.7;
    const tint = Math.random();
    colors[i * 3] = brightness * (tint > 0.7 ? 0.8 : 1.0);
    colors[i * 3 + 1] = brightness * (tint > 0.7 ? 0.6 : 1.0);
    colors[i * 3 + 2] = brightness;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.8,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending
  });
  const stars = new THREE.Points(geometry, material);
  scene.add(stars);
}

// ── 构建心智宇宙 ─────────────────────────────────────────

function buildCosmos(data) {
  if (!scene || !data) return;

  // 清空旧对象（保留星空背景）
  if (sunGroup) { scene.remove(sunGroup); disposeGroup(sunGroup); sunGroup = null; }
  planetGroups.forEach(g => { scene.remove(g); disposeGroup(g); });
  planetGroups = [];
  satelliteGroups.forEach(g => { scene.remove(g); disposeGroup(g); });
  satelliteGroups = [];
  if (nebulaPoints) { scene.remove(nebulaPoints); nebulaPoints.geometry.dispose(); nebulaPoints.material.dispose(); nebulaPoints = null; }
  if (clumpPoints) { scene.remove(clumpPoints); clumpPoints.geometry.dispose(); clumpPoints.material.dispose(); clumpPoints = null; }

  const planetIdMap = new Map();
  data.planets?.forEach(p => {
    if (p.id) planetIdMap.set(p.id, p);
  });

  // 1. 中心黑洞
  sunGroup = createBlackHole(data.sun);
  scene.add(sunGroup);
  markClickable(sunGroup, { label: formatSunLabel(data.sun), type: 'sun', clickable: true });

  // 2. 行星
  data.planets?.forEach((p, i) => {
    const group = createPlanet(p);
    group._planetId = p.id;
    scene.add(group);
    planetGroups.push(group);
    markClickable(group, { label: formatPlanetLabel(p.type), type: 'planet', clickable: true });
  });

  // 3. 卫星
  data.satellites?.forEach(s => {
    const group = createSatellite(s, planetIdMap);
    scene.add(group);
    satelliteGroups.push(group);
    markClickable(group, { label: formatSatelliteLabel(s.distortion_type), type: 'satellite', clickable: true });
  });

  // 4. 暗星云
  data.nebulas?.forEach(n => {
    nebulaPoints = createNebula(n);
    if (nebulaPoints) {
      nebulaPoints.userData = { label: n.title || '潜意识暗星云', type: 'nebula', clickable: true };
      scene.add(nebulaPoints);
    }
  });

  // 5. 碎石带
  data.desire_clumps?.forEach(c => {
    clumpPoints = createLagrangeClump(c, planetIdMap);
    if (clumpPoints) {
      clumpPoints.userData = { label: c.object_name || '欲望碎石带', type: 'clump', clickable: true };
      scene.add(clumpPoints);
    }
  });
}

// ── 黑洞 ────────────────────────────────────────────────

function createBlackHole(sunData) {
  const group = new THREE.Group();

  // 黑洞球体
  const sphereGeo = new THREE.SphereGeometry(sunData.geometry.radius, 32, 32);
  const sphereMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(sunData.material_properties.base_color || '#4B0082'),
    emissive: new THREE.Color(sunData.material_properties.base_color || '#4B0082'),
    emissiveIntensity: sunData.material_properties.emissive_intensity,
    roughness: 0.3,
    metalness: 0.8
  });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  group.add(sphere);

  // 吸积盘 (torus)
  if (sunData.physical_fields?.accretion_disk_active) {
    const torusGeo = new THREE.TorusGeometry(sunData.geometry.radius * 1.8, 0.6, 16, 64);
    const torusMat = new THREE.MeshBasicMaterial({
      color: 0x8B5CF6,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    const torus = new THREE.Mesh(torusGeo, torusMat);
    torus.rotation.x = Math.PI / 2.5;
    group.add(torus);

    const torus2 = new THREE.TorusGeometry(sunData.geometry.radius * 2.2, 0.3, 8, 48);
    const torusMat2 = new THREE.MeshBasicMaterial({
      color: 0x6D28D9,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide
    });
    const torus2Mesh = new THREE.Mesh(torus2, torusMat2);
    torus2Mesh.rotation.x = Math.PI / 2.5;
    torus2Mesh.rotation.z = 0.3;
    group.add(torus2Mesh);

    // 吸积盘粒子环
    const ringParticles = 800;
    const ringPositions = new Float32Array(ringParticles * 3);
    for (let i = 0; i < ringParticles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = sunData.geometry.radius * (1.5 + Math.random() * 1.5);
      const height = (Math.random() - 0.5) * 2;
      ringPositions[i * 3] = Math.cos(angle) * radius;
      ringPositions[i * 3 + 1] = height;
      ringPositions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const ringGeo = new THREE.BufferGeometry();
    ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPositions, 3));
    const ringMat = new THREE.PointsMaterial({
      color: 0x8B5CF6,
      size: 0.15,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });
    const ringPoints = new THREE.Points(ringGeo, ringMat);
    group.add(ringPoints);
  }

  return group;
}

// ── 行星 ────────────────────────────────────────────────

function createPlanet(planetData) {
  const group = new THREE.Group();
  const p = planetData;
  const kepler = p.kepler_orbit;

  // 位置由开普勒参数计算（当前只使用初始异常）
  const angle = kepler.initial_anomaly || 0;
  const a = kepler.semi_major_axis;
  const e = kepler.eccentricity;
  // 极坐标近似：r = a(1-e²)/(1+e·cos(θ))
  const r = a * (1 - e * e) / (1 + e * Math.cos(angle));
  const tilt = kepler.inclination || 0;

  const x = r * Math.cos(angle);
  const z = r * Math.sin(angle) * Math.cos(tilt);
  const y = r * Math.sin(angle) * Math.sin(tilt);
  group.position.set(x, y, z);

  // 轨道线
  const orbitPoints = [];
  for (let i = 0; i <= 64; i++) {
    const theta = (i / 64) * Math.PI * 2;
    const r2 = a * (1 - e * e) / (1 + e * Math.cos(theta));
    const ox = r2 * Math.cos(theta);
    const oz = r2 * Math.sin(theta) * Math.cos(tilt);
    const oy = r2 * Math.sin(theta) * Math.sin(tilt);
    orbitPoints.push(new THREE.Vector3(ox, oy, oz));
  }
  const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
  const orbitMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(p.visual_layer.atmosphere_glow_color || '#666666'),
    transparent: true,
    opacity: 0.15
  });
  const orbitLine = new THREE.Line(orbitGeo, orbitMat);
  scene.add(orbitLine);
  group._orbitLine = orbitLine;

  // 星球
  const sphereGeo = new THREE.SphereGeometry(p.visual_layer.radius, 24, 24);
  const sphereMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(p.visual_layer.atmosphere_glow_color || '#666666'),
    roughness: 0.6,
    metalness: 0.2,
    emissive: new THREE.Color(p.visual_layer.atmosphere_glow_color || '#666666'),
    emissiveIntensity: 0.05
  });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  group.add(sphere);

  // 大气层发光
  const glowGeo = new THREE.SphereGeometry(p.visual_layer.radius * 1.1, 24, 24);
  const glowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(p.visual_layer.atmosphere_glow_color || '#666666'),
    transparent: true,
    opacity: 0.15 * (p.visual_layer.atmosphere_density || 0.5),
    side: THREE.BackSide
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  group.add(glow);

  return group;
}

// ── 卫星 + 粒子尾迹 ────────────────────────────────────

function createSatellite(satData, planetIdMap) {
  const group = new THREE.Group();
  const refPlanet = planetIdMap.get(satData.parent_planet_id);

  // 如果没有找到父行星，放在原点
  let parentPos = new THREE.Vector3(0, 0, 0);
  if (refPlanet) {
    // 找到父行星对应的 group
    const parentGroup = planetGroups.find(g => g._planetId === satData.parent_planet_id);
    if (parentGroup) {
      parentPos.copy(parentGroup.position);
    }
  }
  group.position.copy(parentPos);

  // 卫星小球体
  const satGeo = new THREE.SphereGeometry(satData.geometry.radius, 12, 12);
  const satMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(satData.particle_tail.stream_color || '#8B0000'),
    emissive: new THREE.Color(satData.particle_tail.stream_color || '#8B0000'),
    emissiveIntensity: 0.3,
    roughness: 0.4
  });
  const sat = new THREE.Mesh(satGeo, satMat);
  sat.position.x = satData.orbit_radius;
  group.add(sat);

  // 粒子尾迹
  const tailCount = Math.floor(satData.particle_tail.length * 20);
  const tailPositions = new Float32Array(tailCount * 3);
  for (let i = 0; i < tailCount; i++) {
    const t = i / tailCount;
    const spread = (1 - t) * 0.5;
    tailPositions[i * 3] = satData.orbit_radius - t * satData.particle_tail.length * 0.5;
    tailPositions[i * 3 + 1] = (Math.random() - 0.5) * spread;
    tailPositions[i * 3 + 2] = (Math.random() - 0.5) * spread;
  }
  const tailGeo = new THREE.BufferGeometry();
  tailGeo.setAttribute('position', new THREE.BufferAttribute(tailPositions, 3));
  const tailMat = new THREE.PointsMaterial({
    color: new THREE.Color(satData.particle_tail.stream_color || '#8B0000'),
    size: 0.12,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending
  });
  const tailPoints = new THREE.Points(tailGeo, tailMat);
  group.add(tailPoints);

  return group;
}

// ── 潜意识暗星云 ────────────────────────────────────────

function createNebula(nebData) {
  if (!nebData.particle_system) return null;

  const count = Math.min(Math.max(nebData.particle_system.count, 2000), 15000);
  const boundR = nebData.particle_system.bounding_radius;
  const center = nebData.center_position || [0, 0, 0];
  const isDark = nebData.particle_system.is_dark_nebula;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    // 用球体分布
    const radius = Math.random() * boundR;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = center[0] + radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = center[1] + radius * Math.cos(phi) * 0.4;
    positions[i * 3 + 2] = center[2] + radius * Math.sin(phi) * Math.sin(theta);

    if (isDark) {
      // 吸光暗星云：低亮度、暗紫色
      colors[i * 3] = 0.05 + Math.random() * 0.1;
      colors[i * 3 + 1] = 0.01 + Math.random() * 0.05;
      colors[i * 3 + 2] = 0.05 + Math.random() * 0.15;
    } else {
      colors[i * 3] = 0.2 + Math.random() * 0.3;
      colors[i * 3 + 1] = 0.1 + Math.random() * 0.2;
      colors[i * 3 + 2] = 0.3 + Math.random() * 0.4;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: isDark ? 0.5 : 0.3,
    vertexColors: true,
    transparent: true,
    opacity: isDark ? 0.5 : 0.3,
    blending: isDark ? THREE.NormalBlending : THREE.AdditiveBlending,
    depthWrite: false
  });

  return new THREE.Points(geometry, material);
}

// ── 拉格朗日欲望碎石带 ──────────────────────────────────

function createLagrangeClump(clumpData, planetIdMap) {
  const refPlanet = planetIdMap.get(clumpData.parent_planet_id);
  if (!refPlanet) return null;

  // 在 L4/L5 位置生成粒子群
  const count = Math.floor(clumpData.particle_density * 400);
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const spread = 3.0;
    positions[i * 3] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
    sizes[i] = 0.05 + Math.random() * 0.2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    color: new THREE.Color('#FFD700'),
    size: 0.08,
    transparent: true,
    opacity: 0.6 + clumpData.particle_density * 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  return new THREE.Points(geometry, material);
}

// ── 动画循环 ────────────────────────────────────────────

function animate() {
  if (!scene || !renderer || !controls) return;

  const delta = clock?.getDelta() || 0.016;

  // 黑洞自转
  if (sunGroup) {
    sunGroup.rotation.y += delta * 0.15;
  }

  // 行星公转
  if (cosmosData?.planets && planetGroups.length > 0) {
    cosmosData.planets.forEach((p, i) => {
      const group = planetGroups[i];
      if (!group) return;
      const kepler = p.kepler_orbit;
      const a = kepler.semi_major_axis;
      const e = kepler.eccentricity;
      const tilt = kepler.inclination || 0;
      // 在轨道上推进
      if (!group._orbitAngle) group._orbitAngle = kepler.initial_anomaly || 0;
      group._orbitAngle += delta * 0.15;
      const angle = group._orbitAngle;
      const r = a * (1 - e * e) / (1 + e * Math.cos(angle));
      const x = r * Math.cos(angle);
      const z = r * Math.sin(angle) * Math.cos(tilt);
      const y = r * Math.sin(angle) * Math.sin(tilt);
      group.position.set(x, y, z);
    });
  }

  controls.update();
}

// ── 图例 ────────────────────────────────────────────────

function renderLegend(data) {
  const legendEl = document.getElementById('cosmos-legend');
  if (!legendEl) return;

  const items = [
    { color: '#4B0082', label: '认知塌缩黑洞' },
    { color: '#6A5ACD', label: `亲密关系 (偏心率 ${data.sun?.render_type === 'BLACK_HOLE' ? '0.88' : '—'})` },
    { color: '#4682B4', label: '事业野心' },
    { color: '#8B0000', label: '自动思维卫星' },
    { color: '#2D1B69', label: '潜意识暗星云' },
    { color: '#FFD700', label: '欲望客体碎石带' }
  ];

  legendEl.innerHTML = items.map(item => `
    <span style="display:inline-flex;align-items:center;gap:5px;">
      <span style="width:10px;height:10px;border-radius:50%;background:${item.color};display:inline-block;"></span>
      ${item.label}
    </span>
  `).join('');
  legendEl.style.display = 'flex';
}

// ── 工具函数 ────────────────────────────────────────────

function disposeGroup(group) {
  group.traverse(child => {
    if (child.isMesh || child.isPoints) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  });
  if (group._orbitLine) {
    group._orbitLine.geometry.dispose();
    group._orbitLine.material.dispose();
    scene?.remove(group._orbitLine);
  }
}

// ── Raycaster 工具 ──

function markClickable(group, userData) {
  group.traverse(obj => {
    if (obj.isMesh) {
      obj.userData = { ...obj.userData, ...userData };
    }
  });
}

function resetHover() {
  if (hoveredObj?.material && _origEmissive != null) {
    if (hoveredObj.material.emissiveIntensity != null) {
      hoveredObj.material.emissiveIntensity = _origEmissive;
    }
    if (hoveredObj.material.opacity != null && hoveredObj.material.emissiveIntensity == null) {
      hoveredObj.material.opacity = _origEmissive;
    }
    _origEmissive = null;
  }
}

// ── 标签格式化 ──

function formatSunLabel(sunData) {
  const schema = sunData?.cbt_schema_type;
  if (schema) return schema;
  if (sunData?.physical_fields?.hawking_radiation_label) return sunData.physical_fields.hawking_radiation_label;
  return '认知核心';
}

function formatPlanetLabel(type) {
  if (!type) return '未知行星';
  const map = {
    CAREER_AMBITION: '事业野心',
    INTIMACY_RELATIONSHIP: '亲密关系',
    EGO_IDENTITY: '自我认同',
    SOCIAL_MASK: '社会面具',
    CREATIVE_DRIVE: '创作驱动',
    KNOWLEDGE_HUNGER: '求知渴望'
  };
  return map[type] || type.replace(/_/g, ' ');
}

function formatSatelliteLabel(distortionType) {
  if (!distortionType) return '自动思维';
  const map = {
    CATASTROPHIZING: '灾难化思维',
    POLARIZED_THINKING: '非黑即白',
    OVERGENERALIZATION: '过度概括',
    MIND_READING: '读心术',
    EMOTIONAL_REASONING: '情绪推理',
    LABELING: '贴标签'
  };
  return map[distortionType] || distortionType.replace(/_/g, ' ');
}
