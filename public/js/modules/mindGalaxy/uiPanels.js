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
        const client = new ApiClient();
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
      const client = new ApiClient();
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

  // Bottom panel toggle
  document.querySelector('#bottom-panel .bottom-toggle')?.addEventListener('click', () => {
    document.getElementById('bottom-panel')?.classList.toggle('collapsed');
  });

  // 实时分析预览
  const diaryInput = document.getElementById('diary-input');
  if (diaryInput) {
    diaryInput.addEventListener('input', () => {
      if (analyzerTimeout) clearTimeout(analyzerTimeout);
      analyzerTimeout = setTimeout(() => updateAnalyzerPreview(diaryInput.value), 300);
    });
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
