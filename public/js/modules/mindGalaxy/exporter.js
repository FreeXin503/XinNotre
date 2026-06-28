/**
 * 心智星系 v2 · 导出器
 * 职责：canvas 截图导出、JSON 数据导出
 */

export function initExporter(rs) {
  const btnImage = document.getElementById('btn-export-image');
  const btnJson = document.getElementById('btn-export-json');

  if (btnImage) {
    btnImage.addEventListener('click', () => exportImage(rs.renderer, '1080p'));
  }
  if (btnJson) {
    btnJson.addEventListener('click', () => exportJson());
  }

  // B3: view presets
  document.getElementById('btn-reset')?.addEventListener('click', () => {
    import('./interaction.js').then(m => m.flyToPreset('panoramic'));
  });
  document.getElementById('btn-preset-core')?.addEventListener('click', () => {
    import('./interaction.js').then(m => m.flyToPreset('coreFocus'));
  });
  document.getElementById('btn-preset-side')?.addEventListener('click', () => {
    import('./interaction.js').then(m => m.flyToPreset('sideView'));
  });
  document.getElementById('btn-preset-top')?.addEventListener('click', () => {
    import('./interaction.js').then(m => m.flyToPreset('topDown'));
  });
  document.getElementById('btn-preset-fp')?.addEventListener('click', () => {
    import('./interaction.js').then(m => m.flyToPreset('firstPerson'));
  });

  // C10: video export
  document.getElementById('btn-export-video')?.addEventListener('click', () => {
    exportVideo(rs.renderer, 15, 30);
  });
}

