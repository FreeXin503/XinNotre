import { query } from '../config/database.js';
import { embedText } from './embeddingService.js';
import { upsertVector, deleteVector, ensureCollection } from './vectorStore.js';

let syncRunning = false;
let syncInterval = null;

export async function indexNote(note) {
  if (!note.id || !note.content) return;
  const text = `${note.title || ''}\n${(note.content || '').substring(0, 3000)}`;
  if (!text.trim()) return;

  try {
    const vector = await embedText(text);
    await upsertVector(note.id, vector, {
      user_id: note.user_id,
      note_id: note.id,
      title: note.title || '',
      category: note.category || '',
      created_at: note.created_at ? String(note.created_at).substring(0, 10) : ''
    });

    await query(
      `INSERT INTO note_embeddings (note_id, model, vector_id, dim, content_hash)
       VALUES (?, ?, ?, ?, MD5(?))
       ON DUPLICATE KEY UPDATE
         content_hash = MD5(?),
         embedded_at = CURRENT_TIMESTAMP`,
      [note.id, 'text-embedding-004', note.id, 768, text, text]
    );

    // 心理标签向量化（用于跨时空语义检索）
    try {
      const psychTags = await tryExtractPsychTags(note);
      if (psychTags) {
        const psychVector = await embedText(psychTags);
        await upsertVector(`psych:${note.id}`, psychVector, {
          user_id: note.user_id,
          noteId: note.id,
          type: 'psych_tags',
          tags: psychTags,
          created_at: new Date().toISOString()
        });
      }
    } catch (psychErr) {
      // 心理标签提取失败不影响主流程
    }
  } catch (err) {
    console.error(`[vectorSync] indexNote error (${note.id}):`, err.message);
  }
}

export async function removeNoteIndex(noteId) {
  try {
    await deleteVector(noteId);
    await query('DELETE FROM note_embeddings WHERE note_id = ?', [noteId]);
  } catch (err) {
    console.error(`[vectorSync] removeNoteIndex error (${noteId}):`, err.message);
  }
}

export async function syncAllNotes(userId) {
  if (syncRunning) return;
  syncRunning = true;

  try {
    await ensureCollection();

    const result = await query(
      `SELECT n.id, n.user_id, n.title, n.content, n.category, n.created_at,
              ne.content_hash as old_hash,
              MD5(CONCAT(COALESCE(n.title,''), '\n', LEFT(COALESCE(n.content,''), 3000))) as new_hash
       FROM notes n
       LEFT JOIN note_embeddings ne ON ne.note_id = n.id
       WHERE n.user_id = ? AND n.is_deleted = FALSE AND LENGTH(COALESCE(n.content, '')) > 20
       AND (ne.note_id IS NULL OR ne.content_hash != MD5(CONCAT(COALESCE(n.title,''), '\n', LEFT(COALESCE(n.content,''), 3000))))`,
      [userId]
    );

    if (result.rows.length === 0) {
      console.log('[vectorSync] All notes already indexed');
      return 0;
    }

    console.log(`[vectorSync] Indexing ${result.rows.length} notes...`);
    let indexed = 0;
    for (const note of result.rows) {
      await indexNote(note);
      indexed++;
      if (indexed % 50 === 0) {
        console.log(`[vectorSync] Progress: ${indexed}/${result.rows.length}`);
        await new Promise(r => setTimeout(r, 500));
      }
    }

    console.log(`[vectorSync] Done: ${indexed} notes indexed`);
    return indexed;
  } catch (err) {
    console.error('[vectorSync] syncAllNotes error:', err.message);
    return 0;
  } finally {
    syncRunning = false;
  }
}

export async function indexSingleNote(note) {
  if (!note || !note.id) return;
  try {
    await indexNote(note);
  } catch (err) {
    console.error('[vectorSync] indexSingleNote error:', err.message);
  }
}

export async function removeSingleNoteIndex(noteId) {
  if (!noteId) return;
  try {
    await removeNoteIndex(noteId);
  } catch (err) {
    console.error('[vectorSync] removeSingleNoteIndex error:', err.message);
  }
}

export function startAutoSync() {
  syncInterval = setInterval(async () => {
    try {
      const result = await query(
        `SELECT n.id, n.user_id, n.title, n.content, n.category, n.created_at
         FROM notes n
         LEFT JOIN note_embeddings ne ON ne.note_id = n.id
         WHERE n.is_deleted = FALSE AND LENGTH(COALESCE(n.content,'')) > 20
         AND ne.note_id IS NULL
         LIMIT 20`
      );
      if (result.rows.length > 0) {
        for (const note of result.rows) {
          await indexNote(note);
        }
      }
    } catch (err) {}
  }, 60000);
}

export function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

/**
 * 从便签内容中尝试提取心理标签（关键词分析）
 * 用于向量化跨时空语义检索。非 AI 驱动的轻量提取。
 * @param {Object} note
 * @returns {Promise<string|null>}
 */
async function tryExtractPsychTags(note) {
  const text = `${note.title || ''} ${(note.content || '').substring(0, 2000)}`;
  if (!text.trim()) return null;

  // 心理词汇词典
  const psychWords = [
    '焦虑', '抑郁', '孤独', '愤怒', '恐惧', '压力', '疲惫',
    '开心', '快乐', '幸福', '满足', '感激',
    '自我怀疑', '自信', '成长', '改变', '放弃', '坚持',
    '关系', '家庭', '朋友', '事业', '健康', '财富',
    '迷茫', '希望', '绝望', '宽恕', '原谅', '后悔',
    '崩溃', '治愈', '接纳', '勇气', '脆弱', '坚强'
  ];

  const found = psychWords.filter(w => text.includes(w));
  return found.length > 0 ? found.join(', ') : null;
}
