import { ApiClient } from './api.js';

// 全局状态引用（精确同步 index.html 内核）
let rawNotes = [];
let importedFiles = [];
let activeFileId = 'db-notes';
let activeCategoryName = '全部便签';
let currentSelectedNote = null;
let notesList = document.getElementById('notes-list');

// 将变量暴露给全局空间，确保与 index.html 的原始渲染引擎无缝连通
window.rawNotes = rawNotes;
window.importedFiles = importedFiles;
window.activeFileId = activeFileId;
window.activeCategoryName = activeCategoryName;

// 初始化生命周期挂载
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setupFullstackUI();
    checkAuthAndInit();
  });
} else {
  setupFullstackUI();
  checkAuthAndInit();
}

function setupFullstackUI() {
  // 1. 登录/注册模态框逻辑切换控制
  let isRegisterMode = false;
  const btnToggle = document.getElementById('btn-auth-toggle');
  const btnSubmit = document.getElementById('btn-auth-submit');
  const authTitle = document.querySelector('.auth-title');
  const authSubtitle = document.querySelector('.auth-subtitle');
  const authForm = document.getElementById('auth-form');
  const authError = document.getElementById('auth-error');

  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      isRegisterMode = !isRegisterMode;
      toggleAuthMode(isRegisterMode);
    });
  }

  function toggleAuthMode(registerMode) {
    if (registerMode) {
      authTitle.textContent = '创建 XinNote 账户';
      authSubtitle.textContent = '开启您的全栈智能笔记之旅';
      btnSubmit.textContent = '立即注册';
      btnToggle.parentElement.innerHTML = '已有账号？ <span id="btn-auth-toggle">立即登录</span>';
    } else {
      authTitle.textContent = 'XinNote 智能云空间';
      authSubtitle.textContent = '全栈升级 v5.0 • 灵感无处不在';
      btnSubmit.textContent = '立即登录';
      btnToggle.parentElement.innerHTML = '还没有账号？ <span id="btn-auth-toggle">立即注册</span>';
    }
    // 重新绑定动态更新后的 DOM 节点事件
    const newToggle = document.getElementById('btn-auth-toggle');
    if (newToggle) {
      newToggle.addEventListener('click', () => {
        isRegisterMode = !isRegisterMode;
        toggleAuthMode(isRegisterMode);
      });
    }
  }

  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('auth-username').value.trim();
      const password = document.getElementById('auth-password').value;
      
      authError.style.display = 'none';
      
      try {
        if (isRegisterMode) {
          await ApiClient.register(username, password);
          await ApiClient.login(username, password);
        } else {
          await ApiClient.login(username, password);
        }
        document.getElementById('auth-overlay').style.display = 'none';
        checkAuthAndInit();
      } catch (err) {
        authError.textContent = err.message;
        authError.style.display = 'block';
      }
    });
  }

  // 2. 在便签列表顶部面板注入新建便签按钮 ➕
  const panelTitle = document.querySelector('.panel-title');
  if (panelTitle && !document.getElementById('btn-new-note')) {
    const btnCreate = document.createElement('button');
    btnCreate.id = 'btn-new-note';
    btnCreate.style.cssText = `
      background: none; border: none; color: var(--primary);
      cursor: pointer; font-size: 18px; display: flex;
      align-items: center; justify-content: center; transition: opacity 0.2s;
    `;
    btnCreate.innerHTML = '➕';
    btnCreate.title = '新建便签';
    btnCreate.addEventListener('click', handleCreateNote);
    panelTitle.appendChild(btnCreate);
  }

  // 3. 在阅读面板顶部注入 编辑/删除 全栈动作按钮
  const readerHeader = document.querySelector('.reader-header');
  if (readerHeader && !document.getElementById('btn-edit-note')) {
    const headerRight = document.createElement('div');
    headerRight.className = 'header-right-actions';
    headerRight.style.cssText = `display: flex; gap: 10px; margin-left: auto;`;
    
    const btnEdit = document.createElement('button');
    btnEdit.id = 'btn-edit-note';
    btnEdit.className = 'btn-action-outline';
    btnEdit.style.cssText = `background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); color: var(--text-main); padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 13px;`;
    btnEdit.innerHTML = '✏️ 编辑';
    btnEdit.addEventListener('click', enterEditMode);
    headerRight.appendChild(btnEdit);

    const btnDelete = document.createElement('button');
    btnDelete.id = 'btn-delete-note';
    btnDelete.style.cssText = `background: rgba(234, 67, 53, 0.05); border: 1px solid rgba(234, 67, 53, 0.2); color: #ea4335; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 13px;`;
    btnDelete.innerHTML = '🗑️ 删除';
    btnDelete.addEventListener('click', handleDeleteNote);
    headerRight.appendChild(btnDelete);

    const metaRow = readerHeader.querySelector('.reader-meta') || readerHeader;
    metaRow.appendChild(headerRight);
  }

  // 4. 在主视窗面板内注入动态编辑视图容器（Markdown 编辑器）
  const readerPanel = document.querySelector('.reader-panel');
  if (readerPanel && !document.getElementById('edit-view')) {
    const editView = document.createElement('div');
    editView.id = 'edit-view';
    editView.style.display = 'none';
    editView.className = 'reader-body-container';
    editView.style.cssText = `padding: 30px; flex-direction: column; gap: 16px; width: 100%; height: 100%; overflow-y: auto;`;
    editView.innerHTML = `
      <div class="note-edit-container" style="display: flex; flex-direction: column; gap: 16px; width: 100%; max-width: 750px; margin: 0 auto;">
        <input type="text" id="edit-title" class="auth-input" style="font-size: 20px; font-weight: 600;" placeholder="输入便签标题...">
        <div class="edit-meta-row">
          <input type="text" id="edit-category" class="auth-input" placeholder="分类标签目录..." style="max-width: 240px;">
        </div>
        <textarea id="edit-content" class="auth-input" style="min-height: 350px; font-family: monospace; line-height: 1.6; resize: vertical;" placeholder="输入便签正文内容 (支持纯文本及 Markdown)..."></textarea>
        <div class="edit-actions-bar" style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 10px;">
          <button id="btn-edit-cancel" style="background: transparent; border: 1px solid var(--border-color); color: var(--text-muted); padding: 10px 20px; border-radius: 10px; cursor: pointer;">取消</button>
          <button id="btn-edit-save" style="background: var(--primary); color: #131314; font-weight:600; border: none; padding: 10px 24px; border-radius: 10px; cursor: pointer;">💾 保存更改</button>
        </div>
      </div>
    `;
    readerPanel.appendChild(editView);

    document.getElementById('btn-edit-cancel').addEventListener('click', exitEditMode);
    document.getElementById('btn-edit-save').addEventListener('click', saveNoteEdits);
  }

  // 5. 在侧边栏页脚注入全栈注销登录按钮
  const sidebarUser = document.querySelector('.sidebar-footer');
  if (sidebarUser && !document.getElementById('btn-fullstack-logout')) {
    const btnLogout = document.createElement('button');
    btnLogout.id = 'btn-fullstack-logout';
    btnLogout.style.cssText = `
      background: none; border: none; color: var(--text-muted); cursor: pointer;
      font-size: 12px; margin-left: auto; padding: 6px; transition: color 0.2s;
    `;
    btnLogout.innerHTML = '🚪 退出账户';
    btnLogout.addEventListener('click', handleLogout);
    sidebarUser.appendChild(btnLogout);
  }
}

