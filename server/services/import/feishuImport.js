import AdmZip from 'adm-zip';
import crypto from 'crypto';
import { BaseImporter } from './baseImporter.js';

function extractDocxText(xmlText) {
  const paragraphs = [];
  const paraRegex = /<w:p[ >][\s\S]*?<\/w:p>/gi;
  let pMatch;

  while ((pMatch = paraRegex.exec(xmlText)) !== null) {
    const pBlock = pMatch[0];
    const texts = [];
    const tRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/gi;
    let tMatch;
    while ((tMatch = tRegex.exec(pBlock)) !== null) {
      texts.push(tMatch[1]);
    }
    if (texts.length > 0 || /<w:tc[ >]/i.test(pBlock)) {
      paragraphs.push(texts.join(''));
    }
  }

  return paragraphs.join('\n');
}

export class FeishuImporter extends BaseImporter {
  static canHandle(filename, mimeType) {
    return filename.endsWith('.docx') || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  async parse(buffer, opts = {}) {
    let zip;
    try {
      zip = new AdmZip(buffer);
    } catch {
      throw Object.assign(new Error('encrypted docx not supported'), { statusCode: 400 });
    }

    const docXmlEntry = zip.getEntry('word/document.xml');
    if (!docXmlEntry) {
      throw Object.assign(new Error('encrypted docx not supported'), { statusCode: 400 });
    }

    const xmlText = docXmlEntry.getData().toString('utf8');

    if (/EncryptedPackage/i.test(xmlText) || /EncryptionInfo/i.test(xmlText)) {
      throw Object.assign(new Error('encrypted docx not supported'), { statusCode: 400 });
    }

    const fullText = extractDocxText(xmlText);

    const docPropsEntry = zip.getEntry('docProps/app.xml');
    let title = '';
    if (docPropsEntry) {
      const appXml = docPropsEntry.getData().toString('utf8');
      const tMatch = appXml.match(/<Title>([\s\S]*?)<\/Title>/i);
      if (tMatch) title = tMatch[1].trim();
    }

    if (!title) {
      const coreEntry = zip.getEntry('docProps/core.xml');
      if (coreEntry) {
        const coreXml = coreEntry.getData().toString('utf8');
        const tMatch = coreXml.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i);
        if (tMatch) title = tMatch[1].trim();
      }
    }

    title = title || this.extractTitle(fullText);

    const { content: cleanContent, truncated } = this.truncateContent(fullText);

    const id = `fs_${crypto.createHash('sha256').update(fullText.substring(0, 500)).digest('hex').substring(0, 28)}`;
    const noteMeta = { feishu: {} };
    if (truncated) noteMeta.feishu.truncated = true;

    return {
      entries: [{
        id,
        title,
        content: cleanContent,
        category: '飞书导入',
        tags: [],
        meta_json: noteMeta
      }],
      skipped: 0
    };
  }
}

export default FeishuImporter;
