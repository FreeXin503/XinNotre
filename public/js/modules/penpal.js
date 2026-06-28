let _abortCtrl = null;
let _currentContainer = null;
let _activeThreadId = null;

export function mountPenpal(container) {
  _abortCtrl = new AbortController();
  _currentContainer = container;
  renderMainView();
  loadThreads();
}

export function unmountPenpal() {
  if (_abortCtrl) { _abortCtrl.abort(); _abortCtrl = null; }
  _currentContainer = null;
  _activeThreadId = null;
  delete window.createPenpalThread;
  delete window.sendPenpalMessage;
}

function renderMainView() {
  _currentContainer.innerHTML = `
    <div class="archaeology-container" style="max-width:960px;margin:0 auto;padding:20px 0;">
      <div class="archaeology-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <div>
          <h2 style="margin:0;font-size:20px;font-weight:600;">✉️ 跨时空笔友</h2>
          <p style="margin:4px 0 0;font-size:13px;color:var(--text-muted);">与过去某个时间段的自己写信对话</p>
        </div>
        <button onclick="createPenpalThread()" class="persona-generate-btn" style="padding:8px 20px;border:none;border-radius:8px;background:var(--accent);color:#fff;cursor:pointer;font-size:14px;">+ 创建笔友线程</button>
      </div>
      <div id="penpal-layout" style="display:flex;gap:20px;min-height:400px;">
        <div id="penpal-sidebar" style="width:280px;flex-shrink:0;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--surface);">
          <div style="padding:12px 16px;font-size:13px;font-weight:600;border-bottom:1px solid var(--border);color:var(--text-muted);">我的笔友线程</div>
          <div id="penpal-thread-list" style="padding:8px;"></div>
        </div>
        <div id="penpal-messages" style="flex:1;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--surface);display:flex;flex-direction:column;">
          <div id="penpal-messages-header" style="padding:12px 16px;font-size:13px;font-weight:600;border-bottom:1px solid var(--border);color:var(--text-muted);">选择一个线程开始对话</div>
          <div id="penpal-messages-body" style="flex:1;padding:16px;overflow-y:auto;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:13px;">
            左侧选择一个笔友线程
          </div>
          <div id="penpal-input-area" style="display:none;padding:12px 16px;border-top:1px solid var(--border);">
            <div style="display:flex;gap:8px;">
              <input id="penpal-msg-input" type="text" placeholder="给过去的自己写封信…" style="flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;outline:none;">
              <button onclick="sendPenpalMessage()" style="padding:8px 20px;border:none;border-radius:8px;background:var(--accent);color:#fff;cursor:pointer;font-size:14px;">发送</button>
            </div>
          </div>
        </div>
      </div>
      <div id="penpal-create-modal" style="display:none;"></div>
    </div>
  `;
}

async function loadThreads() {
  const listEl = document.getElementById('penpal-thread-list');
  if (!listEl) return;
  try {
    const res = await ApiClient.listPenpalThreads();
    const threads = res?.data?.threads || [];
    if (threads.length === 0) {
      listEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px;">暂无笔友线程<br><span style="font-size:12px;">点击上方按钮创建</span></div>';
      return;
    }
    listEl.innerHTML = threads.map(t => `
      <div class="penpal-thread-item" data-id="${t.id}" style="padding:10px 12px;border-radius:8px;cursor:pointer;margin-bottom:4px;transition:background .15s;" onmouseover="this.style.background='var(--hover)'" onmouseout="this.style.background=''" onclick="openPenpalThread(${t.id})">
        <div style="font-size:14px;font-weight:500;">${t.personaLabel || '未命名线程'}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${t.letterCount || 0} 封信 · ${t.windowStart || ''} ~ ${t.windowEnd || ''}</div>
      </div>
    `).join('');
  } catch (err) {
    listEl.innerHTML = '<div style="padding:24px;text-align:center;color:#ea4335;font-size:13px;">加载失败</div>';
  }
}

window.createPenpalThread = function() {
  const modal = document.getElementById('penpal-create-modal');
  if (!modal) return;
  modal.style.display = 'block';
  modal.innerHTML = `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1000;" onclick="if(event.target===this)document.getElementById('penpal-create-modal').style.display='none'">
      <div style="background:var(--surface);border-radius:16px;padding:28px 32px;width:420px;max-width:90vw;">
        <h3 style="margin:0 0 20px;font-size:18px;">创建笔友线程</h3>
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:13px;margin-bottom:4px;color:var(--text-muted);">对方称呼（如"2021年的我"）</label>
          <input id="penpal-label-input" type="text" placeholder="2021年的我" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;outline:none;box-sizing:border-box;">
        </div>
        <div style="margin-bottom:14px;display:flex;gap:12px;">
          <div style="flex:1;">
            <label style="display:block;font-size:13px;margin-bottom:4px;color:var(--text-muted);">开始日期</label>
            <input id="penpal-start-input" type="date" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;outline:none;box-sizing:border-box;">
          </div>
          <div style="flex:1;">
            <label style="display:block;font-size:13px;margin-bottom:4px;color:var(--text-muted);">结束日期</label>
            <input id="penpal-end-input" type="date" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;outline:none;box-sizing:border-box;">
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button onclick="document.getElementById('penpal-create-modal').style.display='none'" style="padding:8px 20px;border:1px solid var(--border);border-radius:8px;background:transparent;color:var(--text);cursor:pointer;font-size:14px;">取消</button>
          <button id="penpal-create-btn" onclick="doCreatePenpalThread()" style="padding:8px 20px;border:none;border-radius:8px;background:var(--accent);color:#fff;cursor:pointer;font-size:14px;">创建</button>
        </div>
      </div>
    </div>
  `;
};

