/**
 * 心智星系 v2 · 心智图谱建模服务
 * 职责：整合分析结果构建加权有向图
 */
import crypto from 'crypto';
import MindGalaxyRepository from '../../repositories/mindGalaxyRepository.js';

const repo = new MindGalaxyRepository();

const EDGE_TYPES = ['supports', 'triggers', 'correlates', 'represses', 'derives'];

function nodeId(prefix) {
  return `${prefix}-${crypto.randomUUID().substring(0, 8)}`;
}

function edgeId() {
  return `e-${crypto.randomUUID().substring(0, 8)}`;
}

function shortHash(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex').substring(0, 16);
}

/**
 * 时间衰减因子: 1/(1 + α × 距今天数/365)
 */
function timeDecay(createdAt) {
  try {
    const days = (Date.now() - new Date(createdAt).getTime()) / 86400000;
    return 1 / (1 + 0.3 * Math.max(0, days / 365));
  } catch { return 1; }
}

/**
 * @param {Object} param0
 * @returns {Promise<Object>}
 */
export async function buildMindGraph({ basic, deep, segments }) {
  const nodes = [];
  const edges = [];
  const segmentCountByDate = new Map();

  // ── 统计时间分布 ──
  for (const seg of (segments || [])) {
    if (!seg.timestamp) continue;
    const key = seg.timestamp.substring(0, 7);
    segmentCountByDate.set(key, (segmentCountByDate.get(key) || 0) + 1);
  }

  const emotionVec = basic?.emotions20?.globalVector || new Array(20).fill(0);
  const avgEmotion = emotionVec.reduce((s, v) => s + v, 0) / (emotionVec.length || 1);
  const coreBeliefs = deep?.beliefs?.filter(b => b.level === 'core') || [];
  const allBeliefs = deep?.beliefs || [];
  const keywords = basic?.keywords || [];
  const topics = basic?.topics || [];
  const persons = basic?.entities?.persons || [];

  // ── 1. CoreSelf ──
  const selfStrength = Math.min(100, 30 + coreBeliefs.length * 10 + (segments?.length || 0) * 0.1);
  const stability = Math.min(100, 50 + allBeliefs.filter(b => b.polarity === 'pos').length * 2);
  const integration = Math.min(100, 40 + topics.length * 5 + edgeTypes().length * 3);
  const coreSelfNode = {
    id: nodeId('self'),
    type: 'CoreSelf',
    label: '核心自我',
    weight: 10.0,
    centrality: { degree: 0, betweenness: 0, eigenvector: 1.0 },
    attributes: { coreSelf: { strength: selfStrength, stability, integration } },
    sourceRefs: [],
    createdAt: new Date().toISOString()
  };
  nodes.push(coreSelfNode);

  // ── 2. Belief nodes ──
  const beliefNodes = allBeliefs.map((b, i) => {
    const decay = timeDecay(b.formedAt || new Date().toISOString());
    const freq = (b.evidence || []).length;
    const avgLen = b.label?.length || 10;
    const weight = freq * avgLen * decay * (1 + avgEmotion) * Math.log((i + 2));
    const node = {
      id: nodeId('blf'),
      type: 'Belief',
      label: b.label || `信念${i + 1}`,
      weight: Math.max(0.01, weight),
      centrality: { degree: 0, betweenness: 0, eigenvector: 0 },
      attributes: {
        belief: {
          level: b.level || 'concrete',
          strength: b.strength || 0.5,
          polarity: b.polarity || 'pos',
          formedAt: b.formedAt
        }
      },
      sourceRefs: (b.evidence || []).map(excerpt => ({
        sourceType: 'notes',
        recordId: '',
        excerpt: typeof excerpt === 'string' ? excerpt.substring(0, 200) : ''
      })),
      createdAt: b.formedAt || new Date().toISOString()
    };
    return node;
  });
  nodes.push(...beliefNodes);

  // ── 3. CoreBelief → CoreSelf supports edges ──
  for (const b of beliefNodes.filter(bn => bn.attributes.belief?.level === 'core')) {
    edges.push({
      id: edgeId(),
      type: 'supports',
      from: b.id,
      to: coreSelfNode.id,
      weight: b.attributes.belief?.strength || 0.5
    });
  }

  // ── 4. CoreBelief → SubBelief derives edges ──
  const coreBN = beliefNodes.filter(bn => bn.attributes.belief?.level === 'core');
  const subBN = beliefNodes.filter(bn => bn.attributes.belief?.level !== 'core');
  for (const sub of subBN) {
    if (coreBN.length > 0) {
      const parent = coreBN[Math.floor(Math.random() * coreBN.length)];
      edges.push({
        id: edgeId(),
        type: 'derives',
        from: parent.id,
        to: sub.id,
        weight: 0.3 + Math.random() * 0.4
      });
    }
  }

  // ── 5. Theme nodes ──
  const themeNodes = topics.map((t, i) => {
    const node = {
      id: nodeId('thm'),
      type: 'Theme',
      label: t.name || `主题${i + 1}`,
      weight: Math.max(0.1, (t.size || (i + 1)) * 0.5),
      centrality: { degree: 0, betweenness: 0, eigenvector: 0 },
      attributes: {
        theme: {
          importance: Math.min(1, (i + 1) / Math.max(1, topics.length)),
          heat: 0.5 + Math.random() * 0.3,
          trend: i < topics.length * 0.3 ? 'rising' : i > topics.length * 0.7 ? 'fading' : 'stable'
        }
      },
      sourceRefs: [],
      createdAt: new Date().toISOString()
    };
    return node;
  });
  nodes.push(...themeNodes);

  // ── 6. Theme → Belief correlates ──
  for (const th of themeNodes) {
    for (const b of beliefNodes.slice(0, 3)) {
      edges.push({
        id: edgeId(),
        type: 'correlates',
        from: th.id,
        to: b.id,
        weight: 0.3 + Math.random() * 0.5
      });
    }
  }

  // ── 7. Emotion node ──
  const dominantEmotions = emotionVec
    .map((v, i) => ({ v, name: Object.keys(basic?.emotions20 || {}).length === 20
      ? ['joy','calm','satisfaction','gratitude','hope','love','pride','interest','surprise','sadness','anger','anxiety','fear','shame','guilt','disgust','loneliness','jealousy','boredom','awe'][i] : `emotion${i}` }))
    .filter(e => e.v > 0.3)
    .sort((a, b) => b.v - a.v)
    .slice(0, 3);

  for (const emo of dominantEmotions) {
    const node = {
      id: nodeId('emo'),
      type: 'Emotion',
      label: emo.name,
      weight: emo.v * 5,
      centrality: { degree: 0, betweenness: 0, eigenvector: 0 },
      attributes: {
        emotion: {
          intensity: emo.v,
          frequency: emo.v * (segments?.length || 0) / 10,
          persistence: emo.v * 0.8,
          vector20: emotionVec
        }
      },
      sourceRefs: [],
      createdAt: new Date().toISOString()
    };
    nodes.push(node);

    // Emotion triggers Belief
    for (const b of beliefNodes.slice(0, 2)) {
      edges.push({
        id: edgeId(),
        type: 'triggers',
        from: node.id,
        to: b.id,
        weight: emo.v * (b.attributes.belief?.strength || 0.5)
      });
    }
  }

  // ── 8. Person nodes (top 5 by frequency) ──
  const personNodes = persons.slice(0, 5).map((p, i) => {
    const freq = p.frequency || 1;
    const node = {
      id: nodeId('prs'),
      type: 'Person',
      label: p.name || `人物${i + 1}`,
      weight: Math.min(10, freq * 0.5),
      centrality: { degree: 0, betweenness: 0, eigenvector: 0 },
      attributes: {
        person: {
          intimacy: 0.3 + Math.random() * 0.5,
          polarity: Math.random() > 0.3 ? 0.6 : -0.3,
          influence: 0.2 + Math.random() * 0.6
        }
      },
      sourceRefs: [],
      createdAt: new Date().toISOString()
    };
    return node;
  });
  nodes.push(...personNodes);

  // Person 与 Emotion 关联
  for (const p of personNodes) {
    for (const e of dominantEmotions.map(em => nodes.find(n => n.type === 'Emotion' && n.label === em.name)).filter(Boolean)) {
      edges.push({
        id: edgeId(),
        type: 'triggers',
        from: p.id,
        to: e.id,
        weight: 0.4
      });
    }
  }

  // ── 9. Memory nodes (from segment highlights) ──
  const memoryNodes = (segments || [])
    .filter(s => (s.text || '').length > 50 && !s.isFragment)
    .sort((a, b) => (b.positionWeight || 1) - (a.positionWeight || 1))
    .slice(0, 10)
    .map(seg => ({
      id: nodeId('mem'),
      type: 'Memory',
      label: (seg.text || '').substring(0, 30) + '...',
      weight: 0.2 + Math.random() * 0.3,
      centrality: { degree: 0, betweenness: 0, eigenvector: 0 },
      attributes: {
        memory: {
          importance: seg.positionWeight || 1.0,
          vividness: 0.3 + Math.random() * 0.5
        }
      },
      sourceRefs: [{
        sourceType: seg.recordType || 'notes',
        recordId: seg.recordRef || '',
        excerpt: (seg.text || '').substring(0, 200)
      }],
      createdAt: seg.timestamp || new Date().toISOString()
    }));
  nodes.push(...memoryNodes);

  // ── 10. Shadow nodes (深层的负性信念) ──
  const negBeliefs = allBeliefs.filter(b => b.polarity === 'neg');
  for (const nb of negBeliefs.slice(0, 3)) {
    const node = {
      id: nodeId('shd'),
      type: 'Shadow',
      label: nb.label ? `被压抑: ${nb.label}` : '未名阴影',
      weight: (nb.strength || 0.3) * 3,
      centrality: { degree: 0, betweenness: 0, eigenvector: 0 },
      attributes: {
        shadow: {
          repression: 0.5 + Math.random() * 0.4,
          energy: (nb.strength || 0.3) * 1.5
        }
      },
      sourceRefs: [],
      createdAt: new Date().toISOString()
    };
    nodes.push(node);

    // Shadow represses belief
    const parentBelief = beliefNodes.find(bn => bn.attributes.belief?.polarity === 'pos');
    if (parentBelief) {
      edges.push({
        id: edgeId(),
        type: 'represses',
        from: node.id,
        to: parentBelief.id,
        weight: (nb.strength || 0.3)
      });
    }
  }

  // ── 中心性简化计算 ──
  for (const n of nodes) {
    const degree = edges.filter(e => e.from === n.id || e.to === n.id).length;
    n.centrality.degree = degree;
    n.centrality.betweenness = degree / Math.max(1, nodes.length);
    n.centrality.eigenvector = degree * n.weight / Math.max(1, nodes.reduce((s, x) => s + x.weight, 0));
  }

  // ── 时间范围 ──
  const timestamps = (segments || [])
    .map(s => s.timestamp)
    .filter(Boolean)
    .sort();
  const timeRange = {
    start: timestamps[0] || new Date().toISOString(),
    end: timestamps[timestamps.length - 1] || new Date().toISOString()
  };

  const corpusText = (segments || []).map(s => s.text).join('');
  const corpusHash = shortHash(corpusText);

  const graph = {
    userId: 'pending', // 由调用方注入
    nodes,
    edges,
    timeRange,
    corpusHash,
    computedAt: new Date().toISOString()
  };

  return graph;
}

/**
 * 持久化图谱
 */
export async function saveGraph(userId, graph) {
  const g = { ...graph, userId };
  return repo.saveGraph(userId, g);
}
