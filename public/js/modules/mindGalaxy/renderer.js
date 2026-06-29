import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { generateNebulaTexture } from './textures.js';

export function initRenderer(container) {
  const THREE = window.THREE;
  if (!THREE) throw new Error('Three.js not loaded');

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050510, 0.00015);
  scene.background = new THREE.Color(0x050510);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 300);
  camera.position.set(8, 12, 22);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.18;
  controls.minDistance = 4;
  controls.maxDistance = 60;
  controls.maxPolarAngle = Math.PI * 0.85;
  controls.target.set(0, 0, 0);
  controls.update();

  let resumeRotateTimer = null;
  controls.addEventListener('start', () => {
    controls.autoRotate = false;
    if (resumeRotateTimer) clearTimeout(resumeRotateTimer);
  });
  controls.addEventListener('end', () => {
    if (resumeRotateTimer) clearTimeout(resumeRotateTimer);
    resumeRotateTimer = setTimeout(() => { controls.autoRotate = true; }, 3500);
    controls._mgAutoRotateTimer = resumeRotateTimer;
  });

  const ambientLight = new THREE.AmbientLight(0x1a1a3a, 0.6);
  scene.add(ambientLight);
  const keyLight = new THREE.DirectionalLight(0x8899cc, 0.3);
  keyLight.position.set(10, 20, 5);
  scene.add(keyLight);

  const raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 0.3;
  raycaster.params.Line.threshold = 0.15;

  const clock = new THREE.Clock();
  const mouse = new THREE.Vector2();

  let composer = null;

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) composer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize, { passive: true });

  return {
    scene,
    camera,
    renderer,
    controls,
    raycaster,
    clock,
    mouse,
    _resizeFn: onResize,
    getComposer: () => composer,
    setComposer: (c) => { composer = c; }
  };
}

let _passes = null;

export function initPostProcessing(rs, params = {}) {
  const THREE = window.THREE;
  const { scene, camera, renderer } = rs;
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    params.strength ?? 0.5,
    params.radius ?? 0.4,
    params.threshold ?? 0.0
  );
  composer.addPass(bloomPass);

  const rgbShiftPass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, amount: { value: 0.001 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec2 vUv; uniform sampler2D tDiffuse; uniform float amount; void main() { vec4 cr = texture2D(tDiffuse, vUv + vec2(amount, 0.0)); vec4 cg = texture2D(tDiffuse, vUv); vec4 cb = texture2D(tDiffuse, vUv - vec2(amount, 0.0)); gl_FragColor = vec4(cr.r, cg.g, cb.b, 1.0); }'
    })
  );
  rgbShiftPass.enabled = false;
  composer.addPass(rgbShiftPass);

  const vignettePass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, intensity: { value: 0.15 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec2 vUv; uniform sampler2D tDiffuse; uniform float intensity; void main() { vec4 tex = texture2D(tDiffuse, vUv); float d = length(vUv - 0.5); tex.rgb *= 1.0 - d * intensity; gl_FragColor = tex; }'
    })
  );
  vignettePass.enabled = true;
  vignettePass.uniforms.intensity.value = 0.12;
  composer.addPass(vignettePass);

  const grainPass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, time: { value: 0 }, intensity: { value: 0.04 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec2 vUv; uniform sampler2D tDiffuse; uniform float time; uniform float intensity; float random(vec2 uv) { return fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453); } void main() { vec4 tex = texture2D(tDiffuse, vUv); float grain = random(vUv + time) * intensity; tex.rgb += grain; gl_FragColor = tex; }'
    })
  );
  grainPass.enabled = false;
  composer.addPass(grainPass);

  const dofPass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }, blur: { value: 0.5 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec2 resolution; uniform float blur; void main() { vec2 invRes = 1.0 / resolution; vec4 sum = vec4(0.0); sum += texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * invRes * blur); sum += texture2D(tDiffuse, vUv + vec2(0.0, -1.0) * invRes * blur); sum += texture2D(tDiffuse, vUv + vec2(1.0, -1.0) * invRes * blur); sum += texture2D(tDiffuse, vUv + vec2(-1.0, 0.0) * invRes * blur); sum += texture2D(tDiffuse, vUv) * 1.5; sum += texture2D(tDiffuse, vUv + vec2(1.0, 0.0) * invRes * blur); sum += texture2D(tDiffuse, vUv + vec2(-1.0, 1.0) * invRes * blur); sum += texture2D(tDiffuse, vUv + vec2(0.0, 1.0) * invRes * blur); sum += texture2D(tDiffuse, vUv + vec2(1.0, 1.0) * invRes * blur); gl_FragColor = sum / 9.5; }'
    })
  );
  dofPass.enabled = false;
  composer.addPass(dofPass);

  if (rs.setComposer) rs.setComposer(composer);

  _passes = { rgbShift: rgbShiftPass, vignette: vignettePass, grain: grainPass, dof: dofPass };

  return { composer, bloomPass, passes: _passes };
}

