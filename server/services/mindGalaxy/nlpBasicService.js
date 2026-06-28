/**
 * 心智星系 v2 · NLP 基础分析服务
 * 职责：算法级分析(无 LLM)——关键词 / 主题聚类 / 20维情绪 / 实体关系 / 时间模式
 */
import crypto from 'crypto';

// ── 中文停用词 ─────────────────────────────────────────────
const STOP_WORDS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去',
  '你', '会', '着', '没有', '看', '好', '自己', '这', '他', '她', '它', '们', '那', '吗', '吧', '呢', '啊', '哦', '嗯',
  '但是', '因为', '所以', '如果', '虽然', '可以', '这个', '那个', '什么', '怎么', '为什么', '还是', '已经', '一直',
  '比较', '非常', '真的', '应该', '可能', '觉得', '知道', '然后', '不过', '只是', '一点', '还是', '时候', '现在',
  '今天', '昨天', '明天', '今年', '去年', '以后', '以前', '一样', '一些', '这么', '那么', '这样', '那样', '这些',
  '那些', '这里', '那里', '哪里', '大家', '有人', '似乎', '竟然', '其实', '当然', '也许', '反正', '终于'
]);

// ── 20维情绪词典（扩展版） ─────────────────────────────────
const EMOTION_LEXICON = {
  joy:        ['开心', '快乐', '高兴', '欢乐', '喜悦', '愉快', '欣喜', '欢笑', '乐', '爽'],
  calm:       ['平静', '安静', '宁静', '淡定', '从容', '祥和', '平和', '心安', '踏实'],
  satisfaction: ['满足', '满意', '充实', '圆满', '知足', '值得', '够了', '太好了'],
  gratitude:  ['感谢', '感恩', '谢谢', '感激', '庆幸', '幸亏', '多亏', '幸得'],
  hope:       ['希望', '期待', '盼', '憧憬', '渴望', '向往', '曙光', '光明'],
  love:       ['爱', '喜欢', '心疼', '宠爱', '深爱', '挚爱', '依恋', '钟情', '在意'],
  pride:      ['骄傲', '自豪', '成就感', '自信', '得意', '厉害了', '牛逼'],
  interest:   ['好奇', '有趣', '有意思', '感兴趣', '新鲜', '惊奇', '探索'],
  surprise:   ['惊讶', '意外', '没想到', '居然', '震惊', '吃惊', '愕然'],
  sadness:    ['难过', '伤心', '悲伤', '悲哀', '心痛', '忧伤', '泪', '哭泣', '哭', '心碎'],
  anger:      ['生气', '愤怒', '气愤', '恼火', '发火', '暴躁', '恨', '怒', '气死', '火大'],
  anxiety:    ['焦虑', '不安', '紧张', '担心', '忧心', '忐忑', '慌', '怕', '莫名'],
  fear:       ['害怕', '恐惧', '畏惧', '惊恐', '恐慌', '吓', '发抖', '恐怖', '可怕'],
  shame:      ['羞耻', '丢脸', '惭愧', '羞愧', '难堪', '无地自容', '不好意思'],
  guilt:      ['内疚', '愧疚', '自责', '抱歉', '对不起', '亏欠', '后悔', '不该'],
  disgust:    ['厌恶', '反感', '恶心', '讨厌', '厌烦', '烦', '腻', '受够了'],
  loneliness: ['孤独', '寂寞', '孤单', '独处', '形单影只', '落寞', '凄凉'],
  jealousy:   ['嫉妒', '羡慕', '眼红', '不甘', '酸', '凭什么'],
  boredom:    ['无聊', '厌倦', '乏味', '没意思', '闷', '空虚', '平淡', '毫无波澜'],
  awe:        ['敬畏', '震撼', '崇敬', '惊叹', '叹为观止', '伟', '了不起', '不可思议']
};

const EMOTION_NAMES = Object.keys(EMOTION_LEXICON);
const N_EMOTIONS = EMOTION_NAMES.length;

// ── 中文分词（简易正则+停用词） ─────────────────────────────
function tokenize(text) {
  const cleaned = text.replace(/[^\u4e00-\u9fff\w]/g, ' ');
  const unigrams = cleaned.match(/[\u4e00-\u9fff]+/g) || [];
  const bigrams = [];
  for (const word of unigrams) {
    if (word.length >= 2) {
      bigrams.push(word);
      for (let i = 0; i < word.length - 1; i++) {
        bigrams.push(word.substring(i, i + 2));
      }
    }
  }
  return [...new Set(bigrams.filter(w => w.length >= 2 && !STOP_WORDS.has(w)))];
}

