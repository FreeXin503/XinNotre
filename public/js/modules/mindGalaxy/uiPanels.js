/**
 * 心智星系 v2 · UI 面板
 * 职责：数据导入按钮、详情面板、手动分析
 */
import { mountMindGalaxy } from './index.js';

let leftCollapsed = false;

export function initUI() {
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
          // Reload to show imported data
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
