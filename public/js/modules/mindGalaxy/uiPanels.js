/**
 * 心智星系 v2 · UI 面板 + 时间控制 + 分析预览
 * 职责：数据导入按钮、详情面板、手动分析、时间轴播放控制、实时分析预览
 */

import { analyzePreview } from './analyzer.js';

let leftCollapsed = false;
let analyzerTimeout = null;

export const timeState = {
  current: 0,
  max: 1000,
  playing: false,
  speed: 0.5
};

export function initUI() {
  initTimeControls();

  // Left panel toggle
  document.getElementById('left-toggle')?.addEventListener('click', () => {
    leftCollapsed = !leftCollapsed;
    const panel = document.getElementById('left-panel');
    if (panel) panel.classList.toggle('collapsed', leftCollapsed);
  });

  // Import buttons: redirect to v2 analyze
  const bindImport = (id, source) => {
    document.getElementById(id)?.addEventListener('click', async () => {
      showImportStatus('正在生成星系...');
      try {
        const { ApiClient } = await import('../../api.js');
        const client = ApiClient;
        const url = source === 'notes' ? '/mind-galaxy/from-notes' : source === 'kb' ? '/mind-galaxy/from-kb' : '/mind-galaxy/mixed';
        const res = await client.request(url, { headers: client.getHeaders() });
        if (res?.success) {
          hideImportStatus();
          location.reload();
        } else {
          showImportStatus('导入失败', true);
        }
      } catch (e) {
        showImportStatus('导入失败: ' + e.message, true);
      }
    });
  };
  bindImport('btn-import-notes', 'notes');
  bindImport('btn-import-kb', 'kb');
  bindImport('btn-import-mixed', 'mixed');

  // Analyze button: SSE stream
  document.getElementById('btn-analyze')?.addEventListener('click', async () => {
    const text = document.getElementById('diary-input')?.value?.trim();
    if (!text || text.length < 10) {
      alert('请输入至少10个字的日记内容');
      return;
    }
    showImportStatus('正在分析...');
    try {
      const { ApiClient } = await import('../../api.js');
      const client = ApiClient;
      client.subscribeMindGalaxyAnalyze({ text, source: 'notes' }, {
        onStatus: (stage) => {
          const stages = { preprocess: '预处理中...', 'basic-analyze': '基础分析中...', 'deep-analyze': 'AI深度分析中...', 'graph-build': '构建心智图谱...', 'galaxy-map': '生成星系...' };
          updateImportStatus(stages[stage] || stage);
        },
        onResult: () => location.reload()
      });
    } catch (e) {
      showImportStatus('分析失败，使用内置示例', true);
    }
  });

  // Example button: fills example text
  document.getElementById('btn-example')?.addEventListener('click', () => {
    const ta = document.getElementById('diary-input');
    if (ta) ta.value = '今天的工作很顺利，我完成了一个困扰已久的项目。虽然过程很辛苦，但看到成果的那一刻我感到无比满足。\n\n'
      + '晚上和朋友聊了聊最近的生活，她告诉我她要搬家了，我有点难过，但也为她感到高兴。\n\n'
      + '我开始思考自己真正想要的生活是什么样子。是继续留在现在的城市，还是去尝试新的可能？\n\n'
      + '最近睡眠不太好，总是焦虑未来。但我知道这些都是暂时的，一切都会好起来的。';
  });

  // Detail panel close
  document.getElementById('detail-close')?.addEventListener('click', () => {
    const panel = document.getElementById('right-panel');
    if (panel) panel.classList.add('collapsed');
    document.getElementById('detail-empty').style.display = 'block';
    document.getElementById('detail-content').style.display = 'none';
  });

  // Evolution timeline load button
  document.getElementById('btn-load-evolution')?.addEventListener('click', loadEvolutionTimeline);

  // Bottom panel toggle
  document.querySelector('#bottom-panel .bottom-toggle')?.addEventListener('click', () => {
    document.getElementById('bottom-panel')?.classList.toggle('collapsed');
  });

  // Social & Digital Twin panel toggles
  document.getElementById('btn-social')?.addEventListener('click', () => {
    document.getElementById('social-panel')?.classList.toggle('visible');
    // Hide others
    document.getElementById('digital-twin-panel')?.classList.remove('visible');
    document.getElementById('socratic-panel')?.classList.remove('visible');
  });
  
  // (Note: Digital Twin button is also handled by its own init function, but we can manage exclusive visibility here)
  document.getElementById('btn-digital-twin')?.addEventListener('click', () => {
    document.getElementById('social-panel')?.classList.remove('visible');
    document.getElementById('socratic-panel')?.classList.remove('visible');
  });
  
  document.getElementById('btn-socratic')?.addEventListener('click', () => {
    document.getElementById('social-panel')?.classList.remove('visible');
    document.getElementById('digital-twin-panel')?.classList.remove('visible');
    document.getElementById('socratic-panel')?.classList.toggle('visible');
  });

  // 实时分析预览
  const diaryInput = document.getElementById('diary-input');
  if (diaryInput) {
    diaryInput.addEventListener('input', () => {
      if (analyzerTimeout) clearTimeout(analyzerTimeout);
      analyzerTimeout = setTimeout(() => updateAnalyzerPreview(diaryInput.value), 300);
    });
  }

  initSettings();
}