// ── TF-IDF ─────────────────────────────────────────────────
function computeTFIDF(segments) {
  const tf = new Map();
  const df = new Map();
  const docs = [];

  for (const seg of segments) {
    const tokens = tokenize(seg.text);
    const tokenSet = new Set(tokens);
    docs.push({ tokens, tokenSet });
    const tfMap = new Map();
    for (const t of tokens) {
      tfMap.set(t, (tfMap.get(t) || 0) + 1);
    }
    for (const [t, count] of tfMap) {
      tf.set(t, (tf.get(t) || 0) + count / tokens.length);
    }
    for (const t of tokenSet) {
      df.set(t, (df.get(t) || 0) + 1);
    }
  }

  const N = docs.length || 1;
  const keywords = [];
  for (const [word, tfVal] of tf) {
    const idf = Math.log((N + 1) / ((df.get(word) || 0) + 1)) + 1;
    keywords.push({ word, score: tfVal * idf });
  }
  keywords.sort((a, b) => b.score - a.score);
  return keywords.slice(0, 50);
}

// ── K-Means 主题聚类（关键词向量） ──────────────────────────
function kMeansClustering(segments, keywords, k) {
  const topKeywords = keywords.slice(0, 30);
  const vectors = segments.map(seg => {
    const tokens = tokenize(seg.text);
    const vec = new Array(topKeywords.length).fill(0);
    for (let i = 0; i < topKeywords.length; i++) {
      vec[i] = tokens.includes(topKeywords[i].word) ? 1 : 0;
    }
    return vec;
  });

  k = Math.min(k, segments.length, 8);
  if (k <= 0) return [];

  // Init centroids (k-means++)
  const centroids = [vectors[0].slice()];
  for (let ci = 1; ci < k; ci++) {
    const dists = vectors.map(v => {
      return Math.min(...centroids.map(c => c.reduce((s, cv, i) => s + (v[i] - cv) ** 2, 0)));
    });
    const totalDist = dists.reduce((a, b) => a + b, 0) || 1;
    let r = Math.random() * totalDist, acc = 0;
    for (let vi = 0; vi < vectors.length; vi++) {
      acc += dists[vi];
      if (acc >= r && !centroids.some(c => c.every((cv, i) => cv === vectors[vi][i]))) {
        centroids.push(vectors[vi].slice());
        break;
      }
    }
  }

  // Assign (max 20 iterations)
  for (let iter = 0; iter < 20; iter++) {
    const clusters = Array.from({ length: k }, () => []);
    for (const v of vectors) {
      let best = 0, bestDist = Infinity;
      for (let ci = 0; ci < k; ci++) {
        const d = centroids[ci].reduce((s, cv, i) => s + (v[i] - cv) ** 2, 0);
        if (d < bestDist) { bestDist = d; best = ci; }
      }
      clusters[best].push(v);
    }
    let moved = false;
    for (let ci = 0; ci < k; ci++) {
      if (clusters[ci].length === 0) continue;
      const newCent = new Array(topKeywords.length).fill(0);
      for (const v of clusters[ci]) for (let i = 0; i < v.length; i++) newCent[i] += v[i];
      for (let i = 0; i < newCent.length; i++) newCent[i] /= clusters[ci].length;
      const shift = centroids[ci].reduce((s, cv, i) => s + (cv - newCent[i]) ** 2, 0);
      if (shift > 0.0001) moved = true;
      centroids[ci] = newCent;
    }
    if (!moved) break;
  }

  // Extract topic names
  const topics = [];
  for (let ci = 0; ci < k; ci++) {
    const topIndices = centroids[ci]
      .map((v, i) => ({ v, i }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 3);
    topics.push({
      name: topIndices.map(ti => topKeywords[ti.i]?.word || '未知').join('·'),
      keywords: topIndices.map(ti => topKeywords[ti.i]?.word || ''),
      centroid: centroids[ci],
      size: 0
    });
  }
  return topics;
}

// ── 20维情绪向量 ───────────────────────────────────────────
function analyzeEmotion20(segments) {
  const globalVector = new Array(N_EMOTIONS).fill(0);
  const segmentVectors = segments.map(seg => {
    const vec = new Array(N_EMOTIONS).fill(0);
    let matchCount = 0;
    for (let ei = 0; ei < N_EMOTIONS; ei++) {
      const emotion = EMOTION_NAMES[ei];
      for (const kw of EMOTION_LEXICON[emotion]) {
        if (seg.text.includes(kw)) {
          vec[ei] += 1;
          break;
        }
      }
      if (vec[ei] > 0) matchCount++;
    }
    // Normalize to [0,1]
    if (matchCount > 0) {
      for (let ei = 0; ei < N_EMOTIONS; ei++) {
        vec[ei] = Math.min(1, vec[ei] / matchCount);
      }
    }
    for (let ei = 0; ei < N_EMOTIONS; ei++) {
      globalVector[ei] += vec[ei] / segments.length;
    }
    return vec;
  });

  return { globalVector, segmentVectors };
}

// ── 实体识别 ───────────────────────────────────────────────
function extractEntities(segments) {
  const persons = new Map();
  const locations = new Map();
  const events = new Map();

  for (const seg of segments) {
    // 人物（"人物A" "人物B" 脱敏代称）
    const personMatches = seg.text.match(/[人物][A-Z]/g) || [];
    for (const p of personMatches) {
      persons.set(p, (persons.get(p) || 0) + 1);
    }

    // 地点（后缀匹配）
    const locMatches = seg.text.match(/[\u4e00-\u9fff]{2,}(?:市|省|县|区|镇|村|公园|广场|大厦|路|街|学校|医院|公司|银行|餐厅|咖啡馆|书店|超市)/g) || [];
    for (const l of locMatches) {
      locations.set(l, (locations.get(l) || 0) + 1);
    }

    // 事件（"了"结尾短语，简化版）
    const evtMatches = seg.text.match(/[\u4e00-\u9fff]{3,}(?:了|过|完)/g) || [];
    for (const e of evtMatches) {
      const clean = e.replace(/了|过|完$/, '');
      if (clean.length >= 2) {
        events.set(clean, (events.get(clean) || 0) + 1);
      }
    }
  }

  const topN = (map, n) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, freq]) => ({ name, frequency: freq }));

  return {
    persons: topN(persons, 10),
    locations: topN(locations, 10),
    events: topN(events, 15)
  };
}

