import { asyncHandler, success, fail } from '../utils/response.js';
import { parseDayOneJson } from '../services/import/dayoneImport.js';
import { NotionImporter } from '../services/import/notionImport.js';
import { ObsidianImporter } from '../services/import/obsidianImport.js';
import { EvernoteImporter } from '../services/import/evernoteImport.js';
import { FeishuImporter } from '../services/import/feishuImport.js';
import { ChatlogImporter } from '../services/import/chatlogImport.js';
import { VoiceImporter } from '../services/import/voiceImport.js';
import { preprocess } from '../services/mindGalaxy/preprocessService.js';
import noteRepository from '../repositories/noteRepository.js';

async function importEntries(userId, entries) {
  let imported = 0;
  let dedupSkipped = 0;

  for (const entry of entries) {
    const existing = await noteRepository.findById(entry.id, userId);
    if (existing) {
      dedupSkipped++;
      continue;
    }

    await noteRepository.create({
      id: entry.id,
      title: entry.title,
      content: entry.content,
      category: entry.category,
      meta_json: entry.meta_json || {}
    }, userId);

    preprocess(userId, {
      sources: [{
        type: 'notes',
        text: entry.content,
        ref: entry.id,
        timestamp: new Date().toISOString()
      }]
    }).catch(() => {});

    imported++;
  }

  return { imported, dedupSkipped };
}

export const importDayOne = asyncHandler(async (req, res) => {
  if (!req.file) return fail(res, '请上传 DayOne JSON 文件', 400);
  if (req.file.size > 10 * 1024 * 1024) return fail(res, '文件大小超过限制（最大 10MB）', 413);

  const userId = req.user.id;
  const { entries, skipped: parseSkipped } = await parseDayOneJson(req.file.buffer);

  if (entries.length === 0) return success(res, { imported: 0, skipped: parseSkipped });

  let imported = 0;
  let dedupSkipped = 0;

  for (const entry of entries) {
    let content = entry.content;
    let truncated = false;
    if (content.length > 50000) {
      content = content.substring(0, 50000);
      truncated = true;
    }

    const noteId = `do_${entry.uuid.slice(0, 28)}`;

    const existing = await noteRepository.findById(noteId, userId);
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
    if (truncated) metaJson.dayone.truncated = true;

    await noteRepository.create({
      id: noteId,
      title: entry.title,
      content,
      category: 'DayOne导入',
      meta_json: metaJson
    }, userId);

    preprocess(userId, {
      sources: [{ type: 'notes', text: content, ref: noteId, timestamp: entry.sampledAt }]
    }).catch(() => {});

    imported++;
  }

  return success(res, { imported, skipped: parseSkipped + dedupSkipped });
});

async function handleImporterUpload(req, res, ImporterClass, label) {
  if (!req.file) return fail(res, `请上传${label}文件`, 400);
  if (req.file.size > 10 * 1024 * 1024) return fail(res, '文件大小超过限制（最大 10MB）', 413);

  const userId = req.user.id;
  const importer = new ImporterClass();
  const { entries, skipped: parseSkipped } = await importer.parse(req.file.buffer);

  if (entries.length === 0) return success(res, { imported: 0, skipped: parseSkipped });

  const { imported, dedupSkipped } = await importEntries(userId, entries);
  return success(res, { imported, skipped: parseSkipped + dedupSkipped });
}

export const importNotion = asyncHandler(async (req, res) => {
  return handleImporterUpload(req, res, NotionImporter, 'Notion');
});

export const importObsidian = asyncHandler(async (req, res) => {
  return handleImporterUpload(req, res, ObsidianImporter, 'Obsidian');
});

export const importEvernote = asyncHandler(async (req, res) => {
  return handleImporterUpload(req, res, EvernoteImporter, '印象笔记');
});

export const importFeishu = asyncHandler(async (req, res) => {
  return handleImporterUpload(req, res, FeishuImporter, '飞书');
});

export const importChatlog = asyncHandler(async (req, res) => {
  return handleImporterUpload(req, res, ChatlogImporter, '微信聊天记录');
});

export const importVoice = asyncHandler(async (req, res) => {
  if (!req.file) return fail(res, '请上传音频文件（m4a/mp3/wav）', 400);
  if (req.file.size > 25 * 1024 * 1024) return fail(res, '文件大小超过限制（最大 25MB）', 413);

  const ext = (req.file.originalname || '').split('.').pop().toLowerCase();
  if (!['m4a', 'mp3', 'wav'].includes(ext)) {
    return fail(res, '不支持的文件格式，仅支持 m4a/mp3/wav', 400);
  }

  const userId = req.user.id;
  const importer = new VoiceImporter();
  const { entries, skipped: parseSkipped } = await importer.parse(req.file.buffer, { format: ext, userId });

  if (entries.length === 0) return success(res, { imported: 0, message: '未识别出语音内容' });

  const { imported, dedupSkipped } = await importEntries(userId, entries);
  return success(res, { imported, skipped: parseSkipped + dedupSkipped });
});
