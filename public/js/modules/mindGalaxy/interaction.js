/**
 * 心智星系 v2 · 交互系统
 * 职责：Raycaster hover/click/dblclick + 相机平滑跟随 + CSS2D 标签
 */
let raycaster, mouse, camera, controls, scene;
let hoveredObj = null, selectedObj = null;
let _origEmissive = null;
let cameraTween = null;
let _clickablesCache = null;
let _cacheFrame = 0;

// ── CSS2D 标签系统 ──
let labelRenderer = null;
let labelObjects = [];
let labelsVisible = true;
let _scene = null;
let _camera = null;
let _searchListeners = [];
let _celestialItemsProvider = null;
let _systemMode = false;
let _visibilityChangeHandler = null;

function escapeHtml(str) {
  if (str == null) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

export function initInteraction(rs) {
  raycaster = rs.raycaster;
  mouse = rs.mouse;
  camera = rs.camera;
  controls = rs.controls;
  scene = rs.scene;

  window.addEventListener('mousemove', onMouseMove, { passive: true });
  window.addEventListener('click', onClick);
  window.addEventListener('dblclick', onDoubleClick);
  window.addEventListener('keydown', onKeyDown);

  initSearch();
}

export function setCelestialItemsProvider(provider) {
  _celestialItemsProvider = typeof provider === 'function' ? provider : null;
}

export function setVisibilityChangeHandler(handler) {
  _visibilityChangeHandler = typeof handler === 'function' ? handler : null;
}

export function disposeInteraction() {
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('click', onClick);
  window.removeEventListener('dblclick', onDoubleClick);
  window.removeEventListener('keydown', onKeyDown);
  _searchListeners.forEach(({ el, type, fn }) => el.removeEventListener(type, fn));
  _searchListeners = [];
  _clickablesCache = null;
  hoveredObj = selectedObj = null;
}

function getTypeLabel(type) {
  const map = {
    black_hole: '银心 · 核心自我',
    giant_star: '巨星 · 核心价值观',
    main_sequence: '主序星 · 人生主题',
    planet_system: '行星系统 · 心智模式',
    nebula: '星云 · 情绪场',
    binary_companion: '伴星 · 重要他人',
    asteroid_belt: '小行星带 · 记忆碎片',
    dark_matter: '暗物质 · 潜意识',
    supernova_remnant: '超新星遗迹 · 观念转变',
    neutron_star: '中子星 · 固化伤痛'
  };
  return map[type] || '天体 · ' + (type || '未知');
}

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  if (!raycaster || !camera) return;
  raycaster.setFromCamera(mouse, camera);

  if (!_clickablesCache || _cacheFrame++ > 30) {
    _clickablesCache = [];
    scene.traverse(obj => { if (obj.userData?.clickable) _clickablesCache.push(obj); });
    _cacheFrame = 0;
  }
  const intersects = raycaster.intersectObjects(_clickablesCache, false);

  const tooltip = document.getElementById('tooltip');
  if (intersects.length > 0) {
    const obj = intersects[0].object;
    if (hoveredObj !== obj) {
      resetHover();
      hoveredObj = obj;
      if (obj.material) {
        _origEmissive = obj.material.emissiveIntensity;
        obj.material.emissiveIntensity = Math.min(3, _origEmissive * 2);
      }
    }
    const data = obj.userData;
    if (tooltip && data) {
      tooltip.classList.add('visible');
      tooltip.style.left = (event.clientX + 20) + 'px';
      tooltip.style.top = (event.clientY - 40) + 'px';
      tooltip.querySelector('.tt-name').textContent = data.name || data.bodyName || '';
      tooltip.querySelector('.tt-type').textContent = getTypeLabel(data.type);
    }
  } else {
    resetHover();
    hoveredObj = null;
    if (tooltip) tooltip.classList.remove('visible');
  }
}

function resetHover() {
  if (hoveredObj?.material && _origEmissive != null) {
    hoveredObj.material.emissiveIntensity = _origEmissive;
    _origEmissive = null;
  }
}