// ── 时间模式分析 ───────────────────────────────────────────
function analyzeTimePatterns(segments) {
  const hourCount = new Array(24).fill(0);
  const weekdayCount = new Array(7).fill(0);
  const hourEmotions = new Array(24).fill(null).map(() => new Array(N_EMOTIONS).fill(0));

  let validSegments = 0;
  for (const seg of segments) {
    if (!seg.timestamp) continue;
    try {
      const d = new Date(seg.timestamp);
      if (isNaN(d.getTime())) continue;
      validSegments++;
      const h = d.getHours();
      const w = d.getDay();
      hourCount[h]++;
      weekdayCount[w]++;

      const { segmentVectors } = analyzeEmotion20([seg]);
      for (let ei = 0; ei < N_EMOTIONS; ei++) {
        hourEmotions[h][ei] += segmentVectors[0][ei];
      }
    } catch { /* skip */ }
  }

  // Normalize hour emotions
  for (let h = 0; h < 24; h++) {
    if (hourCount[h] > 0) {
      for (let ei = 0; ei < N_EMOTIONS; ei++) {
        hourEmotions[h][ei] /= hourCount[h];
      }
    }
  }

  // 情绪突变点检测（相邻窗口差 > 0.5）
  const anomalyPoints = [];
  const windowSize = 5;
  for (let i = windowSize; i < segments.length; i += windowSize) {
    const prev = segments.slice(i - windowSize, i);
    const curr = segments.slice(i, i + windowSize);
    const prevEmo = analyzeEmotion20(prev).globalVector;
    const currEmo = analyzeEmotion20(curr).globalVector;
    const diff = prevEmo.reduce((s, v, ei) => s + Math.abs((currEmo[ei] || 0) - v), 0);
    if (diff > 0.5) {
      anomalyPoints.push({
        segmentIndex: i,
        diff,
        beforeEmo: EMOTION_NAMES[prevEmo.indexOf(Math.max(...prevEmo))],
        afterEmo: EMOTION_NAMES[currEmo.indexOf(Math.max(...currEmo))]
      });
    }
  }

  return {
    byHour: hourCount.map((count, h) => ({ hour: h, count, topEmotion: EMOTION_NAMES[hourEmotions[h].indexOf(Math.max(...hourEmotions[h]))] || 'calm' })),
    byWeekday: weekdayCount.map((count, d) => ({ weekday: d, count })),
    anomalyPoints
  };
}

// ── 主入口 ─────────────────────────────────────────────────

// ── 主题时序演化（C13）────────────────────────────────────

function getWindowKey(ts, windowSize) {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = d.getMonth();
  switch (windowSize) {
    case 'month':   return `${y}-${String(m + 1).padStart(2, '0')}`;
    case 'quarter': return `${y}-Q${Math.floor(m / 3) + 1}`;
    case 'year':    return `${y}`;
    default:        return `${y}-${String(m + 1).padStart(2, '0')}`;
  }
}

/**
 * @param {{ text: string, timestamp: string }[]} segments
 * @param {'month'|'quarter'|'year'} windowSize
 * @returns {Array<{ window: string, topics: Array<{ name: string, importance: number, trend: string }> }>}
 */
