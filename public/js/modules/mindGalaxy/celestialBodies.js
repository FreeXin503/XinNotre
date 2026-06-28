/**
 * 心智星系 v2 · 天体工厂(1/2)
 * 职责：black_hole / giant_star / main_sequence / planet_system / nebula
 */
import { generateGlowTexture, generateStarSurfaceTexture, generateNebulaTexture, generateBlackHoleDiskTexture } from './textures.js';

const THREE = () => window.THREE;

// ── helpers ──

function hexToColor(hex) {
  const T = THREE();
  return new T.Color(hex);
}

function createGlow(parent, colorHex, size, opacity = 0.4) {
  const T = THREE();
  const tex = generateGlowTexture(colorHex, 'rgba(0,0,0,0)');
  const mat = new T.SpriteMaterial({ map: tex, blending: T.AdditiveBlending, depthWrite: false, opacity });
  const sprite = new T.Sprite(mat);
  sprite.scale.set(size, size, 1);
  parent.add(sprite);
  return sprite;
}

function disposeObj(obj) {
  if (!obj) return;
  if (obj.traverse) {
    obj.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });
  }
  if (obj.geometry) obj.geometry.dispose();
  if (obj.material) obj.material.dispose();
}

// ── black_hole ──

export function createBlackHole(body) {
  const T = THREE();
  const group = new T.Group();
  const r = body.visual?.radius || 5;
  const color = hexToColor(body.visual?.colorHex || '#4B0082');

  const coreGeo = new T.SphereGeometry(r * 0.3, 64, 64);
  const coreMat = new T.MeshBasicMaterial({ color: 0x000000 });
  const core = new T.Mesh(coreGeo, coreMat);
  group.add(core);

  const diskGeo = new T.TorusGeometry(r * 0.8, r * 0.15, 32, 64);
  let disk;
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (gl && gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) > 0) {
      const diskMat = new T.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: color },
          uInnerRadius: { value: 0.65 },
          uOuterRadius: { value: 1.0 }
        },
        vertexShader: 'varying vec2 vUv; varying vec3 vPos; void main() { vUv = uv; vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'varying vec2 vUv; varying vec3 vPos; uniform float uTime; uniform vec3 uColor; uniform float uInnerRadius; uniform float uOuterRadius; void main() { float dist = length(vPos.xy) / 2.0; float t = clamp((dist - uInnerRadius) / (uOuterRadius - uInnerRadius), 0.0, 1.0); float spiral = sin(atan(vPos.y, vPos.x) * 8.0 + uTime * 2.0 - dist * 10.0) * 0.5 + 0.5; float brightness = mix(1.0, 0.15, t) * (0.5 + spiral * 0.5); float alpha = mix(0.7, 0.1, t); gl_FragColor = vec4(uColor * brightness, alpha); }',
        transparent: true,
        side: T.DoubleSide,
        depthWrite: false
      });
      disk = new T.Mesh(diskGeo, diskMat);
      disk._shaderUniforms = diskMat.uniforms;
    } else {
      throw new Error('fallback');
    }
  } catch {
    const diskTex = generateBlackHoleDiskTexture();
    const diskMat = new T.MeshBasicMaterial({ map: diskTex, transparent: true, opacity: 0.7, side: T.DoubleSide, blending: T.AdditiveBlending });
    disk = new T.Mesh(diskGeo, diskMat);
  }
  disk.rotation.x = Math.PI / 2;
  group.add(disk);

  createGlow(group, body.visual?.colorHex || '#4B0082', r * 3, 0.3);

  group.userData = { type: 'black_hole' };
  return {
    group,
    update(delta) {
      disk.rotation.z += delta * 0.3;
      core.rotation.y += delta * 0.1;
      if (disk._shaderUniforms) disk._shaderUniforms.uTime.value += delta;
    },
    dispose() { disposeObj(group); }
  };
}

// ── giant_star / main_sequence ──

function createStarCommon(body, emissiveBoost = 1) {
  const T = THREE();
  const group = new T.Group();
  const r = body.visual?.radius || 2;
  const color = hexToColor(body.visual?.colorHex || '#FFD700');

  const tex = generateStarSurfaceTexture(0.15);
  const geo = new T.SphereGeometry(r, 48, 48);
  const mat = new T.MeshStandardMaterial({
    map: tex,
    color,
    emissive: color,
    emissiveIntensity: (body.visual?.emissiveIntensity || 1) * emissiveBoost,
    roughness: 0.3,
    metalness: 0.1
  });
  const mesh = new T.Mesh(geo, mat);
  mesh.castShadow = false;
  group.add(mesh);

  // Glow layers
  const glowSizes = [r * 2.5, r * 4, r * 6];
  const glowOps = [0.5, 0.25, 0.1];
  for (let i = 0; i < 3; i++) {
    createGlow(group, body.visual?.colorHex || '#FFD700', glowSizes[i], glowOps[i]);
  }

  return { group, mesh, r, color };
}

