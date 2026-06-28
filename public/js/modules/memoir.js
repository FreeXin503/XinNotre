let _abortCtrl = null;
let _currentContainer = null;

export function mountMemoir(container) {
  _abortCtrl = new AbortController();
  _currentContainer = container;
  renderMainView();
  loadMemoirs();
}

export function unmountMemoir() {
  if (_abortCtrl) { _abortCtrl.abort(); _abortCtrl = null; }
  _currentContainer = null;
  delete window.showGenerateMemoir;
  delete window.doGenerateMemoir;
  delete window.viewMemoirDetail;
  delete window.publishMemoir;
}

function renderMainView() {
  _currentContainer.innerHTML = `
    <div class="archaeology-container" style="max-width:960px;margin:0 auto;padding:20px 0;">
      <div class="archaeology-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <div>
          <h2 style="margin:0;font-size:20px;font-weight:600;">📖 主题回忆录</h2>
          <p style="margin:4px 0 0;font-size:13px;color:var(--text-muted);">AI 基于你的便签自动生成主题回忆录</p>
        </div>
        <button onclick="showGenerateMemoir()" class="persona-generate-btn" style="padding:8px 20px;border:none;border-radius:8px;background:var(--accent);color:#fff;cursor:pointer;font-size:14px;">✨ 生成回忆录</button>
      </div>
      <div style="display:flex;gap:20px;">
        <div id="memoir-list" style="width:320px;flex-shrink:0;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--surface);">
          <div style="padding:12px 16px;font-size:13px;font-weight:600;border-bottom:1px solid var(--border);color:var(--text-muted);">我的回忆录</div>
          <div id="memoir-list-body" style="padding:8px;min-height:200px;">
            <div style="padding:40px;text-align:center;color:var(--text-muted);font-size:13px;">加载中…</div>
          </div>
        </div>
        <div id="memoir-detail" style="flex:1;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--surface);display:flex;flex-direction:column;">
          <div id="memoir-detail-header" style="padding:12px 16px;font-size:13px;font-weight:600;border-bottom:1px solid var(--border);color:var(--text-muted);">回忆录详情</div>
          <div id="memoir-detail-body" style="flex:1;padding:24px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:13px;">
            选择一篇回忆录查看
          </div>
        </div>
      </div>
      <div id="memoir-generate-modal" style="display:none;"></div>
    </div>
  `;
}

async function loadMemoirs() {
  const body = document.getElementById('memoir-list-body');
  if (!body) return;
  try {
    const res = await ApiClient.listMemoirs();
    const memoirs = res?.data?.memoirs || [];
    if (memoirs.length === 0) {
      body.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);font-size:13px;">还没有回忆录<br><span style="font-size:12px;">点击右上角生成</span></div>';
      return;
    }
    body.innerHTML = memoirs.map(m => {
      const statusMap = { draft: '📝 草稿', generated: '✅ 已完成', published: '📖 已发布' };
      return `<div class="memoir-item" data-id="${m.id}" style="padding:12px;border-radius:8px;cursor:pointer;margin-bottom:4px;transition:background .15s;" onmouseover="this.style.background='var(--hover)'" onmouseout="this.style.background=''" onclick="viewMemoirDetail(${m.id})">
        <div style="font-size:14px;font-weight:500;">${m.theme || '未命名'}</div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-top:4px;">
          <span>${statusMap[m.status] || m.status}</span>
          <span>${m.chapterCount || 0} 章</span>
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${new Date(m.createdAt).toLocaleDateString()}</div>
      </div>`;
    }).join('');
  } catch (err) {
    body.innerHTML = '<div style="padding:40px;text-align:center;color:#ea4335;font-size:13px;">加载失败</div>';
  }
}

window.showGenerateMemoir = function() {
  const modal = document.getElementById('memoir-generate-modal');
  if (!modal) return;
  modal.style.display = 'block';
  modal.innerHTML = `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1000;" onclick="if(event.target===this)document.getElementById('memoir-generate-modal').style.display='none'">
      <div style="background:var(--surface);border-radius:16px;padding:28px 32px;width:420px;max-width:90vw;">
        <h3 style="margin:0 0 20px;font-size:18px;">生成主题回忆录</h3>
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:13px;margin-bottom:4px;color:var(--text-muted);">主题</label>
          <input id="memoir-theme-input" type="text" placeholder="如：我的成长之路、2024年度回忆…" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;outline:none;box-sizing:border-box;">
        </div>
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:13px;margin-bottom:4px;color:var(--text-muted);">章节数: <span id="memoir-chapter-count">5</span></label>
          <input id="memoir-chapters-input" type="range" min="1" max="12" value="5" style="width:100%;" oninput="document.getElementById('memoir-chapter-count').textContent=this.value">
        </div>
        <div id="memoir-generate-stream" style="display:none;margin-bottom:14px;padding:12px;background:var(--bg);border-radius:8px;max-height:200px;overflow-y:auto;font-size:13px;line-height:1.5;white-space:pre-wrap;"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button onclick="document.getElementById('memoir-generate-modal').style.display='none'" style="padding:8px 20px;border:1px solid var(--border);border-radius:8px;background:transparent;color:var(--text);cursor:pointer;font-size:14px;">取消</button>
          <button id="memoir-generate-btn" onclick="doGenerateMemoir()" style="padding:8px 20px;border:none;border-radius:8px;background:var(--accent);color:#fff;cursor:pointer;font-size:14px;">开始生成</button>
        </div>
      </div>
    </div>
  `;
};

