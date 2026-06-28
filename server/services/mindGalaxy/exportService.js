/**
 * 心智星系 v2 · 导出服务
 * 职责：JSON/CSV 数据导出、PDF 报告导出
 */
import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
import MindGalaxyRepository from '../../repositories/mindGalaxyRepository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_PATH = path.join(__dirname, '../../fonts/msyh.ttc');

const repo = new MindGalaxyRepository();

function escapeCsvField(val) {
  if (val == null) return '';
  const s = String(val).replace(/"/g, '""');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
}

function flattenFloats(arr, n) {
  const a = arr || [];
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(typeof a[i] === 'number' ? a[i].toFixed(4) : '');
  }
  return out;
}

function registerFont(doc) {
  let hasFont = false;
  try {
    doc.registerFont('Cn', FONT_PATH);
    hasFont = true;
  } catch (e) {
    console.warn('[mindGalaxyExport] 中文字体注册失败:', e.message);
  }
  return hasFont;
}

function font(doc, hasFont, size, style = 'normal') {
  if (hasFont) {
    doc.font('Cn');
  } else {
    doc.font(style === 'bold' ? 'Helvetica-Bold' : 'Helvetica');
  }
  doc.fontSize(size);
}

/**
 * 导出快照数据为 JSON 或 CSV
 * @returns {{ data: string, contentType: string, filename: string }}
 */
export async function exportData(userId, format) {
  if (!['json', 'csv'].includes(format)) {
    throw new Error(`不支持的导出格式: ${format}`);
  }

  const snap = await repo.getLatestSnapshot(userId);
  if (!snap) throw new Error('暂无星系快照');

  const snapshotJson = snap.snapshot_json;
  const bodies = snapshotJson?.bodies || [];

  if (format === 'json') {
    const data = JSON.stringify({ snapshot: snapshotJson, exportedAt: new Date().toISOString() }, null, 2);
    return {
      data,
      contentType: 'application/json',
      filename: `mind-galaxy-${Date.now()}.json`
    };
  }

  // CSV: flatten bodies
  const header = 'id,type,name,pos_x,pos_y,pos_z,radius,color,nodeId\n';
  const rows = bodies.map(b => {
    const v = b.visual || {};
    return [
      escapeCsvField(b.id),
      escapeCsvField(b.type),
      escapeCsvField(b.name),
      ...flattenFloats(b.position, 3),
      typeof v.radius === 'number' ? v.radius.toFixed(4) : '',
      escapeCsvField(v.colorHex || ''),
      escapeCsvField(b.nodeId || '')
    ].join(',');
  }).join('\n');

  const data = header + rows;
  return {
    data,
    contentType: 'text/csv; charset=utf-8',
    filename: `mind-galaxy-${Date.now()}.csv`
  };
}

/**
 * 导出报告为 PDF
 * @param {number} userId
 * @param {string} reportId - observation_report 的 id 或 snapshotId
 * @param {WritableStream} writable - HTTP response
 */
