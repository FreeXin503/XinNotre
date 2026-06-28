import { ApiClient } from '../api.js';

let containerEl = null;
let currentSnapshotId = null;
let abortCtrl = null;

const DIM_LABELS = {
  thinker: '思考者',
  doer: '行动派',
  emotional: '情绪型',
  rational: '理性型',
  romantic: '浪漫',
  pragmatic: '务实'
};

const DIM_ORDER = ['thinker', 'doer', 'emotional', 'rational', 'romantic', 'pragmatic'];

export function mountPersona(container) {
  containerEl = container;
  renderMainView();
}

export function unmountPersona() {
  if (abortCtrl) { abortCtrl.abort(); abortCtrl = null; }
  containerEl = null;
  currentSnapshotId = null;
  delete window.generatePersona;
  delete window.selectPersona;
  delete window.comparePersona;
}

function renderMainView() {
  if (!containerEl) return;
  containerEl.innerHTML = `
    <div class="persona-container">
      <div class="persona-header">
        <h2>🧬 灵魂人格档案</h2>
        <p class="persona-subtitle">你的人格特征随着时间的推移而演变</p>
      </div>
      <div class="persona-actions">
        <button id="btn-persona-generate" class="persona-generate-btn" onclick="window.generatePersona()">✨ 生成最新人格快照</button>
        <span class="persona-hint">基于全量便签分析，每次导出后可更新</span>
      </div>
      <div id="persona-progress" class="persona-progress"></div>
      <div id="persona-radar-container" class="persona-radar-container">
        <canvas id="persona-radar-canvas" width="360" height="360"></canvas>
      </div>
      <div id="persona-summary" class="persona-summary"></div>
      <div id="persona-timeline" class="persona-timeline"></div>
      <div id="persona-diff-area" class="persona-diff-area"></div>
    </div>
  `;

  window.generatePersona = generatePersona;

  loadHistory();
}

async function generatePersona() {
  const progressEl = document.getElementById('persona-progress');
  if (progressEl) progressEl.innerHTML = `<div class="persona-loading">⏳ 正在分析便签人格特征...</div>`;

  if (abortCtrl) abortCtrl.abort();
  abortCtrl = new AbortController();

  try {
    ApiClient.subscribePersonaGenerate({ model: 'deepseek-chat', lengthMode: ApiClient.getLengthMode() }, {
      signal: abortCtrl.signal,
      onStatus: (data) => {
        if (progressEl) progressEl.innerHTML = `<div class="persona-loading">⏳ ${data.message || '处理中...'}</div>`;
      },
      onChunk: (data) => {
        // show as streaming progress text
        const existing = progressEl?.querySelector('.persona-stream');
        if (!existing && progressEl) {
          progressEl.innerHTML = `<div class="persona-stream">${data.content || ''}</div>`;
        } else if (existing) {
          existing.textContent += data.content || '';
        }
      },
      onResult: (data) => {
        if (data.cached) {
          if (progressEl) progressEl.innerHTML = `<div class="persona-cached">📋 语料未变，使用已有快照: ${data.versionTag}</div>`;
          loadSnapshot(data.snapshotId);
          return;
        }
        if (progressEl) progressEl.innerHTML = `<div class="persona-success">✅ ${data.versionTag} 生成完成</div>`;
        renderRadar(data.radar);
        renderSummary(data);
        currentSnapshotId = data.snapshotId;
        loadHistory();
      },
      onDone: () => {},
      onError: (err) => {
        if (progressEl) progressEl.innerHTML = `<div class="persona-error">❌ ${err.message}</div>`;
      }
    });
  } catch (err) {
    if (progressEl) progressEl.innerHTML = `<div class="persona-error">❌ ${err.message}</div>`;
  }
}

