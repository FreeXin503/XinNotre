import crypto from 'crypto';
import { BaseImporter } from './baseImporter.js';
import { transcribeAudio } from '../aiProviderService.js';

export class VoiceImporter extends BaseImporter {
  static canHandle(filename, mimeType) {
    const ext = filename.split('.').pop().toLowerCase();
    return ['m4a', 'mp3', 'wav'].includes(ext) || mimeType.startsWith('audio/');
  }

  async parse(buffer, opts = {}) {
    const { format, userId } = opts;
    if (!format) {
      throw Object.assign(new Error('请指定音频格式（m4a/mp3/wav）'), { statusCode: 400 });
    }

    const result = await transcribeAudio({ audioBuffer: buffer, format, language: 'zh' });

    if (!result.text) {
      return { entries: [], skipped: 0 };
    }

    const { content: cleanContent, truncated } = this.truncateContent(result.text);
    const id = `voice_${crypto.createHash('sha256').update(result.text.substring(0, 200)).digest('hex').substring(0, 28)}`;

    const sentences = result.sentences.map(s => ({
      text: s.text,
      beginTime: s.beginTime,
      endTime: s.endTime,
      emotion: s.emotion || 'unknown'
    }));

    const metaJson = {
      voice: {
        duration: result.sentences.length > 0
          ? Math.max(...result.sentences.map(s => s.endTime))
          : 0,
        format,
        emotion: result.sentences[0]?.emotion || 'unknown',
        sentences
      }
    };
    if (truncated) metaJson.voice.truncated = true;

    return {
      entries: [{
        id,
        title: cleanContent.substring(0, 30).trim() + (cleanContent.length > 30 ? '…' : ''),
        content: cleanContent,
        category: '语音导入',
        tags: [],
        meta_json: metaJson
      }],
      skipped: 0
    };
  }
}

export default VoiceImporter;