export async function exportReportPDF(userId, reportId, writable) {
  const reportRow = await repo.getReportBySnapshotId(userId, reportId);
  if (!reportRow) throw new Error('暂未生成报告');

  const report = reportRow.report_json;
  const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 45, right: 45 } });
  const hasFont = registerFont(doc);

  doc.pipe(writable);

  const pageW = doc.page.width - 90;

  // Cover
  const f = (size, style) => font(doc, hasFont, size, style);

  // Title block
  f(26, 'bold');
  doc.fillColor(hasFont ? '#e6f0ff' : '#333');
  doc.text('心智星系解读报告', 45, 50, { align: 'center', width: pageW });

  f(12);
  doc.fillColor(hasFont ? '#6b84a8' : '#888');
  const galaxyTypeStr = (report.typology?.type || report.overview?.hubbleType || '');
  doc.text(report.overview?.hubbleType ? `星系类型：${report.overview.hubbleType}` : '', 45, doc.y + 10, { align: 'center', width: pageW });
  doc.text(`生成于 ${new Date(report.generatedAt || Date.now()).toLocaleDateString('zh-CN')}`, 45, doc.y + 5, { align: 'center', width: pageW });

  doc.addPage();

  // Helper: check page overflow
  function ensureSpace(needed) {
    if (doc.y + needed > 730) doc.addPage();
  }

  // 1. 概览
  ensureSpace(120);
  f(16, 'bold');
  doc.fillColor(hasFont ? '#e6f0ff' : '#333');
  doc.text('一、星系概览');
  doc.moveDown(0.5);

  f(11);
  doc.fillColor(hasFont ? '#c8d8e8' : '#444');
  const overview = report.overview || {};
  const ovLines = [
    `概述：${overview.oneLineSummary || '暂无'}`,
    `哈勃类型：${overview.hubbleType || '—'}`,
    `节点总数：${overview.analyzedNodeCount || 0}`,
    `银心强度：${overview.coreMass ?? '—'}  |  稳定性：${overview.selfStability ?? '—'}  |  整合度：${overview.selfIntegration ?? '—'}`,
    `旋臂数：${overview.spiralArms ?? '—'}  |  缠绕度：${overview.windingTightness ?? '—'}  |  平坦度：${overview.flatness ?? '—'}`,
    `信度：${overview.confidence || '—'}`
  ];
  for (const line of ovLines) {
    doc.text(line, 60);
    doc.moveDown(0.15);
  }

  // 2. 核心信念
  doc.addPage();
  f(16, 'bold');
  doc.fillColor(hasFont ? '#e6f0ff' : '#333');
  doc.text('二、核心信念');
  doc.moveDown(0.5);

  const beliefs = report.coreBeliefs || [];
  if (beliefs.length > 0) {
    f(11);
    doc.fillColor(hasFont ? '#c8d8e8' : '#444');
    for (let i = 0; i < beliefs.length; i++) {
      ensureSpace(30);
      const b = beliefs[i];
      const polarityMark = b.polarity === 'pos' ? '⊕' : b.polarity === 'neg' ? '⊖' : '○';
      doc.text(`${i + 1}. ${polarityMark} ${b.label}（${b.level || ''}，强度 ${Math.round((b.strength || 0) * 100)}%，信度 ${b.confidence || ''}）`, 60);
      doc.moveDown(0.15);
    }
  } else {
    f(11);
    doc.fillColor(hasFont ? '#8ba4c8' : '#666');
    doc.text('未检测到明确的信念节点', 60);
  }

  // ── C23: 信念结构树图 ──
  const beliefs = (report.coreBeliefs || []);
  if (beliefs.length > 0) {
    ensureSpace(beliefs.length * 25 + 30);
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.fillColor(hasFont ? '#8899bb' : '#555');
    doc.text('▌ 信念结构树', 45);
    doc.moveDown(0.3);

    const startX = 80, startY = doc.y;
    beliefs.forEach((b, i) => {
      const y = startY + i * 24;
      const strength = Math.max(0.1, Math.min(1, b.strength || 0.5));
      const barWidth = 120 * strength;
      const polarityColor = b.polarity === 'pos' ? '#4fc3f7' : b.polarity === 'neg' ? '#ef5350' : '#888';

      doc.fontSize(8);
      doc.fillColor(hasFont ? '#c8d8e8' : '#444');
      doc.text(`${b.label || `信念 ${i + 1}`}`, startX, y + 2, { width: 140 });

      doc.rect(startX + 150, y + 4, barWidth, 10)
        .fillAndStroke(polarityColor, polarityColor);

      doc.fontSize(7);
      doc.fillColor(hasFont ? '#889' : '#555');
      doc.text(`${Math.round(strength * 100)}%`, startX + 150 + barWidth + 6, y + 4);
    });
    doc.moveDown(1);
  }

  // 3. 情绪光谱
  ensureSpace(80);
  f(16, 'bold');
  doc.fillColor(hasFont ? '#e6f0ff' : '#333');
  doc.text('三、情绪光谱', 45);
  doc.moveDown(0.5);

  const emotion = report.emotionSpectrum || {};
  f(11);
  doc.fillColor(hasFont ? '#c8d8e8' : '#444');
  doc.text(`主导情绪：${emotion.dominant || '—'}`, 60);
  doc.moveDown(0.15);
  doc.text(`情绪周期：${emotion.cycle || '—'}`, 60);
  doc.moveDown(0.3);

  const dist = emotion.distribution || [];
  if (dist.length > 0) {
    doc.text('情绪分布：', 60);
    for (const d of dist.slice(0, 10)) {
      doc.text(`  · ${d.emotion}: ${Math.round((d.ratio || 0) * 100)}%`, 75);
      doc.moveDown(0.05);
    }
  }

  if ((emotion.triggers || []).length > 0) {
    doc.moveDown(0.3);
    doc.text('情绪触发因子：', 60);
    for (const t of (emotion.triggers || []).slice(0, 5)) {
      doc.text(`  · ${t.stimulus}（信度 ${Math.round((t.confidence || 0) * 100)}%）`, 75);
      doc.moveDown(0.05);
    }
  }

  // ── C23: 情绪分布条形图 ──
  if (dist.length > 0) {
    ensureSpace(dist.length * 20 + 30);
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.fillColor(hasFont ? '#8899bb' : '#555');
    doc.text('▌ 情绪分布图', 45);
    doc.moveDown(0.3);

    const colors = ['#FFD700', '#4169E1', '#98FB98', '#FFA07A', '#FF6347', '#9370DB', '#00CED1', '#FF69B4', '#DC143C', '#999999'];
    const startX = 80, sY = doc.y;
    const maxRatio = Math.max(...dist.map(d => d.ratio || 0), 0.01);
    dist.slice(0, 10).forEach((d, i) => {
      const y = sY + i * 18;
      const ratio = d.ratio || 0;
      const barW = Math.max(5, (ratio / maxRatio) * 200);
      const color = colors[i % colors.length];

      doc.fontSize(8);
      doc.fillColor(hasFont ? '#c8d8e8' : '#444');
      doc.text(d.emotion || '-', startX, y + 1, { width: 120 });

      doc.rect(startX + 130, y + 3, barW, 10).fillAndStroke(color, color);
      doc.fontSize(7);
      doc.fillColor(hasFont ? '#889' : '#555');
      doc.text(`${Math.round(ratio * 100)}%`, startX + 130 + barW + 6, y + 3);
    });
    doc.moveDown(1);
  }

  // 4. 关系星系
  ensureSpace(80);
  f(16, 'bold');
  doc.fillColor(hasFont ? '#e6f0ff' : '#333');
  doc.text('四、关系星系', 45);
  doc.moveDown(0.5);

  const relations = report.relationshipGalaxy || {};
  f(11);
  doc.fillColor(hasFont ? '#c8d8e8' : '#444');

  const persons = relations.topPersons || [];
  if (persons.length > 0) {
    for (let i = 0; i < persons.length; i++) {
      ensureSpace(20);
      const p = persons[i];
      const polarityMark = p.polarity > 0 ? '⊕' : '⊖';
      doc.text(`${i + 1}. ${polarityMark} ${p.name}  亲密度 ${Math.round((p.intimacy || 0) * 100)}%  影响力 ${Math.round((p.influence || 0) * 100)}%`, 60);
      doc.moveDown(0.1);
    }
  } else {
    doc.text('未检测到核心关系人物', 60);
  }

  // ── C23: 关系网络图 ──
  if (persons.length > 1) {
    ensureSpace(persons.length * 30 + 50);
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.fillColor(hasFont ? '#8899bb' : '#555');
    doc.text('▌ 关系网络', 45);
    doc.moveDown(0.3);

    const cx = 260, cy = doc.y + 60, outerR = 55;
    doc.circle(cx, cy, outerR).stroke(hasFont ? '#334' : '#999');
    doc.circle(cx, cy, 15).fillAndStroke(hasFont ? '#2a3a5a' : '#ccc', hasFont ? '#4fc3f7' : '#999');

    const totalIntimacy = persons.reduce((s, p) => s + (p.intimacy || 0), 0) || 1;
    persons.slice(0, 8).forEach((p, i) => {
      const angle = (i / Math.min(persons.length, 8)) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(angle) * outerR;
      const y = cy + Math.sin(angle) * outerR;
      const dotR = 3 + (p.intimacy || 0) * 6;
      const dotColor = p.polarity > 0 ? '#4fc3f7' : p.polarity < 0 ? '#ef5350' : '#888';

      doc.circle(x, y, dotR).fillAndStroke(dotColor, dotColor);

      doc.lineWidth(0.5);
      doc.moveTo(cx, cy).lineTo(x, y)
        .stroke(hasFont ? '#334' : '#999');

      doc.fontSize(7);
      doc.fillColor(hasFont ? '#ccc' : '#444');
      doc.text(p.name || '-', x - 20, y + dotR + 2, { width: 40, align: 'center' });
    });
    doc.moveDown(6);
  }

  const patterns = relations.patterns || [];
  if (patterns.length > 0) {
    doc.moveDown(0.5);
    doc.text('关系模式：', 60);
    for (const p of patterns) {
      doc.text(`  · ${p}`, 75);
    }
  }

  // 5. 演化时间线
  doc.addPage();
  f(16, 'bold');
  doc.fillColor(hasFont ? '#e6f0ff' : '#333');
  doc.text('五、演化时间线');
  doc.moveDown(0.5);

  const evolution = report.evolutionTimeline || {};
  const entries = evolution.nodes || [];
  if (entries.length > 0) {
    f(11);
    doc.fillColor(hasFont ? '#c8d8e8' : '#444');
    for (const e of entries.slice(0, 15)) {
      ensureSpace(20);
      const mark = e.type === 'growth' ? '⬆' : '⬇';
      doc.text(`${mark} ${e.date || '—'}  ${e.description || ''}`, 60);
      doc.moveDown(0.1);
    }
  } else {
    f(11);
    doc.fillColor(hasFont ? '#8ba4c8' : '#666');
    doc.text('未检测到明确的演化事件', 60);
  }
  doc.moveDown(0.5);
  f(11);
  doc.fillColor(hasFont ? '#c8d8e8' : '#444');
  doc.text(`趋势判断：${evolution.trend || '—'}`, 60);

  // 6. 阴影盲点
  ensureSpace(80);
  f(16, 'bold');
  doc.fillColor(hasFont ? '#e6f0ff' : '#333');
  doc.text('六、阴影盲点', 45);
  doc.moveDown(0.5);

  const shadows = report.shadows || {};
  f(11);
  doc.fillColor(hasFont ? '#c8d8e8' : '#444');

  if ((shadows.repressedThemes || []).length > 0) {
    doc.text('被压抑的主题：', 60);
    for (const t of shadows.repressedThemes) {
      doc.text(`  · ${t}`, 75);
      doc.moveDown(0.05);
    }
  } else {
    doc.text('未检测到被压抑的主题', 60);
  }

  doc.moveDown(0.5);
  if ((shadows.cognitiveBiases || []).length > 0) {
    doc.text('可能的认知偏差：', 60);
    for (const b of shadows.cognitiveBiases) {
      doc.text(`  · ${b}`, 75);
      doc.moveDown(0.05);
    }
  } else {
    doc.text('未检测到显著认知偏差', 60);
  }

  doc.moveDown(0.5);
  if ((shadows.unintegrated || []).length > 0) {
    doc.text('有待整合的面向：', 60);
    for (const u of shadows.unintegrated) {
      doc.text(`  · ${u}`, 75);
      doc.moveDown(0.05);
    }
  }

  // 7. 类型学解读
  ensureSpace(80);
  f(16, 'bold');
  doc.fillColor(hasFont ? '#e6f0ff' : '#333');
  doc.text('七、类型学解读', 45);
  doc.moveDown(0.5);

  const typology = report.typology || {};
  f(11);
  doc.fillColor(hasFont ? '#c8d8e8' : '#444');
  doc.text(`星系类型：${typology.type || '—'}`, 60);
  doc.moveDown(0.3);
  doc.text(`特征：${(typology.traits || []).join('、') || '—'}`, 60);
  doc.moveDown(0.3);
  doc.text(`优势：${(typology.strengths || []).join('、') || '—'}`, 60);
  doc.moveDown(0.3);
  doc.text(`盲点：${(typology.blindSpots || []).join('、') || '—'}`, 60);

  // 8. 总结
  ensureSpace(100);
  f(16, 'bold');
  doc.fillColor(hasFont ? '#e6f0ff' : '#333');
  doc.text('八、总结', 45);
  doc.moveDown(0.5);

  const summary = report.summary || {};
  f(11);
  doc.fillColor(hasFont ? '#c8d8e8' : '#444');
  for (const line of (summary.summaryLines || [])) {
    doc.text(`· ${line}`, 60);
    doc.moveDown(0.1);
  }

  if ((summary.suggestions || []).length > 0) {
    doc.moveDown(0.5);
    f(12, 'bold');
    doc.fillColor(hasFont ? '#e6f0ff' : '#333');
    doc.text('成长建议：', 60);
    doc.moveDown(0.3);
    f(11);
    doc.fillColor(hasFont ? '#c8d8e8' : '#444');
    for (const s of summary.suggestions) {
      doc.text(`> ${s}`, 75);
      doc.moveDown(0.15);
    }
  }

  // Footer on each page
  let pageNum = 1;
  doc.on('pageAdded', () => {
    pageNum++;
    f(8);
    doc.fillColor(hasFont ? '#6b84a8' : '#aaa');
    doc.text(`— ${pageNum} —`, 45, doc.page.height - 40, { align: 'center', width: pageW });
  });

  doc.end();
}

export default { exportData, exportReportPDF };