async function checkAuthAndInit() {
  if (!ApiClient.isLoggedIn()) {
    document.getElementById('auth-overlay').style.display = 'flex';
    return;
  }
  
  document.getElementById('auth-overlay').style.display = 'none';

  // 装载同步全栈用户信息及头像
  const username = ApiClient.getUsername();
  const avatar = document.querySelector('.sidebar-avatar');
  if (avatar) avatar.textContent = username.substring(0, 2).toUpperCase();
  const usernameEl = document.querySelector('.sidebar-username');
  if (usernameEl) usernameEl.textContent = username;

  await loadNotesFromDB();
}

function handleLogout() {
  if (confirm('确认要安全退出当前智能云账户吗？')) {
    ApiClient.clearToken();
    location.reload();
  }
}

// 核心数据库加载引擎：拉取全栈云端数据并无损适配原生可视化面板
async function loadNotesFromDB() {
  try {
    // 【已修复修正】对接 index.html 原生搜索框的真正 ID: 'search-input'
    const searchQuery = document.getElementById('search-input')?.value || '';
    
    const data = await ApiClient.getNotes({
      category: activeCategoryName === '全部便签' ? '' : activeCategoryName,
      search: searchQuery
    });
    
    rawNotes = data.notes.map(note => ({
      id: note.id,
      title: note.title || '无标题',
      content: note.content || '',
      date: new Date(note.updated_at).toLocaleString(),
      category: note.category || '未分类',
      wordCount: (note.content || '').length,
      fileId: 'db-notes'
    }));

    window.rawNotes = rawNotes;
    
    // 构造原生的分级目录结构数据格式
    const dbCategories = { '全部便签': rawNotes };
    rawNotes.forEach(n => {
      if (!dbCategories[n.category]) dbCategories[n.category] = [];
      dbCategories[n.category].push(n);
    });

    importedFiles = [{
      id: 'db-notes',
      name: '智能云数据库空间',
      notes: rawNotes,
      categories: dbCategories,
      wordCount: rawNotes.reduce((acc, n) => acc + n.wordCount, 0),
      collapsed: false
    }];

    window.importedFiles = importedFiles;

    // 触发 index.html 全量可视化驾驶舱、图表及侧边树状栏的同步更新机制
    if (typeof window.updateGlobalDataAndUI === 'function') {
      window.updateGlobalDataAndUI();
    }
  } catch (err) {
    console.error('全栈云端数据载入失败:', err.message);
  }
}

