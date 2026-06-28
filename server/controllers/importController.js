import { asyncHandler, success, fail } from '../utils/response.js';
import { parseDayOneJson } from '../services/import/dayoneImport.js';
import { preprocess } from '../services/mindGalaxy/preprocessService.js';
import noteRepository from '../repositories/noteRepository.js';

export const importDayOne = asyncHandler(async (req, res) => {
  if (!req.file) {
    return fail(res, '请上传 DayOne JSON 文件', 400);
  }

  if (req.file.size > 10 * 1024 * 1024) {
    return fail(res, '文件大小超过限制（最大 10MB）', 413);
  }

  const userId = req.user.id;
  const { entries, skipped: parseSkipped } = await parseDayOneJson(req.file.buffer);

  if (entries.length === 0) {
    return success(res, { imported: 0, skipped: parseSkipped });
  }

  let imported = 0;
  let dedupSkipped = 0;

  for (const entry of entries) {
    let content = entry.content;

    let truncated = false;
    if (content.length > 50000) {
      content = content.substring(0, 50000);
      truncated = true;
    }

    const existing = await noteRepository.findByUuid(entry.uuid, userId);
    if (existing) {
      dedupSkipped++;
      continue;
    }

    const metaJson = {
      dayone: {
        weather: entry.meta.weather || null,
        location: entry.meta.location || null,
        photos: entry.meta.photos || [],
        sampledAt: entry.sampledAt
      }
    };
    if (truncated) {
      metaJson.dayone.truncated = true;
    }

    const noteId = `do_${entry.uuid.slice(0, 28)}`;

    await noteRepository.create({
      id: noteId,
      title: entry.title,
      content,
      category: 'DayOne导入',
      meta_json: metaJson
    }, userId);

    preprocess(userId, {
      sources: [{
        type: 'notes',
        text: content,
        ref: noteId,
        timestamp: entry.sampledAt
      }]
    }).catch(() => {});

    imported++;
  }

  return success(res, { imported, skipped: parseSkipped + dedupSkipped });
});
