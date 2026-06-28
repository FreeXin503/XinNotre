let _abortCtrl = null;
let _currentContainer = null;

export function mountLetter(container) {
  _abortCtrl = new AbortController();
  _currentContainer = container;
  renderMainView();
  loadLetters();
}

export function unmountLetter() {
  if (_abortCtrl) { _abortCtrl.abort(); _abortCtrl = null; }
  _currentContainer = null;
  delete window.showCreateLetter;
  delete window.doCreateLetter;
  delete window.openSealedLetter;
}

function renderMainView() {
  _currentContainer.innerHTML = `
    <div class="archaeology-container" style="max-width:960px;margin:0 auto;padding:20px 0;">
      <div class="archaeology-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <div>
          <h2 style="margin:0;font-size:20px;font-weight:600;">📮 时光胶囊</h2>
          <p style="margin:4px 0 0;font-size:13px;color:var(--text-muted);">给未来的自己写信，在特定的时刻开启</p>
        </div>
        <button onclick="showCreateLetter()" class="persona-generate-btn" style="padding:8px 20px;border:none;border-radius:8px;background:var(--accent);color:#fff;cursor:pointer;font-size:14px;">✍️ 写封信</button>
      </div>
      <div style="display:flex;gap:20px;">
        <div id="letter-list" style="flex:1;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--surface);">
          <div style="padding:12px 16px;font-size:13px;font-weight:600;border-bottom:1px solid var(--border);color:var(--text-muted);">我的信件</div>
          <div id="letter-list-body" style="padding:8px;">
            <div style="padding:40px;text-align:center;color:var(--text-muted);font-size:13px;">加载中…</div>
          </div>
        </div>
        <div id="letter-detail" style="flex:1;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--surface);display:flex;flex-direction:column;">
          <div style="padding:12px 16px;font-size:13px;font-weight:600;border-bottom:1px solid var(--border);color:var(--text-muted);">信件详情</div>
          <div id="letter-detail-body" style="flex:1;padding:24px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:13px;">
            选择一封信件查看
          </div>
        </div>
      </div>
      <div id="letter-create-modal" style="display:none;"></div>
    </div>
  `;
}

async function loadLetters() {
  const body = document.getElementById('letter-list-body');
  if (!body) return;
  try {
    const res = await ApiClient.listLetters();
    const letters = res?.data?.letters || [];
    if (letters.length === 0) {
      body.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);font-size:13px;">还没有信件<br><span style="font-size:12px;">点击右上角写封信吧</span></div>';
      return;
    }
    body.innerHTML = letters.map(l => {
      const isDelivered = !!l.deliveredAt;
      return `<div class="letter-item" data-id="${l.id}" style="padding:12px;border-radius:8px;cursor:pointer;margin-bottom:4px;transition:background .15s;${isDelivered ? '' : 'opacity:.6;'}" onmouseover="this.style.background='var(--hover)'" onmouseout="this.style.background=''" onclick="openSealedLetter(${l.id})">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:20px;">${l.waxSealEmoji || '📮'}</span>
          <div>
            <div style="font-size:14px;font-weight:500;">${l.title || '无标题'}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">
              ${isDelivered ? '📬 已开启 · ' + new Date(l.deliveredAt).toLocaleDateString() : '🔒 封印中 · ' + l.triggerType}
              · ${new Date(l.sealedAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>`;
    }).join('');
  } catch (err) {
    body.innerHTML = '<div style="padding:40px;text-align:center;color:#ea4335;font-size:13px;">加载失败</div>';
  }
}

