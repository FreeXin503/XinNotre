import { ApiClient } from '../api.js';

let abortCtrl = null;

export function mountGrowthTree(el) {
  el.innerHTML = `
    <div style="max-width:800px;margin:0 auto;">
      <h2 style="font-size:22px;font-weight:700;margin-bottom:4px;background:linear-gradient(135deg,#5ee6a8,#4ed8ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">B2 · 成长证据树</h2>
      <p style="color:var(--text-muted);font-size:13px;margin-bottom:24px;">从便签中自动抽取你的年度目标、学习计划、Flag，并关联达成证据，年终结算。</p>

      <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
        <button id="gt-extract" style="background:linear-gradient(135deg,#5ee6a8,#34d399);color:#131314;border:none;border-radius:10px;padding:8px 20px;font-weight:600;cursor:pointer;font-size:13px;">🌱 抽取新目标</button>
        <select id="gt-status-filter" style="background:var(--bg-base);border:1px solid var(--border-color);color:var(--text-main);border-radius:10px;padding:8px 14px;font-size:13px;outline:none;">
          <option value="">全部状态</option>
          <option value="pending">待完成</option>
          <option value="in_progress">进行中</option>
          <option value="achieved">已达成</option>
          <option value="abandoned">已放弃</option>
        </select>
        <select id="gt-year-filter" style="background:var(--bg-base);border:1px solid var(--border-color);color:var(--text-main);border-radius:10px;padding:8px 14px;font-size:13px;outline:none;">
          <option value="">全部年份</option>
          ${Array.from({length:5},(_,i)=>new Date().getFullYear()-i).map(y=>`<option value="${y}">${y}年</option>`).join('')}
        </select>
        <button id="gt-settle" style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.25);color:#f59e0b;border-radius:10px;padding:8px 20px;font-weight:500;cursor:pointer;font-size:13px;">📊 年终结算</button>
      </div>

      <div id="gt-progress" style="display:none;padding:12px 16px;background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:12px;margin-bottom:16px;font-size:13px;color:var(--text-muted);"></div>

      <div id="gt-list" style="display:flex;flex-direction:column;gap:10px;">
        <div style="text-align:center;padding:60px 0;color:var(--text-muted);font-size:14px;">点击「抽取新目标」从便签中识别目标</div>
      </div>
    </div>
  `;

  document.getElementById('gt-extract').onclick = startExtraction;
  document.getElementById('gt-settle').onclick = startSettle;
  document.getElementById('gt-status-filter').onchange = loadGoals;
  document.getElementById('gt-year-filter').onchange = loadGoals;

  loadGoals();
}

async function startExtraction() {
  const btn = document.getElementById('gt-extract');
  const progress = document.getElementById('gt-progress');
  btn.disabled = true;
  btn.textContent = '⏳ 抽取中...';
  progress.style.display = 'block';
  progress.innerHTML = '正在分析便签中的目标...';
  abortCtrl = new AbortController();

  const model = localStorage.getItem('GT_MODEL') || 'deepseek-chat';
  const customApiKey = localStorage.getItem('DEEPSEEK_API_KEY') || '';

  window.ApiClient.subscribeGoalExtraction({ model, customApiKey }, {
    signal: abortCtrl.signal,
    onProgress: (p) => { progress.innerHTML = `抽取进度: ${p.processed || 0}/${p.total || '?'} (${p.percent || 0}%)`; },
    onResult: (r) => {
      progress.innerHTML = `✅ 目标抽取完成！发现 ${r.found || 0} 个目标`;
      loadGoals();
    },
    onError: (e) => { progress.innerHTML = `❌ ${e.message}`; },
    onDone: () => { btn.disabled = false; btn.textContent = '🌱 抽取新目标'; }
  });
}