// ── B8: 演化时间轴加载 ──

export async function loadEvolutionTimeline() {
  const markersEl = document.getElementById('evolution-markers');
  if (!markersEl) return;
  markersEl.innerHTML = '<span style="color:#888;font-size:0.75rem;">加载中...</span>';

  try {
    const { ApiClient } = await import('../../api.js');
    const client = ApiClient;
    const res = await client.request('/mind-galaxy/evolution', { headers: client.getHeaders() });
    if (!res?.success || !res.data?.snapshots) throw new Error('无演化数据');
    const { setSnapshots, replaceWithSnapshot } = await import('./index.js');
    setSnapshots(res.data.snapshots);
    if (res.data.snapshots.length > 0) {
      await replaceWithSnapshot(res.data.snapshots.length - 1, false);
    }
  } catch (e) {
    if (markersEl) markersEl.innerHTML = `<span style="color:#e57373;font-size:0.75rem;">加载失败: ${e.message}</span>`;
  }
}

// ── 时间控制 ─────────────────────────────────────────────

function initTimeControls() {
  const btnPlay = document.getElementById('btn-play');
  const slider = document.getElementById('time-slider');
  const speedBtns = document.querySelectorAll('.tc-speed-btn');

  if (btnPlay) {
    btnPlay.addEventListener('click', () => {
      timeState.playing = !timeState.playing;
      updatePlayBtn(btnPlay);
    });
  }

  if (slider) {
    slider.addEventListener('input', () => {
      if (timeState.playing) {
        timeState.playing = false;
        if (btnPlay) updatePlayBtn(btnPlay);
      }
      timeState.current = parseFloat(slider.value);
      updateTimeDisplay();
    });
  }

  speedBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      speedBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      timeState.speed = parseFloat(btn.dataset.speed);
    });
  });

  updateTimeDisplay();
}

function updatePlayBtn(btn) {
  if (timeState.playing) {
    btn.classList.remove('active');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    btn.querySelector('.ctrl-tooltip').textContent = '暂停';
  } else {
    btn.classList.add('active');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="6,4 20,12 6,20"/></svg>';
    btn.querySelector('.ctrl-tooltip').textContent = '播放';
  }
}

export function updateTimeDisplay() {
  const slider = document.getElementById('time-slider');
  const currentLabel = document.getElementById('tc-time-current');
  const totalLabel = document.getElementById('tc-time-total');
  if (slider) slider.value = timeState.current;
  if (currentLabel) currentLabel.textContent = (timeState.current / 100).toFixed(1) + 's';
  if (totalLabel) totalLabel.textContent = (timeState.max / 100).toFixed(1) + 's';
}

export function advanceTime(delta) {
  if (!timeState.playing) return;
  timeState.current += delta * timeState.speed * 100;
  if (timeState.current >= timeState.max) timeState.current = 0;
  updateTimeDisplay();
}

export function getNormalizedTime() {
  return timeState.max > 0 ? Math.min(1, timeState.current / timeState.max) : 0;
}

// ── 实时分析预览 ────────────────────────────────────────

const EMOTION_COLORS = {
  joy: '#FFD700', calm: '#87CEEB', satisfaction: '#98FB98', gratitude: '#FFA07A',
  hope: '#FF69B4', love: '#FF1493', pride: '#FFD700', interest: '#00CED1',
  surprise: '#FF6347', sadness: '#4169E1', anger: '#DC143C', anxiety: '#9370DB',
  fear: '#8B008B', shame: '#CD853F', guilt: '#A0522D', disgust: '#556B2F',
  loneliness: '#708090', jealousy: '#2E8B57', boredom: '#999999', awe: '#9400D3'
};

