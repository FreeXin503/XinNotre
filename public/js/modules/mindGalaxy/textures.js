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
  gradient.addColorStop(0.15, innerColor);
  gradient.addColorStop(0.4, outerColor);
  gradient.addColorStop(0.7, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function generateStarSurfaceTexture(hue, size = 512) {
  const THREE = GL();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size - 0.5;
      const ny = y / size - 0.5;
      const nr = Math.sqrt(nx * nx + ny * ny) * 2;

      let v = Math.sin(nx * 12 + ny * 8) * 0.5 + 0.5;
      v += Math.sin(nx * 20 - ny * 15 + 1.5) * 0.3;
      v += Math.sin(nx * 6 + ny * 18 + 2.8) * 0.2;
      v += Math.sin(nx * 30 + ny * 25 + 0.7) * 0.15;
      v = v / 1.15;

      const edgeFade = 1 - Math.min(1, Math.max(0, (nr - 0.7) / 0.3));
      v = v * 0.7 + 0.3;
      v *= edgeFade;

      const s = 0.6 + v * 0.4;
      const l = 0.35 + v * 0.45;

      const hRad = hue * Math.PI / 180;
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x_ = c * (1 - Math.abs((hRad / (Math.PI / 3)) % 2 - 1));
      const m = l - c / 2;
      let r_, g_, b_;
      if (hRad < Math.PI / 3) { r_ = c; g_ = x_; b_ = 0; }
      else if (hRad < 2 * Math.PI / 3) { r_ = x_; g_ = c; b_ = 0; }
      else if (hRad < Math.PI) { r_ = 0; g_ = c; b_ = x_; }
      else if (hRad < 4 * Math.PI / 3) { r_ = 0; g_ = x_; b_ = c; }
      else if (hRad < 5 * Math.PI / 3) { r_ = x_; g_ = 0; b_ = c; }
      else { r_ = c; g_ = 0; b_ = x_; }

      const idx = (y * size + x) * 4;
      data[idx] = Math.round((r_ + m) * 255);
      data[idx + 1] = Math.round((g_ + m) * 255);
      data[idx + 2] = Math.round((b_ + m) * 255);
      data[idx + 3] = 255;
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
  const fallbackColors = ['rgba(180,60,200,0.12)', 'rgba(220,80,60,0.10)', 'rgba(60,120,220,0.08)', 'rgba(200,150,40,0.10)'];
  const palette = (colors && colors.length > 0) ? colors : fallbackColors;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < palette.length; i++) {
    const cx = size * (0.2 + Math.random() * 0.6);
    const cy = size * (0.2 + Math.random() * 0.6);
    const r = size * (0.15 + Math.random() * 0.35);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, palette[i]);
    grad.addColorStop(0.5, palette[i].replace('0.12', '0.04').replace('0.10', '0.03').replace('0.08', '0.02'));
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
