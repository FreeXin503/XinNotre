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

function createJet(parent, color, radius, direction = 1) {
  const T = THREE();
  const height = radius * 3.8;
  const coneGeo = new T.ConeGeometry(radius * 0.18, height, 48, 1, true);
  const coneMat = new T.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.28,
    blending: T.AdditiveBlending,
    depthWrite: false,
    side: T.DoubleSide
  });
  const cone = new T.Mesh(coneGeo, coneMat);
  cone.position.y = direction * (radius * 0.28 + height / 2);
  if (direction < 0) cone.rotation.z = Math.PI;
  parent.add(cone);

  const particles = 260;
  const positions = new Float32Array(particles * 3);
  const colors = new Float32Array(particles * 3);
  for (let i = 0; i < particles; i++) {
    const t = Math.random();
    const spread = radius * 0.05 + radius * 0.28 * t;
    const angle = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(angle) * spread * Math.random();
    positions[i * 3 + 1] = direction * (radius * 0.35 + height * t);
    positions[i * 3 + 2] = Math.sin(angle) * spread * Math.random();
    colors[i * 3] = Math.min(1, color.r + 0.35);
    colors[i * 3 + 1] = Math.min(1, color.g + 0.25);
    colors[i * 3 + 2] = Math.min(1, color.b + 0.45);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(positions, 3));
  geo.setAttribute('color', new T.BufferAttribute(colors, 3));
  const mat = new T.PointsMaterial({
    size: radius * 0.035,
    vertexColors: true,
    transparent: true,
    opacity: 0.65,
    blending: T.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  });
  const points = new T.Points(geo, mat);
  parent.add(points);
  return { cone, points, direction };
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
  const jetColor = new T.Color(body.visual?.jetColorHex || '#7fc8ff');
  const jets = [createJet(group, jetColor, r, 1), createJet(group, jetColor, r, -1)];

  group.userData = { type: 'black_hole' };
  return {
    group,
    update(delta) {
      disk.rotation.z += delta * 0.3;
      core.rotation.y += delta * 0.1;
      jets.forEach((jet, index) => {
        jet.points.rotation.y += delta * (0.55 + index * 0.12);
        jet.cone.material.opacity = 0.22 + 0.08 * Math.sin(performance.now() * 0.0018 + index);
      });
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
  const colorHex = body.visual?.colorHex || '#FFD700';
  const color = hexToColor(colorHex);

  const tempHSL = {};
  color.getHSL(tempHSL);
  const hue = tempHSL.h * 360;

  const tex = generateStarSurfaceTexture(hue, 512);
  const geo = new T.SphereGeometry(r, 64, 64);
  const mat = new T.MeshStandardMaterial({
    map: tex,
    color,
    emissive: color,
    emissiveIntensity: (body.visual?.emissiveIntensity || 1) * emissiveBoost * 1.5,
    roughness: 0.4,
    metalness: 0.1
  });
  const mesh = new T.Mesh(geo, mat);
  mesh.castShadow = false;
  group.add(mesh);

  createGlow(group, colorHex, r * 5, 0.6);
  createGlow(group, colorHex, r * 9, 0.2);

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
  const colorHex = body.visual?.colorHex || '#4488CC';
  const color = hexToColor(colorHex);

  const geo = new T.SphereGeometry(r, 48, 48);
  const mat = new T.MeshStandardMaterial({
    color, roughness: 0.55, metalness: 0.2,
    emissive: color, emissiveIntensity: 0.15
  });
  const mesh = new T.Mesh(geo, mat);
  group.add(mesh);

  const atmoGeo = new T.SphereGeometry(r * 1.15, 48, 48);
  const atmoMat = new T.MeshStandardMaterial({
    color, roughness: 1, metalness: 0,
    transparent: true, opacity: 0.12, depthWrite: false,
    emissive: color, emissiveIntensity: 0.3
  });
  group.add(new T.Mesh(atmoGeo, atmoMat));

  createGlow(group, colorHex, r * 3, 0.2);

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
  const shells = [];
  for (let i = 0; i < 3; i++) {
    const shellGeo = new T.SphereGeometry(radius * (0.8 + i * 0.28), 32, 32);
    const shellMat = new T.MeshBasicMaterial({
      map: nebulaTex,
      color,
      transparent: true,
      opacity: density * (0.2 - i * 0.045),
      side: T.DoubleSide,
      depthWrite: false,
      blending: T.AdditiveBlending
    });
    const shell = new T.Mesh(shellGeo, shellMat);
    shell.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    group.add(shell);
    shells.push(shell);
  }

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
      shells.forEach((shell, index) => {
        shell.rotation.y += delta * motionSpeed * (0.08 + index * 0.04);
        shell.rotation.z -= delta * motionSpeed * (0.035 + index * 0.02);
      });
      particles.rotation.y += delta * motionSpeed * 0.5;
      particles.rotation.x += delta * motionSpeed * 0.2;
    },
    dispose() { disposeObj(group); }
  };
}