export function clusterTopicsByWindow(segments, windowSize = 'month') {
  if (!Array.isArray(segments) || segments.length === 0) return [];

  const MIN_SEGMENTS = 3;
  const TREND_THRESHOLD = 0.2;

  // 1. 按时间窗口分组
  const windows = new Map();
  for (const seg of segments) {
    if (!seg.timestamp) continue;
    const key = getWindowKey(seg.timestamp, windowSize);
    if (!key) continue;
    if (!windows.has(key)) windows.set(key, []);
    windows.get(key).push(seg);
  }

  // 2. 按时间排序的窗口结果
  const sortedKeys = [...windows.keys()].sort();
  const windowResults = [];

  for (const key of sortedKeys) {
    const segs = windows.get(key);
    if (segs.length < MIN_SEGMENTS) {
      windowResults.push({
        window: key,
        topics: [],
        segmentCount: segs.length
      });
      continue;
    }

    const meaningful = segs.filter(s => !s.isFragment);
    const keywords = computeTFIDF(meaningful.length > 0 ? meaningful : segs);
    const k = Math.min(6, Math.ceil(segs.length / 4));
    const topics = kMeansClustering(meaningful.length > 0 ? meaningful : segs, keywords, k);

    // 计算实际簇大小（kMeansClustering 返回的 size 固定为 0，需独立计算）
    if (topics.length > 0) {
      const topKeywords = keywords.slice(0, 30);
      const sourceSegs = meaningful.length > 0 ? meaningful : segs;
      const vectors = sourceSegs.map(s => {
        const tokens = tokenize(s.text);
        const vec = new Array(topKeywords.length).fill(0);
        for (let i = 0; i < topKeywords.length; i++) {
          vec[i] = tokens.includes(topKeywords[i].word) ? 1 : 0;
        }
        return vec;
      });
      for (const v of vectors) {
        let bestCi = 0, bestDist = Infinity;
        for (let ci = 0; ci < topics.length; ci++) {
          const d = topics[ci].centroid.reduce((s, cv, i) => s + (v[i] - cv) ** 2, 0);
          if (d < bestDist) { bestDist = d; bestCi = ci; }
        }
        topics[bestCi].size++;
      }
    }

    const resultTopics = topics.map(t => {
      const topicName = normalizeTopicName(t.name);
      const importance = Math.min(1, t.size / segs.length);
      return { name: topicName, keywords: t.keywords, importance };
    });

    windowResults.push({ window: key, topics: resultTopics, segmentCount: segs.length });
  }

  // 3. 计算 trend
  for (let wi = 0; wi < windowResults.length; wi++) {
    const wr = windowResults[wi];
    if (wr.segmentCount < MIN_SEGMENTS) continue;

    const prev = wi > 0 ? windowResults[wi - 1] : null;
    const prevTopics = prev && prev.segmentCount >= MIN_SEGMENTS
      ? new Map(prev.topics.map(t => [t.name, t.importance]))
      : null;

    for (const t of wr.topics) {
      if (!prevTopics) {
        t.trend = 'born';
      } else if (!prevTopics.has(t.name)) {
        t.trend = 'born';
      } else {
        const prevImportance = prevTopics.get(t.name);
        const ratio = prevImportance > 0 ? (t.importance - prevImportance) / prevImportance : t.importance > 0 ? 1 : 0;
        if (ratio > TREND_THRESHOLD) t.trend = 'rising';
        else if (ratio < -TREND_THRESHOLD) t.trend = 'fading';
        else t.trend = 'stable';
      }
    }

    // 标记上一窗口中存在但当前消失的主题为 fading
    if (prevTopics) {
      for (const [prevName, prevImp] of prevTopics) {
        if (!wr.topics.find(t => t.name === prevName)) {
          wr.topics.push({ name: prevName, keywords: [], importance: prevImp * 0.3, trend: 'fading' });
        }
      }
    }
  }

  // 剥离内部字段
  return windowResults.map(wr => ({
    window: wr.window,
    segmentCount: wr.segmentCount,
    topics: wr.topics.map(t => ({
      name: t.name,
      importance: Math.round(t.importance * 1000) / 1000,
      trend: t.trend || 'unknown'
    }))
  }));
}

function normalizeTopicName(name) {
  if (!name) return '未知';
  const parts = name.split('·').filter(Boolean);
  return parts.length > 0 ? parts[0] : name;
}

// ── 情绪周期性检测（C14）────────────────────────────────────

function autocorrelation(series, lag) {
  const n = series.length;
  if (n <= lag) return 0;
  let num = 0, denA = 0, denB = 0;
  const mean = series.reduce((a, b) => a + b, 0) / n;
  for (let i = 0; i < n - lag; i++) {
    const va = series[i] - mean;
    const vb = series[i + lag] - mean;
    num += va * vb;
    denA += va * va;
    denB += vb * vb;
  }
  if (denA === 0 || denB === 0) return 0;
  return num / Math.sqrt(denA * denB);
}

