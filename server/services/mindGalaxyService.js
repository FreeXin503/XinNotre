/**
 * 心智星系 · Mind Galaxy 服务
 * 职责：
 *   1. 从便签/日记生成星系数据
 *   2. 从知识库生成星系数据
 *   3. 数据格式转换和映射
 */
import { query } from '../config/database.js';
import noteRepository from '../repositories/noteRepository.js';

// ════════════════════════════════════════════════════════════
// 星系数据生成服务
// ════════════════════════════════════════════════════════════

/**
 * 从便签/日记生成星系数据
 * @param {number} userId - 用户ID
 * @param {Object} options - 选项
 * @returns {Object} 星系数据
 */
export async function generateGalaxyFromNotes(userId, options = {}) {
  const { limit = 50, category = null } = options;

  // 获取便签列表
  const result = await noteRepository.findByUserId(userId, {
    category,
    page: 1,
    pageSize: limit
  });

  const notes = result.items;
  if (!notes || notes.length === 0) {
    return createEmptyGalaxy('暂无日记数据');
  }

  // 分析便签，提取主题和分类
  const analyzed = analyzeNotes(notes);

  // 转换为星系格式
  return convertToGalaxyFormat(analyzed, 'notes');
}

/**
 * 从知识库生成星系数据
 * @param {number} userId - 用户ID
 * @param {Object} options - 选项
 * @returns {Object} 星系数据
 */
export async function generateGalaxyFromKnowledgeBase(userId, options = {}) {
  const { kbId = null, limit = 100 } = options;

  // 获取知识库列表
  const kbResult = await query(
    `SELECT kb.*, IFNULL(kbnc.c, 0) as note_count
     FROM knowledge_bases kb
     LEFT JOIN (SELECT kb_id, COUNT(*) as c FROM knowledge_base_notes GROUP BY kb_id) kbnc ON kbnc.kb_id = kb.id
     WHERE kb.user_id = ?
     ORDER BY kb.updated_at DESC`,
    [userId]
  );

  const knowledgeBases = kbResult.rows;
  if (!knowledgeBases || knowledgeBases.length === 0) {
    return createEmptyGalaxy('暂无知识库数据');
  }

  // 获取知识库笔记
  let allNotes = [];
  for (const kb of knowledgeBases) {
    if (kbId && kb.id !== parseInt(kbId)) continue;
    
    const notesResult = await query(
      `SELECT n.*, kbn.kb_id, kbn.sort_order, kbn.added_at as kb_added_at
       FROM knowledge_base_notes kbn
       JOIN notes n ON n.id = kbn.note_id
       WHERE kbn.kb_id = ? AND n.user_id = ?
       ORDER BY kbn.sort_order ASC, kbn.added_at DESC
       LIMIT ?`,
      [kb.id, userId, limit]
    );
    
    allNotes = allNotes.concat(notesResult.rows.map(n => ({
      ...n,
      kb_name: kb.name,
      kb_icon: kb.icon,
      kb_id: kb.id
    })));
  }

  if (allNotes.length === 0) {
    return createEmptyGalaxy('知识库中暂无笔记');
  }

  // 分析知识库笔记
  const analyzed = analyzeKnowledgeBaseNotes(allNotes, knowledgeBases);

  // 转换为星系格式
  return convertToGalaxyFormat(analyzed, 'knowledge');
}

/**
 * 生成混合星系（日记 + 知识库）
 * @param {number} userId - 用户ID
 * @returns {Object} 星系数据
 */
export async function generateMixedGalaxy(userId) {
  const notesGalaxy = await generateGalaxyFromNotes(userId, { limit: 30 });
  const kbGalaxy = await generateGalaxyFromKnowledgeBase(userId, { limit: 50 });

  // 合并两个星系
  return {
    stars: [...notesGalaxy.stars, ...kbGalaxy.stars],
    planets: [...notesGalaxy.planets, ...kbGalaxy.planets],
    satellites: [...notesGalaxy.satellites, ...kbGalaxy.satellites],
    meta: {
      source: 'mixed',
      notesCount: notesGalaxy.meta?.count || 0,
      kbCount: kbGalaxy.meta?.count || 0,
      generatedAt: new Date().toISOString()
    }
  };
}

