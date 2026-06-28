/**
 * 心智星系 v2 · 渲染器
 * 职责：Three.js Scene/Camera/Renderer/Controls/Lighting/Raycaster 管理
 */
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

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
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
    _resizeFn: onResize
  };
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
  window.removeEventListener('resize', scene?._resizeFn);
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

export function startAnimation(frameFn) {
  // managed by index.js
}

export function stopAnimation(id) {
  cancelAnimationFrame(id);
}
