import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../config/database.js';
import PDFDocument from 'pdfkit';
import { fail, asyncHandler } from '../utils/response.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FONT_PATH = path.join(__dirname, '../fonts/msyh.ttc');

function fontAvailable() {
  return fs.existsSync(FONT_PATH);
}

export const exportReportPdf = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  let headersSent = false;

  try {
    const result = await query('SELECT * FROM ai_reports WHERE id = ? AND user_id = ?', [id, userId]);
    if (result.rows.length === 0) {
      return fail(res, 'Report not found', 404);
    }

    if (result.rows[0].content == null || result.rows[0].content === '') {
      return fail(res, '报告内容为空, 无法导出', 412);
    }

    const report = result.rows[0];
    const content = report.content;
    const reportTitle = `${report.scope === 'monthly' ? `${report.year}年${report.month}月` : `${report.year}年度`}个人数字人生报告`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(reportTitle)}.pdf"`);

    const doc = new PDFDocument({ size: 'A4', margins: { top: 60, bottom: 60, left: 50, right: 50 } });

    // 注册 CJK 字体, 回退 Helvetica
    const hasCjk = fontAvailable();
    if (hasCjk) {
      doc.registerFont('Cn', FONT_PATH);
    } else {
      console.warn('[pdfController] CJK 字体未找到, 中文将渲染为空白');
    }
    const FONT_BODY = hasCjk ? 'Cn' : 'Helvetica';
    const FONT_BOLD = hasCjk ? 'Cn' : 'Helvetica-Bold';

    doc.pipe(res);
    headersSent = true;

    // 客户端断连时结束文档, 释放资源
    req.on('close', () => {
      if (doc._readableState && !doc._readableState.ended) {
        doc.end();
      }
    });

    // Header
    doc.fontSize(22).font(FONT_BOLD).text(reportTitle, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font(FONT_BODY).fillColor('#888').text(`生成时间: ${new Date().toLocaleDateString('zh-CN')}`, { align: 'center' });
    doc.moveDown(1);
    doc.strokeColor('#4ed8ff').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    // Content
    doc.fontSize(12).font(FONT_BODY).fillColor('#333');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) { doc.moveDown(0.3); continue; }
      if (trimmed.startsWith('# ')) {
        doc.fontSize(18).font(FONT_BOLD).fillColor('#111').text(trimmed.substring(2), { continued: false });
        doc.moveDown(0.3);
      } else if (trimmed.startsWith('## ')) {
        doc.fontSize(15).font(FONT_BOLD).fillColor('#333').text(trimmed.substring(3), { continued: false });
        doc.moveDown(0.3);
      } else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        doc.fontSize(12).font(FONT_BOLD).fillColor('#111').text(trimmed.replace(/\*\*/g, ''), { continued: false });
        doc.moveDown(0.3);
      } else if (trimmed.startsWith('- ')) {
        doc.fontSize(11).font(FONT_BODY).fillColor('#444').text(`  \u2022 ${trimmed.substring(2)}`, { indent: 20 });
        doc.moveDown(0.2);
      } else {
        const clean = trimmed.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*/g, '').replace(/__/g, '');
        doc.fontSize(11).font(FONT_BODY).fillColor('#444').text(clean, { align: 'left' });
        doc.moveDown(0.3);
      }

      if (doc.y > 700) {
        doc.addPage();
        doc.fontSize(12);
      }
    }

    // Footer
    doc.moveDown(2);
    doc.strokeColor('#ccc').lineWidth(0.5).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('#aaa').text('由 心迹星图 生成', { align: 'center' });

    doc.end();
  } catch (err) {
    console.error('PDF export error:', err.message);
    if (!headersSent) {
      try { res.status(500).json({ error: 'PDF generation failed' }); } catch {}
    }
  }
});