// ════════════════════════════════════════════════════════════
// 分析和转换函数
// ════════════════════════════════════════════════════════════

/**
 * 分析便签数据
 */
function analyzeNotes(notes) {
  const categories = {};
  const tags = {};
  const emotions = { positive: 0, neutral: 0, negative: 0 };

  notes.forEach(note => {
    const category = note.category || '未分类';
    if (!categories[category]) {
      categories[category] = {
        name: category,
        count: 0,
        notes: [],
        keywords: extractKeywords(note.title + ' ' + (note.content || ''))
      };
    }
    categories[category].count++;
    categories[category].notes.push(note);

    // 简单情感分析
    const emotion = analyzeEmotion(note.content || note.title);
    emotions[emotion]++;
  });

  return {
    categories,
    emotions,
    totalCount: notes.length,
    notes
  };
}

/**
 * 分析知识库笔记
 */
function analyzeKnowledgeBaseNotes(notes, knowledgeBases) {
  const kbMap = {};
  
  knowledgeBases.forEach(kb => {
    kbMap[kb.id] = {
      id: kb.id,
      name: kb.name,
      icon: kb.icon,
      description: kb.description,
      count: 0,
      notes: [],
      keywords: []
    };
  });

  notes.forEach(note => {
    const kbId = note.kb_id;
    if (kbMap[kbId]) {
      kbMap[kbId].count++;
      kbMap[kbId].notes.push(note);
      kbMap[kbId].keywords = kbMap[kbId].keywords.concat(
        extractKeywords(note.title + ' ' + (note.content || ''))
      );
    }
  });

  return {
    knowledgeBases: kbMap,
    totalCount: notes.length,
    notes
  };
}

/**
 * 转换为星系数据格式
 */