window.showCreateLetter = function() {
  const modal = document.getElementById('letter-create-modal');
  if (!modal) return;
  modal.style.display = 'block';
  modal.innerHTML = `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1000;" onclick="if(event.target===this)document.getElementById('letter-create-modal').style.display='none'">
      <div style="background:var(--surface);border-radius:16px;padding:28px 32px;width:480px;max-width:90vw;">
        <h3 style="margin:0 0 20px;font-size:18px;">写一封时光信</h3>
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:13px;margin-bottom:4px;color:var(--text-muted);">标题</label>
          <input id="letter-title-input" type="text" placeholder="给未来自己的一封信" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;outline:none;box-sizing:border-box;">
        </div>
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:13px;margin-bottom:4px;color:var(--text-muted);">内容</label>
          <textarea id="letter-content-input" rows="6" placeholder="写下你想对未来的自己说的话…" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;outline:none;box-sizing:border-box;resize:vertical;"></textarea>
        </div>
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:13px;margin-bottom:4px;color:var(--text-muted);">开启方式</label>
          <select id="letter-trigger-input" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;outline:none;box-sizing:border-box;">
            <option value="date">指定日期</option>
            <option value="next_sync">下次数据同步时</option>
            <option value="goal_done">达成某个目标时</option>
            <option value="reverse">立即（反向致未来的你）</option>
          </select>
        </div>
        <div id="letter-trigger-value-area" style="margin-bottom:14px;">
          <label style="display:block;font-size:13px;margin-bottom:4px;color:var(--text-muted);">触发值</label>
          <input id="letter-trigger-value-input" type="text" placeholder="YYYY-MM-DD" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;outline:none;box-sizing:border-box;">
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button onclick="document.getElementById('letter-create-modal').style.display='none'" style="padding:8px 20px;border:1px solid var(--border);border-radius:8px;background:transparent;color:var(--text);cursor:pointer;font-size:14px;">取消</button>
          <button id="letter-create-btn" onclick="doCreateLetter()" style="padding:8px 20px;border:none;border-radius:8px;background:var(--accent);color:#fff;cursor:pointer;font-size:14px;">封印</button>
        </div>
      </div>
    </div>
  `;
  const sel = document.getElementById('letter-trigger-input');
  if (sel) {
    sel.addEventListener('change', function() {
      const area = document.getElementById('letter-trigger-value-area');
      const input = document.getElementById('letter-trigger-value-input');
      if (area && input) {
        if (this.value === 'date') { area.style.display = 'block'; input.placeholder = 'YYYY-MM-DD'; }
        else if (this.value === 'goal_done') { area.style.display = 'block'; input.placeholder = '目标ID'; }
        else { area.style.display = 'none'; }
      }
    });
  }
};

window.doCreateLetter = async function() {
  const btn = document.getElementById('letter-create-btn');
  if (btn) { btn.disabled = true; btn.textContent = '封印中…'; }
  try {
    const title = document.getElementById('letter-title-input')?.value?.trim();
    const content = document.getElementById('letter-content-input')?.value?.trim();
    const triggerType = document.getElementById('letter-trigger-input')?.value;
    const triggerValue = document.getElementById('letter-trigger-value-input')?.value?.trim();
    if (!title || !content) { alert('请填写标题和内容'); return; }
    await ApiClient.createLetter({ title, content, triggerType, triggerValue });
    document.getElementById('letter-create-modal').style.display = 'none';
    loadLetters();
  } catch (err) {
    alert('创建失败: ' + (err.message || '未知错误'));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '封印'; }
  }
};

window.openSealedLetter = async function(id) {
  const body = document.getElementById('letter-detail-body');
  const header = document.querySelector('#letter-detail > div:first-child');
  if (!body) return;
  body.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">正在开启…</div>';
  try {
    const res = await ApiClient.listLetters();
    const letters = res?.data?.letters || [];
    const letter = letters.find(l => l.id === id);
    if (!letter) { body.innerHTML = '<div style="color:#ea4335;font-size:13px;">信件不存在</div>'; return; }
    if (header) header.textContent = letter.title || '信件详情';
    if (!letter.deliveredAt) {
      body.innerHTML = `
        <div style="text-align:center;padding:20px;">
          <div style="font-size:48px;margin-bottom:16px;">${letter.waxSealEmoji || '📮'}</div>
          <div style="font-size:16px;font-weight:500;margin-bottom:8px;">🔒 封印中</div>
          <div style="font-size:13px;color:var(--text-muted);">将在 ${letter.triggerType === 'date' ? letter.triggerValue || '指定日期' : letter.triggerType} 时开启</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">封印于 ${new Date(letter.sealedAt).toLocaleDateString()}</div>
        </div>
      `;
      return;
    }
    body.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">正在揭示信件内容…</div>';
    const fullLetter = letters.find(l => l.id === id);
    body.innerHTML = `
      <div style="text-align:center;padding:20px;">
        <div style="font-size:48px;margin-bottom:16px;">📬</div>
        <div style="font-size:16px;font-weight:500;margin-bottom:4px;">${fullLetter?.title || letter.title}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:20px;">${fullLetter?.deliveredAt ? new Date(fullLetter.deliveredAt).toLocaleDateString() : ''}</div>
        <div style="padding:16px;background:var(--bg);border-radius:12px;text-align:left;white-space:pre-wrap;font-size:14px;line-height:1.6;max-height:400px;overflow-y:auto;">${fullLetter?.content || letter.content || '（内容为空）'}</div>
      </div>
    `;
    ApiClient.subscribeOpenLetter(id, {
      signal: _abortCtrl?.signal,
      onChunk: ({ t }) => {
        const el = body.querySelector('div:last-child');
        if (el) el.innerHTML += t || '';
      },
      onError: () => {}
    });
  } catch (err) {
    body.innerHTML = '<div style="color:#ea4335;font-size:13px;">加载失败</div>';
  }
};
