import { searchVectors, cachedSearch } from './vectorStore.js';
import { embedText } from './embeddingService.js';
import { query } from '../config/database.js';

export async function hybridRetrieve(userId, searchText, topK = 8) {
  if (!searchText || searchText.trim().length === 0) {
    return await getRecentNotes(userId, topK);
  }

  const [vectorResults, ftsResults] = await Promise.allSettled([
    cachedSearch(embedText, searchText, 30, 300000, userId),
    fulltextSearch(userId, searchText, 10)
  ]);

  const merged = new Map();

  // Merge vector results (high recall)
  if (vectorResults.status === 'fulfilled' && vectorResults.value) {
    for (const r of vectorResults.value) {
      if (!merged.has(r.id)) {
        merged.set(r.id, { ...r, sources: ['vector'], boost: 0 });
      }
    }
  }

  // Merge FTS results with boost
  if (ftsResults.status === 'fulfilled' && ftsResults.value) {
    for (let i = 0; i < ftsResults.value.length; i++) {
      const r = ftsResults.value[i];
      if (merged.has(r.id)) {
        const existing = merged.get(r.id);
        existing.sources.push('fts');
        existing.boost += 0.15 + (1 - i / ftsResults.value.length) * 0.1;
      } else {
        merged.set(r.id, { ...r, sources: ['fts'], boost: 0.1 + (1 - i / ftsResults.value.length) * 0.05 });
      }
    }
  }

  // Time decay: recent notes get a small boost
  const results = Array.from(merged.values());
  results.forEach(r => {
    if (r.payload?.created_at) {
      const ageDays = (Date.now() - new Date(r.payload.created_at).getTime()) / 86400000;
      r.boost += Math.max(0, (180 - Math.min(ageDays, 180)) / 180 * 0.1);
    }
  });

  results.sort((a, b) => (b.score + b.boost) - (a.score + a.boost));
  return results.slice(0, topK);
}

async function fulltextSearch(userId, term, limit = 10) {
  try {
    let result = await query(
      `SELECT id, title, LEFT(content, 800) as content, category,
              MATCH(title, content) AGAINST(? IN BOOLEAN MODE) as score
       FROM notes
       WHERE user_id = ? AND is_deleted = FALSE AND MATCH(title, content) AGAINST(? IN BOOLEAN MODE)
       ORDER BY score DESC LIMIT ?`,
      [term, userId, term, limit]
    );

    if (!result || result.rows.length === 0) {
      result = await query(
        `SELECT id, title, LEFT(content, 800) as content, category
         FROM notes
         WHERE user_id = ? AND is_deleted = FALSE AND (title LIKE ? OR content LIKE ?)
         LIMIT ?`,
        [userId, `%${term.substring(0, 8)}%`, `%${term.substring(0, 8)}%`, limit]
      );
    }

    return result.rows.map(r => ({
      id: r.id,
      score: r.score || 0.1,
      payload: {
        note_id: r.id,
        user_id: userId,
        title: r.title,
        category: r.category,
      },
      content: r.content
    }));
  } catch (err) {
    console.error('[retrieval] FTS error:', err.message);
    return [];
  }
}

async function getRecentNotes(userId, topK = 8) {
  try {
    const result = await query(
      'SELECT id, title, LEFT(content, 800) as content, category, created_at FROM notes WHERE user_id = ? AND is_deleted = FALSE ORDER BY updated_at DESC LIMIT ?',
      [userId, topK]
    );
    return result.rows.map((r, i) => ({
      id: r.id,
      score: 1 - i * 0.05,
      payload: {
        note_id: r.id,
        user_id: userId,
        title: r.title,
        category: r.category,
        created_at: r.created_at ? String(r.created_at).substring(0, 10) : ''
      },
      content: r.content
    }));
  } catch (err) {
    console.error('[retrieval] Recent notes error:', err.message);
    return [];
  }
}

export function buildContextText(titles, results) {
  return results.map((r, i) =>
    `--- 记忆碎片 #${i + 1} ---\n` +
    `标题: ${r.payload?.title || '无标题'}\n` +
    `分类: ${r.payload?.category || '未知'}\n` +
    `原文: ${(r.content || '').substring(0, 1500)}`
  ).join('\n\n');
}