export function setPostEffect(name, enabled) {
  if (!_passes || !_passes[name]) return;
  _passes[name].enabled = enabled;
}

export function disposePostProcessing(rs) {
  if (rs && rs.getComposer) {
    const c = rs.getComposer();
    if (c) {
      c.dispose();
      rs.setComposer(null);
    }
  }
}

function disposeMaterial(mat) {
  if (mat.map) mat.map.dispose();
  if (mat.lightMap) mat.lightMap.dispose();
  if (mat.bumpMap) mat.bumpMap.dispose();
  if (mat.normalMap) mat.normalMap.dispose();
  if (mat.specularMap) mat.specularMap.dispose();
  if (mat.envMap) mat.envMap.dispose();
  mat.dispose();
}

export function disposeScene(scene, renderer, controls) {
  if (controls) {
    if (controls._mgAutoRotateTimer) clearTimeout(controls._mgAutoRotateTimer);
    controls.dispose();
  }
  if (scene) {
    scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => disposeMaterial(m));
        } else {
          disposeMaterial(obj.material);
        }
      }
      if (obj.texture) obj.texture.dispose();
    });
    scene.clear();
  }
  if (renderer) {
    renderer.dispose();
    if (renderer.domElement?.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  }
}

export function createOrbitLine(planetBody, parentPos) {
  const T = window.THREE;
  if (!T || !planetBody?.motion?.orbitRadius) return null;

  const radius = planetBody.motion.orbitRadius || 5;
  const inclination = planetBody.motion.orbitInclination || 0;
  const phase = planetBody.motion.orbitPhase || 0;
  const eccentricity = planetBody.motion.eccentricity || 0;

  const segments = 96;
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2 + phase;
    const r = radius * (1 + eccentricity * Math.cos(angle));
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const y = Math.sin(angle) * Math.sin(inclination) * r;
    points.push(new T.Vector3(x, y, z));
  }

  const geo = new T.BufferGeometry().setFromPoints(points);
  const mat = new T.LineBasicMaterial({
    color: 0x334466,
    transparent: true,
    opacity: 0.35,
    depthWrite: false
  });
  const line = new T.Line(geo, mat);

  if (parentPos) {
    line.position.copy(parentPos);
  }

  return line;
}

export function disposeOrbitLine(line) {
  if (!line) return;
  if (line.geometry) line.geometry.dispose();
  if (line.material) line.material.dispose();
}