function convertToGalaxyFormat(analyzed, sourceType) {
  const stars = [];
  const planets = [];
  const satellites = [];

  if (sourceType === 'notes') {
    // 便签：分类作为恒星，便签作为行星，关键词作为卫星
    const categories = Object.values(analyzed.categories);
    const starColors = ['#f0c040', '#ff8866', '#88ccff', '#aaffaa', '#ddaaff', '#ffdd88'];
    
    categories.forEach((cat, index) => {
      const starId = `star-notes-${index}`;
      const hue = (index * 60 + 30) % 360;
      
      stars.push({
        id: starId,
        name: cat.name,
        type: 'star',
        sourceType: 'notes',
        sourceId: cat.name,
        hue: hue,
        colorHex: starColors[index % starColors.length],
        radius: Math.min(0.8 + cat.count * 0.15, 2.0),
        position: [
          Math.cos(index * 2.094) * 6,
          (Math.random() - 0.5) * 4,
          Math.sin(index * 2.094) * 6
        ],
        coreBelief: `${cat.name} · 共 ${cat.count} 篇日记`,
        description: `这个主题包含 ${cat.count} 篇日记记录，关键词：${cat.keywords.slice(0, 5).join('、')}`,
        diaryExcerpts: cat.notes.slice(0, 3).map(n => n.title),
        emotionTendency: getEmotionTendency(analyzed.emotions),
        frequency: cat.count > 10 ? '高频' : cat.count > 5 ? '中频' : '低频'
      });

      // 每个分类下的便签作为行星
      cat.notes.slice(0, 6).forEach((note, pIndex) => {
        const planetId = `planet-notes-${index}-${pIndex}`;
        const planetColors = ['#88bbee', '#88ddaa', '#ddaa88', '#cc88dd', '#88dddd', '#dddd88'];
        
        planets.push({
          id: planetId,
          name: note.title.substring(0, 12),
          type: 'planet',
          sourceType: 'notes',
          sourceId: note.id,
          parentStarId: starId,
          colorHex: planetColors[pIndex % planetColors.length],
          radius: 0.3 + Math.random() * 0.2,
          orbitRadius: 2.5 + pIndex * 0.6,
          orbitInclination: (Math.random() - 0.5) * 0.4,
          orbitSpeed: 0.15 + Math.random() * 0.2,
          coreMeaning: note.title,
          diaryExcerpts: [note.content?.substring(0, 100) || note.title],
          emotionTendency: analyzeEmotion(note.content || note.title) === 'positive' ? '积极' : 
                          analyzeEmotion(note.content || note.title) === 'negative' ? '消极' : '中性',
          noteData: {
            id: note.id,
            title: note.title,
            category: note.category,
            updatedAt: note.updated_at
          }
        });

        // 提取关键词作为卫星
        const keywords = extractKeywords(note.title + ' ' + (note.content || ''));
        keywords.slice(0, 3).forEach((keyword, sIndex) => {
          satellites.push({
            id: `sat-notes-${index}-${pIndex}-${sIndex}`,
            name: keyword,
            type: 'satellite',
            sourceType: 'notes',
            sourceId: note.id,
            parentPlanetId: planetId,
            colorHex: '#ffcc88',
            radius: 0.08,
            orbitRadius: 0.5 + sIndex * 0.15,
            emotionTendency: '中性',
            diaryExcerpts: [keyword]
          });
        });
      });
    });
  } else if (sourceType === 'knowledge') {
    // 知识库：知识库作为恒星，笔记作为行星，知识点作为卫星
    const kbs = Object.values(analyzed.knowledgeBases).filter(kb => kb.count > 0);
    const starColors = ['#66ccff', '#66ffcc', '#ffcc66', '#cc66ff', '#ff66cc', '#66ff66'];
    
    kbs.forEach((kb, index) => {
      const starId = `star-kb-${kb.id}`;
      
      stars.push({
        id: starId,
        name: kb.icon + ' ' + kb.name,
        type: 'star',
        sourceType: 'knowledge',
        sourceId: kb.id,
        hue: (index * 55 + 200) % 360,
        colorHex: starColors[index % starColors.length],
        radius: Math.min(0.9 + kb.count * 0.1, 2.2),
        position: [
          Math.cos(index * 1.8 + 1) * 7,
          (Math.random() - 0.5) * 3,
          Math.sin(index * 1.8 + 1) * 7
        ],
        coreBelief: `${kb.name} · 知识库`,
        description: kb.description || `包含 ${kb.count} 条知识笔记`,
        diaryExcerpts: kb.notes.slice(0, 3).map(n => n.title),
        emotionTendency: '求知',
        frequency: kb.count > 20 ? '高频' : kb.count > 10 ? '中频' : '低频',
        kbData: {
          id: kb.id,
          name: kb.name,
          icon: kb.icon,
          noteCount: kb.count
        }
      });

      // 知识库下的笔记作为行星
      kb.notes.slice(0, 8).forEach((note, pIndex) => {
        const planetId = `planet-kb-${kb.id}-${pIndex}`;
        const planetColors = ['#88ddff', '#88ffdd', '#ffdd88', '#dd88ff', '#88ff88', '#ff88dd'];
        
        planets.push({
          id: planetId,
          name: note.title.substring(0, 14),
          type: 'planet',
          sourceType: 'knowledge',
          sourceId: note.id,
          parentStarId: starId,
          colorHex: planetColors[pIndex % planetColors.length],
          radius: 0.35 + Math.random() * 0.15,
          orbitRadius: 2.8 + pIndex * 0.5,
          orbitInclination: (Math.random() - 0.5) * 0.3,
          orbitSpeed: 0.12 + Math.random() * 0.15,
          coreMeaning: note.title,
          diaryExcerpts: [note.content?.substring(0, 120) || note.title],
          emotionTendency: '探索',
          noteData: {
            id: note.id,
            title: note.title,
            kbId: kb.id,
            kbName: kb.name
          }
        });

        // 提取知识点作为卫星
        const keywords = extractKeywords(note.title + ' ' + (note.content || ''));
        keywords.slice(0, 2).forEach((keyword, sIndex) => {
          satellites.push({
            id: `sat-kb-${kb.id}-${pIndex}-${sIndex}`,
            name: keyword,
            type: 'satellite',
            sourceType: 'knowledge',
            sourceId: note.id,
            parentPlanetId: planetId,
            colorHex: '#aaddff',
            radius: 0.07,
            orbitRadius: 0.55 + sIndex * 0.12,
            emotionTendency: '求知',
            diaryExcerpts: [keyword]
          });
        });
      });
    });
  }

  return {
    stars,
    planets,
    satellites,
    meta: {
      source: sourceType,
      count: analyzed.totalCount,
      generatedAt: new Date().toISOString()
    }
  };
}