function onClick(event) {
  if (event.target.closest('#top-bar, #left-panel, #right-panel, #bottom-panel')) return;
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const clickables = [];
  scene.traverse(obj => { if (obj.userData?.clickable) clickables.push(obj); });
  const hits = raycaster.intersectObjects(clickables, false);

  if (hits.length > 0) {
    const obj = hits[0].object;
    selectedObj = obj;
    updateDetailPanel(obj.userData);
    const pos = new window.THREE.Vector3();
    selectedObj.getWorldPosition(pos);
    const dist = selectedObj.userData?.type === 'giant_star' ? 8 : selectedObj.userData?.type === 'nebula' ? 15 : 5;
    focusOnBody(pos, dist);
  } else {
    selectedObj = null;
    updateDetailPanel(null);
  }
}

function onDoubleClick(event) {
  if (!camera || !scene) return;
  const rect = event.target.getBoundingClientRect();
  const mx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const my = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  const v = new window.THREE.Vector3(mx, my, 0.5);
  const ray = new window.THREE.Raycaster();
  ray.setFromCamera(v, camera);
  const clickables = [];
  scene.traverse(o => { if (o.userData?.clickable) clickables.push(o); });
  const hits = ray.intersectObjects(clickables, false);
  if (!hits.length || hits[0].object.userData?.type === 'black_hole') return;
  selectedObj = hits[0].object;
  const pos = new window.THREE.Vector3();
  selectedObj.getWorldPosition(pos);
  const dist = selectedObj.userData?.type === 'giant_star' ? 8 : selectedObj.userData?.type === 'nebula' ? 15 : 5;
  if (['giant_star', 'main_sequence', 'binary_companion'].includes(selectedObj.userData?.type)) {
    enterStarSystem(selectedObj.userData);
  }
  focusOnBody(pos, dist);
}

function onKeyDown(event) {
  switch (event.key.toLowerCase()) {
    case 'escape':
      if (_systemMode) exitStarSystem();
      else {
        selectedObj = null;
        updateDetailPanel(null);
      }
      break;
    case ' ':
      event.preventDefault();
      document.getElementById('btn-play')?.click();
      break;
    case 'r':
      flyToPreset('coreFocus', 1.0);
      break;
    case 'o':
      document.getElementById('btn-orbits')?.click();
      break;
    case 'l':
      document.getElementById('btn-labels')?.click();
      break;
  }
}

function enterStarSystem(bodyData) {
  const items = _celestialItemsProvider?.() || [];
  const centerId = bodyData?.id || bodyData?.nodeId;
  if (!centerId || items.length === 0) return;
  const related = new Set([centerId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of items) {
      const parentId = item.body?.motion?.parentBodyId;
      const itemId = item.body?.id || item.body?.nodeId;
      if (parentId && related.has(parentId) && itemId && !related.has(itemId)) {
        related.add(itemId);
        changed = true;
      }
    }
  }
  items.forEach(item => {
    const itemId = item.body?.id || item.body?.nodeId;
    const visible = related.has(itemId);
    item.group.visible = visible;
    item.group.traverse(obj => { if (obj.userData) obj.userData._systemHidden = !visible; });
  });
  _visibilityChangeHandler?.();
  _systemMode = true;
  showSystemToast(`已进入「${bodyData.name || '恒星'}」系统，Esc 返回全景`);
}

function exitStarSystem() {
  const items = _celestialItemsProvider?.() || [];
  items.forEach(item => {
    item.group.visible = true;
    item.group.traverse(obj => { if (obj.userData) obj.userData._systemHidden = false; });
  });
  _visibilityChangeHandler?.();
  _systemMode = false;
  flyToPreset('panoramic', 1.0);
  showSystemToast('已返回全景视图');
}

function showSystemToast(text) {
  let toast = document.getElementById('system-mode-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'system-mode-toast';
    toast.style.cssText = 'position:fixed;left:50%;bottom:88px;transform:translateX(-50%);z-index:80;padding:0.55rem 1rem;border:1px solid hsla(260,30%,45%,0.35);border-radius:999px;background:hsla(240,20%,8%,0.82);backdrop-filter:blur(12px);color:#d9def5;font-size:0.78rem;letter-spacing:0.04em;pointer-events:none;opacity:0;transition:opacity .2s ease;';
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2200);
}

export function focusOnBody(targetPos, distance = 5) {
  if (!camera || !controls) return;
  cameraTween = {
    start: camera.position.clone(),
    end: new window.THREE.Vector3(targetPos.x + distance, targetPos.y + distance * 0.5, targetPos.z + distance),
    targetStart: controls.target.clone(),
    targetEnd: targetPos.clone(),
    progress: 0,
    duration: 1.2
  };
  controls.enabled = false;
}

