import { ApiClient } from './api.js';

// Global references to match index.html original variables
let rawNotes = [];
let importedFiles = [];
let activeFileId = 'db-notes';
let activeCategoryName = '全部便签';
let currentSelectedNote = null;
let notesList = document.getElementById('notes-list');

// We'll expose variables globally so original functions can read them
window.rawNotes = rawNotes;
window.importedFiles = importedFiles;

// Initial Setup
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
  // 1. Inject Login Modal CSS and markup
  // Bind auth overlay toggle (HTML is now in index.html)
  let isRegisterMode = false;
  const btnToggle = document.getElementById('btn-auth-toggle');
  const btnSubmit = document.getElementById('btn-auth-submit');
  const authTitle = document.querySelector('.auth-title');
  const authSubtitle = document.querySelector('.auth-subtitle');
  const authForm = document.getElementById('auth-form');
  const authError = document.getElementById('auth-error');

  btnToggle.addEventListener('click', () => {
    isRegisterMode = !isRegisterMode;
    if (isRegisterMode) {
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
    // Re-bind click event
    setupFullstackUIRebind();
  });

  function setupFullstackUIRebind() {
    const newToggle = document.getElementById('btn-auth-toggle');
    if (newToggle) {
      newToggle.addEventListener('click', () => {
        isRegisterMode = !isRegisterMode;
        if (isRegisterMode) {
          authTitle.textContent = '创建 XinNote 账户';
          authSubtitle.textContent = '开启您的全栈智能笔记之旅';
          btnSubmit.textContent = '立即注册';
          newToggle.parentElement.innerHTML = '已有账号？ <span id="btn-auth-toggle">立即登录</span>';
        } else {
          authTitle.textContent = 'XinNote 智能云空间';
          authSubtitle.textContent = '全栈升级 v5.0 • 灵感无处不在';
          btnSubmit.textContent = '立即登录';
          newToggle.parentElement.innerHTML = '还没有账号？ <span id="btn-auth-toggle">立即注册</span>';
        }
        setupFullstackUIRebind();
      });
    }
  }

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;
    
    authError.style.display = 'none';
    
    try {
      if (isRegisterMode) {
        await ApiClient.register(username, password);
        // auto-login after register
        await ApiClient.login(username, password);
      } else {
        await ApiClient.login(username, password);
      }
      // Successful auth
      document.getElementById('auth-overlay').style.display = 'none';
      checkAuthAndInit();
    } catch (err) {
      authError.textContent = err.message;
      authError.style.display = 'block';
    }
  });

  // 3. Inject New Note "+" Button in Notes Panel Title
  const panelTitle = document.querySelector('.panel-title');
  if (panelTitle) {
    const btnCreate = document.createElement('button');
    btnCreate.id = 'btn-new-note';
    btnCreate.style.cssText = `
      background: none;
      border: none;
      color: var(--primary);
      cursor: pointer;
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.2s;
    `;
    btnCreate.innerHTML = '➕';
    btnCreate.title = '新建便签';
    btnCreate.addEventListener('click', handleCreateNote);
    panelTitle.appendChild(btnCreate);
  }

  // 4. Inject Edit/Save button inside reader panel header
  const readerHeader = document.querySelector('.reader-header');
  if (readerHeader) {
    const headerRight = document.createElement('div');
    headerRight.className = 'header-right-actions';
    headerRight.style.cssText = `
      display: flex;
      gap: 10px;
      margin-left: auto;
    `;
    
    const btnEdit = document.createElement('button');
    btnEdit.id = 'btn-edit-note';
    btnEdit.className = 'btn-action-outline';
    btnEdit.innerHTML = '✏️ 编辑便签';
    btnEdit.addEventListener('click', enterEditMode);
    headerRight.appendChild(btnEdit);

    const btnDelete = document.createElement('button');
    btnDelete.id = 'btn-delete-note';
    btnDelete.className = 'btn-action-outline';
    btnDelete.style.borderColor = 'rgba(234, 67, 53, 0.4)';
    btnDelete.style.color = '#ea4335';
    btnDelete.innerHTML = '🗑️ 删除';
    btnDelete.addEventListener('click', handleDeleteNote);
    headerRight.appendChild(btnDelete);

    const metaRow = readerHeader.querySelector('.reader-meta');
    if (metaRow) {
      metaRow.appendChild(headerRight);
    }
  }

  // 5. Inject Edit View container placeholder inside reader-panel
  const readerPanel = document.querySelector('.reader-panel');
  if (readerPanel) {
    const editView = document.createElement('div');
    editView.id = 'edit-view';
    editView.style.display = 'none';
    editView.className = 'reader-body-container';
    editView.innerHTML = `
      <div class="note-edit-container">
        <input type="text" id="edit-title" class="edit-title-input" placeholder="输入便签标题...">
        <div class="edit-meta-row">
          <input type="text" id="edit-category" class="auth-input" placeholder="分类标签..." style="max-width: 200px;">
        </div>
        <textarea id="edit-content" class="edit-content-textarea" placeholder="输入便签内容 (支持 Markdown)..."></textarea>
        <div class="edit-actions-bar">
          <button id="btn-edit-cancel" class="btn-action-outline">取消</button>
          <button id="btn-edit-save" class="btn-action-primary">💾 保存更改</button>
        </div>
      </div>
    `;
    readerPanel.appendChild(editView);

    // Bind edit view cancel and save
    document.getElementById('btn-edit-cancel').addEventListener('click', exitEditMode);
    document.getElementById('btn-edit-save').addEventListener('click', saveNoteEdits);
  }

  // 6. Inject Log Out button in Settings modal or sidebar
  const sidebarUser = document.querySelector('.sidebar-footer');
  if (sidebarUser) {
    const btnLogout = document.createElement('button');
    btnLogout.style.cssText = `
      background: none; border: none; color: var(--text-muted); cursor: pointer;
      font-size: 12px; margin-left: 10px; transition: color 0.2s;
    `;
    btnLogout.innerHTML = '🚪 退出';
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

  // Load avatar with username initial
  const username = ApiClient.getUsername();
  const avatar = document.querySelector('.sidebar-avatar');
  if (avatar) avatar.textContent = username.substring(0, 2).toUpperCase();
  const usernameEl = document.querySelector('.sidebar-username');
  if (usernameEl) usernameEl.textContent = username;

  await loadNotesFromDB();
}