/**
 * @param {{ date: string, emotions: number[] }[]} emotionSeries
 * @returns {{ weekly: { period: number|null, confidence: number }, monthly: { period: number|null, confidence: number }, seasonal: { period: number|null, confidence: number } }}
 */
export function detectEmotionPeriodicity(emotionSeries) {
  const MIN_DAYS = 30;
  const CONFIDENCE_THRESHOLD = 0.3;
  const MAX_SERIES_LENGTH = 365;

  if (!Array.isArray(emotionSeries) || emotionSeries.length < MIN_DAYS) {
    return {
      weekly: { period: null, confidence: 0, confidenceLevel: 'low' },
      monthly: { period: null, confidence: 0, confidenceLevel: 'low' },
      seasonal: { period: null, confidence: 0, confidenceLevel: 'low' }
    };
  }

  // Sort by date
  const sorted = emotionSeries
    .filter(s => s && s.date && s.emotions)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (sorted.length < MIN_DAYS) {
    return {
      weekly: { period: null, confidence: 0, confidenceLevel: 'low' },
      monthly: { period: null, confidence: 0, confidenceLevel: 'low' },
      seasonal: { period: null, confidence: 0, confidenceLevel: 'low' }
    };
  }

  const dailyIntensity = sorted.map(s => {
    const e = s.emotions;
    if (!Array.isArray(e) || e.length === 0) return 0;
    return e.reduce((sum, v) => sum + v, 0) / e.length;
  });

  // Use up to 1 year of data
  const series = dailyIntensity.slice(0, MAX_SERIES_LENGTH);

  // Weekly periodicity (lag=7)
  const weeklyPeaks = [];
  for (let lag = 5; lag <= 9; lag++) {
    weeklyPeaks.push({ lag, corr: autocorrelation(series, lag) });
  }
  weeklyPeaks.sort((a, b) => b.corr - a.corr);
  const weeklyBest = weeklyPeaks[0];
  const weeklyResult = {
    period: weeklyBest.corr >= CONFIDENCE_THRESHOLD ? 7 : null,
    confidence: Math.round(Math.max(0, weeklyBest.corr) * 1000) / 1000,
    confidenceLevel: weeklyBest.corr >= CONFIDENCE_THRESHOLD ? 'medium' : 'low'
  };

  // Monthly periodicity (lag=28~31)
  const monthlyPeaks = [];
  for (let lag = 27; lag <= 33; lag++) {
    monthlyPeaks.push({ lag, corr: autocorrelation(series, lag) });
  }
  monthlyPeaks.sort((a, b) => b.corr - a.corr);
  const monthlyBest = monthlyPeaks[0];
  const monthlyResult = {
    period: monthlyBest.corr >= CONFIDENCE_THRESHOLD ? 30 : null,
    confidence: Math.round(Math.max(0, monthlyBest.corr) * 1000) / 1000,
    confidenceLevel: monthlyBest.corr >= CONFIDENCE_THRESHOLD ? 'medium' : 'low'
  };

  // Seasonal periodicity (lag=80~100)
  const seasonalPeaks = [];
  for (let lag = 80; lag <= 100; lag++) {
    seasonalPeaks.push({ lag, corr: autocorrelation(series, lag) });
  }
  seasonalPeaks.sort((a, b) => b.corr - a.corr);
  const seasonalBest = seasonalPeaks[0];
  const seasonalResult = {
    period: seasonalBest.corr >= CONFIDENCE_THRESHOLD ? 90 : null,
    confidence: Math.round(Math.max(0, seasonalBest.corr) * 1000) / 1000,
    confidenceLevel: seasonalBest.corr >= CONFIDENCE_THRESHOLD ? 'medium' : 'low'
  };

  return {
    weekly: weeklyResult,
    monthly: monthlyResult,
    seasonal: seasonalResult
  };
}

// ── 情绪触发链分析（C15）────────────────────────────────────

/**
 * @param {{ text: string }[]} segments
 * @param {{ name: string, keywords: string[] }[]} topics
 * @returns {Array<{ topic: string, emotion: string, strength: number, confidence: number }>}
 */