// ── B3: 相机视角预设 ──

export const CAMERA_PRESETS = {
  panoramic: { pos: [0, 30, 60], target: [0, 0, 0] },
  coreFocus: { pos: [0, 5, 15], target: [0, 0, 0] },
  sideView: { pos: [50, 0, 0], target: [0, 0, 0] },
  topDown: { pos: [0, 80, 1], target: [0, 0, 0] },
  firstPerson: { pos: [0, 2, 5], target: [0, 2, 0] }
};

export function flyToPreset(name, duration = 1.0) {
  if (!camera || !controls) return;
  const preset = CAMERA_PRESETS[name];
  if (!preset) return;
  if (name === 'firstPerson') {
    const existing = document.getElementById('vr-reserved-toast');
    if (!existing) {
      const toast = document.createElement('div');
      toast.id = 'vr-reserved-toast';
      toast.textContent = '第一人称巡游';
      toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:hsla(260,60%,30%,0.9);color:#e0e0e0;padding:0.5rem 1.5rem;border-radius:2rem;font-size:0.85rem;z-index:100;pointer-events:none;';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    }
  }
  const T = window.THREE;
  cameraTween = {
    start: camera.position.clone(),
    end: new T.Vector3(...preset.pos),
    targetStart: controls.target.clone(),
    targetEnd: new T.Vector3(...preset.target),
    progress: 0,
    duration
  };
  controls.enabled = (name === 'firstPerson');
  if (name === 'firstPerson') {
    setTimeout(() => { controls.enabled = true; }, duration * 1000 + 200);
  }
}

export function updateInteraction(delta) {
  if (!cameraTween) return;
  cameraTween.progress += delta / cameraTween.duration;
  const t = cameraTween.progress > 1 ? 1 : cameraTween.progress;
  const ease = t * (2 - t); // easeOutQuad
  camera.position.lerpVectors(cameraTween.start, cameraTween.end, ease);
  controls.target.lerpVectors(cameraTween.targetStart, cameraTween.targetEnd, ease);
  if (t >= 1) {
    cameraTween = null;
    controls.enabled = true;
  }
}

function updateDetailPanel(data) {
  const empty = document.getElementById('detail-empty');
  const content = document.getElementById('detail-content');
  const panel = document.getElementById('right-panel');
  if (!data) {
    if (empty) empty.style.display = 'block';
    if (content) content.style.display = 'none';
    if (panel) panel.classList.add('collapsed');
    return;
  }
  if (panel) panel.classList.remove('collapsed');
  if (empty) empty.style.display = 'none';
  if (content) {
    content.style.display = 'block';
    const meta = data.meta || {};
    const bodyId = data.nodeId || data.id || '';
    content.innerHTML = `
      <div class="detail-header">
        <h3>${escapeHtml(data.name)}</h3>
        <span class="detail-type-tag">${escapeHtml(data.type || '未知')}</span>
      </div>
      <div class="detail-info">
        ${data.coreBelief ? `<p><strong>核心信念：</strong>${escapeHtml(data.coreBelief)}</p>` : ''}
        ${meta.coreSelf ? `<p>自我强度: ${escapeHtml(meta.coreSelf.strength)} | 稳定性: ${escapeHtml(meta.coreSelf.stability)}</p>` : ''}
        ${meta.belief ? `<p>信念层级: ${escapeHtml(meta.belief.level)} | 极性: ${meta.belief.polarity === 'pos' ? '积极' : '消极'}</p>` : ''}
        ${meta.theme ? `<p>重要度: ${escapeHtml(meta.theme.importance)} | 趋势: ${escapeHtml(meta.theme.trend)}</p>` : ''}
        ${meta.emotion ? `<p>情绪强度: ${escapeHtml(meta.emotion.intensity)}</p>` : ''}
      </div>
      <div class="detail-actions">
        <button class="detail-action-btn" data-action="rename" data-id="${escapeHtml(bodyId)}">重命名</button>
        <button class="detail-action-btn" data-action="hide" data-id="${escapeHtml(bodyId)}">隐藏</button>
        ${data.type === 'planet_system' ? `<button class="detail-action-btn" data-action="classify" data-id="${escapeHtml(bodyId)}">归类</button>` : ''}
      </div>
    `;
    bindDetailActions(bodyId);
  }
}

function bindDetailActions(bodyId) {
  const content = document.getElementById('detail-content');
  if (!content) return;
  content.querySelector('.detail-action-btn[data-action="rename"]')?.addEventListener('click', () => {
    const newName = prompt('输入新名称（最多20字符）：');
    if (newName && newName.trim()) {
      updateBodyName(bodyId, newName.trim().substring(0, 20));
    }
  });
  content.querySelector('.detail-action-btn[data-action="hide"]')?.addEventListener('click', () => {
    if (confirm('确定隐藏此星体？')) {
      hideCelestialBody(bodyId);
    }
  });
  content.querySelector('.detail-action-btn[data-action="classify"]')?.addEventListener('click', () => {
    showClassifyPopup(bodyId);
  });
}

async function updateBodyName(bodyId, newName) {
  try {
    const { ApiClient } = await import('../../api.js');
    const client = ApiClient;
    const res = await client.request('/mind-galaxy/body/rename', {
      method: 'PUT', body: JSON.stringify({ bodyId, newName }), headers: client.getHeaders()
    });
    if (res?.success) { location.reload(); }
  } catch (e) { alert('重命名失败: ' + e.message); }
}

function hideCelestialBody(bodyId) {
  const hidden = JSON.parse(localStorage.getItem('mg_hidden') || '[]');
  if (!hidden.includes(bodyId)) hidden.push(bodyId);
  localStorage.setItem('mg_hidden', JSON.stringify(hidden));
  const obj = scene.getObjectByProperty('userData.nodeId', bodyId) || scene.getObjectByProperty('userData.id', bodyId);
  if (obj) obj.visible = false;
  updateDetailPanel(null);
}

export function setBodyVisible(bodyId, visible) {
  scene.traverse(obj => {
    if (obj.userData?.nodeId === bodyId || obj.userData?.id === bodyId) {
      obj.visible = visible;
    }
  });
  const hidden = JSON.parse(localStorage.getItem('mg_hidden') || '[]');
  if (visible) {
    const idx = hidden.indexOf(bodyId);
    if (idx >= 0) hidden.splice(idx, 1);
  } else {
    if (!hidden.includes(bodyId)) hidden.push(bodyId);
  }
  localStorage.setItem('mg_hidden', JSON.stringify(hidden));
}

function showClassifyPopup(bodyId) {
  const topics = window.__mgTopics || [];
  if (topics.length === 0) {
    alert('暂无可用主题');
    return;
  }
  const select = document.createElement('select');
  select.innerHTML = '<option value="">选择主题...</option>' + topics.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a1a2e;padding:20px;border-radius:8px;z-index:1000;border:1px solid #333;';
  wrapper.innerHTML = '<div style="margin-bottom:12px;color:#e0e0e0;">选择归类主题</div>';
  wrapper.appendChild(select);
  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = '确认';
  confirmBtn.style.cssText = 'margin-top:10px;padding:6px 16px;background:#4fc3f7;border:none;border-radius:4px;cursor:pointer;';
  confirmBtn.addEventListener('click', async () => {
    if (!select.value) return;
    try {
      const { ApiClient } = await import('../../api.js');
      const client = ApiClient;
      const res = await client.request('/mind-galaxy/body/classify', {
        method: 'POST', body: JSON.stringify({ noteId: bodyId, topicId: select.value }), headers: client.getHeaders()
      });
      if (res?.success) { document.body.removeChild(wrapper); location.reload(); }
    } catch (e) { alert('归类失败: ' + e.message); }
  });
  wrapper.appendChild(confirmBtn);
  document.body.appendChild(wrapper);
}

// ── B4: 搜索与过滤 ──

let _flashTimer = null;

export function initSearch() {
  const searchInput = document.getElementById('search-input');
  const typeFilter = document.getElementById('search-type-filter');
  const clearBtn = document.getElementById('btn-clear-search');
  const push = (el, type, fn) => { el.addEventListener(type, fn); _searchListeners.push({ el, type, fn }); };

  if (searchInput) {
    push(searchInput, 'input', () => {
      const keyword = searchInput.value.trim();
      if (keyword) {
        if (typeFilter) typeFilter.value = '';
        filterByType('');
        searchAndHighlight(keyword);
      } else {
        clearSearch();
      }
    });
  }

  if (typeFilter) {
    push(typeFilter, 'change', () => {
      const type = typeFilter.value;
      if (type) {
        if (searchInput) searchInput.value = '';
        clearSearch();
        filterByType(type);
      } else {
        filterByType('');
      }
    });
  }

  if (clearBtn) {
    push(clearBtn, 'click', clearSearch);
  }
}

function searchAndHighlight(keyword) {
  if (!scene || !camera || !controls) return;
  if (_flashTimer) clearTimeout(_flashTimer);

  const lower = keyword.toLowerCase();
  const matches = [];
  scene.traverse(obj => {
    if (obj.userData?.name && obj.userData.name.toLowerCase().includes(lower)) {
      matches.push(obj);
    }
  });

  if (matches.length === 0) return;

  let flashCount = 0;
  function flash() {
    if (flashCount >= 6) {
      matches.forEach(m => { if (m.material) m.material.wireframe = false; });
      return;
    }
    const isOn = flashCount % 2 === 0;
    matches.forEach(m => {
      if (m.material) m.material.wireframe = isOn;
    });
    flashCount++;
    _flashTimer = setTimeout(flash, 200);
  }
  flash();

  const firstMatch = matches[0];
  const pos = firstMatch.getWorldPosition(new (window.THREE).Vector3());
  if (pos) focusOnBody(pos, 3);
}

function filterByType(type) {
  if (!scene) return;
  scene.traverse(obj => {
    if (obj.userData?.type) {
      obj.visible = !type || obj.userData.type === type;
    }
  });
}

function clearSearch() {
  if (_flashTimer) clearTimeout(_flashTimer);
  const si = document.getElementById('search-input');
  const sf = document.getElementById('search-type-filter');
  if (si) si.value = '';
  if (sf) sf.value = '';
  if (scene) {
    scene.traverse(obj => { if (obj.userData?.type) obj.visible = true; });
  }
}

// ── CSS2D 标签系统 ──

export function initLabels(rs, celestialItems) {
  const T = window.THREE;
  if (!T || !T.CSS2DRenderer || !rs) return;

  _scene = rs.scene;
  _camera = rs.camera;

  labelRenderer = new T.CSS2DRenderer();
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.left = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  labelRenderer.domElement.style.zIndex = '2';
  const container = document.getElementById('canvas-container');
  if (container) {
    container.appendChild(labelRenderer.domElement);
  } else {
    document.body.appendChild(labelRenderer.domElement);
  }

  function onLabelResize() {
    if (labelRenderer) {
      labelRenderer.setSize(window.innerWidth, window.innerHeight);
    }
  }
  window.addEventListener('resize', onLabelResize, { passive: true });
  labelRenderer.__resizeFn = onLabelResize;

  for (const item of celestialItems) {
    if (!item?.body?.name) continue;
    const div = document.createElement('div');
    div.className = item.body.type === 'planet_system' ? 'celestial-label planet-label' : 'celestial-label';
    div.textContent = item.body.name;

    const label = new T.CSS2DObject(div);
    const radius = item.body.visual?.radius || 1;
    const yOffset = item.body.type === 'planet_system' ? radius * 2.2 : radius * 1.8;
    label.position.set(0, yOffset, 0);
    label.userData.bodyId = item.body.id;
    label.userData.radius = radius;
    if (!labelsVisible) {
      label.visible = false;
    }

    item.group.add(label);
    labelObjects.push(label);
  }
}

export function renderLabels() {
  if (labelRenderer && _scene && _camera) {
    labelRenderer.render(_scene, _camera);
  }
}

export function disposeLabels() {
  if (labelRenderer?.__resizeFn) {
    window.removeEventListener('resize', labelRenderer.__resizeFn);
  }
  labelObjects.forEach(label => {
    if (label.element?.parentNode) {
      label.element.parentNode.removeChild(label.element);
    }
    if (label.parent) {
      label.parent.remove(label);
    }
  });
  labelObjects.length = 0;
  if (labelRenderer?.domElement?.parentNode) {
    labelRenderer.domElement.parentNode.removeChild(labelRenderer.domElement);
  }
  labelRenderer = null;
  _scene = null;
  _camera = null;
}

export function setLabelsVisible(visible) {
  labelsVisible = visible;
  labelObjects.forEach(label => { label.visible = visible; });
}

export function toggleLabels() {
  labelsVisible = !labelsVisible;
  labelObjects.forEach(label => { label.visible = labelsVisible; });
  return labelsVisible;
}
