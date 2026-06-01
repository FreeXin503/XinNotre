import { query } from '../config/database.js';

// Get list of notes with optional search, category filter, and pagination
export async function getNotes(req, res) {
  const userId = req.user.id;
  const { category, search, limit = 50, offset = 0 } = req.query;

  try {
    let sql = 'SELECT * FROM notes WHERE user_id = $1 AND is_deleted = FALSE';
    const params = [userId];

    if (category && category !== '全部') {
      params.push(category);
      sql += ` AND category = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (title LIKE $${params.length} OR content LIKE $${params.length} OR category LIKE $${params.length})`;
    }

    sql += ' ORDER BY updated_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);
    
    // Also fetch categories count/distribution for statistics
    const statsResult = await query(
      'SELECT category, COUNT(*) as count FROM notes WHERE user_id = $1 AND is_deleted = FALSE GROUP BY category',
      [userId]
    );

    res.json({
      notes: result.rows,
      categories: statsResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notes: ' + err.message });
  }
}

// Get specific note detail with history versions
export async function getNoteDetail(req, res) {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const noteRes = await query('SELECT * FROM notes WHERE id = $1 AND user_id = $2', [id, userId]);
    if (noteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Fetch versions
    const versionsRes = await query(
      'SELECT * FROM note_versions WHERE note_id = $1 ORDER BY version_num DESC',
      [id]
    );

    res.json({
      note: noteRes.rows[0],
      versions: versionsRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch note detail: ' + err.message });
  }
}

// Create new note
export async function createNote(req, res) {
  const userId = req.user.id;
  const { title = '无标题', content = '', category = '未分类' } = req.body;
  const id = req.body.id || Math.random().toString(36).substring(2, 12);
  const wordCount = content.length;

  try {
    await query(
      `INSERT INTO notes (id, user_id, title, content, category, word_count, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, userId, title, content, category, wordCount]
    );

    const noteRes = await query('SELECT * FROM notes WHERE id = $1 AND user_id = $2', [id, userId]);
    res.status(201).json(noteRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create note: ' + err.message });
  }
}

// Update existing note with version snapshot
export async function updateNote(req, res) {
  const { id } = req.params;
  const userId = req.user.id;
  const { title, content, category } = req.body;

  try {
    // 1. Fetch current note to archive its current state
    const currentRes = await query('SELECT * FROM notes WHERE id = $1 AND user_id = $2', [id, userId]);
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const currentNote = currentRes.rows[0];

    // If changes occurred, create a history version
    if (currentNote.title !== title || currentNote.content !== content) {
      // Find the next version number
      const verCountRes = await query(
        'SELECT COALESCE(MAX(version_num), 0) as max_ver FROM note_versions WHERE note_id = $1',
        [id]
      );
      const nextVer = verCountRes.rows[0].max_ver + 1;

      // Save version snapshot
      await query(
        `INSERT INTO note_versions (note_id, title, content, version_num, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, currentNote.title, currentNote.content, nextVer, currentNote.updated_at]
      );
    }

    // 2. Perform the update
    const wordCount = content !== undefined ? content.length : currentNote.word_count;
    const finalTitle = title !== undefined ? title : currentNote.title;
    const finalContent = content !== undefined ? content : currentNote.content;
    const finalCategory = category !== undefined ? category : currentNote.category;

    await query(
      `UPDATE notes
       SET title = $1, content = $2, category = $3, word_count = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND user_id = $6`,
      [finalTitle, finalContent, finalCategory, wordCount, id, userId]
    );

    const noteRes = await query('SELECT * FROM notes WHERE id = $1 AND user_id = $2', [id, userId]);
    res.json(noteRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update note: ' + err.message });
  }
}

// Delete note (Soft delete)
export async function deleteNote(req, res) {
  const { id } = req.params;
  const userId = req.user.id;
  const { hard = false } = req.query;

  try {
    if (hard === 'true' || hard === true) {
      await query('DELETE FROM notes WHERE id = $1 AND user_id = $2', [id, userId]);
      res.json({ message: 'Note permanently deleted' });
    } else {
      await query('UPDATE notes SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2', [id, userId]);
      res.json({ message: 'Note soft-deleted successfully' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete note: ' + err.message });
  }
}
