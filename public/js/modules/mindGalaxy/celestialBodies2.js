/**
 * 心智星系 v2 · 天体工厂(2/2)
 * 职责：binary_companion / asteroid_belt / dark_matter / supernova_remnant / neutron_star
 */
import { generateGlowTexture } from './textures.js';

const THREE = () => window.THREE;

function hexToColor(hex) {
  const T = THREE();
  return new T.Color(hex);
}

function disposeObj(obj) {
  if (!obj) return;
  obj.traverse?.(child => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
      else child.material.dispose();
    }
  });
}

// ── binary_companion ──

export function createBinaryCompanion(body) {
  const T = THREE();
  const group = new T.Group();
  const r = body.visual?.radius || 1.5;
  const color = hexToColor(body.visual?.colorHex || '#FFA07A');

  // Main star
  const geo1 = new T.SphereGeometry(r, 32, 32);
  const mat1 = new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, roughness: 0.3 });
  const star1 = new T.Mesh(geo1, mat1);
  group.add(star1);

  // Companion
  const geo2 = new T.SphereGeometry(r * 0.6, 24, 24);
  const mat2 = new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, roughness: 0.3 });
  const star2 = new T.Mesh(geo2, mat2);
  star2.position.set(r * 3, 0, 0);
  group.add(star2);

  // Gravity line (dashed Bezier)
  const curve = new T.CubicBezierCurve3(
    new T.Vector3(0, 0, 0), new T.Vector3(r, r * 2, 0),
    new T.Vector3(r * 2, -r, 0), new T.Vector3(r * 3, 0, 0)
  );
  const points = curve.getPoints(20);
  const lineGeo = new T.BufferGeometry().setFromPoints(points);
  const lineMat = new T.LineBasicMaterial({ color, transparent: true, opacity: 0.3 });
  const line = new T.Line(lineGeo, lineMat);
  group.add(line);

  group.userData = { type: 'binary_companion' };
  return {
    group,
    update(delta) {
      star1.rotation.y += delta * 0.2;
      star2.rotation.y += delta * 0.3;
    },
    dispose() { disposeObj(group); }
  };
}

// ── asteroid_belt ──

export function createAsteroidBelt(body) {
  const T = THREE();
  const group = new T.Group();
  const count = Math.min(1000, body.visual?.particleCount || 300);
  const color = hexToColor(body.visual?.colorHex || '#8888AA');
  const bound = 2 + (body.visual?.radius || 0.05) * 20;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = bound * (0.7 + Math.random() * 0.3);
    const y = (Math.random() - 0.5) * 1.5;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
    const c = color.clone().multiplyScalar(0.5 + Math.random() * 0.5);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(positions, 3));
  geo.setAttribute('color', new T.BufferAttribute(colors, 3));
  const mat = new T.PointsMaterial({ size: 0.2, vertexColors: true, blending: T.AdditiveBlending, depthWrite: false });
  const points = new T.Points(geo, mat);
  group.add(points);

  group.userData = { type: 'asteroid_belt' };
  return {
    group,
    update(delta) {
      group.rotation.y += delta * 0.1;
    },
    dispose() { disposeObj(group); }
  };
}

// ── dark_matter ──

export function createDarkMatter(body) {
  const T = THREE();
  const group = new T.Group();
  const r = body.visual?.opacity ? 2 + body.visual.opacity * 8 : 4;
  const color = hexToColor(body.visual?.colorHex || '#222244');

  const geo = new T.SphereGeometry(r, 16, 16);
  const mat = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.15, side: T.BackSide });
  group.add(new T.Mesh(geo, mat));

  // Inner fog
  const innerGeo = new T.SphereGeometry(r * 0.7, 16, 16);
  const innerMat = new T.MeshBasicMaterial({ color: 0x000022, transparent: true, opacity: 0.1 });
  group.add(new T.Mesh(innerGeo, innerMat));

  group.userData = { type: 'dark_matter' };
  return {
    group,
    update() {},
    dispose() { disposeObj(group); }
  };
}

// ── supernova_remnant ──

export function createSupernovaRemnant(body) {
  const T = THREE();
  const group = new T.Group();
  const color = hexToColor(body.visual?.colorHex || '#FF6347');
  const count = Math.min(4000, body.visual?.particleCount || 2000);

  // Expanding shell particles
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = 3 + Math.random() * 8;
    positions[i * 3] = Math.cos(theta) * Math.sin(phi) * radius;
    positions[i * 3 + 1] = Math.sin(theta) * Math.sin(phi) * radius;
    positions[i * 3 + 2] = Math.cos(phi) * radius;
    const c = color.clone().multiplyScalar(0.3 + Math.random() * 0.7);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(positions, 3));
  geo.setAttribute('color', new T.BufferAttribute(colors, 3));
  const mat = new T.PointsMaterial({
    size: 0.3,
    vertexColors: true,
    blending: T.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.6
  });
  group.add(new T.Points(geo, mat));

  // Central remnant
  const coreGeo = new T.SphereGeometry(0.3, 16, 16);
  const coreMat = new T.MeshBasicMaterial({ color: 0xFFFFFF });
  group.add(new T.Mesh(coreGeo, coreMat));

  group.userData = { type: 'supernova_remnant' };
  return {
    group,
    update(delta) {
      group.children.forEach((child, i) => {
        if (child.isPoints && child.geometry?.attributes?.position) {
          const pos = child.geometry.attributes.position;
          for (let j = 0; j < pos.count; j++) {
            pos.array[j * 3] *= 1 + delta * 0.02;
            pos.array[j * 3 + 1] *= 1 + delta * 0.02;
            pos.array[j * 3 + 2] *= 1 + delta * 0.02;
          }
          pos.needsUpdate = true;
        }
      });
    },
    dispose() { disposeObj(group); }
  };
}

// ── neutron_star ──

export function createNeutronStar(body) {
  const T = THREE();
  const group = new T.Group();

  const coreGeo = new T.SphereGeometry(0.2, 32, 32);
  const coreMat = new T.MeshBasicMaterial({ color: 0xFFFFFF });
  group.add(new T.Mesh(coreGeo, coreMat));

  // Pulsar beams
  const beamGeo = new T.CylinderGeometry(0.05, 0.05, 3, 8);
  const beamMat = new T.MeshBasicMaterial({ color: 0xAADDFF, transparent: true, opacity: 0.6 });
  const beam1 = new T.Mesh(beamGeo, beamMat);
  beam1.rotation.x = Math.PI / 2;
  const beam2 = new T.Mesh(beamGeo, beamMat);
  beam2.rotation.x = Math.PI / 2;

  // Glow ring
  const ringGeo = new T.TorusGeometry(0.6, 0.05, 8, 32);
  const ringMat = new T.MeshBasicMaterial({ color: 0xAADDFF, transparent: true, opacity: 0.5 });
  const ring = new T.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 3;

  const glowGroup = new T.Group();
  glowGroup.add(beam1, beam2, ring);
  group.add(glowGroup);

  group.userData = { type: 'neutron_star' };
  return {
    group,
    update(delta) {
      glowGroup.rotation.z += delta * 5;
      glowGroup.rotation.x += delta * 3;
      const flicker = 0.5 + Math.sin(Date.now() * 0.01) * 0.3;
      beamMat.opacity = flicker;
      ringMat.opacity = flicker * 0.7;
    },
    dispose() { disposeObj(group); }
  };
}