export function buildEmotionTriggerChain(segments, topics) {
  if (!Array.isArray(segments) || segments.length === 0) return [];
  if (!Array.isArray(topics) || topics.length === 0) return [];

  const TOP_N = 10;
  const topicKeywordMap = new Map();
  for (const t of topics) {
    if (t.keywords && t.keywords.length > 0) {
      topicKeywordMap.set(t.name, new Set(t.keywords));
    }
  }

  // 每段匹配主题 + 情绪
  const cooccurrence = new Map(); // "topic::emotion" → { topic, emotion, cooccurrence, intensitySum }
  for (const seg of segments) {
    if (!seg.text) continue;
    const { segmentVectors } = analyzeEmotion20([seg]);
    const emoVec = segmentVectors[0];
    if (!emoVec) continue;

    // 找主导情绪
    let maxEmo = 0, maxIdx = 0;
    for (let ei = 0; ei < emoVec.length; ei++) {
      if (emoVec[ei] > maxEmo) { maxEmo = emoVec[ei]; maxIdx = ei; }
    }
    if (maxEmo <= 0) continue;
    const dominantEmotion = EMOTION_NAMES[maxIdx];

    // 匹配主题关键词
    const tokens = tokenize(seg.text);
    const tokenSet = new Set(tokens);
    for (const [topicName, kwSet] of topicKeywordMap) {
      const matched = [...kwSet].filter(kw => tokenSet.has(kw));
      if (matched.length === 0) continue;

      const key = `${topicName}::${dominantEmotion}`;
      if (!cooccurrence.has(key)) {
        cooccurrence.set(key, { topic: topicName, emotion: dominantEmotion, cooccurrence: 0, intensitySum: 0 });
      }
      const entry = cooccurrence.get(key);
      entry.cooccurrence += matched.length;
      entry.intensitySum += maxEmo;
    }
  }

  const results = [];
  for (const [, entry] of cooccurrence) {
    const freqRatio = entry.cooccurrence / segments.length;
    const intensity = entry.intensitySum / entry.cooccurrence;
    const strength = Math.min(1, freqRatio * intensity * 10);
    results.push({
      topic: entry.topic,
      emotion: entry.emotion,
      strength: Math.round(strength * 1000) / 1000,
      confidence: Math.round(Math.min(1, freqRatio * 3) * 1000) / 1000
    });
  }

  results.sort((a, b) => b.strength - a.strength);
  return results.slice(0, TOP_N);
}

// ── 关系网络（C16）─────────────────────────────────────────

const INTIMACY_PATTERNS = [
  { regex: /亲爱的|宝贝|老公|老婆|亲爱的/g, score: 0.9 },
  { regex: /兄弟|闺蜜|死党|铁子/g, score: 0.8 },
  { regex: /朋友|好友|伙伴/g, score: 0.5 },
  { regex: /同事|领导|老板|下属/g, score: 0.3 },
];

function extractPersonsFromText(text) {
  if (!text) return [];
  const matches = text.match(/人物[A-Z]/g) || [];
  return [...new Set(matches)];
}

function estimatePolarity(text) {
  if (!text) return 0;
  let positive = 0, negative = 0;
  for (const kw of EMOTION_LEXICON.joy) if (text.includes(kw)) positive++;
  for (const kw of EMOTION_LEXICON.sadness) if (text.includes(kw)) negative++;
  for (const kw of EMOTION_LEXICON.anger) if (text.includes(kw)) negative++;
  const total = positive + negative;
  if (total === 0) return 0.5;
  return positive / total;
}

function estimateIntimacyStyle(text, personName) {
  if (!text || !personName) return 0.3;
  let maxScore = 0;
  for (const pattern of INTIMACY_PATTERNS) {
    if (pattern.regex.test(text)) {
      maxScore = Math.max(maxScore, pattern.score);
    }
  }
  return maxScore > 0 ? maxScore : 0.3;
}

/**
 * @param {{ text: string }[]} segments
 * @returns {{ nodes: Array<{ name: string, degree: number, betweenness: number, intimacy: number }>, edges: Array<{ a: string, b: string, cooccurrence: number, polarity: number }> }}
 */
export function buildRelationshipNetwork(segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return { nodes: [], edges: [] };
  }

  const cooccurrence = new Map();
  const personCount = new Map();
  const personPolarity = new Map();

  for (const seg of segments) {
    if (!seg.text) continue;
    const persons = extractPersonsFromText(seg.text);
    const polarity = estimatePolarity(seg.text);

    for (const p of persons) {
      personCount.set(p, (personCount.get(p) || 0) + 1);
      if (!personPolarity.has(p)) personPolarity.set(p, { total: 0, count: 0 });
      const pp = personPolarity.get(p);
      pp.total += polarity;
      pp.count++;
    }

    for (let i = 0; i < persons.length; i++) {
      for (let j = i + 1; j < persons.length; j++) {
        const a = persons[i] < persons[j] ? persons[i] : persons[j];
        const b = persons[i] < persons[j] ? persons[j] : persons[i];
        const key = `${a}::${b}`;
        if (!cooccurrence.has(key)) {
          cooccurrence.set(key, { cooccurrence: 0, polaritySum: 0 });
        }
        const entry = cooccurrence.get(key);
        entry.cooccurrence++;
        entry.polaritySum += polarity;
      }
    }
  }

  const totalPersons = personCount.size;
  if (totalPersons === 0) return { nodes: [], edges: [] };

  const degree = new Map();
  for (const [key] of cooccurrence) {
    const [a, b] = key.split('::');
    degree.set(a, (degree.get(a) || 0) + 1);
    degree.set(b, (degree.get(b) || 0) + 1);
  }

  const edges = [];
  for (const [key, entry] of cooccurrence) {
    const [a, b] = key.split('::');
    edges.push({
      a,
      b,
      cooccurrence: entry.cooccurrence,
      polarity: Math.round((entry.polaritySum / entry.cooccurrence) * 1000) / 1000
    });
  }

  const nodes = [];
  for (const [name, freq] of personCount) {
    const deg = degree.get(name) || 0;
    const betweenness = totalPersons > 1 ? Math.round((deg / (totalPersons - 1)) * 1000) / 1000 : 0;
    const pp = personPolarity.get(name) || { total: 0.5, count: 1 };
    const avgPolarity = pp.total / pp.count;
    const freqFactor = Math.min(1, freq / Math.max(1, segments.length / 3));
    const intimacy = Math.round((freqFactor * 0.4 + avgPolarity * 0.3 + 0.3 * 0.3) * 1000) / 1000;

    nodes.push({
      name,
      degree: deg,
      betweenness,
      intimacy
    });
  }

  return { nodes, edges };
}