export function createGiantStar(body) {
  const { group, mesh } = createStarCommon(body, 1.5);
  group.userData = { type: 'giant_star' };
  return {
    group,
    update(delta) { mesh.rotation.y += delta * 0.15; },
    dispose() { disposeObj(group); }
  };
}

export function createMainSequence(body) {
  const { group, mesh } = createStarCommon(body, 0.8);
  group.userData = { type: 'main_sequence' };
  return {
    group,
    update(delta) { mesh.rotation.y += delta * 0.2; },
    dispose() { disposeObj(group); }
  };
}

// ── planet_system ──

export function createPlanetSystem(body) {
  const T = THREE();
  const group = new T.Group();
  const r = body.visual?.radius || 1.5;
  const color = hexToColor(body.visual?.colorHex || '#4488CC');

  const geo = new T.SphereGeometry(r, 32, 32);
  const mat = new T.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.2 });
  const mesh = new T.Mesh(geo, mat);
  group.add(mesh);

  // Atmosphere shell
  const atmoGeo = new T.SphereGeometry(r * 1.2, 32, 32);
  const atmoMat = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.15, side: T.BackSide });
  group.add(new T.Mesh(atmoGeo, atmoMat));

  createGlow(group, body.visual?.colorHex || '#4488CC', r * 3, 0.25);

  group.userData = { type: 'planet_system', orbit: body.motion };
  return {
    group,
    mesh,
    update(delta) { mesh.rotation.y += delta * 0.3; },
    dispose() { disposeObj(group); }
  };
}

// ── nebula (volume) ──

export function createNebula(body) {
  const T = THREE();
  const group = new T.Group();
  const density = body.visual?.density || 0.6;
  const radius = (body.visual?.radius || 0.2) * 10;
  const color = hexToColor(body.visual?.colorHex || '#6644AA');
  const motionSpeed = body.visual?.motionSpeed || 0.3;

  const emotionColors = body.userData?.emotionMeta?.dominant_raw_emotions?.map(e => {
    const map = { joy: '#FFD700', sadness: '#4169E1', anger: '#FF4500', fear: '#9400D3', surprise: '#00CED1', disgust: '#7CFC00', trust: '#FF69B4', anticipation: '#FFA500' };
    return map[e];
  }).filter(Boolean);
  const nebulaTex = generateNebulaTexture(emotionColors && emotionColors.length > 0 ? emotionColors : null);
  const shellGeo = new T.SphereGeometry(radius, 32, 32);
  const shellMat = new T.MeshBasicMaterial({
    map: nebulaTex, color, transparent: true, opacity: density * 0.35, side: T.DoubleSide, depthWrite: false
  });
  group.add(new T.Mesh(shellGeo, shellMat));

  const innerGeo = new T.SphereGeometry(radius * 0.6, 24, 24);
  const innerMat = new T.MeshBasicMaterial({
    color, transparent: true, opacity: density * 0.15, side: T.BackSide, depthWrite: false
  });
  group.add(new T.Mesh(innerGeo, innerMat));

  const particleCount = Math.min(5000, body.visual?.particleCount || 3000);
  const positions = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = radius * Math.pow(Math.random(), 0.7) * 1.5;
    positions[i * 3] = Math.cos(theta) * Math.sin(phi) * r;
    positions[i * 3 + 1] = Math.sin(theta) * Math.sin(phi) * r;
    positions[i * 3 + 2] = Math.cos(phi) * r;
    sizes[i] = 0.1 + Math.random() * 0.5;
  }
  const particlesGeo = new T.BufferGeometry();
  particlesGeo.setAttribute('position', new T.BufferAttribute(positions, 3));
  particlesGeo.setAttribute('size', new T.BufferAttribute(sizes, 1));
  const particlesMat = new T.PointsMaterial({
    color, size: 0.25, transparent: true, opacity: density * 0.8,
    blending: T.AdditiveBlending, depthWrite: false
  });
  const particles = new T.Points(particlesGeo, particlesMat);
  group.add(particles);
  group.userData = { type: 'nebula' };

  return {
    group,
    particles,
    update(delta) {
      particles.rotation.y += delta * motionSpeed * 0.5;
      particles.rotation.x += delta * motionSpeed * 0.2;
    },
    dispose() { disposeObj(group); }
  };
}
