/**
 * 心智星系 v2 · 纹理库
 * 职责：程序化 CanvasTexture 生成
 */
const GL = () => window.THREE;

export function generateGlowTexture(innerColor, outerColor, size = 256) {
  const THREE = GL();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, innerColor);
  gradient.addColorStop(0.3, innerColor);
  gradient.addColorStop(0.7, outerColor);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function generateStarSurfaceTexture(hue, size = 128) {
  const THREE = GL();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size * 8;
      const ny = y / size * 8;
      const n = Math.sin(nx * 1.3) * Math.cos(ny * 0.8)
        + Math.sin(nx * 2.7 + ny * 1.7) * 0.5
        + Math.sin(ny * 5.1 - nx * 0.5) * 0.3
        + Math.sin(nx * 9.7 + ny * 3.2) * 0.15;
      const brightness = 0.4 + (n + 1) / 4;
      const r = Math.floor(brightness * 255);
      const g = Math.floor(brightness * 200);
      const b = Math.floor(brightness * 150);
      const idx = (y * size + x) * 4;
      imageData.data[idx] = r;
      imageData.data[idx + 1] = g;
      imageData.data[idx + 2] = b;
      imageData.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function generateNebulaTexture(colors, size = 256) {
  const THREE = GL();
  const fallbackColors = ['rgba(255,107,53,0.3)', 'rgba(247,147,30,0.25)', 'rgba(255,215,0,0.2)', 'rgba(200,80,180,0.15)'];
  const palette = (colors && colors.length > 0) ? colors : fallbackColors;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 10; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = size * 0.1 + Math.random() * size * 0.35;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    const col = palette[i % palette.length];
    grad.addColorStop(0, col);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function generateBlackHoleDiskTexture(size = 256) {
  const THREE = GL();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2, cy = size / 2;
  const grad = ctx.createRadialGradient(cx, cy, size * 0.02, cx, cy, size * 0.45);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.05, 'rgba(0,0,0,0.95)');
  grad.addColorStop(0.2, 'rgba(200,80,0,0.9)');
  grad.addColorStop(0.4, 'rgba(255,140,0,0.7)');
  grad.addColorStop(0.6, 'rgba(180,60,180,0.5)');
  grad.addColorStop(0.8, 'rgba(80,0,120,0.3)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 200; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = size * 0.05 + Math.random() * size * 0.35;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    ctx.fillStyle = 'rgba(255,200,100,' + (0.1 + Math.random() * 0.4) + ')';
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