// 新建便签交互控制
async function handleCreateNote() {
  const title = prompt('请输入新建全栈云便签的标题:', '未命名灵感便签');
  if (title === null) return;
  
  try {
    const newNote = await ApiClient.createNote({
      title: title.trim() || '无标题',
      content: '',
      category: activeCategoryName === '全部便签' ? '未分类' : activeCategoryName
    });
    
    await loadNotesFromDB();
    
    const mappedNote = rawNotes.find(n => n.id === newNote.id);
    if (mappedNote && typeof window.selectNote === 'function') {
      window.selectNote(mappedNote);
    }
  } catch (err) {
    alert('创建便签失败: ' + err.message);
  }
}

// 编辑模式状态机控制
function enterEditMode() {
  if (!currentSelectedNote) return;
  
  const readerView = document.getElementById('reader-view');
  const editView = document.getElementById('edit-view');
  
  if (readerView) readerView.style.display = 'none';
  if (editView) {
    editView.style.display = 'flex';
    document.getElementById('edit-title').value = currentSelectedNote.title;
    document.getElementById('edit-category').value = currentSelectedNote.category;
    document.getElementById('edit-content').value = currentSelectedNote.content;
  }
}

function exitEditMode() {
  const readerView = document.getElementById('reader-view');
  const editView = document.getElementById('edit-view');
  
  if (readerView) readerView.style.display = 'flex';
  if (editView) editView.style.display = 'none';
}

async function saveNoteEdits() {
  if (!currentSelectedNote) return;
  
  const title = document.getElementById('edit-title').value.trim() || '无标题';
  const category = document.getElementById('edit-category').value.trim() || '未分类';
  const content = document.getElementById('edit-content').value;

  try {
    const updated = await ApiClient.updateNote(currentSelectedNote.id, { title, category, content });
    
    await loadNotesFromDB();
    exitEditMode();
    
    const mappedNote = rawNotes.find(n => n.id === updated.id);
    if (mappedNote && typeof window.selectNote === 'function') {
      window.selectNote(mappedNote);
    }
  } catch (err) {
    alert('云端保存失败: ' + err.message);
  }
}

async function handleDeleteNote() {
  if (!currentSelectedNote) return;
  if (!confirm(`您确定要永久删除云端便签《${currentSelectedNote.title}》吗？此操作无法撤销。`)) return;

  try {
    await ApiClient.deleteNote(currentSelectedNote.id);
    currentSelectedNote = null;
    window.currentSelectedNote = null;
    await loadNotesFromDB();
    
    document.getElementById('reader-view').style.display = 'none';
    document.getElementById('dashboard-view').style.display = 'flex';
  } catch (err) {
    alert('云端删除失败: ' + err.message);
  }
}