// ── 内容节奏分析（C27）─────────────────────────────────────

export function analyzeContentRhythm(segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return { hourly: [], weekday: [], topPatterns: [] };
  }

  const hourBins = new Array(24).fill(null).map(() => ({
    count: 0,
    texts: [],
    emotions: new Array(N_EMOTIONS).fill(0)
  }));
  const weekdayBins = new Array(7).fill(null).map(() => ({
    count: 0,
    texts: [],
    emotions: new Array(N_EMOTIONS).fill(0)
  }));

  for (const seg of segments) {
    if (!seg.timestamp || !seg.text) continue;
    try {
      const d = new Date(seg.timestamp);
      if (isNaN(d.getTime())) continue;
      const h = d.getHours();
      const w = d.getDay();
      hourBins[h].count++;
      hourBins[h].texts.push(seg.text);
      weekdayBins[w].count++;
      weekdayBins[w].texts.push(seg.text);
    } catch { /* skip */ }
  }

  const hourly = [];
  for (let h = 0; h < 24; h++) {
    const bin = hourBins[h];
    if (bin.count === 0) { hourly.push({ hour: h, count: 0, topEmotion: '', topTopic: '' }); continue; }
    const emo = analyzeEmotion20(bin.texts.map(t => ({ text: t })));
    const topEmoIdx = emo.globalVector.indexOf(Math.max(...emo.globalVector));
    const kw = computeTFIDF(bin.texts.map(t => ({ text: t })));
    const topTopic = kw.length > 0 ? kw[0]?.word || '' : '';
    hourly.push({ hour: h, count: bin.count, topEmotion: EMOTION_NAMES[topEmoIdx] || 'calm', topTopic });
  }

  const weekday = [];
  for (let w = 0; w < 7; w++) {
    const bin = weekdayBins[w];
    if (bin.count === 0) { weekday.push({ weekday: w, count: 0, topEmotion: '' }); continue; }
    const emo = analyzeEmotion20(bin.texts.map(t => ({ text: t })));
    const topEmoIdx = emo.globalVector.indexOf(Math.max(...emo.globalVector));
    weekday.push({ weekday: w, count: bin.count, topEmotion: EMOTION_NAMES[topEmoIdx] || 'calm' });
  }

  const patternCount = new Map();
  for (let h = 0; h < 24; h++) {
    const bin = hourBins[h];
    if (bin.count === 0) continue;
    const emo = analyzeEmotion20(bin.texts.map(t => ({ text: t })));
    const topEmoIdx = emo.globalVector.indexOf(Math.max(...emo.globalVector));
    patternCount.set(`${h}:${EMOTION_NAMES[topEmoIdx]}`, bin.count);
  }
  const topPatterns = [...patternCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, count]) => {
      const [hour, emotion] = key.split(':');
      return { hour: parseInt(hour), emotion, count };
    });

  return { hourly, weekday, topPatterns };
}

// ── 多维度事件检测（C28）───────────────────────────────────

function avgTextLength(segments) {
  if (!segments.length) return 0;
  return segments.reduce((s, seg) => s + (seg.text?.length || 0), 0) / segments.length;
}