export function createSkybox(scene) {
  const T = window.THREE;
  if (!T || !scene) return null;
  const SIZE = 512;
  const canvases = [];
  for (let f = 0; f < 6; f++) {
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    grad.addColorStop(0, '#050518');
    grad.addColorStop(0.5, '#0a0a30');
    grad.addColorStop(1, '#020210');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * SIZE;
      const y = Math.random() * SIZE;
      const brightness = 0.3 + Math.random() * 0.7;
      const r = 0.5 + Math.random() * 1.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180,200,255,${brightness})`;
      ctx.fill();
    }
    for (let i = 0; i < 3; i++) {
      const nx = Math.random() * SIZE;
      const ny = Math.random() * SIZE;
      const grd = ctx.createRadialGradient(nx, ny, 0, nx, ny, 60 + Math.random() * 80);
      grd.addColorStop(0, 'rgba(60,40,120,0.12)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, SIZE, SIZE);
    }
    canvases.push(c);
  }
  const texture = new T.CubeTexture(canvases);
  texture.needsUpdate = true;
  texture._canvases = canvases;
  scene.background = texture;
  return texture;
}

export function disposeSkybox(scene) {
  if (!scene) return;
  const bg = scene.background;
  if (bg?._canvases) {
    bg.dispose();
  }
  scene.background = null;
}

export function createGalaxyBackdrop(scene) {
  const T = window.THREE;
  if (!T || !scene) return null;

  const group = new T.Group();
  group.name = 'galaxyBackdrop';

  const starCount = 2600;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = 35 + Math.random() * 70;
    starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    starPositions[i * 3 + 2] = radius * Math.cos(phi);

    const roll = Math.random();
    const color = roll < 0.62 ? new T.Color(0xdfe8ff)
      : roll < 0.82 ? new T.Color(0x8fb8ff)
      : roll < 0.94 ? new T.Color(0xffd69a)
      : new T.Color(0xff9fd4);
    starColors[i * 3] = color.r;
    starColors[i * 3 + 1] = color.g;
    starColors[i * 3 + 2] = color.b;
  }
  const starGeo = new T.BufferGeometry();
  starGeo.setAttribute('position', new T.BufferAttribute(starPositions, 3));
  starGeo.setAttribute('color', new T.BufferAttribute(starColors, 3));
  const starMat = new T.PointsMaterial({
    size: 0.08,
    vertexColors: true,
    blending: T.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.88,
    sizeAttenuation: true
  });
  const stars = new T.Points(starGeo, starMat);
  stars.name = 'deepStarfield';
  group.add(stars);

  const bandCount = 5200;
  const bandPositions = new Float32Array(bandCount * 3);
  const bandColors = new Float32Array(bandCount * 3);
  for (let i = 0; i < bandCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 18 + Math.random() * 72;
    const spread = (Math.random() - 0.5) * 5.5;
    bandPositions[i * 3] = Math.cos(angle) * radius;
    bandPositions[i * 3 + 1] = spread + Math.sin(angle * 3) * 0.8;
    bandPositions[i * 3 + 2] = Math.sin(angle) * radius * 0.28;
    const color = new T.Color().setHSL(0.58 + Math.random() * 0.16, 0.55, 0.56 + Math.random() * 0.22);
    bandColors[i * 3] = color.r;
    bandColors[i * 3 + 1] = color.g;
    bandColors[i * 3 + 2] = color.b;
  }
  const bandGeo = new T.BufferGeometry();
  bandGeo.setAttribute('position', new T.BufferAttribute(bandPositions, 3));
  bandGeo.setAttribute('color', new T.BufferAttribute(bandColors, 3));
  const bandMat = new T.PointsMaterial({
    size: 0.16,
    vertexColors: true,
    blending: T.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.38,
    sizeAttenuation: true
  });
  const milkyWay = new T.Points(bandGeo, bandMat);
  milkyWay.name = 'milkyWayBand';
  milkyWay.rotation.x = -0.28;
  milkyWay.rotation.z = 0.18;
  group.add(milkyWay);

  const nebulaDefs = [
    { pos: [9, 4, -13], size: 20, colors: ['hsla(270, 65%, 42%, 0.13)', 'hsla(300, 60%, 36%, 0.08)', 'hsla(210, 55%, 46%, 0.06)'] },
    { pos: [-12, -2, -10], size: 18, colors: ['hsla(205, 58%, 42%, 0.12)', 'hsla(180, 45%, 38%, 0.07)', 'hsla(260, 42%, 44%, 0.06)'] },
    { pos: [2, 9, -18], size: 24, colors: ['hsla(30, 60%, 48%, 0.10)', 'hsla(350, 50%, 42%, 0.07)', 'hsla(290, 45%, 42%, 0.05)'] },
    { pos: [14, -5, -9], size: 17, colors: ['hsla(320, 55%, 42%, 0.12)', 'hsla(345, 48%, 38%, 0.07)', 'hsla(275, 45%, 45%, 0.05)'] }
  ];
  const nebulaSprites = nebulaDefs.map((def, index) => {
    const tex = generateNebulaTexture(def.colors, 512);
    const sprite = new T.Sprite(new T.SpriteMaterial({
      map: tex,
      blending: T.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.58
    }));
    sprite.name = `backdropNebula${index}`;
    sprite.position.set(def.pos[0], def.pos[1], def.pos[2]);
    sprite.scale.set(def.size, def.size, 1);
    group.add(sprite);
    return sprite;
  });

  const dustCount = 800;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustColors = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 36;
    dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 24;
    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 30;
    dustColors[i * 3] = 0.45 + Math.random() * 0.45;
    dustColors[i * 3 + 1] = 0.38 + Math.random() * 0.38;
    dustColors[i * 3 + 2] = 0.62 + Math.random() * 0.34;
  }
  const dustGeo = new T.BufferGeometry();
  dustGeo.setAttribute('position', new T.BufferAttribute(dustPositions, 3));
  dustGeo.setAttribute('color', new T.BufferAttribute(dustColors, 3));
  const dust = new T.Points(dustGeo, new T.PointsMaterial({
    size: 0.035,
    vertexColors: true,
    blending: T.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.52,
    sizeAttenuation: true
  }));
  dust.name = 'foregroundDust';
  group.add(dust);

  scene.add(group);
  return { group, stars, milkyWay, dust, nebulaSprites };
}

export function updateGalaxyBackdrop(backdrop, delta) {
  if (!backdrop) return;
  if (backdrop.stars) backdrop.stars.rotation.y += delta * 0.004;
  if (backdrop.milkyWay) backdrop.milkyWay.rotation.y += delta * 0.006;
  if (backdrop.dust) {
    backdrop.dust.rotation.y += delta * 0.018;
    backdrop.dust.rotation.x += delta * 0.008;
  }
  backdrop.nebulaSprites?.forEach((sprite, index) => {
    sprite.rotation.z += delta * (0.006 + index * 0.002);
  });
}

export function disposeGalaxyBackdrop(backdrop) {
  if (!backdrop?.group) return;
  backdrop.group.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (obj.material.map) obj.material.map.dispose();
      obj.material.dispose();
    }
  });
  if (backdrop.group.parent) backdrop.group.parent.remove(backdrop.group);
}

export function stopAnimation(id) {
  cancelAnimationFrame(id);
}