// 拦截劫持原生 selectNote 动作，注入全栈历史版本时空轨迹渲染
const originalSelectNote = window.selectNote;
window.selectNote = async function(note) {
  currentSelectedNote = note;
  window.currentSelectedNote = note;

  if (typeof originalSelectNote === 'function') {
    originalSelectNote(note);
  }

  // 异步秒级获取版本控制快照
  try {
    const detail = await ApiClient.getNoteDetail(note.id);
    renderVersionHistory(detail.versions);
  } catch (err) {
    console.error('拉取历史版本失败:', err.message);
  }
};

function renderVersionHistory(versions) {
  let box = document.getElementById('version-history-box');
  if (box) box.remove();

  if (!versions || versions.length === 0) return;

  const readerBody = document.getElementById('reader-body');
  if (!readerBody) return;

  box = document.createElement('div');
  box.id = 'version-history-box';
  box.className = 'version-history-box';
  box.style.cssText = `margin-top: 40px; padding: 20px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 14px;`;
  
  let listHtml = '';
  versions.forEach(v => {
    const dateStr = new Date(v.created_at).toLocaleString();
    listHtml += `
      <div class="version-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 13px;">
        <span style="color: var(--text-muted);">🕒 版本 v${v.version_num} (${dateStr})</span>
        <button class="btn-restore-version" data-ver="${v.version_num}" 
                data-title="${v.title.replace(/"/g, '&quot;')}" 
                data-content="${v.content.replace(/"/g, '&quot;')}"
                style="background: rgba(138, 180, 248, 0.1); border: 1px solid rgba(138, 180, 248, 0.2); color: var(--primary); padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size:12px;">
          一键闪回此版本
        </button>
      </div>
    `;
  });

  box.innerHTML = `
    <div class="version-history-title" style="font-size: 14px; font-weight: 600; color: var(--text-main); margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">⏳ 历史版本时光机 (${versions.length})</div>
    <div class="version-history-list" style="display: flex; flex-direction: column;">${listHtml}</div>
  `;

  readerBody.appendChild(box);

  box.querySelectorAll('.btn-restore-version').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ver = btn.dataset.ver;
      const title = btn.dataset.title;
      const content = btn.dataset.content;

      if (confirm(`确认要将当前便签快照无损回滚至历史版本 v${ver} 吗？`)) {
        try {
          const updated = await ApiClient.updateNote(currentSelectedNote.id, {
            title,
            content,
            category: currentSelectedNote.category
          });
          await loadNotesFromDB();
          const mappedNote = rawNotes.find(n => n.id === updated.id);
          if (mappedNote && typeof window.selectNote === 'function') {
            window.selectNote(mappedNote);
          }
        } catch (err) {
          alert('闪回版本失败: ' + err.message);
        }
      }
    });
  });
}

// ==================== 🧠 AI 灵魂流式流控对答系统修复对接 ====================
const btnSendAi = document.getElementById('btn-send-ai');
const aiChatInput = document.getElementById('ai-chat-input');
const aiChatMessages = document.getElementById('ai-chat-messages');

if (btnSendAi) {
  const newBtnSend = btnSendAi.cloneNode(true);
  btnSendAi.parentNode.replaceChild(newBtnSend, btnSendAi);
  newBtnSend.addEventListener('click', handleStreamingSend);
}

if (aiChatInput) {
  aiChatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleStreamingSend();
    }
  });
}