function updateAnalyzerPreview(text) {
  const preview = document.getElementById('analyzer-preview');
  const warningEl = document.getElementById('ap-warning');
  const keywordsEl = document.getElementById('ap-keywords');
  const emotionsEl = document.getElementById('ap-emotions');
  const charCountEl = document.getElementById('ap-char-count');

  if (!preview || !text || text.trim().length < 10) {
    if (preview) preview.classList.remove('visible');
    return;
  }

  const result = analyzePreview(text);
  preview.classList.add('visible');

  if (charCountEl) charCountEl.textContent = `${result.charCount} 字`;

  if (result.warning && warningEl) {
    warningEl.style.display = 'block';
    warningEl.textContent = result.warning;
  } else if (warningEl) {
    warningEl.style.display = 'none';
  }

  if (keywordsEl) {
    keywordsEl.innerHTML = result.keywords.slice(0, 10)
      .map(k => `<span class="ap-keyword">${k.word}</span>`).join('');
  }

  if (emotionsEl) {
    const topEmotions = result.emotions.slice(0, 8);
    emotionsEl.innerHTML = topEmotions.length > 0
      ? topEmotions.map(e => {
          const pct = Math.round(e.score * 100);
          const color = EMOTION_COLORS[e.name] || '#888';
          return `<div class="ap-emotion-row">
            <span class="ap-emotion-name">${e.name}</span>
            <div class="ap-emotion-bar-track">
              <div class="ap-emotion-bar-fill" style="width:${pct}%;background:${color}"></div>
            </div>
            <span class="ap-emotion-score">${pct}%</span>
          </div>`;
        }).join('')
      : '<div class="ap-emotion-row"><span class="ap-emotion-name" style="color:var(--text-muted)">暂未检测到情绪词</span></div>';
  }
}

function showImportStatus(msg, isError = false) {
  const el = document.getElementById('import-status');
  const text = document.getElementById('import-status-text');
  if (!el || !text) return;
  el.style.display = 'flex';
  text.textContent = msg;
  text.style.color = isError ? 'var(--danger)' : 'var(--text-secondary)';
}
function updateImportStatus(msg) {
  const el = document.getElementById('import-status');
  const text = document.getElementById('import-status-text');
  if (el) el.style.display = 'flex';
  if (text) text.textContent = msg;
}
function hideImportStatus() {
  const el = document.getElementById('import-status');
  if (el) el.style.display = 'none';
}

export function importSnapshotData() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', () => {
      const file = input.files[0];
      document.body.removeChild(input);

      if (!file) {
        reject(new Error('未选择文件'));
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        reject(new Error('文件大小超过 10MB 限制'));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data || typeof data !== 'object' || !data.nodes) {
            reject(new Error('无效的快照数据结构'));
            return;
          }
          resolve(data);
        } catch (e) {
          reject(new Error('JSON 解析失败: ' + e.message));
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });

    input.addEventListener('cancel', () => {
      document.body.removeChild(input);
      reject(new Error('用户取消'));
    });

    input.click();
  });
}

// ── 设置面板 ───────────────────────────────────────────────

function initSettings() {
  const settingsBtn = document.getElementById('btn-settings');
  if (!settingsBtn) return;

  settingsBtn.addEventListener('click', () => {
    const overlay = document.createElement('div');
    overlay.id = 'settings-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:999;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:#0f0f1e;border:1px solid #2a2a4a;border-radius:12px;width:560px;max-height:80vh;overflow-y:auto;color:#e0e0e0;">
        <div style="display:flex;border-bottom:1px solid #2a2a4a;">
          <button class="settings-tab active" data-panel="privacy">隐私控制</button>
          <button class="settings-tab" data-panel="hidden">隐藏列表</button>
          <button class="settings-tab" data-panel="person">人物管理</button>
          <button class="settings-tab" data-panel="mapping">映射规则</button>
          <button class="settings-tab" data-panel="poster">分享海报</button>
          <button class="settings-tab" data-panel="report">解读报告</button>
          <button class="settings-tab" data-panel="effects">高级滤镜</button>
        </div>
        <div id="settings-body" style="padding:20px;"></div>
        <div style="padding:0 20px 20px;text-align:right;">
          <button id="settings-close" style="padding:6px 20px;background:#333;border:none;color:#ccc;border-radius:6px;cursor:pointer;">关闭</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#settings-close').addEventListener('click', () => document.body.removeChild(overlay));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) document.body.removeChild(overlay); });

    const tabs = overlay.querySelectorAll('.settings-tab');
    tabs.forEach(t => {
      t.style.cssText = 'padding:10px 16px;background:none;border:none;color:#888;cursor:pointer;font-size:13px;border-bottom:2px solid transparent;transition:all 0.2s;';
      t.addEventListener('click', () => {
        tabs.forEach(tt => { tt.classList.remove('active'); tt.style.color = '#888'; tt.style.borderBottomColor = 'transparent'; });
        t.classList.add('active');
        t.style.color = '#4fc3f7';
        t.style.borderBottomColor = '#4fc3f7';
        switchPanel(t.dataset.panel);
      });
    });
    switchPanel('privacy');
  });
}

function switchPanel(name) {
  const body = document.getElementById('settings-body');
  if (!body) return;
  switch (name) {
    case 'privacy': renderPrivacyPanel(body); break;
    case 'hidden': renderHiddenPanel(body); break;
    case 'person': renderPersonPanel(body); break;
    case 'mapping': renderMappingPanel(body); break;
    case 'poster': renderPosterPanel(body); break;
    case 'report': renderReportPanel(body); break;
    case 'effects': renderEffectsPanel(body); break;
  }
}