window.doGenerateMemoir = async function() {
  const theme = document.getElementById('memoir-theme-input')?.value?.trim();
  const chapters = parseInt(document.getElementById('memoir-chapters-input')?.value || '5');
  const btn = document.getElementById('memoir-generate-btn');
  const stream = document.getElementById('memoir-generate-stream');
  if (!theme) { alert('请输入主题'); return; }
  if (btn) { btn.disabled = true; btn.textContent = '生成中…'; }
  if (stream) { stream.style.display = 'block'; stream.textContent = ''; }
  try {
    ApiClient.subscribeGenerateMemoir({ theme, chapters }, {
      signal: _abortCtrl?.signal,
      onChunk: ({ t }) => {
        if (stream) stream.textContent += t || '';
      },
      onDone: ({ memoirId, chapters: ch }) => {
        if (stream) stream.textContent += '\n\n✅ 回忆录生成完成！(' + (ch || '?') + ' 章)';
        if (btn) { btn.disabled = false; btn.textContent = '开始生成'; }
        loadMemoirs();
        setTimeout(() => {
          const modal = document.getElementById('memoir-generate-modal');
          if (modal) modal.style.display = 'none';
        }, 1500);
      },
      onError: ({ message }) => {
        if (stream) stream.textContent += '\n❌ 生成失败: ' + (message || '');
        if (btn) { btn.disabled = false; btn.textContent = '开始生成'; }
      }
    });
  } catch (err) {
    if (stream) stream.textContent += '\n❌ 生成失败: ' + (err.message || '');
    if (btn) { btn.disabled = false; btn.textContent = '开始生成'; }
  }
};

window.viewMemoirDetail = async function(id) {
  const body = document.getElementById('memoir-detail-body');
  const header = document.getElementById('memoir-detail-header');
  if (!body) return;
  body.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">加载中…</div>';
  try {
    const res = await ApiClient.getMemoirExport(id);
    const memoir = res?.data?.memoir;
    const chapters = res?.data?.chapters || [];
    if (!memoir) { body.innerHTML = '<div style="color:#ea4335;font-size:13px;">回忆录不存在</div>'; return; }
    if (header) header.innerHTML = memoir.theme + ' <span style="font-weight:400;font-size:12px;color:var(--text-muted);">· ' + (chapters.length || 0) + ' 章</span>';
    const statusMap = { draft: '📝 草稿', generated: '✅ 已完成', published: '📖 已发布' };
    body.innerHTML = `
      <div style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
          <span style="font-size:13px;color:var(--text-muted);">状态: ${statusMap[memoir.status] || memoir.status}</span>
          ${memoir.status === 'generated' ? '<button class="persona-generate-btn" onclick="publishMemoir(' + memoir.id + ')" style="padding:6px 16px;border:none;border-radius:8px;background:var(--accent);color:#fff;cursor:pointer;font-size:13px;">📚 发布</button>' : ''}
          ${memoir.status === 'draft' ? '<span style="font-size:12px;color:var(--text-muted);">生成中…</span>' : ''}
        </div>
      </div>
      <div id="memoir-chapters"></div>
    `;
    const chEl = document.getElementById('memoir-chapters');
    if (chEl && chapters.length > 0) {
      chEl.innerHTML = chapters.map((ch, i) => `
        <div style="margin-bottom:16px;padding:16px;background:var(--bg);border-radius:12px;">
          <div style="font-size:14px;font-weight:600;margin-bottom:8px;">第${i+1}章 · ${ch.title || '无标题'}</div>
          <div style="font-size:13px;line-height:1.6;white-space:pre-wrap;color:var(--text);">${ch.content || '（内容为空）'}</div>
          ${ch.citations && ch.citations.length > 0 ? '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-size:11px;color:var(--text-muted);">📎 引用 ' + ch.citations.length + ' 条便签</div>' : ''}
        </div>
      `).join('');
    }
  } catch (err) {
    body.innerHTML = '<div style="color:#ea4335;font-size:13px;">加载失败</div>';
  }
};

window.publishMemoir = async function(id) {
  try {
    await ApiClient.publishMemoir(id);
    loadMemoirs();
    viewMemoirDetail(id);
  } catch (err) {
    alert('发布失败: ' + (err.message || ''));
  }
};
