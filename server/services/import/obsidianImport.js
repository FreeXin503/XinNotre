import AdmZip from 'adm-zip';
import crypto from 'crypto';
import { BaseImporter } from './baseImporter.js';

function parseSimpleFrontMatter(text) {
  if (!text.startsWith('---')) return { meta: {}, body: text };
  const endIdx = text.indexOf('---', 3);
  if (endIdx === -1) return { meta: {}, body: text };
  const fmBlock = text.substring(3, endIdx).trim();
  const body = text.substring(endIdx + 3).trim();
  const meta = {};
  for (const line of fmBlock.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.substring(0, idx).trim();
    let value = line.substring(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    if (key === 'tags' && value.startsWith('[') && value.endsWith(']')) {
      meta.tags = value.slice(1, -1).split(',').map(t => t.trim().replace(/['"]/g, '')).filter(Boolean);
    } else {
      meta[key] = value;
    }
  }
  return { meta, body };
}

function extractWikiLinks(text) {
  const matches = text.match(/\[\[(.+?)\]\]/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.slice(2, -2).split('|')[0].trim()).filter(Boolean))];
}

export class ObsidianImporter extends BaseImporter {
  static canHandle(filename, mimeType) {
    return filename.endsWith('.zip') || mimeType === 'application/zip';
  }

  async parse(buffer, opts = {}) {
    const entries = [];
    const seen = new Set();
    let zip;

    try {
      zip = new AdmZip(buffer);
    } catch {
      throw Object.assign(new Error('invalid obsidian format'), { statusCode: 400 });
    }

    const zipEntries = zip.getEntries();
    const mdFiles = zipEntries.filter(e => !e.isDirectory && e.entryName.replace(/\\/g, '/').endsWith('.md'));

    for (const entry of mdFiles) {
      const rawContent = entry.getData().toString('utf8');
      const { meta, body } = parseSimpleFrontMatter(rawContent);

      const title = meta.title || entry.entryName.replace(/\\/g, '/').split('/').pop().replace(/\.md$/i, '');
      const id = `ob_${crypto.createHash('sha256').update(entry.entryName).digest('hex').substring(0, 28)}`;

      if (seen.has(id)) continue;
      seen.add(id);

      const wikiTags = extractWikiLinks(body);
      const allTags = [...new Set([...(meta.tags || []), ...wikiTags])];

      const { content: cleanContent, truncated } = this.truncateContent(body);
      const noteMeta = {};
      if (truncated) noteMeta.truncated = true;

      entries.push({
        id,
        title,
        content: cleanContent,
        category: 'Obsidian导入',
        tags: allTags,
        meta_json: { obsidian: noteMeta }
      });
    }

    return { entries, skipped: mdFiles.length === 0 ? (zipEntries.length > 0 ? zipEntries.length : 0) : 0 };
  }
}

export default ObsidianImporter;