function exportImage(renderer, resolution = '1080p') {
  if (!renderer) return;

  const presets = {
    '1080p': { w: 1920, h: 1080 },
    '2K': { w: 2560, h: 1440 },
    '4K': { w: 3840, h: 2160 },
    'mobile': { w: 1080, h: 1920 }
  };
  const size = presets[resolution] || presets['1080p'];

  const origW = renderer.domElement.width;
  const origH = renderer.domElement.height;
  const origPR = renderer.getPixelRatio();

  try {
    renderer.setPixelRatio(1);
    renderer.setSize(size.w, size.h, false);
    if (typeof window.__mgRenderOnce === 'function') window.__mgRenderOnce();
    const canvas = renderer.domElement;
    canvas.toBlob(blob => {
      renderer.setPixelRatio(origPR);
      renderer.setSize(origW, origH, false);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `mind-galaxy-${Date.now()}.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast('截图已保存');
    }, 'image/png');
  } catch (err) {
    renderer.setPixelRatio(origPR);
    renderer.setSize(origW, origH, false);
    showToast('截图导出失败: ' + err.message, true);
  }
}

async function exportJson() {
  try {
    const { ApiClient } = await import('../../api.js');
    const client = new ApiClient();
    const res = await client.exportGalaxy('json');
    if (!res?.success) {
      showToast('数据导出失败: ' + (res?.error || '未知错误'), true);
      return;
    }

    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `mind-galaxy-data-${Date.now()}.json`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showToast('JSON 数据已导出');
  } catch (err) {
    showToast('JSON 导出失败: ' + err.message, true);
  }
}

function showToast(msg, isError = false) {
  const existing = document.getElementById('mg-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'mg-toast';
  toast.textContent = msg;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '5rem',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '100',
    padding: '0.65rem 1.25rem',
    borderRadius: '0.75rem',
    background: isError ? 'hsla(0, 60%, 40%, 0.9)' : 'hsla(140, 50%, 35%, 0.9)',
    color: '#fff',
    fontSize: '0.8rem',
    fontFamily: "'Noto Serif SC', serif",
    backdropFilter: 'blur(8px)',
    border: isError ? '1px solid hsla(0, 60%, 50%, 0.4)' : '1px solid hsla(140, 50%, 50%, 0.4)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    pointerEvents: 'none',
    opacity: '0',
    transition: 'opacity 0.3s ease'
  });
  document.body.appendChild(toast);

  requestAnimationFrame(() => { toast.style.opacity = '1'; });
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

export function exportGLTF(scene) {
  if (!scene) return;
  const GLTFExporter = window.THREE?.GLTFExporter;
  if (!GLTFExporter) {
    showToast('需要 Three.js GLTFExporter', true);
    return;
  }

  try {
    const exporter = new GLTFExporter();
    exporter.parse(scene, (gltf) => {
      const blob = new Blob([JSON.stringify(gltf)], { type: 'model/gltf+json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `mind-galaxy-${Date.now()}.gltf`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast('GLTF 已导出');
    }, (err) => {
      showToast('GLTF 导出失败: ' + err.message, true);
    });
  } catch (err) {
    showToast('GLTF 导出失败: ' + err.message, true);
  }
}

export function exportOBJ(scene) {
  if (!scene) return;
  const THREE = window.THREE;
  if (!THREE) return;

  try {
    let objContent = '# Mind Galaxy OBJ Export\n';
    objContent += `# Generated at ${new Date().toISOString()}\n`;

    let vertexOffset = 0;

    scene.traverse((obj) => {
      if (obj.isMesh && obj.geometry) {
        const geo = obj.geometry;
        const positions = geo.getAttribute('position');
        const normals = geo.getAttribute('normal');

        if (!positions) return;

        obj.updateWorldMatrix(true, false);
        const matrix = obj.matrixWorld;
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);

        objContent += `\no ${obj.name || 'mesh'}\n`;

        for (let i = 0; i < positions.count; i++) {
          const v = new THREE.Vector3(
            positions.getX(i),
            positions.getY(i),
            positions.getZ(i)
          ).applyMatrix4(matrix);
          objContent += `v ${v.x} ${v.y} ${v.z}\n`;
        }

        if (normals) {
          for (let i = 0; i < normals.count; i++) {
            const n = new THREE.Vector3(
              normals.getX(i),
              normals.getY(i),
              normals.getZ(i)
            ).applyMatrix3(normalMatrix).normalize();
            objContent += `vn ${n.x} ${n.y} ${n.z}\n`;
          }
        }

        if (geo.index) {
          for (let i = 0; i < geo.index.count; i += 3) {
            const a = geo.index.getX(i) + 1 + vertexOffset;
            const b = geo.index.getX(i + 1) + 1 + vertexOffset;
            const c = geo.index.getX(i + 2) + 1 + vertexOffset;
            if (normals) {
              objContent += `f ${a}//${a} ${b}//${b} ${c}//${c}\n`;
            } else {
              objContent += `f ${a} ${b} ${c}\n`;
            }
          }
        } else {
          for (let i = 0; i < positions.count; i += 3) {
            const a = i + 1 + vertexOffset;
            const b = i + 2 + vertexOffset;
            const c = i + 3 + vertexOffset;
            if (normals) {
              objContent += `f ${a}//${a} ${b}//${b} ${c}//${c}\n`;
            } else {
              objContent += `f ${a} ${b} ${c}\n`;
            }
          }
        }

        vertexOffset += positions.count;
      }
    });

    const blob = new Blob([objContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `mind-galaxy-${Date.now()}.obj`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('OBJ 已导出');
  } catch (err) {
    showToast('OBJ 导出失败: ' + err.message, true);
  }
}

// ── C10: 视频导出 ──

let _videoRecorder = null;

export function exportVideo(renderer, durationSec = 15, fps = 30) {
  if (!renderer) return;
  const canvas = renderer.domElement;
  if (!canvas.captureStream) {
    showToast('当前浏览器不支持视频录制', true);
    return;
  }

  if (_videoRecorder?.state === 'recording') {
    _videoRecorder.stop();
    showToast('录制已停止');
    return;
  }

  const chunks = [];
  const stream = canvas.captureStream(fps);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';

  try {
    _videoRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000 });
  } catch {
    _videoRecorder = new MediaRecorder(stream);
  }

  _videoRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  _videoRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `mind-galaxy-${Date.now()}.webm`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('视频已导出');
    const btn = document.getElementById('btn-export-video');
    if (btn && btn.dataset.origHtml) { btn.innerHTML = btn.dataset.origHtml; delete btn.dataset.origHtml; btn.classList.remove('recording'); }
    _videoRecorder = null;
  };

  showToast(`开始录制 ${durationSec}s`);

  const recordBtn = document.getElementById('btn-export-video');
  if (recordBtn) {
    recordBtn.dataset.origHtml = recordBtn.innerHTML;
    recordBtn.classList.add('recording');
  }

  _videoRecorder.start();
  setTimeout(() => {
    if (_videoRecorder?.state === 'recording') {
      _videoRecorder.stop();
    }
  }, durationSec * 1000);
}

