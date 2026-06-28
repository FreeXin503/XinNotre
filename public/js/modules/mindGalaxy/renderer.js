import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export function initRenderer(container) {
  const THREE = window.THREE;
  if (!THREE) throw new Error('Three.js not loaded');

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050510, 0.00015);
  scene.background = new THREE.Color(0x050510);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 300);
  camera.position.set(8, 12, 22);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  container.appendChild(renderer.domElement);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 3;
  controls.maxDistance = 120;
  controls.maxPolarAngle = Math.PI * 0.85;
  controls.target.set(0, 0, 0);
  controls.update();

  const ambientLight = new THREE.AmbientLight(0x223344, 0.6);
  scene.add(ambientLight);
  const keyLight = new THREE.DirectionalLight(0xffeedd, 0.8);
  keyLight.position.set(20, 30, 10);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0x334466, 0.4);
  fillLight.position.set(-15, -5, -10);
  scene.add(fillLight);

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
  vignettePass.uniforms.intensity.value = 0.25;
  composer.addPass(vignettePass);

  const grainPass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, time: { value: 0 }, intensity: { value: 0.04 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec2 vUv; uniform sampler2D tDiffuse; uniform float time; uniform float intensity; float random(vec2 uv) { return fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453); } void main() { vec4 tex = texture2D(tDiffuse, vUv); float grain = random(vUv + time) * intensity; tex.rgb += grain; gl_FragColor = tex; }'
    })
  );
  grainPass.enabled = true;
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

export function stopAnimation(id) {
  cancelAnimationFrame(id);
}
