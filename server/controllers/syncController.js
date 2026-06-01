import { query } from '../config/database.js';

// Sync notes pushed from Userscript or manual JSON import
export async function syncPush(req, res) {
  const userId = req.user.id;
  const { notes } = req.body;

  if (!notes || !Array.isArray(notes)) {
    return res.status(400).json({ error: 'Invalid payload: "notes" array required' });
  }

  console.log(`📥 Received sync payload: ${notes.length} notes for user ID: ${userId}`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  try {
    for (const note of notes) {
      const {
        id,
        title = '无标题',
        content = '',
        category = '未分类',
        date = ''
      } = note;

      if (!id) continue;

      const wordCount = content.length;
      
      // Determine modification date
      let parsedDate = new Date();
      if (date) {
        const d = new Date(date);
        if (!isNaN(d.getTime())) {
          parsedDate = d;
        }
      }

      // Check if note already exists
      const existingRes = await query('SELECT * FROM notes WHERE id = $1 AND user_id = $2', [id, userId]);

      if (existingRes.rows.length === 0) {
        // 1. Insert new note
        await query(
          `INSERT INTO notes (id, user_id, title, content, category, word_count, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
          [id, userId, title, content, category, wordCount, parsedDate]
        );
        inserted++;
      } else {
        // 2. Note exists, compare title and content
        const existing = existingRes.rows[0];
        
        if (existing.title !== title || existing.content !== content) {
          // Backup current note to version history before updating
          const verCountRes = await query(
            'SELECT COALESCE(MAX(version_num), 0) as max_ver FROM note_versions WHERE note_id = $1',
            [id]
          );
          const nextVer = verCountRes.rows[0].max_ver + 1;

          await query(
            `INSERT INTO note_versions (note_id, title, content, version_num, created_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, existing.title, existing.content, nextVer, existing.updated_at]
          );

          // Update note
          await query(
            `UPDATE notes
             SET title = $1, content = $2, category = $3, word_count = $4, updated_at = $5, is_deleted = FALSE
             WHERE id = $6 AND user_id = $7`,
            [title, content, category, wordCount, parsedDate, id, userId]
          );
          updated++;
        } else {
          // If deleted tag was true, restore it if synchronized again
          if (existing.is_deleted) {
            await query('UPDATE notes SET is_deleted = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
            updated++;
          } else {
            skipped++;
          }
        }
      }
    }

    res.json({
      message: 'Sync completed successfully',
      stats: {
        total: notes.length,
        inserted,
        updated,
        skipped
      }
    });
  } catch (err) {
    console.error('❌ Sync failed:', err.message);
    res.status(500).json({ error: 'Sync failed: ' + err.message });
  }
}
