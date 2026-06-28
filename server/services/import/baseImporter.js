export class BaseImporter {
  static canHandle(filename, mimeType) {
    return false;
  }

  async parse(buffer, opts) {
    return { entries: [], skipped: 0 };
  }

  extractTitle(content) {
    const firstLine = content.split('\n')[0].trim();
    if (firstLine.length > 0 && firstLine.length <= 60) return firstLine;
    if (content.length <= 30) return content;
    return content.substring(0, 30).trim() + '…';
  }

  truncateContent(content, max = 50000) {
    if (content.length <= max) return { content, truncated: false };
    return { content: content.substring(0, max), truncated: true };
  }
}
