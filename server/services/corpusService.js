import crypto from 'crypto';
import { query } from '../config/database.js';

export async function getCorpus(userId, scope = {}) {
  const {
    mode = 'all',
    category = null,
    dateStart = null,
    dateEnd = null,
    noteId = null,
    limit = 200,
    perNoteChars = 300
  } = scope;

  if (!userId) {
    return { notes: [], corpusText: '', hash: '', count: 0 };
  }

  let sql = 'SELECT id, title, content, category, created_at FROM notes WHERE user_id = ? AND is_deleted = FALSE';
  const params = [userId];

  if (mode === 'category' && category) {
    params.push(category);
    sql += ' AND category = ?';
  } else if (mode === 'range' && dateStart) {
    params.push(dateStart);
    sql += ' AND created_at >= ?';
    if (dateEnd) {
      params.push(dateEnd);
      sql += ' AND created_at < ?';
    }
  } else if (mode === 'note' && noteId) {
    params.push(noteId);
    sql += ' AND id = ?';
  }

  sql += ' ORDER BY created_at ASC LIMIT ?';
  params.push(limit);

  const result = await query(sql, params);
  const notes = result.rows || [];

  const corpusText = notes.map(n => {
    const content = (n.content || '').substring(0, perNoteChars);
    const date = String(n.created_at || '').substring(0, 10);
    return `[${date} | ${n.category || '未知'}] ${n.title || '无标题'}\n${content}`;
  }).join('\n\n---\n\n');

  const hash = crypto.createHash('sha256').update(corpusText).digest('hex').substring(0, 16);

  return { notes, corpusText, hash, count: notes.length };
}
