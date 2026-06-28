import { ApiClient } from '../api.js';

let currentState = 'idle';
let currentCard = null;
let containerEl = null;
let abortCtrl = null;

export function mountArchaeology(container) {
  containerEl = container;
  renderMainView();
}

export function unmountArchaeology() {
  if (abortCtrl) { abortCtrl.abort(); abortCtrl = null; }
  containerEl = null;
  currentState = 'idle';
  currentCard = null;
  delete window.digBlindBox;
  delete window.appraiseCard;
}

function renderMainView() {
  if (!containerEl) return;
  containerEl.innerHTML = `
    <div class="archaeology-container">
      <div class="archaeology-header">
        <h2>🏺 便签考古盲盒</h2>
        <p class="archaeology-subtitle">从时间地层中挖出一段被遗忘的回忆</p>
      </div>
      <div class="archaeology-modes">
        <button class="archaeology-mode-btn active" data-mode="random">🎲 随机挖掘</button>
        <button class="archaeology-mode-btn" data-mode="emotion">🎭 按情绪挖</button>
        <button class="archaeology-mode-btn" data-mode="topic">🏷️ 按主题挖</button>
      </div>
      <div id="archaeology-seed-area" class="archaeology-seed-area" style="display:none;">
        <input type="text" id="archaeology-seed-input" placeholder="输入情绪词或主题关键词..." />
      </div>
      <button id="btn-archaeology-dig" class="archaeology-dig-btn" onclick="window.digBlindBox()">⛏️ 开始挖掘</button>
      <div id="archaeology-result" class="archaeology-result"></div>
      <div id="archaeology-collection" class="archaeology-collection"></div>
    </div>
  `;

  // Mode switching
  containerEl.querySelectorAll('.archaeology-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      containerEl.querySelectorAll('.archaeology-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.mode;
      const seedArea = document.getElementById('archaeology-seed-area');
      if (mode === 'emotion' || mode === 'topic') {
        seedArea.style.display = 'block';
        document.getElementById('archaeology-seed-input').placeholder = mode === 'emotion' ? '如：快乐、焦虑、平静...' : '如：旅行、工作、爱情...';
      } else {
        seedArea.style.display = 'none';
      }
    });
  });

  window.digBlindBox = digBlindBox;

  // Load collection
  loadCollection();
}

async function digBlindBox() {
  if (currentState === 'digging') return;

  const activeBtn = containerEl?.querySelector('.archaeology-mode-btn.active');
  const mode = activeBtn?.dataset?.mode || 'random';
  const seed = document.getElementById('archaeology-seed-input')?.value || '';

  const btn = document.getElementById('btn-archaeology-dig');
  const resultEl = document.getElementById('archaeology-result');
  if (!resultEl) return;

  currentState = 'digging';
  if (btn) btn.disabled = true;
  resultEl.innerHTML = `<div class="archaeology-digging">⛏️ 正在挖掘...<div class="digging-particles"></div></div>`;

  try {
    const data = await ApiClient.digBlindBox(mode, seed);
    currentCard = data;
    renderCard(data, resultEl);
    currentState = 'revealed';
    if (btn) btn.disabled = false;
    loadCollection();
  } catch (err) {
    resultEl.innerHTML = `<div class="archaeology-error">❌ ${err.message}</div>`;
    currentState = 'idle';
    if (btn) btn.disabled = false;
  }
}

