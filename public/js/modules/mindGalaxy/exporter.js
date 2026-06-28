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

  const canvas = renderer.domElement;

  try {
    if (canvas.toBlob) {
      canvas.toBlob(blob => {
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
    } else {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `mind-galaxy-${Date.now()}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast('截图已保存');
    }
  } catch (err) {
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
let _videoChunks = [];

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

  _videoChunks = [];
  const stream = canvas.captureStream(fps);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';

  try {
    _videoRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000 });
  } catch {
    _videoRecorder = new MediaRecorder(stream);
  }

  _videoRecorder.ondataavailable = (e) => { if (e.data.size > 0) _videoChunks.push(e.data); };
  _videoRecorder.onstop = () => {
    const blob = new Blob(_videoChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `mind-galaxy-${Date.now()}.webm`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('视频已导出');
    _videoRecorder = null;
  };

  showToast(`开始录制 ${durationSec}s`);

  const recordBtn = document.getElementById('btn-export-video');
  if (recordBtn) recordBtn.textContent = '停止';

  _videoRecorder.start();
  setTimeout(() => {
    if (_videoRecorder?.state === 'recording') {
      _videoRecorder.stop();
      if (recordBtn) recordBtn.textContent = '视频';
    }
  }, durationSec * 1000);
}

export function stopVideo() {
  if (_videoRecorder?.state === 'recording') {
    _videoRecorder.stop();
  }
}
