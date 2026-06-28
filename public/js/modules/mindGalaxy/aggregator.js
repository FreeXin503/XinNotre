const LOCATION_RE = /(中国|北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|重庆|苏州|天津|长沙|郑州|东莞|青岛|沈阳|宁波|昆明|大连|厦门|合肥|佛山|福州|哈尔滨|济南|温州|长春|石家庄|常州|泉州|南宁|贵阳|南昌|太原|烟台|嘉兴|南通|金华|珠海|惠州|徐州|海口|乌鲁木齐|绍兴|中山|台州|兰州)/g;

const WEEK_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function dateToISOWeek(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return null;
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function stableAnonName(index) {
  return `person${String(index).padStart(3, '0')}`;
}

function anonymizeTimestamps(bodies) {
  return (bodies || []).map(body => {
    if (!body) return body;
    const b = { ...body };
    if (b.timestamp && WEEK_RE.test(b.timestamp)) {
      b.timestamp = dateToISOWeek(b.timestamp);
    }
    if (b.createdAt) {
      b.createdAt = dateToISOWeek(b.createdAt);
    }
    return b;
  });
}

function anonymizeLocations(text) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(LOCATION_RE, '[LOCATION]');
}

function simpleKMeans(vectors, k) {
  if (!vectors || vectors.length === 0) return { clusters: [], centroids: [] };
  const dim = vectors[0].length;
  if (dim === 0) return { clusters: vectors.map(() => 0), centroids: [] };

  const centroids = [];
  for (let i = 0; i < Math.min(k, vectors.length); i++) {
    centroids.push([...vectors[i]]);
  }
  if (centroids.length === 0) return { clusters: [], centroids: [] };

  const maxIter = 20;
  let assignments = new Array(vectors.length).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (let i = 0; i < vectors.length; i++) {
      let minDist = Infinity;
      let best = 0;
      for (let j = 0; j < centroids.length; j++) {
        let dist = 0;
        for (let d = 0; d < dim; d++) {
          dist += (vectors[i][d] - centroids[j][d]) ** 2;
        }
        if (dist < minDist) {
          minDist = dist;
          best = j;
        }
      }
      if (assignments[i] !== best) {
        assignments[i] = best;
        changed = true;
      }
    }
    if (!changed) break;

    for (let j = 0; j < centroids.length; j++) {
      const members = vectors.filter((_, i) => assignments[i] === j);
      if (members.length === 0) continue;
      for (let d = 0; d < dim; d++) {
        centroids[j][d] = members.reduce((s, v) => s + v[d], 0) / members.length;
      }
    }
  }

  return {
    clusters: assignments,
    centroids: centroids.map((c, i) => ({
      clusterId: i,
      centroid: c,
      size: assignments.filter(a => a === i).length
    }))
  };
}

const EMOTION_BUCKETS = ['焦虑', '平静', '忧郁', '兴奋', '愤怒', '悲伤', '恐惧', '喜悦'];

function buildEmotionHistogram(bodies) {
  const histogram = {};
  for (const bucket of EMOTION_BUCKETS) {
    histogram[bucket] = 0;
  }
  for (const body of (bodies || [])) {
    const emo = body.emotion || body.emotionalTone;
    if (emo && histogram[emo] !== undefined) {
      histogram[emo]++;
    }
  }
  return histogram;
}

function extractTopicVectors(bodies) {
  const vectors = [];
  for (const body of (bodies || [])) {
    if (body.vector && Array.isArray(body.vector) && body.vector.length > 0) {
      vectors.push(body.vector);
    }
    if (body.topicVector && Array.isArray(body.topicVector) && body.topicVector.length > 0) {
      vectors.push(body.topicVector);
    }
  }
  return vectors;
}

export function anonymize(snapshot) {
  if (!snapshot || !snapshot.bodies) {
    throw new Error('无效的快照数据');
  }

  const bodies = snapshot.bodies;
  const personIndex = {};
  let personCounter = 0;

  const anonymizedBodies = bodies.map(body => {
    if (!body) return null;
    if (body.type === 'person') {
      if (personIndex[body.label] === undefined) {
        personIndex[body.label] = personCounter++;
      }
      const anonLabel = stableAnonName(personIndex[body.label]);
      const sanitizedContent = anonymizeLocations(body.description || body.content || '');
      return {
        type: 'person',
        anonLabel,
        label: anonLabel,
        emotion: body.emotion || body.emotionalTone || null,
        description: sanitizedContent
      };
    }
    if (body.type === 'topic' || body.type === 'star') {
      const sanitizedContent = anonymizeLocations(body.description || body.content || '');
      return {
        type: body.type,
        label: `topic_${body.id || Math.random().toString(36).slice(2, 8)}`,
        description: sanitizedContent,
        vector: body.vector || body.topicVector || null
      };
    }
    return null;
  }).filter(Boolean);

  const topicVectors = extractTopicVectors(bodies);
  let kmeansResult;
  let topicVectorsResult;
  try {
    kmeansResult = simpleKMeans(topicVectors, Math.min(5, topicVectors.length || 1));
    topicVectorsResult = kmeansResult.centroids.map(c => c.centroid);
  } catch {
    console.warn('[aggregator] K-Means 不收敛，降级 TF-IDF 中心点');
    topicVectorsResult = topicVectors.length > 0 ? [topicVectors.reduce((a, b) => a.map((v, i) => v + b[i]), new Array(topicVectors[0].length).fill(0)).map(v => v / topicVectors.length)] : [];
  }

  const anonymizedPayload = {
    topicVectors: topicVectorsResult,
    emotionHistogram: buildEmotionHistogram(bodies),
    anonBodies: anonymizedBodies
  };

  return anonymizedPayload;
}
