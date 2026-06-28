/**
 * 心智星系 v2 · 数据预处理服务
 * 职责：清洗/去重/去噪/脱敏/分段/标注
 */
import crypto from 'crypto';
import MindGalaxyRepository from '../../repositories/mindGalaxyRepository.js';

const repo = new MindGalaxyRepository();

// 中文人名常见姓氏 + 常用名 (简化词典)
const SURNAMES = '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳酆鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮下齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴谈宋茅庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍虞万支柯昝管卢莫经房裘缪干解应宗丁宣贲邓郁单杭洪包诸左石崔吉钮龚程嵇邢滑裴陆荣翁荀羊於惠甄麴家封芮羿储靳汲邴糜松井段富巫乌焦巴弓牧隗山谷车侯宓蓬全郗班仰秋仲伊宫宁仇栾暴甘钭厉戎祖武符刘景詹束龙叶幸司韶郜黎蓟薄印宿白怀蒲邰从鄂索咸籍赖卓蔺屠蒙池乔阴鬱胥能苍双闻莘党翟谭贡劳逄姬申扶堵冉宰郦雍卻璩桑桂濮牛寿通边扈燕冀郏浦尚农温别庄晏柴瞿阎充慕连茹习宦艾鱼容向古易慎戈廖庾终暨居衡步都耿满弘匡国文寇广禄阙东欧殳沃利蔚越夔隆师巩厍聂晁勾敖融冷訾辛阚那简饶空曾毋沙乜养鞠须丰巢关蒯相查後荆红游竺权逯盖益桓公';
const GIVEN_TOKENS = ['伟', '芳', '娜', '秀英', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀兰', '霞', '平', '刚', '桂英', '文', '华', '飞', '玉兰', '桂花', '斌', '玲', '建国', '建华', '宇', '欣', '凯', '子轩', '梓', '浩然', '一诺', '浩然正气'];

/**
 * 检测是否为弹窗/打卡等模板化内容
 */
function isTemplateText(text) {
  const templates = [/^今日(天气|打卡|签到)/, /^早安/, /^晚安/, /^今日份/, /^记录第\d+天/, /^#\S+打卡/, /^【早读】/, /^日签/];
  return templates.some(re => re.test(text));
}

/**
 * 检测是否纯表情/符号（中文字数 < 2）
 */
function isPureSymbolOrEmoji(text) {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const meaningful = text.replace(/[\s\p{P}\p{S}\u2600-\u27BF\uD83C-\uD83E\uD800-\uDBFF\uDC00-\uDFFF]/gu, '').trim();
  return chineseChars < 2 || meaningful.length < 3;
}

/**
 * SHA256 短哈希 (16 hex chars)
 */
function shortHash(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex').substring(0, 16);
}

/**
 * 脱敏替换人名（简易词典匹配）
 */
function desensitize(text) {
  let result = text;
  let personIdx = 1;
  const replaced = new Map();

  // 全名模式: 姓+名 (2-4 字符)
  for (let i = 0; i < text.length - 1; i++) {
    const c1 = text[i], c2 = text[i + 1];
    if (!SURNAMES.includes(c1)) continue;
    const isTwoChar = GIVEN_TOKENS.some(t => t.startsWith(c2) || c2.startsWith(t));
    const isThreeChar = i + 2 < text.length && GIVEN_TOKENS.some(t => t === text.substring(i + 1, i + 3));
    if (isTwoChar || isThreeChar) {
      const len = isThreeChar ? 3 : 2;
      const name = text.substring(i, i + len);
      if (!replaced.has(name) && !['人类', '人才', '人们', '人家', '人员', '人物', '人民', '人生', '人格', '人品', '人人', '人口', '人手'].includes(name)) {
        const alias = `人物${String.fromCharCode(65 + personIdx - 1)}`;
        replaced.set(name, alias);
        result = result.split(name).join(alias);
        personIdx++;
      }
    }
  }

  // 手机号脱敏: 连续 11 位数字 → 138****1234
  result = result.replace(/(\d{3})\d{4}(\d{4})/g, '$1****$2');

  // 邮箱脱敏
  result = result.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '***@$2');

  return { text: result, personCount: personIdx - 1 };
}

/**
 * 按语义分段（双换行 / 句号+换行 / 超过 500 字截断）
 */
function segmentText(text) {
  const rawSegments = text.split(/\n{2,}|(?<=[。！？；\n])\s*(?=[^\s])/g)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const segments = [];
  let segIdx = 0;
  for (const seg of rawSegments) {
    // 超过 500 字的段落再次按句号切分
    if (seg.length > 500) {
      const subSegs = seg.split(/(?<=[。！？])/g).filter(s => s.trim().length > 0);
      for (const sub of subSegs) {
        segments.push({
          index: segIdx++,
          text: sub.trim(),
          wordCount: sub.length,
          isFragment: sub.length < 10
        });
      }
    } else {
      segments.push({
        index: segIdx++,
        text: seg,
        wordCount: seg.length,
        isFragment: seg.length < 10
      });
    }
  }
  return segments;
}

/**
 * @param {number} userId
 * @param {{ sources: Array<{ type: string, text: string, ref: string, timestamp: string }>, options?: { desensitize?: boolean, words?: string[] } }} params
 * @returns {Promise<{ records: Object[], segments: Object[], meta: { totalRecords, totalSegments, fragmentCount, inputChars } }>}
 */
export async function preprocess(userId, { sources, options = {} }) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return { records: [], segments: [], meta: { totalRecords: 0, totalSegments: 0, fragmentCount: 0, inputChars: 0 } };
  }

  const { desensitize: doDesen = true, words: whitelist = [] } = options;
  const seenHashes = new Set();
  const records = [];
  const allSegments = [];
  let totalChars = 0, fragmentCount = 0;

  for (const src of sources) {
    if (!src.text || typeof src.text !== 'string') continue;

    // 去重
    const hash = shortHash(src.text);
    if (seenHashes.has(hash)) continue;
    seenHashes.add(hash);

    // 去噪
    if (isTemplateText(src.text) || isPureSymbolOrEmoji(src.text)) continue;

    totalChars += src.text.length;

    // 脱敏
    let cleanText = src.text;
    if (doDesen) {
      const ds = desensitize(cleanText);
      cleanText = ds.text;
    }

    // 标准化时间戳
    let ts = src.timestamp || new Date().toISOString();
    try {
      if (!/^\d{4}-\d{2}-\d{2}/.test(ts)) {
        ts = new Date(ts).toISOString();
      }
    } catch { ts = new Date().toISOString(); }

    // 分段
    const segments = segmentText(cleanText);
    const fragsInRecord = segments.filter(s => s.isFragment).length;
    fragmentCount += fragsInRecord;

    const record = {
      type: src.type || 'notes',
      ref: src.ref || '',
      hash,
      timestamp: ts,
      segmentCount: segments.length,
      fragmentSegments: fragsInRecord,
      wordCount: cleanText.length
    };
    records.push(record);

    // 附加元数据到 segment
    for (const seg of segments) {
      seg.recordType = record.type;
      seg.recordRef = record.ref;
      seg.recordHash = hash;
      seg.timestamp = ts;
      seg.positionWeight = seg.index === 0 || seg.index === segments.length - 1 ? 1.1 : 1.0;
      allSegments.push(seg);
    }

    // 失速保护
    if (allSegments.length > 10000) break;
  }

  const meta = {
    totalRecords: records.length,
    totalSegments: allSegments.length,
    fragmentCount,
    inputChars: totalChars
  };

  // 持久化数据源
  for (const rec of records) {
    try {
      await repo.insertDataSource(userId, {
        sourceType: rec.type,
        sourceRef: rec.ref,
        contentHash: rec.hash,
        segmentCount: rec.segmentCount,
        preprocessMeta: { timestamp: rec.timestamp, wordCount: rec.wordCount, fragments: rec.fragmentSegments }
      });
    } catch {/* 存储失败不影响分析流程 */}
  }

  return { records, segments: allSegments, meta };
}

export async function purgeRawText(userId, sourceRef) {
  if (!sourceRef) {
    const count = await repo.deleteAllDataSources(userId);
    return { purged: count > 0, count };
  }
  const ok = await repo.deleteDataSourceByRef(userId, sourceRef);
  return { purged: ok, count: ok ? 1 : 0 };
}
