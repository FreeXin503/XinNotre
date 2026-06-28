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

export class NotionImporter extends BaseImporter {
  static canHandle(filename, mimeType) {
    return filename.endsWith('.zip') || mimeType === 'application/zip';
  }

  async parse(buffer, opts = {}) {
    const entries = [];
    const seen = new Set();

    this._parseZip(buffer, entries, seen, '');
    return { entries, skipped: 0 };
  }

  _parseZip(buffer, entries, seen, parentPath) {
    let zip;
    try {
      zip = new AdmZip(buffer);
    } catch {
      return;
    }

    const zipEntries = zip.getEntries();
    const mdFiles = [];
    const subZips = [];

    for (const entry of zipEntries) {
      if (entry.isDirectory) continue;
      const name = entry.entryName.replace(/\\/g, '/');
      if (name.endsWith('.md')) {
        mdFiles.push({ name, entry });
      } else if (name.endsWith('.zip')) {
        subZips.push({ name, entry });
      }
    }

    for (const { name, entry } of mdFiles) {
      const content = entry.getData().toString('utf8');
      const { meta, body } = parseSimpleFrontMatter(content);
      const title = meta.title || this.extractTitle(body);
      const baseName = name.split('/').pop().replace(/\.md$/i, '');
      const id = `nt_${crypto.createHash('sha256').update(name + parentPath).digest('hex').substring(0, 28)}`;

      if (seen.has(id)) continue;
      seen.add(id);

      const { content: cleanContent, truncated } = this.truncateContent(body);
      const noteMeta = {};
      if (parentPath) noteMeta.notionParentUuid = parentPath;
      if (truncated) noteMeta.truncated = true;

      entries.push({
        id,
        title: title || baseName,
        content: cleanContent,
        category: 'Notion导入',
        tags: meta.tags || [],
        meta_json: { notion: noteMeta }
      });
    }

    for (const { name, entry } of subZips) {
      const relPath = name.replace(/\\/g, '/');
      try {
        this._parseZip(entry.getData(), entries, seen, relPath);
      } catch { /* skip corrupt sub-zip */ }
    }
  }
}

export default NotionImporter;
