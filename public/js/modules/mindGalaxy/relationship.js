export async function loadRelationshipGalaxy(token, rs, celestialItems, buildGalaxy, initLabels) {
  try {
    const { ApiClient } = await import('../../api.js');
    const client = new ApiClient();
    const res = await fetch(`/api/mind-galaxy/relationship/graph/${encodeURIComponent(token)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success || !data.data) return null;

    const { cores, bridge, bodies: rawBodies } = data.data;
    if (!rawBodies || rawBodies.length === 0) return null;

    const mergedBodies = rawBodies.map(b => {
      const isBridge = b.isBridge || (b.type === 'person' && bridge.includes(b.label));
      return {
        ...b,
        position: b.position || [0, 0, 0],
        visual: {
          ...b.visual,
          colorHex: isBridge ? '#FFD700' : (b.visual?.colorHex || '#888888'),
          emissiveIntensity: isBridge ? 2.5 : (b.visual?.emissiveIntensity || 1)
        },
        meta: { ...b.meta, isBridge }
      };
    });

    const snap = {
      galaxyType: 'S',
      spiralArms: 3,
      bodies: mergedBodies
    };

    return { snap, bridge };
  } catch {
    return null;
  }
}

export function renderBridgeLegend(bridgeNames) {
  const container = document.getElementById('canvas-container');
  if (!container) return;
  const existing = document.getElementById('rel-legend');
  if (existing) existing.remove();

  const legend = document.createElement('div');
  legend.id = 'rel-legend';
  legend.style.cssText = 'position:absolute;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:#FFD700;padding:8px 20px;border-radius:20px;font-size:14px;pointer-events:none;z-index:10;border:1px solid rgba(255,215,0,0.3);';
  legend.textContent = `共同人物：${bridgeNames.join('、') || '无'}（金色高亮）`;
  container.appendChild(legend);
}
