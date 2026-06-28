import crypto from 'crypto';
import { query } from '../config/database.js';
import { success, fail, asyncHandler } from '../utils/response.js';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 对已转义的文本做轻量 markdown 行内提升(只处理 * _ ` 换行)
 * 禁止输出原始 HTML 标签
 */
function lightMarkdown(s) {
  return s
    .split('\n').map(line => {
      line = line.trim();
      if (!line) return '<br>';
      if (line.startsWith('# ')) return '<h1>' + line.substring(2) + '</h1>';
      if (line.startsWith('## ')) return '<h2>' + line.substring(3) + '</h2>';
      if (line.startsWith('### ')) return '<h3>' + line.substring(4) + '</h3>';
      if (line.startsWith('> ')) return '<blockquote>' + line.substring(2) + '</blockquote>';
      if (line.startsWith('- ')) return '<li>' + line.substring(2) + '</li>';
      return '<p>' + line + '</p>';
    }).join('\n');
}

export const shareReport = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const report = await query('SELECT * FROM ai_reports WHERE id = ? AND user_id = ?', [id, userId]);
  if (report.rows.length === 0) return fail(res, 'Report not found', 404);

  const reportRow = report.rows[0];
  let shareToken = reportRow.share_token;

  if (!shareToken) {
    shareToken = crypto.randomBytes(24).toString('hex');
    await query('UPDATE ai_reports SET share_token = ? WHERE id = ?', [shareToken, id]);
  }

  success(res, { share_token: shareToken, share_url: `/s/${shareToken}` });
});

export const viewSharedReport = asyncHandler(async (req, res) => {
  const { token } = req.params;

  try {
    const report = await query(
      `SELECT id, scope, year, month, content, created_at, share_expires_at
       FROM ai_reports WHERE share_token = ?`,
      [token]
    );
    if (report.rows.length === 0) {
      return res.status(404).send(`<!DOCTYPE html><html><body style="background:#050c18;color:#6b84a8;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><div style="text-align:center;"><h2>📄 报告未找到</h2><p>该分享链接已失效或不存在</p></div></body></html>`);
    }

    const r = report.rows[0];

    // 过期检查
    if (r.share_expires_at && new Date(r.share_expires_at) < new Date()) {
      return res.status(410).send(`<!DOCTYPE html><html><body style="background:#050c18;color:#6b84a8;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><div style="text-align:center;"><h2>⏰ 分享已过期</h2><p>该分享链接已超过有效期</p></div></body></html>`);
    }

    // 先转义全文
    const safeTitle = escapeHtml(`${r.scope === 'monthly' ? `${r.year}年${r.month}月` : `${r.year}年度`}个人数字人生报告`);
    const safeMeta = escapeHtml(new Date(r.created_at).toLocaleDateString('zh-CN') + ' · 通过分享链接查看');
    const safeContent = escapeHtml(r.content || '');

    // 在已转义的文本上做轻量 markdown 行内提升, 不输出原始标签
    const body = lightMarkdown(safeContent);

    res.send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle} - 分享报告</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#050c18; color:#e6f0ff; font-family:'Inter',sans-serif; padding:60px 24px; line-height:1.9; }
    .container { max-width:780px; margin:0 auto; }
    h1 { font-family:'Outfit',sans-serif; font-size:32px; font-weight:600; margin-bottom:8px; background:linear-gradient(135deg,#e6f0ff,#4ed8ff); -webkit-background-clip:text;-webkit-text-fill-color:transparent; }
    .meta { font-size:13px; color:#6b84a8; margin-bottom:32px; }
    .content { font-size:15px; line-height:1.9; }
    .content h1,.content h2,.content h3 { margin-top:28px; margin-bottom:12px; font-weight:600; color:#fff; }
    .content h1 { font-size:26px; }
    .content h2 { font-size:20px; }
    .content h3 { font-size:17px; }
    .content p { margin-bottom:16px; }
    .content blockquote { padding:16px 20px; border-left:3px solid #4ed8ff; background:rgba(255,255,255,0.02); border-radius:0 8px 8px 0; margin-bottom:16px; color:#8ba4c8; }
    .content pre { padding:16px; background:rgba(0,0,0,0.3); border-radius:12px; overflow-x:auto; margin-bottom:16px; }
    .content code { background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px; font-size:0.9em; }
    .content ul,.content ol { padding-left:24px; margin-bottom:16px; }
    .content li { margin-bottom:6px; }
    .footer { margin-top:48px; padding-top:24px; border-top:1px solid rgba(255,255,255,0.06); text-align:center; font-size:12px; color:#6b84a8; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${safeTitle}</h1>
    <div class="meta">${safeMeta}</div>
    <div class="content">${body}</div>
    <div class="footer">由 心迹星图 生成</div>
  </div>
</body>
</html>`);
  } catch (err) {
    console.error('viewSharedReport error:', err.message);
    res.status(500).send('Internal error');
  }
});