export function stopVideo() {
  if (_videoRecorder?.state === 'recording') {
    _videoRecorder.stop();
  }
}

// ── C25: 分享海报模板 ──

export function renderShareTemplate(type, renderer, snapshotData) {
  const size = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, size, size);

  switch (type) {
    case 'poster':
      renderPoster(ctx, size, renderer, snapshotData);
      break;
    case 'time':
      renderTimeCompare(ctx, size, snapshotData);
      break;
    case 'belief':
      renderBeliefChart(ctx, size, snapshotData);
      break;
    case 'emotion':
      renderEmotionSpectrum(ctx, size, snapshotData);
      break;
  }

  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `mind-galaxy-${type}-${Date.now()}.png`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast(`${typeNames[type]}已导出`);
  }, 'image/png');
}

const typeNames = { poster: '星系海报', time: '时间对比', belief: '信念星图', emotion: '情绪光谱' };

function renderPoster(ctx, size, renderer, snapshotData) {
  if (renderer) {
    const srcCanvas = renderer.domElement;
    const scale = Math.min((size - 160) / srcCanvas.width, (size - 400) / srcCanvas.height);
    const w = srcCanvas.width * scale, h = srcCanvas.height * scale;
    const x = (size - w) / 2, y = 60;
    ctx.fillStyle = '#000';
    ctx.fillRect(x, y, w, h);
    ctx.drawImage(srcCanvas, x, y, w, h);
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.fillText('心智星系', size / 2, size - 250);

  const galaxyType = snapshotData?.galaxyType || 'S';
  ctx.fillStyle = '#4fc3f7';
  ctx.font = '24px "Noto Serif SC", serif';
  ctx.fillText(`哈勃类型: ${galaxyType} · ${snapshotData?.bodies?.length || 0} 天体`, size / 2, size - 190);

  ctx.fillStyle = '#aaaaaa';
  ctx.font = '18px "Noto Serif SC", serif';
  ctx.fillText(new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }), size / 2, size - 140);

  ctx.fillStyle = '#555555';
  ctx.font = '14px "Noto Serif SC", serif';
  ctx.fillText('心迹星图 · 心智星系 Mind Galaxy', size / 2, size - 100);
}

