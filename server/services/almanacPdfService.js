import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_PATH = path.join(__dirname, '../fonts/msyh.ttc');

export function bindAlmanacPdf(volume, reportContent, writable) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 60, bottom: 60, left: 50, right: 50 } });

  let hasFont = false;
  try {
    doc.registerFont('Cn', FONT_PATH);
    hasFont = true;
  } catch (e) {
    console.warn('[almanacPdf] 中文字体注册失败，降级使用 Helvetica:', e.message);
  }

  doc.pipe(writable);

  const font = (size, style = 'normal') => {
    if (hasFont) {
      doc.font(`Cn`);
    } else {
      doc.font(style === 'bold' ? 'Helvetica-Bold' : 'Helvetica');
    }
    doc.fontSize(size);
  };

  // 1. Cover page
  const pageW = doc.page.width - 100;
  doc.rect(0, 0, doc.page.width, 200).fill(hasFont ? '#0a1628' : '#eee');
  font(28, 'bold').fillColor(hasFont ? '#4ed8ff' : '#333').text(volume.volume_title || '年度报告', 50, 80, { align: 'center', width: pageW });
  font(12).fillColor(hasFont ? '#6b84a8' : '#888').text('私人典藏 · 数字人生', 50, 130, { align: 'center', width: pageW });
  font(10).fillColor(hasFont ? '#6b84a8' : '#aaa').text(`由 心迹星图 装订 · ${new Date().toLocaleDateString('zh-CN')}`, 50, 160, { align: 'center', width: pageW });
  doc.addPage();

  // 2. Table of contents (extract ## headings from report content)
  const headings = [];
  for (const line of (reportContent || '').split('\n')) {
    const m = line.match(/^##\s+(.+)/);
    if (m) headings.push(m[1]);
  }
  if (headings.length > 0) {
    font(18, 'bold').fillColor(hasFont ? '#e6f0ff' : '#333').text('目录', 50, 60);
    doc.moveDown(1);
    font(11).fillColor(hasFont ? '#6b84a8' : '#666');
    headings.forEach((h, i) => {
      doc.text(`${i + 1}. ${h}`, { indent: 20 });
      doc.moveDown(0.3);
    });
    doc.addPage();
  }

  // 3. Top Quotes
  const quotes = volume.top_quotes;
  if (quotes && Array.isArray(quotes) && quotes.length > 0) {
    font(16, 'bold').fillColor(hasFont ? '#e6f0ff' : '#333').text('年度十大金句', 50, 60);
    doc.moveDown(0.5);
    font(10).fillColor(hasFont ? '#6b84a8' : '#888');
    quotes.slice(0, 10).forEach((q, i) => {
      const text = q.quote || '';
      if (text.length > 120) text.substring(0, 120) + '...';
      doc.text(`"${text}"`, { indent: 20, paragraphGap: 4 });
      if (q.date) doc.text(`— ${q.date}`, { indent: 40, paragraphGap: 8 });
      doc.moveDown(0.3);
      if (doc.y > 700) doc.addPage();
    });
    doc.addPage();
  }

  // 4. Top Persons & Milestones
  const persons = volume.top_persons;
  if (persons && Array.isArray(persons) && persons.length > 0) {
    font(16, 'bold').fillColor(hasFont ? '#e6f0ff' : '#333').text('年度人物', 50, 60);
    doc.moveDown(0.5);
    font(11).fillColor(hasFont ? '#6b84a8' : '#666');
    persons.slice(0, 8).forEach((p, i) => {
      doc.text(`${i + 1}. ${p.name || ''} (${p.mentions || 0} 次提及)`);
      doc.moveDown(0.2);
    });
    doc.moveDown(0.5);
  }

  const milestones = volume.milestones;
  if (milestones && Array.isArray(milestones) && milestones.length > 0) {
    font(16, 'bold').fillColor(hasFont ? '#e6f0ff' : '#333').text('年度里程碑', 50, doc.y + 10);
    doc.moveDown(0.5);
    font(11).fillColor(hasFont ? '#6b84a8' : '#666');
    milestones.slice(0, 10).forEach((m, i) => {
      doc.text(`${i + 1}. ${m.title || ''} — ${m.date || ''}`);
      doc.moveDown(0.2);
      if (doc.y > 700) doc.addPage();
    });
    doc.addPage();
  }

  // 5. Main body (report content)
  renderMarkdownToPdf(doc, reportContent, hasFont);

  // 6. Footer on each page
  let pageNum = 1;
  doc.on('pageAdded', () => {
    pageNum++;
    font(8).fillColor(hasFont ? '#6b84a8' : '#aaa');
    doc.text(`— ${pageNum} —`, 50, doc.page.height - 40, { align: 'center', width: pageW });
    if (volume.volume_title) {
      doc.text(volume.volume_title, 50, doc.page.height - 40, { width: pageW });
    }
  });

  doc.end();
}

function renderMarkdownToPdf(doc, content, hasFont) {
  if (!content) return;
  const lines = content.split('\n');
  let inCodeBlock = false;

  const font = (size, style = 'normal') => {
    doc.fontSize(size);
    if (hasFont) {
      doc.font('Cn');
    } else {
      doc.font(style === 'bold' ? 'Helvetica-Bold' : 'Helvetica');
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { doc.moveDown(0.3); continue; }

    if (trimmed.startsWith('```')) { inCodeBlock = !inCodeBlock; continue; }
    if (inCodeBlock) { font(9); doc.fillColor(hasFont ? '#8ba4c8' : '#555').text(trimmed, { indent: 20 }); doc.moveDown(0.1); continue; }

    const clean = trimmed.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*/g, '').replace(/__/g, '');

    if (trimmed.startsWith('# ')) {
      font(18, 'bold'); doc.fillColor(hasFont ? '#e6f0ff' : '#222'); doc.text(clean.substring(2)); doc.moveDown(0.3);
    } else if (trimmed.startsWith('## ')) {
      font(14, 'bold'); doc.fillColor(hasFont ? '#e6f0ff' : '#333'); doc.text(clean.substring(3)); doc.moveDown(0.3);
    } else if (trimmed.startsWith('### ')) {
      font(12, 'bold'); doc.fillColor(hasFont ? '#e6f0ff' : '#444'); doc.text(clean.substring(4)); doc.moveDown(0.2);
    } else if (trimmed.startsWith('- ')) {
      font(10); doc.fillColor(hasFont ? '#8ba4c8' : '#555'); doc.text(`  • ${clean.substring(2)}`, { indent: 20 }); doc.moveDown(0.15);
    } else if (trimmed.startsWith('> ')) {
      font(10); doc.fillColor(hasFont ? '#6b84a8' : '#777'); doc.text(clean.substring(2), { indent: 20 }); doc.moveDown(0.2);
    } else {
      font(10); doc.fillColor(hasFont ? '#c8d8e8' : '#444'); doc.text(clean, { align: 'left' }); doc.moveDown(0.2);
    }

    if (doc.y > 740) doc.addPage();
  }
}
