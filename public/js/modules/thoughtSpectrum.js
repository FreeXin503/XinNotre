/**
 * 心迹星图 思想谱系星图 · 前端可视化模块
 * 职责：Canvas 星空渲染、思想家共振榜、话题演变曲线
 *
 * 模块组成:
 *   - 顶部: 生成按钮 + 快照选择器
 *   - 中部左: Canvas 星空图 (思想共振可视化)
 *   - 中部右: Top 10 思想家共振榜
 *   - 底部: 话题演变曲线 (Chart.js 折线图)
 *
 * 防翻车:
 *   - Canvas getContext('2d') 失败时降级为纯文字卡片列表
 *   - unmount 时 destroy Chart.js 实例
 *   - 窗口 resize 自动重新计算星空布局
 */
import { ApiClient } from '../api.js';

// ── 模块状态 ────────────────────────────────────────────

let containerEl = null;
let abortCtrl = null;
let chartInstance = null;
/** @type {Array<{id:string|number, version_tag:string, note_count:number, alignment_json?:string, dominant_tradition?:string, created_at:string}>} */
let snapshotsCache = [];

// ── 生命周期 ────────────────────────────────────────────

export function mountThoughtSpectrum(container) {
  containerEl = container;
  renderMainView();
}

export function unmountThoughtSpectrum() {
  if (abortCtrl) {
    abortCtrl.abort();
    abortCtrl = null;
  }
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  containerEl = null;
  delete window.generateSpectrum;
  delete window.selectSnapshot;
}

// ── 主视图 ──────────────────────────────────────────────

function renderMainView() {
  if (!containerEl) return;
  containerEl.innerHTML = `
    <div class="spectrum-container" style="max-width:900px;margin:0 auto;padding:20px 0;">
      <!-- 顶部 -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
        <div>
          <h2 style="font-size:22px;font-weight:700;margin:0;background:linear-gradient(135deg,#5ee6a8,#8ab4f8,#d96570);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">🌌 思想谱系星图</h2>
          <p style="color:var(--text-muted);font-size:13px;margin:4px 0 0 0;">你的思想与历史上伟大灵魂的深层共振</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <select id="ss-snapshot-select" style="background:rgba(255,255,255,0.05);border:1px solid var(--border-color);color:var(--text-main);border-radius:8px;padding:6px 10px;font-size:12px;outline:none;max-width:160px;">
            <option value="">选择历史快照...</option>
          </select>
          <button id="ss-generate-btn" style="background:linear-gradient(135deg,#5ee6a8,#34d399);color:#131314;border:none;border-radius:10px;padding:8px 18px;font-weight:600;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:6px;">
            ✨ 生成最新谱系
          </button>
        </div>
      </div>

      <!-- 状态指示 -->
      <div id="ss-status" style="display:none;padding:10px 14px;background:rgba(138,180,248,0.06);border:1px solid rgba(138,180,248,0.12);border-radius:10px;margin-bottom:16px;font-size:13px;color:var(--text-muted);"></div>

      <!-- 加载 -->
      <div id="ss-loading" style="display:flex;justify-content:center;padding:60px 0;color:var(--text-muted);font-size:13px;">
        <span class="typing-loading">加载中...</span>
      </div>

      <!-- 三栏布局 -->
      <div id="ss-content" style="display:none;flex-direction:column;gap:20px;">
        <!-- 行1: 星空 + 共振榜 -->
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          <div style="flex:2;min-width:300px;">
            <div style="font-size:13px;font-weight:600;color:var(--text-main);margin-bottom:6px;">🌟 思想星座</div>
            <canvas id="ss-star-canvas" width="500" height="360" style="width:100%;height:360px;border-radius:14px;border:1px solid var(--border-color);background:rgba(0,0,0,0.15);"></canvas>
          </div>
          <div style="flex:1;min-width:200px;">
            <div style="font-size:13px;font-weight:600;color:var(--text-main);margin-bottom:6px;">🏆 思想共振 TOP 10</div>
            <div id="ss-resonance-list" style="display:flex;flex-direction:column;gap:4px;"></div>
          </div>
        </div>

        <!-- 行2: 星座重心 -->
        <div id="ss-constellation-center" style="display:flex;gap:8px;flex-wrap:wrap;"></div>

        <!-- 行3: 话题演变曲线 -->
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div style="font-size:13px;font-weight:600;color:var(--text-main);">📈 话题认知演变</div>
            <select id="ss-topic-select" style="background:rgba(255,255,255,0.05);border:1px solid var(--border-color);color:var(--text-main);border-radius:8px;padding:4px 10px;font-size:12px;outline:none;"></select>
          </div>
          <canvas id="ss-evolution-chart" width="600" height="220" style="width:100%;height:220px;border-radius:12px;border:1px solid var(--border-color);background:rgba(0,0,0,0.08);padding:8px;"></canvas>
          <div id="ss-evolution-fallback" style="display:none;color:var(--text-muted);font-size:12px;text-align:center;padding:20px;"></div>
        </div>
      </div>

      <!-- 空状态 -->
      <div id="ss-empty" style="display:none;text-align:center;padding:60px 20px;color:var(--text-muted);border:1px dashed var(--border-color);border-radius:16px;">
        <div style="font-size:48px;margin-bottom:12px;">🌌</div>
        <div style="font-size:15px;margin-bottom:8px;">还没有思想谱系快照</div>
        <div style="font-size:13px;">点击「生成最新谱系」分析你的思想倾向</div>
      </div>
    </div>
  `;

  // 加载数据
  loadSnapshots();

  // 绑定事件
  document.getElementById('ss-generate-btn')?.addEventListener('click', handleGenerate);
  document.getElementById('ss-snapshot-select')?.addEventListener('change', (e) => {
    if (e.target.value) loadSnapshotDetail(e.target.value);
  });

  window.generateSpectrum = handleGenerate;
  window.selectSnapshot = loadSnapshotDetail;
}