// ── C29 + C30: 隐私面板 ──
function renderPrivacyPanel(body) {
  const localMode = JSON.parse(localStorage.getItem('mg_localMode') || 'false');
  const afterDelete = JSON.parse(localStorage.getItem('mg_afterDelete') || 'false');
  body.innerHTML = `
    <h4 style="margin:0 0 16px;color:#4fc3f7;">隐私控制</h4>
    <div style="margin-bottom:16px;">
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
        <input type="checkbox" id="toggle-local-mode" ${localMode ? 'checked' : ''} style="width:18px;height:18px;">
        <div><strong>本地分析模式</strong><br><small style="color:#888;">开启后，LLM 调用将被禁用，数据不会上传</small></div>
      </label>
    </div>
    <div style="margin-bottom:16px;">
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
        <input type="checkbox" id="toggle-after-delete" ${afterDelete ? 'checked' : ''} style="width:18px;height:18px;">
        <div><strong>分析后删除原始文本</strong><br><small style="color:#888;">开启后，每次分析完成自动删除原始数据，仅保留分析结果</small></div>
      </label>
    </div>
  `;
  body.querySelector('#toggle-local-mode').addEventListener('change', (e) => {
    localStorage.setItem('mg_localMode', JSON.stringify(e.target.checked));
  });
  body.querySelector('#toggle-after-delete').addEventListener('change', (e) => {
    localStorage.setItem('mg_afterDelete', JSON.stringify(e.target.checked));
  });
}

function renderEffectsPanel(body) {
  body.innerHTML = `
    <h4 style="margin:0 0 16px;color:#4fc3f7;">科幻级渲染滤镜 (Post-processing)</h4>
    <p style="font-size:0.8rem;color:#888;margin-bottom:16px;">调节高级视觉效果。开启多重滤镜可能会增加 GPU 负担。</p>
    
    <div class="pp-settings-group">
      <div class="pp-setting-item">
        <label><input type="checkbox" id="pp-bloom-enable" checked> 辉光 (Bloom)</label>
      </div>
      <div class="pp-setting-item">
        <span>强度</span><input type="range" id="pp-bloom-strength" class="pp-slider" min="0" max="3" step="0.1" value="1.5">
      </div>
    </div>

    <div class="pp-settings-group">
      <div class="pp-setting-item">
        <label><input type="checkbox" id="pp-dof-enable"> 景深 (Depth of Field)</label>
      </div>
      <div class="pp-setting-item">
        <span>焦距</span><input type="range" id="pp-dof-focus" class="pp-slider" min="10" max="1000" step="10" value="100">
      </div>
      <div class="pp-setting-item">
        <span>光圈</span><input type="range" id="pp-dof-aperture" class="pp-slider" min="0.001" max="0.1" step="0.001" value="0.01">
      </div>
    </div>

    <div class="pp-settings-group">
      <div class="pp-setting-item">
        <label><input type="checkbox" id="pp-film-enable"> 胶片颗粒 & 暗角 (Film Grain & Vignette)</label>
      </div>
    </div>
  `;

  // Update window variables that renderer.js can read
  if (!window.mgPostProcessing) {
    window.mgPostProcessing = {
      bloom: { enabled: true, strength: 1.5 },
      dof: { enabled: false, focus: 100, aperture: 0.01 },
      film: { enabled: false }
    };
  }

  const bindToggle = (id, cat) => {
    const el = body.querySelector('#' + id);
    if (!el) return;
    el.checked = window.mgPostProcessing[cat].enabled;
    el.addEventListener('change', e => {
      window.mgPostProcessing[cat].enabled = e.target.checked;
      window.dispatchEvent(new Event('mg-post-processing-change'));
    });
  };
  const bindSlider = (id, cat, prop) => {
    const el = body.querySelector('#' + id);
    if (!el) return;
    el.value = window.mgPostProcessing[cat][prop];
    el.addEventListener('input', e => {
      window.mgPostProcessing[cat][prop] = parseFloat(e.target.value);
      window.dispatchEvent(new Event('mg-post-processing-change'));
    });
  };

  bindToggle('pp-bloom-enable', 'bloom');
  bindSlider('pp-bloom-strength', 'bloom', 'strength');
  bindToggle('pp-dof-enable', 'dof');
  bindSlider('pp-dof-focus', 'dof', 'focus');
  bindSlider('pp-dof-aperture', 'dof', 'aperture');
  bindToggle('pp-film-enable', 'film');
}

