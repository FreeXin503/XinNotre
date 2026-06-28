import { query, withTransaction } from '../config/database.js';
import { success, fail, asyncHandler } from '../utils/response.js';

async function writeSyncHistory(userId, payload) {
  await query(
    `INSERT INTO sync_history (user_id, total_count, inserted_count, updated_count, skipped_count, status, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      payload.total ?? 0,
      payload.inserted ?? 0,
      payload.updated ?? 0,
      payload.skipped ?? 0,
      payload.status ?? 'success',
      payload.errorMessage ?? null
    ]
  );
}

export const syncPush = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { notes } = req.body;

  if (!notes || !Array.isArray(notes)) {
    return fail(res, 'Invalid payload: "notes" array required', 400);
  }

  if (notes.length > 5000) {
    return fail(res, '单次同步不能超过 5000 条', 413);
  }

  console.log(`📥 Received sync payload: ${notes.length} notes for user ID: ${userId}`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  try {
    const validNotes = notes.filter(n => n && n.id);
    if (validNotes.length === 0) {
      await writeSyncHistory(userId, { total: 0, inserted: 0, updated: 0, skipped: 0, status: 'empty' });
      return success(res, { message: 'No valid notes to sync', stats: { total: 0, inserted: 0, updated: 0, skipped: 0 } });
    }

    // 整批同步在单个事务内执行
    await withTransaction(async (tx) => {
      const ids = validNotes.map(n => n.id);
      const placeholders = ids.map(() => '?').join(',');
      const existingRes = await tx(
        `SELECT id, title, content, is_deleted, updated_at FROM notes WHERE id IN (${placeholders}) AND user_id = ?`,
        [...ids, userId]
      );
      const existingMap = new Map(existingRes.rows.map(r => [r.id, r]));

      const newNotes = [];
      const updateNotes = [];
      const skipNotes = [];

      for (const note of validNotes) {
        const existing = existingMap.get(note.id);
        if (!existing) {
          newNotes.push(note);
        } else if (existing.title !== (note.title || '无标题') || existing.content !== (note.content || '')) {
          updateNotes.push({ note, existing });
        } else if (existing.is_deleted) {
          updateNotes.push({ note, existing, restoreOnly: true });
        } else {
          skipNotes.push(note);
        }
      }

      skipped = skipNotes.length;

      // Batch INSERT new notes
      if (newNotes.length > 0) {
        const valuePlaceholders = newNotes.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(',');
        const insertParams = [];
        for (const note of newNotes) {
          const title = note.title || '无标题';
          const content = note.content || '';
          const category = note.category || '未分类';
          const wordCount = content.length;
          let parsedDate = new Date();
          if (note.date) {
            const d = new Date(note.date);
            if (!isNaN(d.getTime())) parsedDate = d;
          }
          insertParams.push(note.id, userId, title, content, category, wordCount, parsedDate, parsedDate);
        }

        await tx(
          `INSERT INTO notes (id, user_id, title, content, category, word_count, created_at, updated_at)
           VALUES ${valuePlaceholders}`,
          insertParams
        );
        inserted = newNotes.length;
      }

      // Update existing notes individually (version history logic, 在事务内保证原子性)
      for (const { note, existing, restoreOnly } of updateNotes) {
        if (restoreOnly) {
          await tx(
            'UPDATE notes SET is_deleted = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
            [note.id, userId]
          );
          updated++;
          continue;
        }

        const title = note.title || '无标题';
        const content = note.content || '';
        const category = note.category || '未分类';
        const wordCount = content.length;
        let parsedDate = new Date();
        if (note.date) {
          const d = new Date(note.date);
          if (!isNaN(d.getTime())) parsedDate = d;
        }

        const verCountRes = await tx(
          'SELECT COALESCE(MAX(version_num), 0) as max_ver FROM note_versions WHERE note_id = ?',
          [note.id]
        );
        const nextVer = verCountRes.rows[0].max_ver + 1;

        await tx(
          `INSERT INTO note_versions (note_id, title, content, version_num, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [note.id, existing.title, existing.content, nextVer, existing.updated_at]
        );

        await tx(
          `UPDATE notes SET title = ?, content = ?, category = ?, word_count = ?, updated_at = ?, is_deleted = FALSE
           WHERE id = ? AND user_id = ?`,
          [title, content, category, wordCount, parsedDate, note.id, userId]
        );
        updated++;
      }
    });

    await writeSyncHistory(userId, {
      total: validNotes.length,
      inserted, updated, skipped,
      status: 'success'
    });

    success(res, {
      message: 'Sync completed successfully',
      stats: { total: validNotes.length, inserted, updated, skipped }
    });
  } catch (err) {
    console.error('❌ Sync failed:', err.message);
    try {
      await writeSyncHistory(userId, {
        total: Array.isArray(notes) ? notes.filter(n => n && n.id).length : 0,
        inserted, updated, skipped,
        status: 'failed',
        errorMessage: err.message
      });
    } catch (historyErr) {
      console.error('❌ Sync history write failed:', historyErr.message);
    }
    fail(res, 'Sync failed', 500);
  }
});

export const getSyncHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const result = await query(
    'SELECT * FROM sync_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
    [userId]
  );
  success(res, { history: result.rows });
});
