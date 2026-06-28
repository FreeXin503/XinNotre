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
      const n = Math.sin(nx * 1.3) * Math.cos(ny * 0.8) + Math.sin(nx * 2.1 + ny * 1.7) * 0.5 + Math.sin(ny * 3.2 - nx * 0.5) * 0.3;
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
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  for (const c of (colors || ['rgba(100,80,200,0.3)', 'rgba(50,120,200,0.2)', 'rgba(150,100,220,0.15)'])) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = size * 0.2 + Math.random() * size * 0.4;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, c);
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
  const grad = ctx.createRadialGradient(cx, cy, size * 0.05, cx, cy, size * 0.45);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.5, 'rgba(255,140,0,0.8)');
  grad.addColorStop(0.8, 'rgba(100,0,200,0.4)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