async function loadGoals() {
  const container = document.getElementById('gt-list');
  if (!container) return;

  const params = {};
  const sf = document.getElementById('gt-status-filter')?.value;
  const yf = document.getElementById('gt-year-filter')?.value;
  if (sf) params.status = sf;
  if (yf) params.year = yf;

  try {
    const data = await window.ApiClient.listGoals(params);
    const goals = data.goals || [];
    if (goals.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:60px 0;color:var(--text-muted);font-size:14px;">暂无目标数据</div>';
      return;
    }

    const statusColors = { pending: '#f59e0b', in_progress: '#4ed8ff', achieved: '#5ee6a8', abandoned: '#ff6b8a' };
    const statusLabels = { pending: '待完成', in_progress: '进行中', achieved: '已达成', abandoned: '已放弃' };

    container.innerHTML = goals.map((g, i) => {
      const sc = statusColors[g.status] || '#6b84a8';
      const evidences = (g.evidence || []).map(e => `<span style="font-size:11px;color:var(--text-muted);">📌 ${e.evidenceType}: ${(e.noteText||'').substring(0,80)}</span>`).join('');
      return `
        <div style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:14px;padding:16px 20px;">
          <div style="display:flex;justify-content:space-between;align-items:start;gap:12px;">
            <div style="flex:1;">
              <div style="font-weight:600;color:var(--text-main);font-size:14px;margin-bottom:4px;">${escapeHtml(g.goalSummary || g.goal_text?.substring(0,100) || '未命名目标')}</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
                <span style="font-size:11px;color:${sc};background:${sc}18;padding:2px 8px;border-radius:6px;">${statusLabels[g.status] || g.status}</span>
                ${g.category ? `<span style="font-size:10px;color:var(--text-muted);background:var(--bg-base);padding:2px 8px;border-radius:6px;">${g.category}</span>` : ''}
                ${g.raisedAt ? `<span style="font-size:10px;color:var(--text-muted);">📅 ${g.raisedAt.substring(0,10)}</span>` : ''}
              </div>
              ${evidences ? `<div style="display:flex;flex-direction:column;gap:2px;margin-top:6px;">${evidences}</div>` : ''}
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;">
              ${g.status !== 'achieved' && g.status !== 'abandoned' ? `<button class="gt-status-btn" data-id="${g.id}" data-status="achieved" style="background:rgba(94,230,168,0.1);border:1px solid rgba(94,230,168,0.2);color:#5ee6a8;border-radius:6px;padding:2px 10px;font-size:11px;cursor:pointer;">✓ 达成</button>` : ''}
              ${g.status !== 'abandoned' && g.status !== 'achieved' ? `<button class="gt-status-btn" data-id="${g.id}" data-status="abandoned" style="background:rgba(255,107,138,0.1);border:1px solid rgba(255,107,138,0.2);color:#ff6b8a;border-radius:6px;padding:2px 10px;font-size:11px;cursor:pointer;">✕ 放弃</button>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.gt-status-btn').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const status = btn.dataset.status;
        await window.ApiClient.updateGoalStatus(id, status);
        loadGoals();
      };
    });
  } catch (e) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:13px;">加载失败: ${e.message}</div>`;
  }
}

async function startSettle() {
  const btn = document.getElementById('gt-settle');
  const progress = document.getElementById('gt-progress');
  btn.disabled = true;
  progress.style.display = 'block';
  progress.innerHTML = '⏳ 正在进行年终结算...';
  abortCtrl = new AbortController();

  const year = new Date().getFullYear();
  const model = localStorage.getItem('GT_MODEL') || 'deepseek-chat';
  const customApiKey = localStorage.getItem('DEEPSEEK_API_KEY') || '';

  window.ApiClient.subscribeSettleYear({ year, model, customApiKey, force: false, lengthMode: ApiClient.getLengthMode() }, {
    signal: abortCtrl.signal,
    onStatus: (s) => { progress.innerHTML = s.message || '处理中...'; },
    onChunk: (d) => { if (d.content) progress.innerHTML = marked.parse(d.content); },
    onResult: (r) => {
      progress.innerHTML = `✅ 结算完成！更新 ${r.updated || 0}/${r.total || 0} 个目标`;
      loadGoals();
    },
    onError: (e) => { progress.innerHTML = `❌ ${e.message}`; },
    onDone: () => { btn.disabled = false; }
  });
}

function escapeHtml(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