function handleLogout() {
  if (confirm('确认要退出当前账户登录吗？')) {
    ApiClient.clearToken();
    location.reload();
  }
}

// Load notes via API and re-render listing
async function loadNotesFromDB() {
  try {
    const data = await ApiClient.getNotes({
      category: activeCategoryName,
      search: document.getElementById('search-notes-input')?.value || ''
    });
    
    rawNotes = data.notes.map(note => ({
      id: note.id,
      title: note.title,
      content: note.content,
      date: new Date(note.updated_at).toLocaleString(),
      category: note.category,
      wordCount: note.word_count,
      fileId: 'db-notes'
    }));

    window.rawNotes = rawNotes;
    
    // Package categories in importedFiles structure to match original code expectations
    const dbCategories = { '全部便签': rawNotes };
    rawNotes.forEach(n => {
      if (!dbCategories[n.category]) dbCategories[n.category] = [];
      dbCategories[n.category].push(n);
    });

    importedFiles = [{
      id: 'db-notes',
      name: '智能云数据库备份',
      notes: rawNotes,
      categories: dbCategories,
      wordCount: rawNotes.reduce((acc, n) => acc + n.wordCount, 0),
      collapsed: false
    }];

    window.importedFiles = importedFiles;

    // Call index.html UI updates
    if (typeof window.updateGlobalDataAndUI === 'function') {
      window.updateGlobalDataAndUI();
    }
  } catch (err) {
    console.error('Failed to load notes from backend:', err.message);
  }
}

// Add Note Creator Action
async function handleCreateNote() {
  const title = prompt('请输入新便签标题:', '新建便签');
  if (title === null) return;
  
  try {
    const newNote = await ApiClient.createNote({
      title: title || '无标题',
      content: '',
      category: activeCategoryName === '全部便签' ? '未分类' : activeCategoryName
    });
    
    await loadNotesFromDB();
    
    // Select this note
    const mappedNote = rawNotes.find(n => n.id === newNote.id);
    if (mappedNote) {
      window.selectNote(mappedNote);
    }
  } catch (err) {
    alert('创建便签失败: ' + err.message);
  }
}

// Edit Mode Controllers
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
    
    // Re-select updated note
    const mappedNote = rawNotes.find(n => n.id === updated.id);
    if (mappedNote) {
      window.selectNote(mappedNote);
    }
  } catch (err) {
    alert('保存失败: ' + err.message);
  }
}

async function handleDeleteNote() {
  if (!currentSelectedNote) return;
  if (!confirm(`确定要删除便签《${currentSelectedNote.title}》吗？`)) return;

  try {
    await ApiClient.deleteNote(currentSelectedNote.id);
    currentSelectedNote = null;
    window.currentSelectedNote = null;
    await loadNotesFromDB();
    
    // Toggle views
    document.getElementById('reader-view').style.display = 'none';
    document.getElementById('dashboard-view').style.display = 'flex';
  } catch (err) {
    alert('删除失败: ' + err.message);
  }
}

// Hook selectNote to render historical versions
const originalSelectNote = window.selectNote;
window.selectNote = async function(note) {
  currentSelectedNote = note;
  window.currentSelectedNote = note;

  // Execute base index.html selectNote routine
  if (typeof originalSelectNote === 'function') {
    originalSelectNote(note);
  }

  // Load version history in background and render version panel
  try {
    const detail = await ApiClient.getNoteDetail(note.id);
    renderVersionHistory(detail.versions);
  } catch (err) {
    console.error('Failed to load version history:', err.message);
  }
};