function renderTimeCompare(ctx, size, snapshotData) {
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.fillText('时间演化对比', size / 2, 80);

  const leftR = 320, rightR = 760;
  const cy = size / 2 + 40;

  ctx.beginPath();
  ctx.arc(leftR, cy, 180, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(20,20,60,0.8)';
  ctx.fill();
  ctx.strokeStyle = '#4fc3f7';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#ccc';
  ctx.font = '20px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.fillText('早期', leftR, cy);

  ctx.beginPath();
  ctx.arc(rightR, cy, 180, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(20,20,60,0.8)';
  ctx.fill();
  ctx.strokeStyle = '#ff9800';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#ccc';
  ctx.fillText('现在', rightR, cy);

  ctx.beginPath();
  ctx.moveTo(leftR + 180, cy);
  ctx.lineTo(rightR - 180, cy);
  ctx.strokeStyle = '#555';
  ctx.setLineDash([8, 6]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#888';
  ctx.font = '16px "Noto Serif SC", serif';
  ctx.fillText('演化轨迹', (leftR + rightR) / 2, cy - 20);
}

function renderBeliefChart(ctx, size, data) {
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.fillText('信念星图', size / 2, 80);

  const beliefs = data?.bodies?.filter(b => b.type === 'giant_star' || b.type === 'main_sequence') || [];
  const top = beliefs.slice(0, 10);
  if (top.length === 0) top.push({ name: '暂无信念数据', visual: { colorHex: '#888' }, meta: { belief: { strength: 0 } } });

  const startY = 140, barH = 36, gap = 16, maxW = 600;
  const maxStrength = Math.max(...top.map(b => b.meta?.belief?.strength || 0.5), 0.1);

  top.forEach((b, i) => {
    const y = startY + i * (barH + gap);
    const strength = b.meta?.belief?.strength || 0.5;
    const w = (strength / maxStrength) * maxW;
    const color = b.visual?.colorHex || '#4fc3f7';
    const polarity = b.meta?.belief?.polarity;

    ctx.fillStyle = '#ccc';
    ctx.font = '20px "Noto Serif SC", serif';
    ctx.textAlign = 'right';
    ctx.fillText(b.name || '-', 210, y + barH * 0.65);

    ctx.fillStyle = color;
    ctx.fillRect(230, y, w, barH);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px "Noto Serif SC", serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(strength * 100)}%`, 230 + w + 12, y + barH * 0.65);

    if (polarity === 'pos') {
      ctx.fillStyle = '#4fc3f7';
      ctx.fillText('⊕', 230 + w + 80, y + barH * 0.65);
    } else if (polarity === 'neg') {
      ctx.fillStyle = '#ef5350';
      ctx.fillText('⊖', 230 + w + 80, y + barH * 0.65);
    }
  });
}

function renderEmotionSpectrum(ctx, size, data) {
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.fillText('情绪光谱', size / 2, 80);

  const nebulas = data?.bodies?.filter(b => b.type === 'nebula') || [];
  const palettes = ['#FFD700', '#4169E1', '#98FB98', '#FFA07A', '#FF6347', '#9370DB', '#00CED1', '#FF69B4', '#DC143C', '#999'];
  const cx = size / 2, cy = size / 2 + 60, outerR = 300, innerR = 80;
  const total = nebulas.reduce((s, b) => s + (b.visual?.density || b.meta?.emotion?.intensity || 0.3), 0) || nebulas.length || 1;

  let startAngle = -Math.PI / 2;
  nebulas.slice(0, 10).forEach((n, i) => {
    const val = n.visual?.density || n.meta?.emotion?.intensity || 0.3;
    const sweep = (val / total) * Math.PI * 2;
    const color = palettes[i % palettes.length];

    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(startAngle) * innerR, cy + Math.sin(startAngle) * innerR);
    ctx.arc(cx, cy, outerR, startAngle, startAngle + sweep);
    ctx.lineTo(cx + Math.cos(startAngle + sweep) * innerR, cy + Math.sin(startAngle + sweep) * innerR);
    ctx.arc(cx, cy, innerR, startAngle + sweep, startAngle, true);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(10,10,30,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const midAngle = startAngle + sweep / 2;
    const labelR = outerR + 50;
    ctx.fillStyle = '#ccc';
    ctx.font = '18px "Noto Serif SC", serif';
    ctx.textAlign = midAngle > Math.PI / 2 || midAngle < -Math.PI / 2 ? 'right' : 'left';
    ctx.fillText(n.name || '-', cx + Math.cos(midAngle) * labelR, cy + Math.sin(midAngle) * labelR + 6);

    startAngle += sweep;
  });

  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0a1a';
  ctx.fill();
  ctx.fillStyle = '#ccc';
  ctx.font = '16px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.fillText('我', cx, cy + 6);
}