window.doCreatePenpalThread = async function() {
  const btn = document.getElementById('penpal-create-btn');
  if (btn) { btn.disabled = true; btn.textContent = '创建中…'; }
  try {
    const personaLabel = document.getElementById('penpal-label-input')?.value?.trim();
    const windowStart = document.getElementById('penpal-start-input')?.value;
    const windowEnd = document.getElementById('penpal-end-input')?.value;
    if (!personaLabel || !windowStart || !windowEnd) { alert('请填写完整信息'); return; }
    await ApiClient.createPenpalThread({ personaLabel, windowStart, windowEnd });
    document.getElementById('penpal-create-modal').style.display = 'none';
    loadThreads();
  } catch (err) {
    alert('创建失败: ' + (err.message || '未知错误'));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '创建'; }
  }
};

window.openPenpalThread = async function(threadId) {
  _activeThreadId = threadId;
  const header = document.getElementById('penpal-messages-header');
  const body = document.getElementById('penpal-messages-body');
  const inputArea = document.getElementById('penpal-input-area');
  if (!body) return;
  body.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">加载中…</div>';
  try {
    const res = await ApiClient.getPenpalLetters(threadId);
    const letters = res?.data?.letters || [];
    if (header) header.textContent = '笔友来信';
    if (inputArea) inputArea.style.display = 'flex';
    renderMessages(letters);
  } catch (err) {
    body.innerHTML = '<div style="color:#ea4335;font-size:13px;">加载失败</div>';
  }
};

function renderMessages(letters) {
  const body = document.getElementById('penpal-messages-body');
  if (!body) return;
  if (!letters || letters.length === 0) {
    body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:13px;">发送第一封信吧</div>';
    return;
  }
  body.innerHTML = letters.map(l => `
    <div style="margin-bottom:12px;display:flex;flex-direction:${l.role === 'user' ? 'row-reverse' : 'row'};">
      <div style="max-width:70%;padding:10px 14px;border-radius:12px;${l.role === 'user' ? 'background:var(--accent);color:#fff;border-bottom-right-radius:4px;' : 'background:var(--hover);border-bottom-left-radius:4px;'}">
        <div style="font-size:11px;margin-bottom:4px;opacity:.7;">${l.role === 'user' ? '我' : '过去的自己'}</div>
        <div style="font-size:14px;line-height:1.5;white-space:pre-wrap;">${l.content}</div>
        ${l.truncated ? '<div style="font-size:11px;margin-top:4px;opacity:.5;">[内容截断]</div>' : ''}
      </div>
    </div>
  `).join('');
  body.scrollTop = body.scrollHeight;
}

window.sendPenpalMessage = function() {
  if (!_activeThreadId) return;
  const input = document.getElementById('penpal-msg-input');
  if (!input || !input.value.trim()) return;
  const text = input.value.trim();
  input.value = '';
  const body = document.getElementById('penpal-messages-body');
  if (body) {
    body.innerHTML += `
      <div style="margin-bottom:12px;display:flex;flex-direction:row-reverse;">
        <div style="max-width:70%;padding:10px 14px;border-radius:12px;background:var(--accent);color:#fff;border-bottom-right-radius:4px;">
          <div style="font-size:11px;margin-bottom:4px;opacity:.7;">我</div>
          <div style="font-size:14px;line-height:1.5;white-space:pre-wrap;">${text}</div>
        </div>
      </div>
    `;
    body.innerHTML += '<div id="penpal-streaming" style="margin-bottom:12px;display:flex;"><div style="max-width:70%;padding:10px 14px;border-radius:12px;background:var(--hover);border-bottom-left-radius:4px;"><div style="font-size:11px;margin-bottom:4px;opacity:.7;">过去的自己</div><div id="penpal-stream-text" style="font-size:14px;line-height:1.5;"></div></div></div>';
    body.scrollTop = body.scrollHeight;
  }
  ApiClient.subscribePenpalMessage(_activeThreadId, { message: text }, {
    signal: _abortCtrl?.signal,
    onChunk: ({ t }) => {
      const el = document.getElementById('penpal-stream-text');
      if (el) el.textContent += t || '';
    },
    onDone: () => {
      const el = document.getElementById('penpal-streaming');
      if (el) el.id = 'penpal-stream-done';
      loadThreads();
    },
    onError: ({ message }) => {
      const el = document.getElementById('penpal-streaming');
      if (el) el.innerHTML = '<div style="color:#ea4335;font-size:13px;">回复失败: ' + (message || '') + '</div>';
    }
  });
};
