import crypto from 'crypto';
import { BaseImporter } from './baseImporter.js';

const TIMESTAMP_RE = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+(.+)$/;
const SYSTEM_MSG_RE = /^[-—]{2,}.*[-—]{2,}$/;

export class ChatlogImporter extends BaseImporter {
  static canHandle(filename, mimeType) {
    return filename.endsWith('.txt') || mimeType === 'text/plain';
  }

  async parse(buffer, opts = {}) {
    const text = buffer.toString('utf8');
    const lines = text.split(/\r?\n/);
    const messages = [];
    let currentSpeaker = null;
    let currentTs = null;
    let currentLines = [];

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      const tsMatch = line.match(TIMESTAMP_RE);

      if (tsMatch) {
        if (currentTs && currentLines.length > 0) {
          messages.push({ timestamp: currentTs, speaker: currentSpeaker, content: currentLines.join('\n') });
        }
        currentTs = tsMatch[1];
        currentSpeaker = tsMatch[2].trim();
        currentLines = [];
      } else if (currentTs && line) {
        if (!SYSTEM_MSG_RE.test(line)) {
          currentLines.push(line);
        }
      }
    }

    if (currentTs && currentLines.length > 0) {
      messages.push({ timestamp: currentTs, speaker: currentSpeaker, content: currentLines.join('\n') });
    }

    if (messages.length === 0) {
      return { entries: [], skipped: 0 };
    }

    const sessions = this._aggregateSessions(messages);
    const entries = this._sessionsToEntries(sessions);

    // dedup by content hash (messages may be identical across files)
    const seen = new Set();
    const deduped = [];
    for (const entry of entries) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      deduped.push(entry);
    }

    return { entries: deduped, skipped: messages.length - deduped.length };
  }

  _aggregateSessions(messages) {
    const sessions = [];
    let current = null;

    for (const msg of messages) {
      const msgDate = new Date(msg.timestamp.replace(' ', 'T') + '+08:00');

      if (!current) {
        current = { startTime: msg.timestamp, endTime: msg.timestamp, lines: [msg], participants: new Set([msg.speaker]) };
        continue;
      }

      const lastDate = new Date(current.endTime.replace(' ', 'T') + '+08:00');
      const gapMin = (msgDate - lastDate) / 60000;

      if (gapMin < 30) {
        current.endTime = msg.timestamp;
        current.lines.push(msg);
        current.participants.add(msg.speaker);
      } else {
        sessions.push(current);
        current = { startTime: msg.timestamp, endTime: msg.timestamp, lines: [msg], participants: new Set([msg.speaker]) };
      }
    }

    if (current) sessions.push(current);
    return sessions;
  }

  _sessionsToEntries(sessions) {
    const entries = [];

    for (const session of sessions) {
      const contentLines = session.lines.map(m => `${m.speaker}：${m.content}`);
      const fullContent = contentLines.join('\n');

      let title;
      const firstMsg = session.lines[0];
      if (firstMsg) {
        title = firstMsg.content.substring(0, 30);
      } else {
        title = `聊天记录 ${session.startTime}`;
      }
      if (!title) title = `聊天记录 ${session.startTime}`;

      const { content: cleanContent, truncated } = this.truncateContent(fullContent);

      const id = `wg_${crypto.createHash('sha256').update(session.startTime + session.endTime + [...session.participants].join(',')).digest('hex').substring(0, 28)}`;

      const metaJson = {
        wechat: {
          startTime: session.startTime,
          endTime: session.endTime,
          participants: [...session.participants],
          messageCount: session.lines.length
        }
      };
      if (truncated) metaJson.wechat.truncated = true;

      entries.push({
        id,
        title,
        content: cleanContent,
        category: '微信导入',
        tags: [...session.participants],
        meta_json: metaJson
      });
    }

    return entries;
  }
}

export default ChatlogImporter;