export function detectMajorEvents(segments, { emotionShifts, topicShifts } = {}) {
  if (!Array.isArray(segments) || segments.length === 0) return [];

  const eventWindows = [];
  const WINDOW = 5;

  for (let i = WINDOW; i <= segments.length; i += Math.ceil(WINDOW / 2)) {
    const currSlice = segments.slice(i - WINDOW, i);
    const prevSlice = i >= WINDOW * 2 ? segments.slice(i - WINDOW * 2, i - WINDOW) : [];

    // 情绪突变
    let emotionType = null, emotionSeverity = 0;
    if (prevSlice.length > 0) {
      const currEmo = analyzeEmotion20(currSlice).globalVector;
      const prevEmo = analyzeEmotion20(prevSlice).globalVector;
      const diff = currEmo.reduce((s, v, ei) => s + Math.abs(v - (prevEmo[ei] || 0)), 0);
      if (diff > 0.6) {
        emotionType = 'emotion';
        emotionSeverity = Math.min(1, diff);
      }
    }

    // 主题切换
    let topicType = null, topicSeverity = 0;
    if (topicShifts && Array.isArray(topicShifts)) {
      for (const tw of topicShifts) {
        const twTopics = tw.topics || [];
        const fading = twTopics.filter(t => t.trend === 'fading');
        const rising = twTopics.filter(t => t.trend === 'rising' || t.trend === 'born');
        if (fading.length > 0 && rising.length > 0) {
          topicType = 'topic';
          topicSeverity = Math.min(1, (fading.length + rising.length) / 5);
        }
      }
    }

    // 字数突变
    let wordType = null, wordSeverity = 0;
    if (prevSlice.length > 0) {
      const currAvg = avgTextLength(currSlice);
      const prevAvg = avgTextLength(prevSlice);
      if (prevAvg > 0 && currAvg > 0) {
        const ratio = Math.max(currAvg / prevAvg, prevAvg / currAvg);
        if (ratio > 2) {
          wordType = 'wordcount';
          wordSeverity = Math.min(1, (ratio - 1) / 3);
        }
      }
    }

    // 日期
    let date = null;
    for (const seg of currSlice) {
      if (seg.timestamp) {
        try {
          const d = new Date(seg.timestamp);
          if (!isNaN(d.getTime())) {
            date = d.toISOString().slice(0, 10);
            break;
          }
        } catch { /* skip */ }
      }
    }

    const types = [];
    let severity = 0;
    let description = '';

    if (emotionType) {
      types.push(emotionType);
      severity = Math.max(severity, emotionSeverity);
      if (emotionSeverity > 0.7) description += '情绪显著变化';
      else description += '情绪有所波动';
    }
    if (topicType) {
      types.push(topicType);
      severity = Math.max(severity, topicSeverity);
      if (topicSeverity > 0.5) {
        description += (description ? '，' : '') + '主题发生转换';
      }
    }
    if (wordType) {
      types.push(wordType);
      severity = Math.max(severity, wordSeverity);
      if (wordSeverity > 0.3) {
        description += (description ? '，' : '') + '表达量突变';
      }
    }

    const type = types.length >= 2 ? 'multi' : types[0] || null;
    if (!type || severity === 0) continue;

    eventWindows.push({
      date,
      type,
      severity: Math.round(severity * 1000) / 1000,
      description: description || '节点事件',
      segmentIndex: i
    });
  }

  // 合并同一日期的事件（日期精确 + 取最高 severity）
  const merged = new Map();
  for (const evt of eventWindows) {
    const key = evt.date || 'unknown';
    if (!merged.has(key)) {
      merged.set(key, { ...evt });
      continue;
    }
    const existing = merged.get(key);
    if (evt.severity > existing.severity) existing.severity = evt.severity;
    if (evt.type === 'multi' && existing.type !== 'multi') existing.type = 'multi';
    else if (existing.type !== evt.type && existing.type !== 'multi') existing.type = 'multi';
    if (evt.description.length > existing.description.length) existing.description = evt.description;
  }

  return [...merged.values()]
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
    .map(({ segmentIndex, ...rest }) => rest);
}

// ── analyzeBasic ──────────────────────────────────────────────

/**
 * @param {{ text: string, index: number, recordType: string, timestamp: string, positionWeight: number }[]} segments
 * @returns {{ keywords: Object[], topics: Object[], emotions20: Object, entities: Object, timePatterns: Object }}
 */
export async function analyzeBasic(segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return {
      keywords: [],
      topics: [],
      emotions20: { globalVector: new Array(N_EMOTIONS).fill(0), segmentVectors: [] },
      entities: { persons: [], locations: [], events: [] },
      timePatterns: { byHour: [], byWeekday: [], anomalyPoints: [] }
    };
  }

  // 只分析非碎片段
  const meaningful = segments.filter(s => !s.isFragment);
  if (meaningful.length === 0) {
    return analyzeBasic(segments.slice(0, 1)); // fallback 用第一段
  }

  const keywords = computeTFIDF(meaningful);
  const k = Math.min(8, Math.ceil(meaningful.length / 3));
  const topics = kMeansClustering(meaningful, keywords, k);
  const emotions20 = analyzeEmotion20(meaningful);
  const entities = extractEntities(meaningful);
  const timePatterns = analyzeTimePatterns(meaningful);

  return { keywords, topics, emotions20, entities, timePatterns };
}
