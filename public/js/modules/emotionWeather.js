import { ApiClient } from '../api.js';

let containerEl = null;
let abortCtrl = null;

export function mountEmotionWeather(el) {
  containerEl = el;
  el.innerHTML = `
    <div style="max-width:800px;margin:0 auto;">
      <h2 style="font-size:22px;font-weight:700;margin-bottom:4px;background:linear-gradient(135deg,#4ed8ff,#8366f1);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">A2 · 情绪天气图</h2>
      <p style="color:var(--text-muted);font-size:13px;margin-bottom:24px;">以 GitHub 贡献图般的视觉，一览你一年来的情绪脉动与心路周期。</p>

      <div style="display:flex;gap:12px;align-items:center;margin-bottom:20px;flex-wrap:wrap;">
        <select id="ew-year" style="background:var(--bg-base);border:1px solid var(--border-color);color:var(--text-main);border-radius:10px;padding:8px 14px;font-size:13px;outline:none;">
          ${Array.from({length:5},(_,i)=>new Date().getFullYear()-i).map(y=>`<option value="${y}">${y}年</option>`).join('')}
        </select>
        <select id="ew-layer" style="background:var(--bg-base);border:1px solid var(--border-color);color:var(--text-main);border-radius:10px;padding:8px 14px;font-size:13px;outline:none;">
          <option value="emotion">情绪色</option>
          <option value="note_count">笔记密度</option>
        </select>
        <button id="ew-start-annotation" style="background:linear-gradient(135deg,#4ed8ff,#3b82f6);color:#131314;border:none;border-radius:10px;padding:8px 20px;font-weight:600;cursor:pointer;font-size:13px;">开始情绪标注</button>
        <button id="ew-diagnose" style="background:rgba(131,102,241,0.12);border:1px solid rgba(131,102,241,0.25);color:#8366f1;border-radius:10px;padding:8px 20px;font-weight:500;cursor:pointer;font-size:13px;">气候诊断</button>
      </div>

      <div id="ew-progress" style="display:none;padding:12px 16px;background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:12px;margin-bottom:16px;font-size:13px;color:var(--text-muted);"></div>

      <div id="ew-grid-container" style="min-height:200px;background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:16px;padding:20px;margin-bottom:20px;">
        <div style="text-align:center;padding:60px 0;color:var(--text-muted);font-size:14px;">点击「开始情绪标注」后查看天气图</div>
      </div>

      <div id="ew-legend" style="display:none;display:flex;gap:16px;flex-wrap:wrap;justify-content:center;margin-bottom:20px;"></div>

      <div id="ew-diagnosis" style="display:none;background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:16px;padding:20px;">
        <h3 style="font-size:16px;font-weight:600;margin-bottom:12px;color:var(--text-main);">🌤 情绪气候诊断</h3>
        <div id="ew-diagnosis-content" style="font-size:13px;line-height:1.7;color:var(--text-muted);"></div>
      </div>
    </div>
  `;

  document.getElementById('ew-start-annotation').onclick = startAnnotation;
  document.getElementById('ew-diagnose').onclick = startDiagnosis;
  document.getElementById('ew-year').onchange = loadGrid;
  document.getElementById('ew-layer').onchange = loadGrid;

  loadGrid();
}

async function startAnnotation() {
  const btn = document.getElementById('ew-start-annotation');
  const progress = document.getElementById('ew-progress');
  btn.disabled = true;
  btn.textContent = '⏳ 标注中...';
  progress.style.display = 'block';
  progress.innerHTML = '初始化情绪标注...';
  abortCtrl = new AbortController();

  const token = ApiClient?.getToken?.() || localStorage.getItem('xinnote_token');
  const model = localStorage.getItem('EW_MODEL') || 'deepseek-chat';
  const customApiKey = localStorage.getItem('DEEPSEEK_API_KEY') || '';

  ApiClient.subscribeEmotionAnnotation({ model, customApiKey }, {
    signal: abortCtrl.signal,
    onProgress: (p) => { progress.innerHTML = `标注进度: ${p.processed || 0}/${p.total || '?'} (${p.percent || 0}%)`; },
    onResult: (r) => {
      progress.innerHTML = `✅ 情绪标注完成！共处理 ${r.processed || 0} 篇便签`;
      loadGrid();
    },
    onError: (e) => { progress.innerHTML = `❌ ${e.message}`; },
    onDone: () => { btn.disabled = false; btn.textContent = '开始情绪标注'; }
  });
}