function renderVersionHistory(versions) {
  // Check if historical box already exists, remove it
  let box = document.getElementById('version-history-box');
  if (box) box.remove();

  if (!versions || versions.length === 0) return;

  const readerBody = document.querySelector('.reader-body');
  if (!readerBody) return;

  box = document.createElement('div');
  box.id = 'version-history-box';
  box.className = 'version-history-box';
  
  let listHtml = '';
  versions.forEach(v => {
    const dateStr = new Date(v.created_at).toLocaleString();
    listHtml += `
      <div class="version-item">
        <span>🕒 版本 #${v.version_num} (${dateStr})</span>
        <button class="btn-restore-version" data-ver="${v.version_num}" data-title="${v.title.replace(/"/g, '&quot;')}" data-content="${v.content.replace(/"/g, '&quot;')}">恢复此版本</button>
      </div>
    `;
  });

  box.innerHTML = `
    <div class="version-history-title">🕒 历史版本轨迹 (${versions.length})</div>
    <div class="version-history-list">${listHtml}</div>
  `;

  readerBody.appendChild(box);

  // Bind restore buttons
  box.querySelectorAll('.btn-restore-version').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const ver = btn.dataset.ver;
      const title = btn.dataset.title;
      const content = btn.dataset.content;

      if (confirm(`确认要将当前便签内容恢复至历史版本 #${ver} 吗？`)) {
        try {
          const updated = await ApiClient.updateNote(currentSelectedNote.id, {
            title,
            content,
            category: currentSelectedNote.category
          });
          await loadNotesFromDB();
          const mappedNote = rawNotes.find(n => n.id === updated.id);
          if (mappedNote) {
            window.selectNote(mappedNote);
          }
        } catch (err) {
          alert('恢复版本失败: ' + err.message);
        }
      }
    });
  });
}

// Override AI Chat submit to use SSE streaming API
const btnSendAi = document.getElementById('btn-send-ai');
const aiChatInput = document.getElementById('ai-chat-input');
const aiChatMessages = document.getElementById('ai-chat-messages');

if (btnSendAi) {
  // Unbind original click and bind SSE streaming
  const newBtnSend = btnSendAi.cloneNode(true);
  btnSendAi.parentNode.replaceChild(newBtnSend, btnSendAi);

  newBtnSend.addEventListener('click', handleStreamingSend);
}

// Bind enter key on textarea
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

  // Append user bubble
  appendChatBubble('user', query);
  aiChatInput.value = '';
  aiChatInput.style.height = 'auto';

  // Create empty AI response bubble
  const aiBubble = appendChatBubble('ai', '');
  const contentArea = aiBubble.querySelector('.markdown-body');
  const thinkingArea = aiBubble.querySelector('.thinking-body');
  const thinkingContainer = aiBubble.querySelector('.thinking-container');

  let fullContent = '';
  let fullReasoning = '';

  const selectedModel = document.getElementById('model-select')?.value || 'deepseek-chat';
  const contextMode = window.aiContextMode || 'all';

  const payload = {
    messages: window.aiMessageHistory.concat({ role: 'user', content: query }),
    model: selectedModel,
    contextMode,
    currentNoteId: currentSelectedNote?.id,
    currentCategory: activeCategoryName
  };

  // Set loading state
  contentArea.innerHTML = '<span class="typing-loading">思考中...</span>';

  ApiClient.chatStream(
    payload,
    // onChunk
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
      // Scroll to bottom
      aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
    },
    // onDone
    () => {
      // Save to chat history
      window.aiMessageHistory.push({ role: 'user', content: query });
      window.aiMessageHistory.push({
        role: 'assistant',
        content: fullContent,
        ...(fullReasoning ? { reasoning_content: fullReasoning } : {})
      });
      // Show export chat button if history is rich
      const btnExport = document.getElementById('btn-export-ai');
      if (btnExport) btnExport.style.display = 'flex';
    },
    // onError
    (err) => {
      contentArea.innerHTML = `<span style="color: #ea4335;">❌ 对话出错: ${err.message}</span>`;
    }
  );
}

function appendChatBubble(role, content) {
  const isAi = role === 'ai';
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}-bubble`;
  
  const avatar = isAi ? '🤖' : ApiClient.getUsername().substring(0, 2).toUpperCase();
  const name = isAi ? 'AI 灵魂伴侣' : ApiClient.getUsername();

  bubble.innerHTML = `
    <div class="bubble-avatar">
      <div class="bubble-avatar-inner">${avatar}</div>
    </div>
    <div class="bubble-content-wrapper">
      <div class="bubble-sender-name">${name}</div>
      ${isAi ? `
        <div class="thinking-container" style="display: none;">
          <div class="thinking-header">💭 深度思考过程</div>
          <div class="thinking-body markdown-body"></div>
        </div>
      ` : ''}
      <div class="bubble-text markdown-body">${marked.parse(content)}</div>
    </div>
  `;
  aiChatMessages.appendChild(bubble);
  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
  return bubble;
}

// Override search input to query dynamic API
const searchInput = document.getElementById('search-notes-input');
if (searchInput) {
  searchInput.addEventListener('input', debounce(() => {
    loadNotesFromDB();
  }, 300));
}

// Override folder tree selection
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