// ── C33: 隐藏列表面板 ──
function renderHiddenPanel(body) {
  const hidden = JSON.parse(localStorage.getItem('mg_hidden') || '[]');
  body.innerHTML = `<h4 style="margin:0 0 16px;color:#4fc3f7;">隐藏的星体 (${hidden.length})</h4>`;
  if (hidden.length === 0) {
    body.innerHTML += '<p style="color:#888;">暂无隐藏星体</p>';
    return;
  }
  body.innerHTML += hidden.map(id => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #1a1a2e;">
      <span style="font-size:13px;color:#ccc;">${id}</span>
      <button class="restore-btn" data-id="${id}" style="padding:4px 12px;background:#2e7d32;border:none;color:#fff;border-radius:4px;cursor:pointer;">恢复</button>
    </div>
  `).join('');
  body.querySelectorAll('.restore-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const h = JSON.parse(localStorage.getItem('mg_hidden') || '[]');
      const idx = h.indexOf(id);
      if (idx >= 0) h.splice(idx, 1);
      localStorage.setItem('mg_hidden', JSON.stringify(h));
      body.closest('#settings-body') && renderHiddenPanel(body);
    });
  });
}

// ── C34: 人物管理面板 ──
async function renderPersonPanel(body) {
  body.innerHTML = `
    <h4 style="margin:0 0 16px;color:#4fc3f7;">人物管理</h4>
    <div id="person-list" style="margin-bottom:12px;"><p style="color:#888;">加载中...</p></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;">
      <div style="flex:1;min-width:160px;">
        <label style="font-size:12px;color:#888;">人物 A</label>
        <select id="merge-person-a" style="width:100%;padding:6px;background:#1a1a2e;border:1px solid #333;color:#ccc;border-radius:4px;margin-top:4px;"><option value="">选择...</option></select>
      </div>
      <div style="flex:1;min-width:160px;">
        <label style="font-size:12px;color:#888;">人物 B</label>
        <select id="merge-person-b" style="width:100%;padding:6px;background:#1a1a2e;border:1px solid #333;color:#ccc;border-radius:4px;margin-top:4px;"><option value="">选择...</option></select>
      </div>
      <div style="display:flex;align-items:flex-end;">
        <button id="btn-merge-persons" style="padding:6px 16px;background:#e65100;border:none;color:#fff;border-radius:4px;cursor:pointer;">合并 (A←B)</button>
      </div>
    </div>
  `;

  let persons = [];
  try {
    const { ApiClient } = await import('../../api.js');
    const client = ApiClient;
    const res = await client.request('/mind-galaxy/person/list', { headers: client.getHeaders() });
    if (res?.success) persons = res.data.persons || [];
  } catch {}

  const list = body.querySelector('#person-list');
  if (persons.length === 0) {
    list.innerHTML = '<p style="color:#888;">暂无人物实体</p>';
  } else {
    list.innerHTML = persons.map(p => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #1a1a2e;">
        <span style="font-size:13px;">${escapeHtml(p.name || p.id)}</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:12px;color:#888;">亲密度:</span>
          <input type="range" min="0" max="100" value="${Math.round((p.intimacy || 0) * 100)}" data-pid="${p.id || p.nodeId}" class="intimacy-slider" style="width:80px;">
          <span class="intimacy-val" style="font-size:12px;width:36px;">${Math.round((p.intimacy || 0) * 100)}%</span>
        </div>
      </div>
    `).join('');
  }

  const selectA = body.querySelector('#merge-person-a');
  const selectB = body.querySelector('#merge-person-b');
  persons.forEach(p => {
    const opt = `<option value="${p.id || p.nodeId}">${p.name || p.id}</option>`;
    selectA.innerHTML += opt;
    selectB.innerHTML += opt;
  });

  body.querySelector('#btn-merge-persons').addEventListener('click', async () => {
    const personIdA = selectA.value;
    const personIdB = selectB.value;
    if (!personIdA || !personIdB || personIdA === personIdB) {
      alert('请选择两个不同的人物'); return;
    }
    try {
      const { ApiClient } = await import('../../api.js');
      const client = ApiClient;
      const res = await client.request('/mind-galaxy/person/merge', {
        method: 'POST', body: JSON.stringify({ personIdA, personIdB }), headers: client.getHeaders()
      });
      if (res?.success) { renderPersonPanel(body); }
    } catch (e) { alert('合并失败: ' + e.message); }
  });

  body.querySelectorAll('.intimacy-slider').forEach(s => {
    s.addEventListener('change', async (e) => {
      const personId = e.target.dataset.pid;
      const intimacy = parseInt(e.target.value) / 100;
      const valEl = e.target.parentElement.querySelector('.intimacy-val');
      if (valEl) valEl.textContent = Math.round(intimacy * 100) + '%';
      try {
        const { ApiClient } = await import('../../api.js');
        const client = ApiClient;
        await client.request('/mind-galaxy/person/intimacy', {
          method: 'PUT', body: JSON.stringify({ personId, intimacy }), headers: client.getHeaders()
        });
      } catch {}
    });
  });
}