// ════════════════════════════════════════════════════════════
// 工具函数
// ════════════════════════════════════════════════════════════

/**
 * 创建空星系
 */
function createEmptyGalaxy(message) {
  return {
    stars: [
      {
        id: 'star-empty',
        name: '等待探索',
        type: 'star',
        hue: 200,
        colorHex: '#88aacc',
        radius: 1.0,
        position: [0, 0, 0],
        coreBelief: message,
        description: '导入你的日记和知识库，点亮属于你的心智星系',
        diaryExcerpts: [],
        emotionTendency: '期待',
        frequency: '低频'
      }
    ],
    planets: [],
    satellites: [],
    meta: {
      source: 'empty',
      count: 0,
      message
    }
  };
}

/**
 * 提取关键词（简单实现）
 */
function extractKeywords(text) {
  if (!text) return [];
  
  // 简单的关键词提取：提取常见的有意义的词汇
  const stopWords = ['的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这'];
  
  // 简单分词（按标点和空格分割）
  const words = text.split(/[，。！？、；：""''（）\s\n\r]+/).filter(w => w.length >= 2 && w.length <= 8);
  
  // 过滤停用词并去重
  const keywords = [...new Set(words.filter(w => !stopWords.includes(w)))];
  
  return keywords.slice(0, 10);
}

/**
 * 简单情感分析
 */
function analyzeEmotion(text) {
  if (!text) return 'neutral';
  
  const positiveWords = ['开心', '快乐', '高兴', '幸福', '满足', '成功', '进步', '成长', '希望', '爱', '喜欢', '美好', '感谢', '感恩', '期待', '兴奋', '激动', '温暖', '感动', '惊喜'];
  const negativeWords = ['难过', '伤心', '痛苦', '失望', '焦虑', '压力', '疲惫', '烦恼', '生气', '愤怒', '害怕', '恐惧', '孤独', '迷茫', '沮丧', '失落', '后悔', '遗憾', '担忧', '紧张'];
  
  let positive = 0;
  let negative = 0;
  
  positiveWords.forEach(word => {
    if (text.includes(word)) positive++;
  });
  
  negativeWords.forEach(word => {
    if (text.includes(word)) negative++;
  });
  
  if (positive > negative) return 'positive';
  if (negative > positive) return 'negative';
  return 'neutral';
}

/**
 * 获取情感倾向描述
 */
function getEmotionTendency(emotions) {
  const total = emotions.positive + emotions.neutral + emotions.negative;
  if (total === 0) return '中性';
  
  const posRatio = emotions.positive / total;
  const negRatio = emotions.negative / total;
  
  if (posRatio > 0.6) return '积极向上';
  if (negRatio > 0.4) return '偏消极';
  if (posRatio > negRatio) return '偏积极';
  return '中性平和';
}

export default {
  generateGalaxyFromNotes,
  generateGalaxyFromKnowledgeBase,
  generateMixedGalaxy
};