async function handleStreamingSend() {
  const query = aiChatInput.value.trim();
  if (!query) return;

  const welcomeMsg = document.querySelector('.ai-msg-welcome');
  if (welcomeMsg) welcomeMsg.style.display = 'none';

  appendChatBubble('user', query);
  aiChatInput.value = '';
  aiChatInput.style.height = 'auto';

  // 渲染空的 AI 接收气泡容器
  const aiBubble = appendChatBubble('ai', '');
  // 【核心修复】精确锁定专属子节点，消除同名 markdown-body 选择器重叠导致的思考链覆盖 Bug
  const contentArea = aiBubble.querySelector('.bubble-text');
  const thinkingArea = aiBubble.querySelector('.thinking-body');
  const thinkingContainer = aiBubble.querySelector('.thinking-container');

  let fullContent = '';
  let fullReasoning = '';

  // 【修复修正】精确对齐 index.html 真实大模型选择器 ID：'ai-model-selector'
  const selectedModel = document.getElementById('ai-model-selector')?.value || 'gemini-2.5-flash';
  // 【修复修正】精确对齐 index.html 真实检索域范围控制 ID：'ai-context-scope'
  const contextMode = document.getElementById('ai-context-scope')?.value || 'all';

  if (!window.aiMessageHistory) window.aiMessageHistory = [];

  const payload = {
    messages: window.aiMessageHistory.concat({ role: 'user', content: query }),
    model: selectedModel,
    contextMode,
    currentNoteId: currentSelectedNote?.id,
    currentCategory: activeCategoryName
  };

  contentArea.innerHTML = '<span class="typing-loading" style="color: var(--text-muted); font-style: italic;">Gemini 正在全栈检索历史便签，思考中...</span>';

  ApiClient.chatStream(
    payload,
    // OnChunk 流片段更新事件
    (chunk) => {
      if (chunk.reasoning) {
        if (thinkingContainer) thinkingContainer.style.display = 'block';
        fullReasoning += chunk.reasoning;
        if (thinkingArea) thinkingArea.innerHTML = marked.parse(fullReasoning);
      }
      if (chunk.content) {
        const loading = contentArea.querySelector('.typing-loading');
        if (loading) loading.remove();
        
        fullContent += chunk.content;
        contentArea.innerHTML = marked.parse(fullContent);
      }
      aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
    },
    // OnDone 流式传输完美结束事件
    () => {
      window.aiMessageHistory.push({ role: 'user', content: query });
      window.aiMessageHistory.push({
        role: 'assistant',
        content: fullContent,
        ...(fullReasoning ? { reasoning_content: fullReasoning } : {})
      });
      const btnExport = document.getElementById('btn-export-ai');
      if (btnExport) btnExport.style.display = 'flex';
    },
    // OnError
    (err) => {
      contentArea.innerHTML = `<span style="color: #ea4335; font-weight: 600;">❌ 灵魂对话中断: ${err.message}</span>`;
    }
  );
}

function appendChatBubble(role, content) {
  const isAi = role === 'ai';
  const bubble = document.createElement('div');
  // 精确保持与 index.html 匹配的经典排版类名样式控制
  bubble.className = `chat-bubble ${role}`;
  
  const username = ApiClient.getUsername() || 'HP';
  const avatar = isAi ? '✦' : username.substring(0, 2).toUpperCase();
  const name = isAi ? 'Gemini 智能助理' : username;

  bubble.innerHTML = `
    <div class="bubble-avatar" style="${isAi ? 'background: var(--gradient-gemini);' : ''}">
      <div class="bubble-avatar-inner" style="display:flex; align-items:center; justify-content:center; width:100%; height:100%; font-size:11px; font-weight:700; color:#fff;">${avatar}</div>
    </div>
    <div class="bubble-content-wrapper">
      <div class="bubble-sender-name">${name}</div>
      ${isAi ? `
        <div class="thinking-container" style="display: none; margin-bottom: 12px; background: rgba(255,255,255,0.01); border-left: 2px solid var(--border-color); padding-left: 12px;">
          <div class="thinking-header" style="font-size: 11px; color: var(--text-muted); font-weight: 600; margin-bottom: 4px; cursor: pointer;">💭 深度思考路径过程：</div>
          <div class="thinking-body markdown-body" style="font-size: 12px; color: var(--text-muted); opacity: 0.85; line-height:1.5;"></div>
        </div>
      ` : ''}
      <div class="bubble-text markdown-body">${marked.parse(content || '')}</div>
    </div>
  `;
  aiChatMessages.appendChild(bubble);
  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
  return bubble;
}

// 绑定全局模糊检索拦截控制（防抖处理）
const searchInput = document.getElementById('search-input');
if (searchInput) {
  searchInput.addEventListener('input', debounce(() => {
    loadNotesFromDB();
  }, 300));
}

// 绑定多视图文件树目录切换处理器
window.selectFileCategory = function(fileId, catName) {
  activeFileId = fileId;
  activeCategoryName = catName;
  window.activeFileId = fileId;
  window.activeCategoryName = catName;

  loadNotesFromDB();
};

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}