// ── C35: 映射规则面板 ──
function renderMappingPanel(body) {
  const rules = JSON.parse(localStorage.getItem('mg_mapping_rules') || JSON.stringify({
    nodeToBody: { theme: 'giant_star', person: 'planet_system', emotion: 'nebula', event: 'supernova' },
    colorScheme: {},
    spiralArms: 3,
    windingTightness: 0.5
  }));
  body.innerHTML = `
    <h4 style="margin:0 0 16px;color:#4fc3f7;">映射规则</h4>
    <div style="margin-bottom:12px;">
      <label style="font-size:12px;color:#888;">节点类型 → 天体类型</label>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">
      ${Object.entries(rules.nodeToBody).map(([nodeType, bodyType]) => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:#1a1a2e;border-radius:4px;">
          <span style="font-size:13px;">${nodeType}</span>
          <select class="mapping-select" data-node="${nodeType}" style="padding:4px;background:#0f0f1e;border:1px solid #333;color:#ccc;border-radius:4px;">
            ${['giant_star','dwarf_star','planet_system','nebula','black_hole','neutron_star','supernova','asteroid_belt','comet','galaxy_core'].map(t => `<option value="${t}" ${t === bodyType ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
      `).join('')}
    </div>
    <div style="margin-bottom:12px;">
      <label style="font-size:12px;color:#888;">旋臂数: <span id="arm-val">${rules.spiralArms}</span></label>
      <input type="range" id="spiral-arms" min="2" max="6" value="${rules.spiralArms}" style="width:100%;">
    </div>
    <div style="margin-bottom:12px;">
      <label style="font-size:12px;color:#888;">缠绕度: <span id="wind-val">${rules.windingTightness.toFixed(1)}</span></label>
      <input type="range" id="winding-tightness" min="0" max="100" value="${Math.round(rules.windingTightness * 100)}" style="width:100%;">
    </div>
    <button id="save-mapping" style="padding:6px 16px;background:#4fc3f7;border:none;color:#000;border-radius:4px;cursor:pointer;">保存规则</button>
    <button id="reset-mapping" style="padding:6px 16px;background:#555;border:none;color:#fff;border-radius:4px;cursor:pointer;margin-left:8px;">恢复默认</button>
  `;

  body.querySelector('#spiral-arms').addEventListener('input', (e) => {
    document.getElementById('arm-val').textContent = e.target.value;
  });
  body.querySelector('#winding-tightness').addEventListener('input', (e) => {
    document.getElementById('wind-val').textContent = (parseInt(e.target.value) / 100).toFixed(1);
  });
  body.querySelector('#save-mapping').addEventListener('click', () => {
    const nodeToBody = {};
    body.querySelectorAll('.mapping-select').forEach(s => { nodeToBody[s.dataset.node] = s.value; });
    const newRules = {
      nodeToBody,
      spiralArms: parseInt(body.querySelector('#spiral-arms').value),
      windingTightness: parseInt(body.querySelector('#winding-tightness').value) / 100
    };
    localStorage.setItem('mg_mapping_rules', JSON.stringify(newRules));
    alert('映射规则已保存，下次生成星系时生效');
  });
  body.querySelector('#reset-mapping').addEventListener('click', () => {
    localStorage.removeItem('mg_mapping_rules');
    renderMappingPanel(body);
  });
}

// ── C25: 分享海报面板 ──
function renderPosterPanel(body) {
  body.innerHTML = `
    <h4 style="margin:0 0 16px;color:#4fc3f7;">分享海报</h4>
    <p style="font-size:0.75rem;color:#888;margin-bottom:16px;">生成 1080×1080 PNG，适合微信/微博分享</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      <button class="poster-btn" data-type="poster" style="padding:14px;background:hsla(260,30%,20%,0.5);border:1px solid hsla(260,30%,40%,0.4);border-radius:8px;color:#e0e0e0;cursor:pointer;transition:all 0.2s;">
        <div style="font-size:1.5rem;margin-bottom:4px;">🌌</div>
        <div style="font-size:0.85rem;font-weight:600;">星系海报</div>
        <div style="font-size:0.65rem;color:#888;">全图 + 类型标注</div>
      </button>
      <button class="poster-btn" data-type="time" style="padding:14px;background:hsla(260,30%,20%,0.5);border:1px solid hsla(260,30%,40%,0.4);border-radius:8px;color:#e0e0e0;cursor:pointer;transition:all 0.2s;">
        <div style="font-size:1.5rem;margin-bottom:4px;">⏳</div>
        <div style="font-size:0.85rem;font-weight:600;">时间对比</div>
        <div style="font-size:0.65rem;color:#888;">早期 vs 现在</div>
      </button>
      <button class="poster-btn" data-type="belief" style="padding:14px;background:hsla(260,30%,20%,0.5);border:1px solid hsla(260,30%,40%,0.4);border-radius:8px;color:#e0e0e0;cursor:pointer;transition:all 0.2s;">
        <div style="font-size:1.5rem;margin-bottom:4px;">⭐</div>
        <div style="font-size:0.85rem;font-weight:600;">信念星图</div>
        <div style="font-size:0.65rem;color:#888;">TOP 10 信念</div>
      </button>
      <button class="poster-btn" data-type="emotion" style="padding:14px;background:hsla(260,30%,20%,0.5);border:1px solid hsla(260,30%,40%,0.4);border-radius:8px;color:#e0e0e0;cursor:pointer;transition:all 0.2s;">
        <div style="font-size:1.5rem;margin-bottom:4px;">🎭</div>
        <div style="font-size:0.85rem;font-weight:600;">情绪光谱</div>
        <div style="font-size:0.65rem;color:#888;">情绪分布环图</div>
      </button>
    </div>
  `;

  body.querySelectorAll('.poster-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const type = btn.dataset.type;
      const { renderShareTemplate } = await import('./exporter.js');
      const renderer = window.__mgRenderer || null;
      const snapshotData = window.__mgSnapshot || {};
      renderShareTemplate(type, renderer, snapshotData);
    });
  });
}

