import * as THREE from 'three';

export function generateStarSurface(baseColor, noiseScale = 1, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const tmp = document.createElement('div');
  tmp.style.color = baseColor || '#FFFFFF';
  document.body.appendChild(tmp);
  const rgb = getComputedStyle(tmp).color.match(/\d+/g);
  document.body.removeChild(tmp);
  const baseR = rgb ? parseInt(rgb[0]) : 255;
  const baseG = rgb ? parseInt(rgb[1]) : 200;
  const baseB = rgb ? parseInt(rgb[2]) : 150;
  const imageData = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size * 8 * noiseScale;
      const ny = y / size * 8 * noiseScale;
      const n = Math.sin(nx * 1.3) * Math.cos(ny * 0.8)
        + Math.sin(nx * 2.7 + ny * 1.7) * 0.5
        + Math.sin(ny * 5.1 - nx * 0.5) * 0.3
        + Math.sin(nx * 9.7 + ny * 3.2) * 0.15;
      const brightness = 0.5 + (n + 1) / 4.5;
      const vary = (n + 1) / 2;
      const idx = (y * size + x) * 4;
      imageData.data[idx] = Math.min(255, Math.floor(baseR * brightness * (0.8 + vary * 0.2)));
      imageData.data[idx + 1] = Math.min(255, Math.floor(baseG * brightness * (0.7 + vary * 0.3)));
      imageData.data[idx + 2] = Math.min(255, Math.floor(baseB * brightness * (0.6 + vary * 0.4)));
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

export function generateNebulaCloud(emotionColors, isDark = false, size = 512) {
  const colors = (emotionColors && emotionColors.length > 0) ? emotionColors : ['#FF6B35', '#F7931E', '#FFD700'];
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 12; i++) {
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const r = size * 0.1 + Math.random() * size * 0.35;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    const col = colors[i % colors.length];
    const alpha = (isDark ? 0.08 : 0.12) + Math.random() * (isDark ? 0.15 : 0.25);
    grad.addColorStop(0, col.replace(')', ',' + alpha + ')').replace('rgb', 'rgba'));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function generateBlackHoleDisk(baseColor = '#FF8C00', size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2, cy = size / 2;
  const grad = ctx.createRadialGradient(cx, cy, size * 0.02, cx, cy, size * 0.45);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.05, 'rgba(0,0,0,0.95)');
  grad.addColorStop(0.15, 'rgba(200,80,0,0.9)');
  grad.addColorStop(0.35, 'rgba(255,140,0,0.7)');
  grad.addColorStop(0.55, 'rgba(180,60,180,0.5)');
  grad.addColorStop(0.75, 'rgba(80,0,120,0.3)');
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

export function generateAtmosphereGlow(glowColor, density = 0.5, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2, cy = size / 2;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
  const alpha = Math.min(1, Math.max(0.1, density));
  grad.addColorStop(0, glowColor || 'rgba(100,150,255,' + alpha + ')');
  grad.addColorStop(0.3, (glowColor || 'rgba(100,150,255,1)').replace(/[\d.]+\)$/, (alpha * 0.6) + ')'));
  grad.addColorStop(0.7, 'rgba(100,150,255,' + (alpha * 0.2) + ')');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function generateGalaxyBackground(size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, size * 0.3, 0, size * 0.7);
  grad.addColorStop(0, '#0a0a1a');
  grad.addColorStop(0.45, '#1a1a3a');
  grad.addColorStop(0.5, '#2a1a3a');
  grad.addColorStop(0.55, '#1a1a3a');
  grad.addColorStop(1, '#0a0a1a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const isBlue = i % 4 === 0;
    const isYellow = i % 7 === 0;
    let r = 255, g = 255, b = 255;
    if (isBlue) { r = 160; g = 200; b = 255; }
    else if (isYellow) { r = 255; g = 228; b = 160; }
    const bright = 0.3 + Math.random() * 0.7;
    ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + bright + ')';
    const sz = 0.5 + Math.random() * 1.5;
    ctx.fillRect(x, y, sz, sz);
  }
  for (let i = 0; i < 15; i++) {
    const cx = size * 0.3 + Math.random() * size * 0.4;
    const cy = size * 0.4 + Math.random() * size * 0.2;
    const r = size * 0.03 + Math.random() * size * 0.08;
    const ngrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    const hue = Math.random();
    let rCol, gCol, bCol;
    if (hue < 0.5) { rCol = 255; gCol = 80 + Math.random() * 80; bCol = 40 + Math.random() * 60; }
    else if (hue < 0.75) { rCol = 120; gCol = 60; bCol = 200; }
    else { rCol = 40; gCol = 120; bCol = 200; }
    ngrad.addColorStop(0, 'rgba(' + rCol + ',' + gCol + ',' + bCol + ',0.3)');
    ngrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ngrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