async function loadGrid() {
  const year = document.getElementById('ew-year')?.value || new Date().getFullYear();
  const layer = document.getElementById('ew-layer')?.value || 'emotion';
  const container = document.getElementById('ew-grid-container');
  if (!container) return;

  try {
    const data = await ApiClient.getWeatherGrid({ year, layer });
    renderGrid(container, data);
  } catch (e) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);">加载失败: ${e.message}</div>`;
  }
}

function renderGrid(container, data) {
  if (!data.days || data.days.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:60px 0;color:var(--text-muted);font-size:14px;">该年份暂无情绪数据</div>';
    return;
  }

  const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  const monthDays = Array.from({length:12}, (_,m) => data.days.filter(d => {
    const mo = parseInt(d.date?.substring(5,7) || '0');
    return mo === m + 1;
  }));

  let html = '<div style="display:flex;gap:3px;overflow-x:auto;padding-bottom:8px;">';
  monthDays.forEach((days, mi) => {
    if (days.length === 0) return;
    html += '<div style="min-width:auto;"><div style="font-size:10px;color:var(--text-muted);text-align:center;margin-bottom:4px;">' + months[mi] + '</div><div style="display:flex;gap:2px;flex-wrap:wrap;max-width:180px;">';
    days.forEach(d => {
      const color = d.color || (data.layer === 'note_count' ? (d.noteCount > 3 ? '#4ed8ff' : d.noteCount > 0 ? '#1a4972' : '#0a1628') : '#0a1628');
      const title = `${d.date || ''} score:${d.score || '--'} ${d.label || ''}`;
      html += `<div title="${title}" style="width:12px;height:12px;border-radius:3px;background:${color};border:1px solid rgba(255,255,255,0.05);"></div>`;
    });
    html += '</div></div>';
  });
  html += '</div>';

  // Legend
  const legend = document.getElementById('ew-legend');
  if (data.legend) {
    legend.style.display = 'flex';
    legend.innerHTML = data.legend.map(l =>
      `<span style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text-muted);"><span style="width:10px;height:10px;border-radius:2px;background:${l.color};"></span>${l.label}</span>`
    ).join('');
  }

  container.innerHTML = html;
}

async function startDiagnosis() {
  const btn = document.getElementById('ew-diagnose');
  const panel = document.getElementById('ew-diagnosis');
  const content = document.getElementById('ew-diagnosis-content');
  panel.style.display = 'block';
  content.innerHTML = '⏳ 正在进行气候诊断...';
  btn.disabled = true;

  const year = document.getElementById('ew-year')?.value || new Date().getFullYear();
  const token = ApiClient?.getToken?.() || localStorage.getItem('xinnote_token');
  const model = localStorage.getItem('EW_MODEL') || 'deepseek-chat';
  const customApiKey = localStorage.getItem('DEEPSEEK_API_KEY') || '';
  abortCtrl = new AbortController();

  ApiClient.subscribeClimateDiagnosis({ year: parseInt(year), model, customApiKey, lengthMode: ApiClient.getLengthMode() }, {
    signal: abortCtrl.signal,
    onChunk: (d) => {
      if (d.content) {
        content.innerHTML = marked.parse(d.content);
      }
    },
    onResult: (r) => {
      if (r.narrative) {
        content.innerHTML = marked.parse(r.narrative);
      }
      if (r.plumRains?.length > 0 || r.harvests?.length > 0) {
        let extra = '';
        if (r.plumRains?.length) {
          extra += '<h4 style="margin-top:16px;color:#ff6b8a;">🌧 梅雨季（连续低潮期）</h4>';
          r.plumRains.forEach(p => { extra += `<div style="font-size:12px;color:var(--text-muted);padding:4px 0;">${p.start} ~ ${p.end} 平均分: ${p.avgScore}</div>`; });
        }
        if (r.harvests?.length) {
          extra += '<h4 style="margin-top:16px;color:#5ee6a8;">☀️ 丰收季（连续高能期）</h4>';
          r.harvests.forEach(p => { extra += `<div style="font-size:12px;color:var(--text-muted);padding:4px 0;">${p.start} ~ ${p.end} 平均分: ${p.avgScore}</div>`; });
        }
        content.innerHTML += extra;
      }
    },
    onError: (e) => { content.innerHTML = `❌ ${e.message}`; },
    onDone: () => { btn.disabled = false; }
  });
}