// ── C26: 报告解读面板 ──
async function renderReportPanel(body) {
  body.innerHTML = '<p style="color:#888;">加载报告中...</p>';

  try {
    const { ApiClient } = await import('../../api.js');
    const client = ApiClient;
    const snapshotRes = await client.request('/mind-galaxy/snapshot', { headers: client.getHeaders() });
    if (!snapshotRes?.success || !snapshotRes.data?.id) {
      body.innerHTML = '<p style="color:#e57373;">暂无星系快照，请先生成星系</p>';
      return;
    }

    const reportRes = await client.request(`/mind-galaxy/report/${snapshotRes.data.id}`, { headers: client.getHeaders() });
    if (!reportRes?.success) {
      body.innerHTML = '<p style="color:#e57373;">报告生成失败</p>';
      return;
    }

    const report = reportRes.data;
    let html = '<h4 style="margin:0 0 12px;color:#4fc3f7;">解读报告</h4>';
    html += `<div style="margin-bottom:12px;font-size:0.8rem;color:#aaa;">哈勃类型: ${report.hubbleType || 'S'} · 天体数量: ${report.starCount || 0}</div>`;

    const beliefs = report.coreBeliefs || [];
    if (beliefs.length > 0) {
      html += '<div style="margin-bottom:10px;font-size:0.8rem;font-weight:600;color:#ccc;">核心信念</div>';
      beliefs.forEach(b => {
        html += `<div style="padding:8px 12px;background:#1a1a2e;border-radius:6px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:0.85rem;color:#e0e0e0;">${escapeHtml(b.label || '-')}</span>
            <span style="font-size:0.7rem;color:${b.polarity === 'pos' ? '#4fc3f7' : '#ef5350'};">${b.polarity === 'pos' ? '⊕' : '⊖'} ${Math.round((b.strength || 0) * 100)}%</span>
          </div>`;
        if (b.sourceRef?.length > 0) {
          const ref = b.sourceRef[0];
          html += `<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">
            ${ref.galaxyUrl ? `<a href="${ref.galaxyUrl}" target="_top" style="font-size:0.65rem;color:#4fc3f7;text-decoration:none;padding:2px 8px;border:1px solid #4fc3f7;border-radius:10px;">定位到星系</a>` : ''}
            ${ref.excerpt ? `<button class="view-diary-btn" data-excerpt="${escapeHtml(ref.excerpt)}" style="font-size:0.65rem;color:#ccc;background:none;border:1px solid #555;border-radius:10px;padding:2px 8px;cursor:pointer;">查看日记</button>` : ''}
            <button class="check-belief-btn" data-belief="${escapeHtml(b.label || '')}" style="font-size:0.65rem;color:#8f8;background:none;border:1px solid hsla(120,40%,40%,0.5);border-radius:10px;padding:2px 8px;cursor:pointer;">检验信念</button>
          </div>`;
        } else {
          html += `<div style="margin-top:6px;">
            <button class="check-belief-btn" data-belief="${escapeHtml(b.label || '')}" style="font-size:0.65rem;color:#8f8;background:none;border:1px solid hsla(120,40%,40%,0.5);border-radius:10px;padding:2px 8px;cursor:pointer;">检验信念</button>
          </div>`;
        }
        html += '<div class="belief-check-result" style="display:none;"></div>';
        html += '</div>';
      });
    }

    const persons = report.relationshipGalaxy?.topPersons || [];
    if (persons.length > 0) {
      html += '<div style="margin-top:12px;margin-bottom:10px;font-size:0.8rem;font-weight:600;color:#ccc;">关系人物</div>';
      persons.forEach(p => {
        html += `<div style="padding:8px 12px;background:#1a1a2e;border-radius:6px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:0.85rem;color:#e0e0e0;">${p.polarity > 0 ? '⊕' : '⊖'} ${escapeHtml(p.name || '-')}</span>
            <span style="font-size:0.7rem;color:#888;">亲密度 ${Math.round((p.intimacy || 0) * 100)}%</span>
          </div>`;
        if (p.sourceRef?.galaxyUrl) {
          html += `<div style="margin-top:4px;">
            <a href="${p.sourceRef.galaxyUrl}" target="_top" style="font-size:0.65rem;color:#4fc3f7;text-decoration:none;padding:2px 8px;border:1px solid #4fc3f7;border-radius:10px;">定位到星系</a>
          </div>`;
        }
        html += '</div>';
      });
    }

    body.innerHTML = html;

    body.querySelectorAll('.view-diary-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const excerpt = btn.dataset.excerpt;
        showDiaryModal(excerpt);
      });
    });

    body.querySelectorAll('.check-belief-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const belief = btn.dataset.belief;
        if (!belief) return;
        const resultDiv = btn.closest('div')?.parentElement?.querySelector('.belief-check-result');
        if (resultDiv) resultDiv.style.display = 'block';
        btn.disabled = true;
        btn.textContent = '检验中...';
        try {
          const { ApiClient } = await import('../../api.js');
          const client = ApiClient;
          const res = await client.request('/mind-galaxy/belief-check', {
            method: 'POST',
            body: JSON.stringify({ beliefText: belief }),
            headers: client.getHeaders()
          });
          if (res?.success && res.data) {
            const d = res.data;
            const riskColor = d.risk === 'high' ? '#ef5350' : d.risk === 'medium' ? '#ff9800' : '#8f8';
            const riskLabel = d.risk === 'high' ? '高风险' : d.risk === 'medium' ? '中等' : '低风险';
            if (resultDiv) {
              resultDiv.innerHTML = `
                <div style="margin-top:6px;padding:8px;background:hsla(240,15%,10%,0.6);border-radius:6px;font-size:0.75rem;">
                  <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                    <span style="color:#aaa;">风险等级</span>
                    <span style="color:${riskColor};font-weight:600;">${riskLabel}</span>
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:6px;">
                    <span style="color:#888;">证据强度</span><span style="color:#ddd;text-align:right;">${Math.round((d.scores?.evidenceStrength || 0) * 100)}%</span>
                    <span style="color:#888;">逻辑自洽</span><span style="color:#ddd;text-align:right;">${Math.round((d.scores?.logicalConsistency || 0) * 100)}%</span>
                    <span style="color:#888;">反例容纳</span><span style="color:#ddd;text-align:right;">${Math.round((d.scores?.counterexampleTolerance || 0) * 100)}%</span>
                    <span style="color:#888;">情绪负荷</span><span style="color:#ddd;text-align:right;">${Math.round((d.scores?.emotionalLoad || 0) * 100)}%</span>
                    <span style="color:#888;">行为影响</span><span style="color:#ddd;text-align:right;">${Math.round((d.scores?.behavioralConsequence || 0) * 100)}%</span>
                  </div>
                  ${d.alternatives?.length ? `<div style="color:#8f8;font-size:0.7rem;">替代视角：${d.alternatives.join('；')}</div>` : ''}
                </div>`;
              resultDiv.style.display = 'block';
            }
          }
        } catch {
          if (resultDiv) {
            resultDiv.innerHTML = '<div style="color:#f88;font-size:0.75rem;">检验失败</div>';
            resultDiv.style.display = 'block';
          }
        }
        btn.disabled = false;
        btn.textContent = '检验信念';
      });
    });
  } catch (e) {
    body.innerHTML = `<p style="color:#e57373;">加载失败: ${e.message}</p>`;
  }
}

function showDiaryModal(text) {
  let modal = document.getElementById('diary-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'diary-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:2000;display:flex;align-items:center;justify-content:center;';
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div style="background:#0f0f1e;border:1px solid #2a2a4a;border-radius:12px;max-width:500px;width:90%;max-height:70vh;overflow-y:auto;padding:24px;color:#e0e0e0;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h4 style="margin:0;color:#4fc3f7;font-size:0.9rem;">原始日记</h4>
        <button id="diary-modal-close" style="background:none;border:none;color:#888;font-size:1.2rem;cursor:pointer;">&times;</button>
      </div>
      <div style="font-size:0.85rem;line-height:1.8;color:#ccc;white-space:pre-wrap;">${text}</div>
    </div>
  `;
  modal.querySelector('#diary-modal-close').addEventListener('click', () => modal.remove());
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export { initSettings };