function renderRadar(radar) {
  if (!radar || typeof radar !== 'object') return;
  const canvas = document.getElementById('persona-radar-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2;
  const cy = H / 2;
  const R = Math.min(cx, cy) - 40;
  const n = DIM_ORDER.length;

  ctx.clearRect(0, 0, W, H);

  // Background grid
  for (let level = 1; level <= 5; level++) {
    const r = R * level / 5;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(78, 216, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Axes
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + R * Math.cos(angle), cy + R * Math.sin(angle));
    ctx.strokeStyle = 'rgba(78, 216, 255, 0.15)';
    ctx.stroke();

    // Labels
    const lx = cx + (R + 30) * Math.cos(angle);
    const ly = cy + (R + 30) * Math.sin(angle);
    ctx.fillStyle = '#6b84a8';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(DIM_LABELS[DIM_ORDER[i]], lx, ly);

    // Value label
    const v = radar[DIM_ORDER[i]] || 50;
    const vx = cx + (R + 4) * Math.cos(angle);
    const vy = cy + (R + 4) * Math.sin(angle);
    ctx.fillStyle = '#4ed8ff';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillText(v, vx, vy);
  }

  // Data polygon
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const idx = i % n;
    const v = (radar[DIM_ORDER[idx]] || 50) / 100;
    const angle = (Math.PI * 2 * idx / n) - Math.PI / 2;
    const x = cx + R * v * Math.cos(angle);
    const y = cy + R * v * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(78, 216, 255, 0.15)';
  ctx.fill();
  ctx.strokeStyle = '#4ed8ff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Points
  for (let i = 0; i < n; i++) {
    const v = (radar[DIM_ORDER[i]] || 50) / 100;
    const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
    const x = cx + R * v * Math.cos(angle);
    const y = cy + R * v * Math.sin(angle);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#4ed8ff';
    ctx.fill();
  }
}

function renderSummary(data) {
  const el = document.getElementById('persona-summary');
  if (!el) return;

  const keywords = (data.keywords || []).slice(0, 8);
  el.innerHTML = `
    <div class="persona-summary-card">
      <div class="persona-summary-text">${escapeHtml(data.summary || '暂无综述')}</div>
      ${keywords.length ? `<div class="persona-keywords">高频人格词: ${keywords.map(k => `<span class="persona-keyword-tag">${escapeHtml(k.word)}<small>${k.count}</small></span>`).join('')}</div>` : ''}
      ${data.crossTalk ? `<div class="persona-cross-talk">💬 ${escapeHtml(data.crossTalk)}</div>` : ''}
    </div>
  `;
}

async function loadHistory() {
  const el = document.getElementById('persona-timeline');
  if (!el) return;

  try {
    const data = await ApiClient.listPersonas();
    const personas = data.personas || [];
    if (personas.length === 0) {
      el.innerHTML = `<div class="persona-empty">尚无快照，点击「生成最新人格快照」开始</div>`;
      return;
    }

    el.innerHTML = `
      <h3 class="persona-timeline-title">📊 人格版本演化 (${personas.length})</h3>
      <div class="persona-timeline-scroll">
        ${personas.map((p, i) => `
          <div class="persona-timeline-item ${p.id === currentSnapshotId ? 'active' : ''}" onclick="window.selectPersona(${p.id}, ${personas[0]?.id})">
            <div class="timeline-seq">v${p.seq}</div>
            <div class="timeline-tag">${escapeHtml(p.versionTag || '')}</div>
            <div class="timeline-date">${p.createdAt ? String(p.createdAt).substring(0, 10) : ''}</div>
          </div>
        `).join('')}
      </div>
      ${personas.length >= 2 ? `
        <div class="persona-compare-area">
          <button class="persona-compare-btn" onclick="window.comparePersona(${personas[1]?.id || personas[0]?.id}, ${personas[0]?.id})">
            📈 对比最近两个版本
          </button>
        </div>
      ` : ''}
    `;

    window.selectPersona = selectPersona;
    window.comparePersona = comparePersona;

    // Auto-select latest
    if (!currentSnapshotId && personas.length > 0) {
      loadSnapshot(personas[0].id);
    }
  } catch (err) {
    el.innerHTML = `<div class="persona-error">加载历史失败</div>`;
  }
}

async function loadSnapshot(id) {
  currentSnapshotId = id;
  try {
    const data = await ApiClient.listPersonas();
    const snap = (data.personas || []).find(p => p.id === id);
    if (snap) {
      renderRadar(snap.radar);
      renderSummary(snap);

      // highlight timeline
      document.querySelectorAll('.persona-timeline-item').forEach(el => el.classList.remove('active'));
      const activeEl = document.querySelector(`.persona-timeline-item[onclick*="${id}"]`) ||
        document.querySelector(`[onclick*="selectPersona(${id}"]`);
      if (activeEl) activeEl.classList.add('active');
    }
  } catch (err) {
    // silent
  }
}

async function selectPersona(id, latestId) {
  loadSnapshot(id);
  // Show diff with latest
  if (id !== latestId) {
    comparePersona(id, latestId);
  }
}

async function comparePersona(fromId, toId) {
  const el = document.getElementById('persona-diff-area');
  if (!el) return;

  try {
    const data = await ApiClient.getPersonaDiff(fromId, toId);
    const drift = data.drift || {};
    el.innerHTML = `
      <div class="persona-diff-card">
        <h4>📉 版本变化: ${data.from?.versionTag || ''} → ${data.to?.versionTag || ''}</h4>
        <div class="persona-diff-grid">
          ${DIM_ORDER.map(d => {
            const v = drift[d] || 0;
            const sign = v > 0 ? '+' : '';
            const cls = v > 5 ? 'up' : v < -5 ? 'down' : 'flat';
            return `<div class="persona-diff-item ${cls}">
              <span class="diff-label">${DIM_LABELS[d]}</span>
              <span class="diff-value">${sign}${v}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;
  } catch (err) {
    el.innerHTML = ``;
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
