/**
 * 心智星系 v2 · 前端分析器
 * 职责：镜像后端 nlpBasicService.js 的停用词表+20维情绪词典，实时关键词/情绪预览
 */

const STOP_WORDS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去',
  '你', '会', '着', '没有', '看', '好', '自己', '这', '他', '她', '它', '们', '那', '吗', '吧', '呢', '啊', '哦', '嗯',
  '但是', '因为', '所以', '如果', '虽然', '可以', '这个', '那个', '什么', '怎么', '为什么', '还是', '已经', '一直',
  '比较', '非常', '真的', '应该', '可能', '觉得', '知道', '然后', '不过', '只是', '一点', '还是', '时候', '现在',
  '今天', '昨天', '明天', '今年', '去年', '以后', '以前', '一样', '一些', '这么', '那么', '这样', '那样', '这些',
  '那些', '这里', '那里', '哪里', '大家', '有人', '似乎', '竟然', '其实', '当然', '也许', '反正', '终于'
]);

const EMOTION_LEXICON = {
  joy: ['开心', '快乐', '高兴', '欢乐', '喜悦', '愉快', '欣喜', '欢笑', '乐', '爽'],
  calm: ['平静', '安静', '宁静', '淡定', '从容', '祥和', '平和', '心安', '踏实'],
  satisfaction: ['满足', '满意', '充实', '圆满', '知足', '值得', '够了', '太好了'],
  gratitude: ['感谢', '感恩', '谢谢', '感激', '庆幸', '幸亏', '多亏', '幸得'],
  hope: ['希望', '期待', '盼', '憧憬', '渴望', '向往', '曙光', '光明'],
  love: ['爱', '喜欢', '心疼', '宠爱', '深爱', '挚爱', '依恋', '钟情', '在意'],
  pride: ['骄傲', '自豪', '成就感', '自信', '得意', '厉害了', '牛逼'],
  interest: ['好奇', '有趣', '有意思', '感兴趣', '新鲜', '惊奇', '探索'],
  surprise: ['惊讶', '意外', '没想到', '居然', '震惊', '吃惊', '愕然'],
  sadness: ['难过', '伤心', '悲伤', '悲哀', '心痛', '忧伤', '泪', '哭泣', '哭', '心碎'],
  anger: ['生气', '愤怒', '气愤', '恼火', '发火', '暴躁', '恨', '怒', '气死', '火大'],
  anxiety: ['焦虑', '不安', '紧张', '担心', '忧心', '忐忑', '慌', '怕', '莫名'],
  fear: ['害怕', '恐惧', '畏惧', '惊恐', '恐慌', '吓', '发抖', '恐怖', '可怕'],
  shame: ['羞耻', '丢脸', '惭愧', '羞愧', '难堪', '无地自容', '不好意思'],
  guilt: ['内疚', '愧疚', '自责', '抱歉', '对不起', '亏欠', '后悔', '不该'],
  disgust: ['厌恶', '反感', '恶心', '讨厌', '厌烦', '烦', '腻', '受够了'],
  loneliness: ['孤独', '寂寞', '孤单', '独处', '形单影只', '落寞', '凄凉'],
  jealousy: ['嫉妒', '羡慕', '眼红', '不甘', '酸', '凭什么'],
  boredom: ['无聊', '厌倦', '乏味', '没意思', '闷', '空虚', '平淡', '毫无波澜'],
  awe: ['敬畏', '震撼', '崇敬', '惊叹', '叹为观止', '伟', '了不起', '不可思议']
};

const EMOTION_NAMES = Object.keys(EMOTION_LEXICON);

function tokenize(text) {
  const cleaned = text.replace(/[^\u4e00-\u9fff\w]/g, ' ');
  const unigrams = cleaned.match(/[\u4e00-\u9fff]+/g) || [];
  const bigrams = [];
  for (const word of unigrams) {
    if (word.length >= 2) bigrams.push(word);
    for (let i = 0; i < word.length - 1; i++) {
      bigrams.push(word.substring(i, i + 2));
    }
  }
  return [...new Set(bigrams.filter(w => w.length >= 2 && !STOP_WORDS.has(w)))];
}

function computeTF(text) {
  const tokens = tokenize(text);
  const freq = new Map();
  for (const t of tokens) {
    freq.set(t, (freq.get(t) || 0) + 1);
  }
  const len = tokens.length || 1;
  return [...freq.entries()]
    .map(([word, count]) => ({ word, score: count / len }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

function analyzeEmotions(text) {
  const results = [];
  for (const name of EMOTION_NAMES) {
    let score = 0;
    for (const kw of EMOTION_LEXICON[name]) {
      if (text.includes(kw)) score += 1;
    }
    if (score > 0) results.push({ name, score: Math.min(1, score / 3) });
  }
  return results.sort((a, b) => b.score - a.score);
}

export function analyzePreview(text) {
  if (!text || text.trim().length === 0) {
    return { keywords: [], emotions: [], charCount: 0, isShort: false, warning: null };
  }

  const charCount = text.replace(/\s/g, '').length;
  const isShort = charCount < 500;
  const warning = isShort ? '文本不足500字，分析深度可能受限，建议输入更多内容' : null;
  const keywords = computeTF(text);
  const emotions = analyzeEmotions(text);

  return { keywords, emotions, charCount, isShort, warning };
}