function renderCard(card, el) {
  const daysAgo = card.meta?.daysAgo || 0;
  const coKeywords = card.meta?.coKeywords || [];
  const coNoteTitles = card.meta?.coNoteTitles || [];

  const dateStr = card.createdAt ? String(card.createdAt).substring(0, 10) : '未知日期';

  el.innerHTML = `
    <div class="archaeology-card">
      <div class="archaeology-card-badge">📜 出土文物 · ${daysAgo} 天前埋藏</div>
      <div class="archaeology-card-date">${dateStr} · ${card.noteCategory || '未分类'}</div>
      <h3 class="archaeology-card-title">${card.noteTitle || '无标题'}</h3>
      <div class="archaeology-card-content">${escapeHtml(card.noteContent || '')}</div>
      ${coKeywords.length ? `<div class="archaeology-keywords">同期高频词: ${coKeywords.map(k => `<span class="arch-keyword-tag">${k}</span>`).join('')}</div>` : ''}
      ${coNoteTitles.length ? `<div class="archaeology-co-notes">同期相关: ${coNoteTitles.map(t => `<span class="arch-co-note">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      <button class="archaeology-appraise-btn" onclick="window.appraiseCard(${card.cardId})" id="btn-appraise-${card.cardId}">
        🔍 鉴定这件文物
      </button>
      <div id="appraisal-result-${card.cardId}" class="appraisal-result"></div>
    </div>
  `;

  window.appraiseCard = appraiseCard;
}

async function appraiseCard(cardId) {
  const btn = document.getElementById(`btn-appraise-${cardId}`);
  const resultEl = document.getElementById(`appraisal-result-${cardId}`);
  if (!btn || !resultEl) return;

  btn.disabled = true;
  btn.textContent = '🔍 鉴定中...';
  resultEl.innerHTML = `<div class="appraisal-loading">🧐 正在鉴定...</div>`;

  if (abortCtrl) abortCtrl.abort();
  abortCtrl = new AbortController();

  try {
    ApiClient.subscribeArchaeologyAppraise(cardId, { model: 'deepseek-chat', lengthMode: ApiClient.getLengthMode() }, {
      signal: abortCtrl.signal,
      onStatus: (data) => {
        resultEl.innerHTML = `<div class="appraisal-loading">${data.message || '鉴定中...'}</div>`;
      },
      onChunk: (data) => {
        // Streaming tokens - update progressively
        const existing = resultEl.querySelector('.appraisal-streaming');
        if (existing) existing.textContent += data.content || '';
      },
      onResult: (data) => {
        if (data.cached) {
          resultEl.innerHTML = `<div class="appraisal-cached">📋 已有鉴定记录</div>`;
          return;
        }
        if (data.raw) {
          resultEl.innerHTML = `<div class="appraisal-text">${escapeHtml(data.raw)}</div>`;
          return;
        }
        resultEl.innerHTML = `
          <div class="appraisal-done">
            <div class="appraisal-section">
              <div class="appraisal-section-label">🧩 当时的你</div>
              <p>${escapeHtml(data.thenThinking || '')}</p>
            </div>
            <div class="appraisal-section">
              <div class="appraisal-section-label">📈 后来怎样了</div>
              <p>${escapeHtml(data.didItHappen || '')}</p>
            </div>
            <div class="appraisal-section">
              <div class="appraisal-section-label">💫 现在回头看</div>
              <p>${escapeHtml(data.inHindsight || '')}</p>
            </div>
          </div>
        `;
      },
      onDone: () => {
        btn.textContent = '✅ 已鉴定';
        btn.disabled = false;
      },
      onError: (err) => {
        resultEl.innerHTML = `<div class="archaeology-error">❌ 鉴定失败: ${err.message}</div>`;
        btn.textContent = '🔍 重试鉴定';
        btn.disabled = false;
      }
    });
  } catch (err) {
    resultEl.innerHTML = `<div class="archaeology-error">❌ 鉴定失败: ${err.message}</div>`;
    btn.textContent = '🔍 重试鉴定';
    btn.disabled = false;
  }
}

async function loadCollection() {
  const el = document.getElementById('archaeology-collection');
  if (!el) return;

  try {
    const data = await ApiClient.listArchaeologyCards();
    const cards = data.cards || [];
    if (cards.length === 0) {
      el.innerHTML = `<div class="archaeology-empty">还没有出土文物，开始挖掘吧 🔍</div>`;
      return;
    }

    el.innerHTML = `
      <h3 class="archaeology-collection-title">📚 我的考古图鉴 (${cards.length})</h3>
      <div class="archaeology-collection-grid">
        ${cards.slice(0, 20).map(c => `
          <div class="archaeology-collection-item ${c.isAppraised ? 'appraised' : ''}">
            <div class="collection-item-date">${String(c.noteCreatedAt || '').substring(0, 10)}</div>
            <div class="collection-item-title">${escapeHtml(c.noteTitle || '无标题')}</div>
            <div class="collection-item-mode">${c.digMode === 'random' ? '🎲' : c.digMode === 'emotion' ? '🎭' : '🏷️'}</div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    // silently fail
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