// ── 数据加载 ────────────────────────────────────────────

async function loadSnapshots() {
  const loadingEl = document.getElementById('ss-loading');
  const contentEl = document.getElementById('ss-content');
  const emptyEl = document.getElementById('ss-empty');
  const selectEl = document.getElementById('ss-snapshot-select');

  try {
    const res = await ApiClient.listThoughtSpectrum();
    const snapshots = res?.data?.snapshots || [];
    snapshotsCache = snapshots;

    if (loadingEl) loadingEl.style.display = 'none';

    if (snapshots.length === 0) {
      if (emptyEl) emptyEl.style.display = 'block';
      if (contentEl) contentEl.style.display = 'none';
      return;
    }

    if (contentEl) contentEl.style.display = 'flex';

    // 填充选择器
    if (selectEl) {
      let options = '<option value="">选择历史快照...</option>';
      snapshots.forEach(s => {
        options += `<option value="${escapeHtmlAttr(String(s.id))}">${escapeHtml(s.version_tag || '')} · ${s.note_count || 0}篇</option>`;
      });
      selectEl.innerHTML = options;
      selectEl.value = snapshots[0].id;
    }

    // 加载话题列表
    loadTopics();

    // 加载第一个快照
    loadSnapshotDetail(snapshots[0].id);

  } catch (err) {
    console.error('[thoughtSpectrum] 加载快照列表失败:', err);
    if (loadingEl) {
      loadingEl.innerHTML = `<span style="color:#ea4335;">❌ ${escapeHtml(err.message)}</span>`;
    }
  }
}

async function loadSnapshotDetail(snapshotId) {
  if (!snapshotId) return;
  const selectEl = document.getElementById('ss-snapshot-select');
  if (selectEl) selectEl.value = snapshotId;

  showStatus('🔄 加载快照数据...');

  try {
    // 从快照缓存中查找，避免重复请求
    const snapshot = snapshotsCache.find(s => String(s.id) === String(snapshotId));
    if (!snapshot) {
      showStatus('⚠️ 快照未找到');
      return;
    }

    renderCenterInfo(snapshot);

    // 尝试解析 alignment_json 绘制星空图
    if (snapshot.alignment_json) {
      const alignment = tryParseJSON(snapshot.alignment_json);
      if (alignment && alignment.spectrum && Array.isArray(alignment.spectrum)) {
        renderStarMap(alignment.spectrum);
        renderResonanceList(alignment.spectrum);
      }
    }

    hideStatus();
  } catch (err) {
    showStatus(`❌ ${escapeHtml(err.message)}`);
  }
}

// ── 渲染辅助 ────────────────────────────────────────────

function renderCenterInfo(snapshot) {
  const centerEl = document.getElementById('ss-constellation-center');
  if (!centerEl) return;

  let html = '';
  if (snapshot.dominant_tradition) {
    const parts = snapshot.dominant_tradition.split('·');
    parts.forEach(p => {
      if (!p.trim()) return;
      html += `<span style="background:rgba(138,180,248,0.1);border:1px solid rgba(138,180,248,0.15);border-radius:20px;padding:4px 14px;font-size:13px;color:var(--primary);">${escapeHtml(p.trim())}</span>`;
    });
  }
  centerEl.innerHTML = html || '<span style="color:var(--text-muted);font-size:12px;">暂无思想重心数据</span>';
}

// ── Canvas 星空图 ──────────────────────────────────────

