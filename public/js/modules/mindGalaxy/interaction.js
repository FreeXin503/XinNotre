/**
 * 心智星系 v2 · 交互系统
 * 职责：Raycaster hover/click/dblclick + 相机平滑跟随
 */
let raycaster, mouse, camera, controls, scene;
let hoveredObj = null, selectedObj = null;
let _origEmissive = null;
let cameraTween = null;

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
}

export function disposeInteraction() {
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('click', onClick);
  window.removeEventListener('dblclick', onDoubleClick);
  window.removeEventListener('keydown', onKeyDown);
  hoveredObj = selectedObj = null;
}

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  if (!raycaster || !camera) return;
  raycaster.setFromCamera(mouse, camera);

  const clickables = [];
  scene.traverse(obj => { if (obj.userData?.clickable) clickables.push(obj); });
  const intersects = raycaster.intersectObjects(clickables, false);

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
      tooltip.style.display = 'block';
      tooltip.style.left = event.clientX + 15 + 'px';
      tooltip.style.top = event.clientY + 15 + 'px';
      tooltip.querySelector('.tt-name').textContent = data.name || data.bodyName || '';
      tooltip.querySelector('.tt-type').textContent = data.type || '';
    }
  } else {
    resetHover();
    hoveredObj = null;
    if (tooltip) tooltip.style.display = 'none';
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
  } else {
    selectedObj = null;
    updateDetailPanel(null);
  }
}

function onDoubleClick(event) {
  if (!selectedObj || selectedObj.userData?.type === 'black_hole') return;
  const pos = selectedObj.getWorldPosition(new (window.THREE)().Vector3());
  const dist = selectedObj.userData?.type === 'giant_star' ? 8 : selectedObj.userData?.type === 'nebula' ? 15 : 5;
  focusOnBody(pos, dist);
}

function onKeyDown(event) {
  switch (event.key.toLowerCase()) {
    case 'escape':
      selectedObj = null;
      updateDetailPanel(null);
      break;
    case ' ':
      event.preventDefault();
      break;
  }
}

export function focusOnBody(targetPos, distance = 5) {
  if (!camera || !controls) return;
  cameraTween = {
    start: camera.position.clone(),
    end: new (window.THREE)().Vector3(targetPos.x + distance, targetPos.y + distance * 0.5, targetPos.z + distance),
    targetStart: controls.target.clone(),
    targetEnd: targetPos.clone(),
    progress: 0,
    duration: 1.2
  };
  controls.enabled = false;
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
    content.innerHTML = `
      <div class="detail-header">
        <h3>${data.name}</h3>
        <span class="detail-type-tag">${data.type || '未知'}</span>
      </div>
      <div class="detail-info">
        ${data.coreBelief ? `<p><strong>核心信念：</strong>${data.coreBelief}</p>` : ''}
        ${meta.coreSelf ? `<p>自我强度: ${meta.coreSelf.strength || '-'} | 稳定性: ${meta.coreSelf.stability || '-'}</p>` : ''}
        ${meta.belief ? `<p>信念层级: ${meta.belief.level || '-'} | 极性: ${meta.belief.polarity === 'pos' ? '积极' : '消极'}</p>` : ''}
        ${meta.theme ? `<p>重要度: ${meta.theme.importance || '-'} | 趋势: ${meta.theme.trend || '-'}</p>` : ''}
        ${meta.emotion ? `<p>情绪强度: ${meta.emotion.intensity || '-'}</p>` : ''}
      </div>
    `;
  }
}
