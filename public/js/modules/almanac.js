import { ApiClient } from '../api.js';

let containerEl = null;

export function mountAlmanac(el) {
  containerEl = el;
  el.innerHTML = `
    <div style="max-width:800px;margin:0 auto;">
      <h2 style="font-size:22px;font-weight:700;margin-bottom:4px;background:linear-gradient(135deg,#4ed8ff,#8366f1);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">D1 · 生命年报卷宗</h2>
      <p style="color:var(--text-muted);font-size:13px;margin-bottom:24px;">将 AI 年度报告装订成精美的 PDF 典藏卷宗，可永久保存分享。</p>

      <div id="alm-list" style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px;">
        <div style="text-align:center;padding:40px;color:var(--text-muted);font-size:14px;">
          暂无已出版的卷宗<br>
          <span style="font-size:12px;">请先在 Dashboard 生成年度报告，然后回到此处出版</span>
        </div>
      </div>

      <div id="alm-reports-section" style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:16px;padding:20px;">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:12px;color:var(--text-main);">📋 可出版的报告</h3>
        <div id="alm-reports-list" style="display:flex;flex-direction:column;gap:8px;">
          <div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">请先生成年度报告</div>
        </div>
      </div>

      <div id="alm-publish-progress" style="display:none;margin-top:16px;padding:16px;background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:12px;font-size:13px;color:var(--text-muted);"></div>
    </div>
  `;

  loadReports();
  loadAlmanacs();
}

async function loadReports() {
  const list = document.getElementById('alm-reports-list');
  if (!list) return;
  try {
      const data = await ApiClient.request('/report/history', {});
    const reports = data.reports || [];
    if (reports.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">尚未生成任何报告，请先在 Dashboard 生成</div>';
      return;
    }
    list.innerHTML = reports.map(r => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--bg-base);border-radius:12px;border:1px solid var(--border-color);">
        <div>
          <div style="font-weight:500;color:var(--text-main);font-size:14px;">${r.scope === 'yearly' ? '📅' : '📆'} ${r.year || ''} ${r.scope === 'yearly' ? '年度' : '月度'}报告</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${r.created_at ? new Date(r.created_at).toLocaleString('zh-CN') : ''}</div>
        </div>
        <button class="alm-publish-btn" data-id="${r.id}" style="background:linear-gradient(135deg,#4ed8ff,#3b82f6);color:#131314;border:none;border-radius:8px;padding:6px 16px;font-weight:600;cursor:pointer;font-size:12px;">出版卷宗</button>
      </div>
    `).join('');

    list.querySelectorAll('.alm-publish-btn').forEach(btn => {
      btn.onclick = () => publishAlmanac(parseInt(btn.dataset.id));
    });
  } catch (e) {
    list.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">加载失败: ${e.message}</div>`;
  }
}

async function publishAlmanac(reportId) {
  const progress = document.getElementById('alm-publish-progress');
  progress.style.display = 'block';
  progress.innerHTML = '⏳ 正在出版卷宗...';

  const model = localStorage.getItem('ALM_MODEL') || 'deepseek-chat';
  const customApiKey = localStorage.getItem('DEEPSEEK_API_KEY') || '';

  ApiClient.subscribeAlmanacPublish({ reportId, model, customApiKey, lengthMode: ApiClient.getLengthMode() }, {
    onStatus: (s) => { progress.innerHTML = s.message || '处理中...'; },
    onChunk: (d) => { if (d.content) progress.innerHTML = marked.parse(d.content); },
    onResult: (r) => {
      progress.innerHTML = `✅ 卷宗《${r.volumeTitle || ''}》出版成功！<br><button onclick="downloadAlmanac(${r.volumeId})" style="margin-top:8px;background:rgba(78,216,255,0.12);border:1px solid rgba(78,216,255,0.25);color:#4ed8ff;border-radius:8px;padding:6px 16px;cursor:pointer;">📄 下载 PDF</button>`;
      loadAlmanacs();
      loadReports();
    },
    onError: (e) => { progress.innerHTML = `❌ ${e.message}`; },
    onDone: () => {}
  });
}

async function loadAlmanacs() {
  const list = document.getElementById('alm-list');
  if (!list) return;
  try {
    const data = await ApiClient.listAlmanacs();
    const volumes = data.volumes || [];
    if (volumes.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:14px;">暂无已出版的卷宗</div>';
      return;
    }
    list.innerHTML = volumes.map(v => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:14px;">
        <div>
          <div style="font-weight:600;color:var(--text-main);font-size:15px;">📖 ${v.title || '未命名卷宗'}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${v.year || ''} · ${new Date(v.createdAt).toLocaleDateString('zh-CN')}</div>
        </div>
        <button onclick="downloadAlmanac(${v.id})" style="background:rgba(78,216,255,0.1);border:1px solid rgba(78,216,255,0.2);color:#4ed8ff;border-radius:8px;padding:6px 16px;cursor:pointer;font-size:12px;">📄 PDF</button>
      </div>
    `).join('');
  } catch (e) {
    list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:14px;">加载失败: ${e.message}</div>`;
  }
}

window.downloadAlmanac = function(id) {
  ApiClient.downloadAlmanacPdf(id);
};