function renderStarMap(spectrumData) {
  const canvas = document.getElementById('ss-star-canvas');
  if (!canvas || !spectrumData || spectrumData.length === 0) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // 降级为纯文字列表
    renderResonanceList(spectrumData);
    return;
  }

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // 背景星空装饰
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = Math.random() * 1.5 + 0.3;
    const a = Math.random() * 0.4 + 0.1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fill();
  }

  // 中心点 (用户)
  const cx = w / 2;
  const cy = h / 2;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 16);
  gradient.addColorStop(0, 'rgba(138,180,248,0.6)');
  gradient.addColorStop(1, 'rgba(138,180,248,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#8ab4f8';
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('你', cx, cy);

  // 取 top 15 渲染为星星
  const topThinkers = [...spectrumData]
    .sort((a, b) => (b.resonanceScore || 0) - (a.resonanceScore || 0))
    .slice(0, 15);
  const maxR = Math.min(w, h) / 2 - 48;
  const minR = 32;

  topThinkers.forEach((t, i) => {
    const angle = (i / topThinkers.length) * Math.PI * 2 - Math.PI / 2;
    const score = Math.max(0, Math.min(100, t.resonanceScore || 0));
    const r = minR + (maxR - minR) * (score / 100);
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    const starSize = 4 + (score / 100) * 8;

    // 连线
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    const alpha = 0.1 + (score / 100) * 0.3;
    ctx.strokeStyle = `rgba(138,180,248,${alpha})`;
    ctx.lineWidth = 1;
    ctx.lineTo(x, y);
    ctx.stroke();

    // 星星光晕
    const glow = ctx.createRadialGradient(x, y, 0, x, y, starSize + 4);
    glow.addColorStop(0, `hsla(${240 - (score / 100) * 200}, 70%, 60%, 0.2)`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, starSize + 4, 0, Math.PI * 2);
    ctx.fill();

    // 星星本体
    ctx.beginPath();
    ctx.arc(x, y, starSize, 0, Math.PI * 2);
    const hue = 240 - (score / 100) * 200;
    ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
    ctx.fill();

    // 标签
    ctx.fillStyle = '#e0e0e0';
    ctx.font = `${Math.max(9, 10 + (score / 100) * 2)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(t.displayName || t.thinkerId || '', x, y - starSize - 4);

    // 共振百分比
    ctx.fillStyle = `hsla(${hue}, 50%, 70%, 0.6)`;
    ctx.font = '9px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(`${score}%`, x, y + starSize + 2);
  });
}

// ── 共振榜 ──────────────────────────────────────────────

function renderResonanceList(spectrumData) {
  const list = document.getElementById('ss-resonance-list');
  if (!list || !spectrumData) return;

  const sorted = [...spectrumData]
    .sort((a, b) => (b.resonanceScore || 0) - (a.resonanceScore || 0))
    .slice(0, 10);

  list.innerHTML = sorted.map((t, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:8px;${i === 0 ? 'background:rgba(138,180,248,0.1);' : ''}transition:background 0.2s;">
      <span style="font-weight:700;color:var(--primary);font-size:14px;width:20px;flex-shrink:0;">#${i + 1}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(t.displayName || '')}</div>
        <div style="font-size:10px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(t.era || '')}${t.dominantDimension ? ' · ' + escapeHtml(t.dominantDimension) : ''}</div>
      </div>
      <div style="font-size:13px;font-weight:700;color:var(--primary);flex-shrink:0;">${t.resonanceScore || 0}%</div>
    </div>
  `).join('');
}

// ── 话题加载 ────────────────────────────────────────────

async function loadTopics() {
  const selectEl = document.getElementById('ss-topic-select');
  if (!selectEl) return;

  try {
    const res = await ApiClient.getTopicEvolution(null);
    const topics = res?.data?.topics || [];

    let html = '<option value="">选择话题...</option>';
    topics.forEach(t => {
      html += `<option value="${escapeHtmlAttr(String(t.id))}">${escapeHtml(t.topic_name)}</option>`;
    });
    selectEl.innerHTML = html;

    // 移除旧监听器（用新 select 替换后，旧事件自动解除）
    selectEl.onchange = (e) => {
      if (e.target.value) {
        loadTopicEvolution(e.target.value);
      } else {
        // 清空图表
        if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
        const fallback = document.getElementById('ss-evolution-fallback');
        if (fallback) { fallback.style.display = 'block'; fallback.textContent = '请选择一个话题查看演变曲线'; }
      }
    };

    // 如果有话题，自动选择第一个
    if (topics.length > 0) {
      selectEl.value = topics[0].id;
      loadTopicEvolution(topics[0].id);
    }
  } catch (err) {
    console.error('[thoughtSpectrum] loadTopics error:', err);
  }
}

// ── 工具函数 ────────────────────────────────────────────

function showStatus(msg) {
  const el = document.getElementById('ss-status');
  if (el) { el.style.display = 'block'; el.innerHTML = msg; }
}

function hideStatus() {
  const el = document.getElementById('ss-status');
  if (el) el.style.display = 'none';
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeHtmlAttr(str) {
  if (str == null) return '';
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&/g, '&amp;');
}

function tryParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}
