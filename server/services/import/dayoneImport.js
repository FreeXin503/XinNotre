import crypto from 'crypto';

function shortHash(text, ts) {
  return crypto.createHash('sha256').update(`${text}|${ts}`, 'utf8').digest('hex').substring(0, 32);
}

function extractTitle(content) {
  const firstLine = content.split('\n')[0].trim();
  if (firstLine.length > 0 && firstLine.length <= 60) return firstLine;
  if (content.length <= 30) return content;
  return content.substring(0, 30).trim() + '…';
}

export async function parseDayOneJson(fileBuffer) {
  let raw;
  try {
    raw = JSON.parse(fileBuffer.toString('utf8'));
  } catch {
    throw Object.assign(new Error('invalid dayone format'), { statusCode: 400 });
  }

  if (raw === null || typeof raw !== 'object') {
    throw Object.assign(new Error('invalid dayone format'), { statusCode: 400 });
  }

  let entries = raw.entries || raw;
  if (!Array.isArray(entries)) {
    throw Object.assign(new Error('invalid dayone format'), { statusCode: 400 });
  }

  const result = [];
  let skipped = 0;

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') {
      skipped++;
      continue;
    }

    let uuid = entry.uuid;
    if (!uuid || typeof uuid !== 'string') {
      const content = String(entry.text || entry.body || '');
      const ts = entry.creationDate || entry.modifiedDate || new Date().toISOString();
      uuid = shortHash(content, ts);
      console.warn(`[dayoneImport] missing uuid, generated from content hash: ${uuid}`);
    }

    const content = String(entry.text || entry.body || '');

    let title;
    if (typeof entry.title === 'string' && entry.title.trim().length > 0) {
      title = entry.title.trim().substring(0, 500);
    } else {
      title = extractTitle(content);
    }

    const sampledAt = entry.creationDate || entry.modifiedDate || entry.date || new Date().toISOString();

    const meta = {};

    if (Array.isArray(entry.tags) && entry.tags.length > 0) {
      meta.tags = entry.tags.filter(t => typeof t === 'string');
    }

    if (entry.location && typeof entry.location === 'object') {
      const loc = {
        lat: entry.location.latitude || entry.location.lat || null,
        lng: entry.location.longitude || entry.location.lng || entry.location.lon || null,
        placeName: entry.location.placeName || entry.location.place_name || ''
      };
      if (loc.lat !== null || loc.lng !== null || loc.placeName) {
        meta.location = loc;
      }
    }

    if (entry.weather && typeof entry.weather === 'object') {
      meta.weather = {
        tempC: entry.weather.temperatureCelsius ?? entry.weather.temperature_Celsius ?? entry.weather.tempC ?? null,
        conditions: entry.weather.conditions || '',
        iconName: entry.weather.iconName || ''
      };
    }

    if (Array.isArray(entry.photos) && entry.photos.length > 0) {
      meta.photos = entry.photos
        .map(p => (typeof p === 'string' ? p : p.identifier || p.md5 || ''))
        .filter(Boolean);
    }

    result.push({
      uuid,
      sampledAt,
      content: content.substring(0, 100000),
      title,
      meta
    });
  }

  skipped = result.length > 0 ? entries.length - result.length : entries.length;

  return { entries: result, skipped };
}
