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
