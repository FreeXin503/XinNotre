import crypto from 'crypto';
import { BaseImporter } from './baseImporter.js';

function extractTag(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseEnexDate(str) {
  if (!str) return new Date().toISOString();
  const m = str.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (m) {
    return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
  }
  try {
    return new Date(str).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export class EvernoteImporter extends BaseImporter {
  static canHandle(filename, mimeType) {
    return filename.endsWith('.enex') || mimeType === 'application/xml' || mimeType === 'text/xml';
  }

  async parse(buffer, opts = {}) {
    const text = buffer.toString('utf8');
    const entries = [];
    let skipped = 0;

    const noteRegex = /<note>([\s\S]*?)<\/note>/gi;
    let match;

    while ((match = noteRegex.exec(text)) !== null) {
      const block = match[1];

      try {
        const titleM = block.match(/<title>([\s\S]*?)<\/title>/i);
        const title = titleM ? extractTag(titleM[1]) : '无标题';

        const contentM = block.match(/<content>[\s\S]*?<!\[CDATA\[([\s\S]*?)\]\]>[\s\S]*?<\/content>/i);
        let body = contentM ? extractTag(contentM[1]) : '';

        const createdM = block.match(/<created>([\s\S]*?)<\/created>/i);
        const createdAt = createdM ? parseEnexDate(createdM[1].trim()) : new Date().toISOString();

        const tags = [];
        const tagRegex = /<tag>([\s\S]*?)<\/tag>/gi;
        let tagMatch;
        while ((tagMatch = tagRegex.exec(block)) !== null) {
          const t = extractTag(tagMatch[1]);
          if (t) tags.push(t);
        }

        const resourceCount = (block.match(/<resource>[\s\S]*?<\/resource>/gi) || []).length;
        if (resourceCount > 0) {
          body += '\n\n[图片未迁移]'.repeat(resourceCount);
        }

        const { content: cleanContent, truncated } = this.truncateContent(body);

        const id = `en_${crypto.createHash('sha256').update(title + createdAt + block.substring(0, 200)).digest('hex').substring(0, 28)}`;

        const noteMeta = { evernote: { createdAt, resourceCount } };
        if (truncated) noteMeta.evernote.truncated = true;

        entries.push({
          id,
          title: title.substring(0, 500),
          content: cleanContent,
          category: '印象笔记导入',
          tags,
          meta_json: noteMeta
        });
      } catch {
        skipped++;
      }
    }

    if (entries.length === 0 && !/<note>/i.test(text)) {
      throw Object.assign(new Error('invalid evernote format'), { statusCode: 400 });
    }

    return { entries, skipped };
  }
}

export default EvernoteImporter;
