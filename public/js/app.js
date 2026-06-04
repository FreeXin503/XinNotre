import { ApiClient } from './api.js';

// 全局状态引用（精确同步 index.html 内核）
// 直接使用 window 上的引用，避免与 preview.html 的原始渲染引擎数据不同步
let importedFiles = window.importedFiles || [];
let activeFileId = 'db-notes';
let activeCategoryName = '全部便签';
let currentSelectedNote = null;
let notesList = document.getElementById('notes-list');

// 确保全局变量初始化
window.importedFiles = importedFiles;
window.activeFileId = activeFileId;
window.activeCategoryName = activeCategoryName;

// 初始化 AI 专家灵魂视角配置
window.PERSPECTIVES = {
  default: {
    id: 'default',
    name: '默认灵魂导师',
    icon: '🧠',
    senderName: 'Gemini',
    avatarSvg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="4" fill="#4285f4"/><text x="6" y="17" font-size="13" fill="white" font-weight="bold">G</text></svg>`,
    loadingText: '正在思考中...',
    welcomeTitle: '本地极客智能助理',
    welcomeDesc: '我是你的本地 Gemini 智能助理。我已经深度关联了你从 OPPO 便签中导出的 {count} 篇历史文本。我们可以立刻开始深度问答，回顾你过去几年的思绪与成长。',
    personaPrompt: '',
    replyRules: '',
    presets: [
      { icon: '📅', title: '情感心路回顾', desc: '分析我文字中流露的喜怒哀乐与成长变化', question: '总结我过去几年的情感与心路历程，看看我最常有哪些情绪起伏和心理变化？' },
      { icon: '🚀', title: '事业成长轨迹', desc: '挖掘我记录的学习心得与工作难关', question: '梳理我这些年在技术、学习或事业上的成长轨迹 and 核心收获。' },
      { icon: '🧘‍♂️', title: '哲学自我追问', desc: '总结我对人生、理想与自我的不断探索', question: '分析我这些年来最常思考的哲学问题、人生困惑以及自我解答。' },
      { icon: '✨', title: '人生词频提炼', desc: '通过数据做词频分析，刻画人生特征', question: '找出我便签日记中提到最多次的关键词，并为我构建几个我的人生核心关键词。' }
    ]
  }
};

window.getCurrentPerspective = function() {
  const selector = document.getElementById('ai-perspective-selector');
  const id = selector ? selector.value : 'default';
  return (window.PERSPECTIVES && window.PERSPECTIVES[id]) || window.PERSPECTIVES.default;
};

window.updateWelcomeByPerspective = function() {
  const p = window.getCurrentPerspective();
  const welcomeEl = document.querySelector('.ai-msg-welcome');
  if (!welcomeEl) return;
  const titleEl = welcomeEl.querySelector('.gemini-gradient-title');
  if (titleEl) titleEl.textContent = p.welcomeTitle;
  const descEl = welcomeEl.querySelector('p');
  if (descEl) {
    const rawNotesLength = (window.rawNotes ? window.rawNotes.length : 0) || (window.dbNotes ? window.dbNotes.length : 0) || 0;
    descEl.innerHTML = p.welcomeDesc.replace('{count}', `<strong style="color:var(--primary);">${rawNotesLength}</strong>`);
  }
  const grid = welcomeEl.querySelector('.ai-preset-cards-grid');
  if (grid) {
    grid.innerHTML = p.presets.map(pr =>
      `<div class="ai-preset-card" onclick="sendAiPreset('${pr.question.replace(/'/g, "\\'")}')">
        <div class="preset-title">${pr.icon} ${pr.title}</div>
        <div class="preset-desc">${pr.desc}</div>
      </div>`
    ).join('');
  }
};

window.onPerspectiveChange = function() {
  const p = window.getCurrentPerspective();
  
  // 联动控制联席会诊模式面板的显隐
  const selector = document.getElementById('ai-perspective-selector');
  const multiAgentBar = document.getElementById('multi-agent-bar');
  if (multiAgentBar) {
    if (selector && selector.value === 'multi-agent') {
      multiAgentBar.style.display = 'flex';
      const checkboxesContainer = document.getElementById('multi-agent-checkboxes');
      if (checkboxesContainer) {
        checkboxesContainer.style.display = 'flex';
      }
      const arrow = document.getElementById('multi-agent-arrow');
      if (arrow) arrow.style.transform = 'rotate(0deg)';
    } else {
      multiAgentBar.style.display = 'none';
    }
  }

  window.updateWelcomeByPerspective();
  
  // 在对话框内优雅地输出视角切换提示气泡
  const aiChatMessages = document.getElementById('ai-chat-messages');
  if (aiChatMessages) {
    const sysMsg = document.createElement('div');
    sysMsg.style.cssText = 'text-align: center; margin: 10px 0; font-size: 11px; color: var(--text-muted); font-style: italic;';
    sysMsg.textContent = `🧠 已切换至「${p.name}」视角`;
    aiChatMessages.appendChild(sysMsg);
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
  }
};

window.sendAiPreset = async function(presetText) {
  const welcomeMsg = document.querySelector('.ai-msg-welcome');
  if (welcomeMsg) welcomeMsg.style.display = 'none';

  const aiChatInput = document.getElementById('ai-chat-input');
  if (aiChatInput) {
    aiChatInput.value = presetText;
  }
  await window.handleStreamingSend();
};

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

  // 6. 绑定开发天团模态框事件
  const devSquadModal = document.getElementById('dev-squad-modal');
  const btnShowDevSquad = document.getElementById('btn-show-dev-squad');
  const btnCloseDevSquad = document.getElementById('btn-close-dev-squad');
  const btnCloseDevSquadAction = document.getElementById('btn-close-dev-squad-action');

  if (btnShowDevSquad && devSquadModal) {
    btnShowDevSquad.addEventListener('click', () => {
      devSquadModal.style.display = 'flex';
    });
  }

  const hideDevSquad = () => {
    if (devSquadModal) devSquadModal.style.display = 'none';
  };

  if (btnCloseDevSquad) btnCloseDevSquad.addEventListener('click', hideDevSquad);
  if (btnCloseDevSquadAction) btnCloseDevSquadAction.addEventListener('click', hideDevSquad);
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

  // 动态载入女娲视角与技能系统
  try {
    const res = await ApiClient.getSkills();
    if (res.skills && res.skills.length > 0) {
      if (!window.PERSPECTIVES) window.PERSPECTIVES = {};
      const defaultP = window.PERSPECTIVES.default;
      window.PERSPECTIVES = { default: defaultP };
      res.skills.forEach(skill => {
        window.PERSPECTIVES[skill.id] = skill;
      });

      const selector = document.getElementById('ai-perspective-selector');
      if (selector) {
        let optionsHtml = '<option value="default">🧠 默认灵魂导师</option>';
        res.skills.forEach(skill => {
          optionsHtml += `<option value="${skill.id}">${skill.icon} ${skill.name}</option>`;
        });
        optionsHtml += '<option value="multi-agent">👥 联席会诊模式 (多专家并行)</option>';
        selector.innerHTML = optionsHtml;
        // Ensure default perspective is selected after rebuild
        selector.value = 'default';
      }

      // 渲染多专家选择复选框
      const checkboxesContainer = document.getElementById('multi-agent-checkboxes');
      if (checkboxesContainer) {
        let cbHtml = '';
        res.skills.forEach(skill => {
          cbHtml += `
            <label style="display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text-muted); cursor:pointer; user-select:none; margin:0;">
              <input type="checkbox" class="multi-agent-selector-checkbox" value="${skill.id}" checked style="accent-color:var(--primary); cursor:pointer; width:13px; height:13px;">
              <span>${skill.icon} ${skill.senderName}</span>
            </label>
          `;
        });
        checkboxesContainer.innerHTML = cbHtml;
      }

      window.toggleAllMultiAgents = function(checked) {
        const checkboxes = document.querySelectorAll('.multi-agent-selector-checkbox');
        checkboxes.forEach(cb => cb.checked = checked);
      };
      
      // 👥 联席会议专家选择面板收缩与展开切换
      window.toggleMultiAgentBarCollapse = function() {
        const checkboxesContainer = document.getElementById('multi-agent-checkboxes');
        const arrow = document.getElementById('multi-agent-arrow');
        const multiAgentBar = document.getElementById('multi-agent-bar');
        if (!checkboxesContainer) return;
        
        const isCollapsed = checkboxesContainer.style.display === 'none';
        if (isCollapsed) {
          checkboxesContainer.style.display = 'flex';
          if (arrow) arrow.style.transform = 'rotate(0deg)';
          if (multiAgentBar) multiAgentBar.style.paddingBottom = '10px';
        } else {
          checkboxesContainer.style.display = 'none';
          if (arrow) arrow.style.transform = 'rotate(-90deg)';
          if (multiAgentBar) multiAgentBar.style.paddingBottom = '4px';
        }
      };
      
      console.log('🎉 动态视角载入成功，共计：', res.skills.length, '个');
    }
  } catch (err) {
    console.error('加载女娲技能视角失败:', err);
  }

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
    
    window.rawNotes = data.notes.map(note => ({
      id: note.id,
      title: note.title || '无标题',
      content: note.content || '',
      date: new Date(note.updated_at).toLocaleString(),
      category: note.category || '未分类',
      wordCount: (note.content || '').length,
      fileId: 'db-notes'
    }));
    
    // 构造原生的分级目录结构数据格式
    const notes = window.rawNotes;
    const dbCategories = { '全部便签': notes };
    notes.forEach(n => {
      if (!dbCategories[n.category]) dbCategories[n.category] = [];
      dbCategories[n.category].push(n);
    });

    const dbFileObj = {
      id: 'db-notes',
      name: '智能云数据库空间',
      notes: notes,
      categories: dbCategories,
      wordCount: notes.reduce((acc, n) => acc + n.wordCount, 0),
      collapsed: false
    };

    // 保留已载入的本地备份文件，仅更新云端数据库节点
    const localFiles = (window.importedFiles || []).filter(f => f.id !== 'db-notes');
    window.importedFiles = [dbFileObj, ...localFiles];
    importedFiles = window.importedFiles;

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
    
    const mappedNote = (window.rawNotes || []).find(n => n.id === newNote.id);
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
    
    const mappedNote = (window.rawNotes || []).find(n => n.id === updated.id);
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
          const mappedNote = (window.rawNotes || []).find(n => n.id === updated.id);
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
    // @ popup navigation takes priority
    if (window.atMentionHandleKey && window.atMentionHandleKey(e)) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleStreamingSend();
    }
  });
  // Auto-resize + @ trigger
  aiChatInput.addEventListener('input', (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    if (window.atMentionHandleInput) window.atMentionHandleInput(e);
  });
}

window.handleStreamingSend = handleStreamingSend;
async function handleStreamingSend() {
  const rawQuery = aiChatInput.value.trim();
  if (!rawQuery) return;

  // === @ 引用上下文注入 ===
  const atRefs = window.atSelectedRefs ? [...window.atSelectedRefs] : [];
  let finalQuery = rawQuery;
  let extraSystemContext = '';

  if (atRefs.length > 0) {
    const contextBlocks = atRefs.map(ref => {
      if (ref.type === 'all') {
        const notes = (window.rawNotes || []).slice(0, 20);
        return `【引用：全部便签（前20篇样本）】\n` + notes.map(n => `• ${n.title}: ${(n.content||'').substring(0,150)}`).join('\n');
      } else if (ref.type === 'category') {
        const catNotes = (window.rawNotes || []).filter(n => (n.category||'未分类') === ref.name);
        return `【引用目录「${ref.name}」，共${catNotes.length}篇便签】\n` +
          catNotes.slice(0, 8).map(n => `• ${n.title}\n  ${(n.content||'').substring(0,200)}`).join('\n\n');
      } else if (ref.type === 'file') {
        const file = (window.importedFiles || []).find(f => f.id === ref.id);
        if (file) {
          return `【引用整个备份文件「${file.name}」，共${file.notes.length}篇便签】\n` +
            file.notes.slice(0, 12).map(n => `• ${n.title} (分类: ${n.category||'无'})\n  ${(n.content||'').substring(0,150)}`).join('\n\n');
        }
      } else if (ref.type === 'note') {
        const note = (window.rawNotes || []).find(n => n.id === ref.id);
        if (note) return `【引用便签「${note.title}」，分类：${note.category||'未分类'}】\n${note.content||''}`;
      }
      return '';
    }).filter(Boolean);

    if (contextBlocks.length > 0) {
      extraSystemContext = '\n\n【用户手动 @ 引用的上下文片段，请优先参考这些内容回答】\n' + contextBlocks.join('\n\n---\n\n');
    }
    // Clear refs after send
    if (window.atClearAllRefs) window.atClearAllRefs();
  }

  const welcomeMsg = document.querySelector('.ai-msg-welcome');
  if (welcomeMsg) welcomeMsg.style.display = 'none';



  const selector = document.getElementById('ai-perspective-selector');
  const currentPerspectiveId = selector ? selector.value : 'default';

  const selectedModel = document.getElementById('ai-model-selector')?.value || 'gemini-2.5-flash-preview-05-20';
  const contextMode = document.getElementById('ai-context-scope')?.value || 'all';

  if (!window.aiMessageHistory) window.aiMessageHistory = [];

  const enrichedUserMsg = extraSystemContext
    ? `${finalQuery}${extraSystemContext}`
    : finalQuery;

  // Render user bubble with @ tags highlighted
  const displayQuery = finalQuery.replace(/@([\w\u4e00-\u9fa5·\-_\s]+?)(?=\s|$|@)/g,
    (m, name) => `<span class="at-tag-chip">@${name.trim()}</span>`);
  appendChatBubble('user', finalQuery, displayQuery);
  
  // Clean up dynamic suggestion cards if any exist
  const existingSuggestions = document.getElementById('ai-chat-dynamic-suggestions');
  if (existingSuggestions) existingSuggestions.remove();

  aiChatInput.value = '';
  aiChatInput.style.height = 'auto';
  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;

  // 1. 👥 多专家联席会诊模式下进行并行提问作答
  if (currentPerspectiveId === 'multi-agent') {
    const checkedAgentCbs = document.querySelectorAll('.multi-agent-selector-checkbox:checked');
    if (checkedAgentCbs.length === 0) {
      alert('⚠️ 请至少勾选一位专家参与本次联席会诊！');
      return;
    }

    // 记录用户消息
    window.aiMessageHistory.push({ role: 'user', content: enrichedUserMsg });

    let completedCount = 0;
    const totalAgents = checkedAgentCbs.length;

    // Snapshot history before multi-agent to prevent cross-contamination
    const historyBeforeMulti = window.aiMessageHistory.filter(m => m.role !== 'assistant');

    checkedAgentCbs.forEach(cb => {
      const agentId = cb.value;
      const perspective = window.PERSPECTIVES[agentId];
      if (!perspective) return;

      const personaSystemInstruction = perspective.personaPrompt;

      // 渲染该专家的专属 AI 回答气泡
      const aiBubble = appendChatBubble('ai', '');
      const contentArea = aiBubble.querySelector('.bubble-text');
      const thinkingArea = aiBubble.querySelector('.thinking-body');
      const thinkingContainer = aiBubble.querySelector('.thinking-container');

      // 注入专家头部标识栏
      const bubbleHeader = document.createElement('div');
      bubbleHeader.style.cssText = 'display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; color:var(--primary); margin-bottom:8px; border-bottom:1px dashed rgba(255,255,255,0.04); padding-bottom:4px;';
      bubbleHeader.innerHTML = `${perspective.avatarSvg || '🧠'} <span>${perspective.senderName} (${perspective.icon})</span>`;
      aiBubble.insertBefore(bubbleHeader, aiBubble.firstChild);

      // Each expert only sees non-assistant history + their own prior responses
      const agentHistory = historyBeforeMulti.concat(
        window.aiMessageHistory.filter(m => m.role === 'assistant' && m.content.startsWith(`[${perspective.senderName}]`))
      );

      const payload = {
        messages: agentHistory,
        model: selectedModel,
        contextMode,
        currentNoteId: currentSelectedNote?.id,
        currentCategory: activeCategoryName,
        systemInstruction: personaSystemInstruction
      };

      let fullContent = '';
      let fullReasoning = '';

      contentArea.innerHTML = `<span class="typing-loading" style="color: var(--text-muted); font-style: italic;">${perspective.senderName} 正在分析研究，请稍候...</span>`;

      ApiClient.chatStream(
        payload,
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
        () => {
          // Save response to history (labeled by expert name)
          window.aiMessageHistory.push({
            role: 'assistant',
            content: `[${perspective.senderName}]: ${fullContent}`
          });
          completedCount++;
          if (completedCount === totalAgents) {
            appendDynamicFollowUpSuggestions();
            if (typeof window.autoArchiveCurrentChat === 'function') window.autoArchiveCurrentChat();
          }
          const btnExport = document.getElementById('btn-export-ai');
          if (btnExport) btnExport.style.display = 'flex';
        },
        (err) => {
          contentArea.innerHTML = `<span style="color: #ea4335; font-weight: 600;">❌ [${perspective.senderName}] 诊断中断: ${err.message}</span>`;
          completedCount++;
          if (completedCount === totalAgents) {
            appendDynamicFollowUpSuggestions();
          }
        }
      );
    });

  } else {
    // 2. 🧠 普通单专家的回答工作流
    const perspective = (typeof getCurrentPerspective === 'function') ? getCurrentPerspective() : null;
    // personaPrompt is the full SKILL.md which already includes 角色扮演规则
    // Do NOT append replyRules separately to avoid duplication
    const personaSystemInstruction = perspective
      ? perspective.personaPrompt
      : '';

    const aiBubble = appendChatBubble('ai', '');
    const contentArea = aiBubble.querySelector('.bubble-text');
    const thinkingArea = aiBubble.querySelector('.thinking-body');
    const thinkingContainer = aiBubble.querySelector('.thinking-container');

    const payload = {
      messages: window.aiMessageHistory.concat({ role: 'user', content: enrichedUserMsg }),
      model: selectedModel,
      contextMode,
      currentNoteId: currentSelectedNote?.id,
      currentCategory: activeCategoryName,
      ...(personaSystemInstruction && { systemInstruction: personaSystemInstruction })
    };

    let fullContent = '';
    let fullReasoning = '';

    const senderName = perspective ? perspective.senderName : 'Gemini';
    const loadingText = perspective ? perspective.loadingText : '正在全栈检索历史便签，思考中...';
    contentArea.innerHTML = `<span class="typing-loading" style="color: var(--text-muted); font-style: italic;">${senderName} ${loadingText}</span>`;

    ApiClient.chatStream(
      payload,
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
      () => {
        window.aiMessageHistory.push({ role: 'user', content: enrichedUserMsg });
        window.aiMessageHistory.push({
          role: 'assistant',
          content: fullContent,
          ...(fullReasoning ? { reasoning_content: fullReasoning } : {})
        });
        const btnExport = document.getElementById('btn-export-ai');
        if (btnExport) btnExport.style.display = 'flex';
        
        //对话完成，注入后续问题卡片
        appendDynamicFollowUpSuggestions();
        if (typeof window.autoArchiveCurrentChat === 'function') window.autoArchiveCurrentChat();
      },
      (err) => {
        contentArea.innerHTML = `<span style="color: #ea4335; font-weight: 600;">❌ 灵魂对话中断: ${err.message}</span>`;
      }
    );
  }
}

// 动态产生有趣问题卡片的方法
function appendDynamicFollowUpSuggestions() {
  // 先清理现有的
  const existing = document.getElementById('ai-chat-dynamic-suggestions');
  if (existing) existing.remove();

  // 根据当前选择的视角生成有趣的对话引导问题
  const selector = document.getElementById('ai-perspective-selector');
  const perspectiveId = selector ? selector.value : 'default';
  const p = window.PERSPECTIVES[perspectiveId] || window.PERSPECTIVES.default;
  
  let options = [];
  if (p && p.presets && p.presets.length > 0) {
    // 随机抽两个该视角的快捷卡片
    options = [...p.presets].sort(() => 0.5 - Math.random()).slice(0, 2);
  }

  // 额外生成两个全局深度解析趣味卡片
  const globalOptions = [
    { icon: '🔮', title: '心魔拆解', question: '请帮我梳理：我过去的便签日记中，有没有反复出现的“自我怀疑”或“心魔焦虑”？它们是如何被我战胜的？' },
    { icon: '📈', title: '能力突跃', question: '根据我记录的日记，指出我在什么时间节点（哪年哪月）发生了最明显的技术或心智飞跃？' },
    { icon: '🍀', title: '小确幸盘点', question: '我的便签日记里，写下了哪些最微小但最能治愈我、让我感到幸福快乐的生活碎片？' }
  ];
  options.push(globalOptions[Math.floor(Math.random() * globalOptions.length)]);

  const suggestionsEl = document.createElement('div');
  suggestionsEl.id = 'ai-chat-dynamic-suggestions';
  suggestionsEl.className = 'ai-preset-cards-grid';
  suggestionsEl.style.cssText = 'display:flex; flex-wrap:wrap; gap:8px; margin-top:16px; padding:12px; border-top:1px dashed rgba(255,255,255,0.06); width:100%; max-width:820px; align-self:center; animation:fadeInUp 0.3s ease;';

  options.forEach(opt => {
    const card = document.createElement('div');
    card.className = 'ai-preset-card';
    card.style.cssText = 'flex:1; min-width:200px; padding:10px 14px; background:rgba(138,180,248,0.03); border:1px solid rgba(138,180,248,0.1); border-radius:12px; cursor:pointer; font-size:12px; transition:all 0.2s;';
    card.innerHTML = `
      <div style="font-weight:600; color:var(--primary); margin-bottom:2px;">${opt.icon || '✨'} ${opt.title || '延伸探讨'}</div>
      <div style="color:var(--text-muted); font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${opt.question || opt.desc}</div>
    `;
    card.onclick = () => {
      const q = opt.question || opt.desc;
      aiChatInput.value = q;
      // 触发发送
      if (window.handleStreamingSend) window.handleStreamingSend();
    };
    suggestionsEl.appendChild(card);
  });

  aiChatMessages.appendChild(suggestionsEl);
  setTimeout(() => {
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
  }, 100);
}

function appendChatBubble(role, content, displayHtml) {
  const isAi = role === 'ai';
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;
  
  const username = ApiClient.getUsername() || 'HP';
  const p = (typeof getCurrentPerspective === 'function') ? getCurrentPerspective() : null;

  let avatarHtml, senderName;
  if (isAi && p) {
    avatarHtml = `<div class="bubble-avatar-inner" style="display:flex; align-items:center; justify-content:center; width:100%; height:100%;">${p.avatarSvg}</div>`;
    senderName = p.senderName;
  } else if (isAi) {
    avatarHtml = `<div class="bubble-avatar-inner" style="display:flex; align-items:center; justify-content:center; width:100%; height:100%; font-size:11px; font-weight:700; color:#fff;">✦</div>`;
    senderName = 'Gemini 智能助理';
  } else {
    avatarHtml = `<div class="bubble-avatar-inner" style="display:flex; align-items:center; justify-content:center; width:100%; height:100%; font-size:11px; font-weight:700; color:#fff;">${username.substring(0, 2).toUpperCase()}</div>`;
    senderName = username;
  }

  let renderedContent;
  if (!isAi && displayHtml) {
    renderedContent = displayHtml;
  } else {
    renderedContent = marked.parse(content || '');
  }

  bubble.innerHTML = `
    <div class="bubble-avatar" style="${isAi ? 'background: var(--gradient-gemini);' : ''}">
      ${avatarHtml}
    </div>
    <div class="bubble-content-wrapper">
      <div class="bubble-sender-name" style="display: flex; align-items: center; justify-content: space-between;">
        <span>${senderName}</span>
        ${isAi ? `<button class="tts-speak-btn" onclick="window.speakTtsText(this)" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 11px; display: flex; align-items: center; gap: 3px;" title="朗读回答">🔊 朗读</button>` : ''}
      </div>
      ${isAi ? `
        <div class="thinking-container" style="display: none; margin-bottom: 12px; background: rgba(255,255,255,0.01); border-left: 2px solid var(--border-color); padding-left: 12px;">
          <div class="thinking-header" style="font-size: 11px; color: var(--text-muted); font-weight: 600; margin-bottom: 4px; cursor: pointer;">💭 深度思考路径过程：</div>
          <div class="thinking-body markdown-body" style="font-size: 12px; color: var(--text-muted); opacity: 0.85; line-height:1.5;"></div>
        </div>
      ` : ''}
      <div class="bubble-text markdown-body">${renderedContent}</div>
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
  }, 500));
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

// 全局的同步全选/取消全选辅助函数
window.importSelToggleAll = function(checked) {
  const checkboxes = document.querySelectorAll('.import-file-checkbox, .import-cat-checkbox');
  checkboxes.forEach(cb => cb.checked = checked);
};

window.toggleImportFileCheckbox = function(fileId, checked) {
  const checkboxes = document.querySelectorAll(`.import-cat-checkbox[data-file-id="${fileId}"]`);
  checkboxes.forEach(cb => cb.checked = checked);
};

window.checkImportCatCheckbox = function(fileId) {
  const parent = document.querySelector(`.import-file-checkbox[data-file-id="${fileId}"]`);
  const children = document.querySelectorAll(`.import-cat-checkbox[data-file-id="${fileId}"]`);
  if (!parent || children.length === 0) return;
  const allChecked = Array.from(children).every(cb => cb.checked);
  parent.checked = allChecked;
};

async function syncLocalToCloud() {
  const localFiles = (window.importedFiles || []).filter(f => f.id !== 'db-notes');
  if (localFiles.length === 0) {
    alert('当前没有载入本地备份文件，无需同步！');
    return;
  }

  const modal = document.getElementById('import-selection-modal');
  const listContainer = document.getElementById('import-selection-list');
  const confirmBtn = document.getElementById('import-confirm-btn');

  if (!modal || !listContainer || !confirmBtn) {
    alert('导入选择模态框加载失败，请刷新重试！');
    return;
  }

  // 渲染列表
  let html = '';
  localFiles.forEach(file => {
    html += `
      <div class="import-file-item" style="border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 12px; background: rgba(255,255,255,0.02); display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
           <label style="display: flex; align-items: center; gap: 8px; color: var(--text-main); font-weight: 600; cursor: pointer; font-size: 14px; user-select: none; margin: 0;">
              <input type="checkbox" class="import-file-checkbox" data-file-id="${file.id}" checked onchange="window.toggleImportFileCheckbox('${file.id}', this.checked)" style="accent-color: var(--primary); width: 15px; height: 15px; cursor: pointer;">
              <span>📦 ${file.name}</span>
           </label>
           <span style="font-size: 11px; color: var(--text-muted); background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 6px;">${file.notes.length} 篇</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px; padding-left: 22px; border-left: 1px dashed rgba(255,255,255,0.1); margin-top: 4px;">
    `;

    Object.keys(file.categories).forEach(catName => {
      const isAllNotes = catName === '全部便签';
      html += `
        <div style="display: flex; align-items: center; justify-content: space-between;">
           <label style="display: flex; align-items: center; gap: 8px; color: var(--text-muted); cursor: pointer; font-size: 13px; user-select: none; margin: 0;">
              <input type="checkbox" class="import-cat-checkbox" data-file-id="${file.id}" data-cat-name="${catName}" checked onchange="window.checkImportCatCheckbox('${file.id}')" style="accent-color: var(--primary); width: 13px; height: 13px; cursor: pointer;">
              <span>${isAllNotes ? '🏷️ 全部便签 (安全去重)' : '📁 ' + catName}</span>
           </label>
           <span style="font-size: 11px; color: var(--text-muted);">${file.categories[catName].length} 篇</span>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  listContainer.innerHTML = html;
  modal.style.display = 'flex';

  confirmBtn.onclick = async () => {
    // 搜集选中的分类
    const checkedCats = document.querySelectorAll('.import-cat-checkbox:checked');
    if (checkedCats.length === 0) {
      alert('⚠️ 请至少选择一个目录或分类进行导入！');
      return;
    }

    let allNotesMap = new Map();
    checkedCats.forEach(cb => {
      const fileId = cb.getAttribute('data-file-id');
      const catName = cb.getAttribute('data-cat-name');
      const file = localFiles.find(f => f.id === fileId);
      if (file && file.categories[catName]) {
        file.categories[catName].forEach(n => {
          allNotesMap.set(n.id, {
            id: n.id,
            title: n.title,
            content: n.content,
            category: n.category,
            date: n.date
          });
        });
      }
    });

    const allNotes = Array.from(allNotesMap.values());
    if (allNotes.length === 0) {
      alert('所选目录中没有有效的便签数据！');
      return;
    }

    if (!confirm(`您已勾选选择导入共计 ${allNotes.length} 篇便签，是否即刻开始一键持久化保存至 MySQL 云端数据库？\n（系统将自动智能去重，安全无损！）`)) {
      return;
    }

    modal.style.display = 'none'; // 隐藏选择器

    try {
      const btn = document.getElementById('btn-cloud-sync-action');
      if (btn) {
        btn.disabled = true;
        btn.innerText = '⏳ 正在极速进行云端同步持久化...';
      }

      const res = await ApiClient.syncPush(allNotes);
      alert(`🎉 恭喜！云端同步成功！\n✨ 新增导入: ${res.stats.inserted} 篇\n📝 版本更新: ${res.stats.updated} 篇\n✅ 智能去重略过: ${res.stats.skipped} 篇`);
      
      // Switch to cloud DB space and reload
      activeFileId = 'db-notes';
      activeCategoryName = '全部便签';
      window.activeFileId = activeFileId;
      window.activeCategoryName = activeCategoryName;

      // Clear only the synced files to avoid screen duplicate confusion
      importedFiles = importedFiles.filter(f => f.id === 'db-notes' || f.selectedForSync === false);
      window.importedFiles = importedFiles;

      await loadNotesFromDB();
    } catch (err) {
      alert('云端同步失败: ' + err.message);
    } finally {
      const btn = document.getElementById('btn-cloud-sync-action');
      if (btn) {
        btn.disabled = false;
        btn.innerText = '☁️ 一键将导入的本地备份同步持久化至云端数据库';
      }
    }
  };
}
window.syncLocalToCloud = syncLocalToCloud;

// ==================== 📌 @ 引用智能弹窗系统 (At-Mention System) ====================
(function initAtMentionSystem() {
  // 状态变量
  let atActive = false;
  let atStart = -1;         // @ 符号在 textarea 中的位置索引
  let atQuery = '';         // @ 后面的查询字符串
  let atItems = [];         // 当前弹窗列表项
  let atSelIdx = 0;         // 键盘导航选中索引
  window.atSelectedRefs = [];  // 已确认选中的引用列表 [{type, name, id}]

  const chatInput = document.getElementById('ai-chat-input');
  const popup = document.getElementById('at-mention-popup');
  const itemsEl = document.getElementById('at-mention-items');
  const contextBar = document.getElementById('at-context-bar');
  const contextChips = document.getElementById('at-context-chips');

  if (!chatInput || !popup) return;

  // ---- 构建弹窗数据列表 ----
  function buildItems(q) {
    const notes = window.rawNotes || [];
    const items = [];
    const ql = q.toLowerCase();

    // 1. 特殊项：全部便签
    if (!q || '全部便签'.includes(ql) || 'all'.includes(ql)) {
      items.push({ type: 'all', name: '全部便签', id: '__all__',
        icon: '🌍', meta: `全量 ${notes.length} 篇便签（智能 RAG 关联）`, badge: 'all' });
    }

    // 2. 分类目录
    const catMap = {};
    notes.forEach(n => { const c = n.category || '未分类'; catMap[c] = (catMap[c]||0)+1; });
    const cats = Object.entries(catMap)
      .filter(([c]) => !ql || c.toLowerCase().includes(ql))
      .sort((a, b) => b[1] - a[1]);
    cats.slice(0, 6).forEach(([cat, count]) => {
      items.push({ type: 'category', name: cat, id: cat,
        icon: '📁', meta: `${count} 篇便签`, badge: 'folder' });
    });

    // 3. 便签条目（按标题搜索）
    if (q) {
      const matched = notes.filter(n =>
        (n.title||'').toLowerCase().includes(ql) ||
        (n.content||'').toLowerCase().includes(ql)
      );
      matched.slice(0, 8).forEach(n => {
        items.push({
          type: 'note', name: n.title || '无标题', id: n.id,
          icon: '📄',
          meta: `${n.category || '未分类'} · ${(n.content||'').substring(0, 50)}...`,
          badge: 'note'
        });
      });
    }
    return items;
  }

  // ---- 渲染弹窗 ----
  function renderPopup() {
    if (!itemsEl) return;
    if (atItems.length === 0) {
      itemsEl.innerHTML = '<div class="at-popup-empty">😶 未找到匹配的目录或便签</div>';
      return;
    }

    let html = '';
    let lastType = null;
    atItems.forEach((item, i) => {
      if (item.type !== lastType && item.type !== 'all') {
        const label = item.type === 'category' ? '📁 目录' : '📄 便签';
        html += `<div class="at-popup-section-label">${label}</div>`;
        lastType = item.type;
      }
      const sel = i === atSelIdx ? 'at-selected' : '';
      const badgeClass = `at-badge-${item.badge}`;
      html += `
        <div class="at-popup-item ${sel}" data-idx="${i}" onclick="window._atSelectItem(${i})">
          <span class="at-item-icon">${item.icon}</span>
          <div class="at-item-body">
            <div class="at-item-name">${escapeHtml(item.name)}</div>
            <div class="at-item-meta">${escapeHtml(item.meta)}</div>
          </div>
          <span class="at-item-badge ${badgeClass}">${item.type === 'all' ? '全量' : item.type === 'category' ? '目录' : '便签'}</span>
        </div>`;
    });
    itemsEl.innerHTML = html;

    // Scroll selected into view
    const selEl = itemsEl.querySelector('.at-selected');
    if (selEl) selEl.scrollIntoView({ block: 'nearest' });
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function showPopup(q) {
    atItems = buildItems(q);
    atSelIdx = 0;
    if (atItems.length === 0 && !q) { hidePopup(); return; }
    renderPopup();
    popup.style.display = 'block';
  }

  function hidePopup() {
    popup.style.display = 'none';
    atActive = false;
  }

  // ---- 输入监听 ----
  window.atMentionHandleInput = function(e) {
    const ta = chatInput;
    const val = ta.value;
    const cur = ta.selectionStart;
    const before = val.substring(0, cur);
    const lastAt = before.lastIndexOf('@');

    if (lastAt !== -1) {
      const afterAt = before.substring(lastAt + 1);
      // Only activate if no whitespace between @ and cursor
      if (!/\s/.test(afterAt)) {
        atActive = true;
        atStart = lastAt;
        atQuery = afterAt;
        showPopup(afterAt);
        return;
      }
    }
    hidePopup();
  };

  // ---- 键盘导航 ----
  window.atMentionHandleKey = function(e) {
    if (!atActive || popup.style.display === 'none') return false;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      atSelIdx = Math.min(atSelIdx + 1, atItems.length - 1);
      renderPopup(); return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      atSelIdx = Math.max(atSelIdx - 1, 0);
      renderPopup(); return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (atItems.length > 0) {
        e.preventDefault();
        window._atSelectItem(atSelIdx);
        return true;
      }
    }
    if (e.key === 'Escape') {
      hidePopup(); return true;
    }
    return false;
  };

  // ---- 选中处理 ----
  window._atSelectItem = function(idx) {
    const item = atItems[idx];
    if (!item) return;

    const val = chatInput.value;
    const cur = chatInput.selectionStart;
    const beforeAt = val.substring(0, atStart);
    const afterCursor = val.substring(cur);
    const tag = `@${item.name} `;

    chatInput.value = beforeAt + tag + afterCursor;
    const newPos = atStart + tag.length;
    chatInput.setSelectionRange(newPos, newPos);
    chatInput.focus();

    // 添加到已选引用列表（去重）
    if (!window.atSelectedRefs.find(r => r.id === item.id && r.type === item.type)) {
      window.atSelectedRefs.push({ type: item.type, name: item.name, id: item.id });
      renderContextBar();
    }

    hidePopup();
    // Trigger resize
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  };

  // ---- 已选引用标签条 ----
  function renderContextBar() {
    if (!contextBar || !contextChips) return;
    if (window.atSelectedRefs.length === 0) {
      contextBar.style.display = 'none';
      return;
    }
    contextBar.style.display = 'flex';
    contextChips.innerHTML = window.atSelectedRefs.map((ref, i) => `
      <span class="at-context-chip">
        ${ref.type === 'all' ? '🌍' : ref.type === 'category' ? '📁' : ref.type === 'file' ? '📦' : '📄'}
        ${escapeHtml(ref.name)}
        <span class="at-chip-remove" onclick="window._atRemoveRef(${i})" title="移除引用">✕</span>
      </span>
    `).join('');
  }

  window._atRemoveRef = function(idx) {
    const ref = window.atSelectedRefs[idx];
    window.atSelectedRefs.splice(idx, 1);
    renderContextBar();
    if (ref) {
      chatInput.value = chatInput.value.replace(`@${ref.name} `, '').replace(`@${ref.name}`, '');
    }
  };

  window.atClearAllRefs = function() {
    window.atSelectedRefs = [];
    renderContextBar();
  };

  window.atRenderContextBar = renderContextBar;

  // Add drag & drop listeners to AI input box
  if (chatInput) {
    chatInput.addEventListener('dragover', (e) => {
      e.preventDefault();
      chatInput.style.border = '2px dashed var(--primary)';
      chatInput.style.background = 'rgba(255,255,255,0.05)';
    });

    chatInput.addEventListener('dragleave', (e) => {
      chatInput.style.border = '';
      chatInput.style.background = '';
    });

    chatInput.addEventListener('drop', (e) => {
      e.preventDefault();
      chatInput.style.border = '';
      chatInput.style.background = '';

      const text = e.dataTransfer.getData('text/plain');
      const jsonStr = e.dataTransfer.getData('application/json');
      if (jsonStr) {
        try {
          const item = JSON.parse(jsonStr);
          const val = chatInput.value;
          const cur = chatInput.selectionStart || val.length;
          const before = val.substring(0, cur);
          const after = val.substring(cur);

          chatInput.value = before + text + after;
          const newPos = cur + text.length;
          chatInput.setSelectionRange(newPos, newPos);
          chatInput.focus();

          if (!window.atSelectedRefs) window.atSelectedRefs = [];
          if (!window.atSelectedRefs.find(r => r.id === item.id && r.type === item.type)) {
            window.atSelectedRefs.push({ type: item.type, name: item.name, id: item.id });
            renderContextBar();
          }

          // Trigger resize
          chatInput.style.height = 'auto';
          chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
        } catch (err) {
          console.error('解析拖拽数据失败:', err);
        }
      }
    });
  }

  // Close popup when clicking outside
  document.addEventListener('click', (e) => {
    if (!popup.contains(e.target) && e.target !== chatInput) {
      hidePopup();
    }
  });

  // Re-init when notes data changes
  const origRawNotesSetter = Object.getOwnPropertyDescriptor(window, 'rawNotes');
  // Refresh context bar note counts when rawNotes updates
  const _origBuildCats = window.buildCategoryList;

  console.log('📌 @ 引用弹窗系统已初始化，当前便签库：', (window.rawNotes||[]).length, '篇');
})();

// ==================== 📅 便签时间轴 + 情感热力图逻辑 ====================
window.timelineGroupMode = 'month';
window.currentTimelineFilter = null;

window.analyzeNoteSentiment = function(content) {
  if (!content) return { emotion: 'neutral', score: 0 };
  const text = content.toLowerCase();
  
  const positiveWords = ['开心', '快乐', '高兴', '幸福', '喜悦', '兴奋', '轻松', '满足', '顺利', '乐观', '棒', '赞', '舒服', '惬意', '美好', '开心'];
  const negativeWords = ['焦虑', '难过', '痛苦', '伤心', '沮丧', '郁闷', '烦躁', '生气', '愤怒', '绝望', '压力', '累', '疲惫', '痛苦', '抑郁', '纠结', '无奈', '担心', '害怕'];
  
  let posCount = 0;
  let negCount = 0;
  
  positiveWords.forEach(w => {
    posCount += (text.split(w).length - 1);
  });
  
  negativeWords.forEach(w => {
    negCount += (text.split(w).length - 1);
  });
  
  if (posCount > negCount) {
    return { emotion: 'positive', score: posCount - negCount };
  } else if (negCount > posCount) {
    return { emotion: 'negative', score: negCount - posCount };
  } else {
    return { emotion: 'neutral', score: 0 };
  }
};

window.renderTimelineHeatmap = function(baseNotes) {
  const wrapper = document.getElementById('timeline-scroll-wrapper');
  if (!wrapper) return;
  wrapper.innerHTML = '';
  
  if (!baseNotes || baseNotes.length === 0) {
    wrapper.innerHTML = '<div style="color: var(--text-muted); font-size: 11px; padding: 4px;">当前分类无数据</div>';
    return;
  }
  
  // 按时间对便签分组
  const groups = {};
  baseNotes.forEach(note => {
    const dateObj = new Date(note.date || note.updated_at || note.created_at);
    if (isNaN(dateObj.getTime())) return;
    
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const key = window.timelineGroupMode === 'year' ? String(y) : `${y}-${m}`;
    
    if (!groups[key]) {
      groups[key] = {
        key: key,
        label: window.timelineGroupMode === 'year' ? `${y}年` : `${y}-${m}`,
        notes: [],
        posScore: 0,
        negScore: 0
      };
    }
    groups[key].notes.push(note);
    
    // 轻量情感倾向打分
    const sent = window.analyzeNoteSentiment(note.content);
    if (sent.emotion === 'positive') {
      groups[key].posScore += sent.score;
    } else if (sent.emotion === 'negative') {
      groups[key].negScore += sent.score;
    }
  });
  
  // 按时间升序排序
  const sortedKeys = Object.keys(groups).sort();
  
  sortedKeys.forEach(key => {
    const g = groups[key];
    const total = g.notes.length;
    
    // 热力色彩方案
    let bg = 'rgba(255,255,255,0.02)';
    let border = '1px solid rgba(255,255,255,0.08)';
    let textColor = 'var(--text-muted)';
    let barColor = '#8ab4f8';
    
    if (g.posScore > g.negScore) {
      bg = 'linear-gradient(135deg, rgba(76, 175, 80, 0.08) 0%, rgba(76, 175, 80, 0.2) 100%)';
      border = '1px solid rgba(76, 175, 80, 0.3)';
      textColor = '#81c784';
      barColor = '#4caf50';
    } else if (g.negScore > g.posScore) {
      bg = 'linear-gradient(135deg, rgba(234, 67, 53, 0.08) 0%, rgba(234, 67, 53, 0.2) 100%)';
      border = '1px solid rgba(234, 67, 53, 0.3)';
      textColor = '#e57373';
      barColor = '#ea4335';
    } else if (total > 0) {
      bg = 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.08) 100%)';
      border = '1px solid rgba(255, 255, 255, 0.15)';
      textColor = '#e3e3e3';
      barColor = '#9e9e9e';
    }
    
    const isActive = window.currentTimelineFilter === key;
    if (isActive) {
      border = '2px solid var(--primary)';
      textColor = 'var(--primary)';
    }
    
    // 柱状比例计算
    const maxBarHeight = 24;
    const barHeight = Math.max(3, Math.min(maxBarHeight, total * 3));
    
    const cell = document.createElement('div');
    cell.style.cssText = `
      flex-shrink: 0;
      padding: 6px 12px;
      background: ${bg};
      border: ${border};
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      min-width: 64px;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      user-select: none;
    `;
    if (isActive) {
      cell.style.boxShadow = '0 0 10px rgba(138, 180, 248, 0.2)';
    }
    
    cell.innerHTML = `
      <span style="font-size: 10px; font-weight: 600; color: ${textColor};">${g.label}</span>
      <div style="width: 12px; height: ${maxBarHeight}px; display: flex; align-items: flex-end; justify-content: center; background: rgba(255,255,255,0.03); border-radius: 3px; overflow: hidden;">
        <div style="width: 100%; height: ${barHeight}px; background: ${barColor}; border-radius: 2px; transition: height 0.3s;"></div>
      </div>
      <span style="font-size: 9px; color: var(--text-muted); opacity: 0.85;">${total} 篇</span>
    `;
    
    cell.onclick = () => {
      if (window.currentTimelineFilter === key) {
        window.currentTimelineFilter = null;
      } else {
        window.currentTimelineFilter = key;
      }
      window.updateTimelineFilterUI(baseNotes);
      window.renderNotesListWithActiveFilter();
    };
    
    wrapper.appendChild(cell);
  });
};

window.updateTimelineFilterUI = function(baseNotes) {
  const badge = document.getElementById('timeline-filter-badge');
  if (!badge) return;
  
  if (window.currentTimelineFilter) {
    badge.textContent = `📅 过滤: ${window.currentTimelineFilter} ✕`;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
  
  // 重绘时间轴状态的高亮
  window.renderTimelineHeatmap(baseNotes);
};

window.renderNotesListWithActiveFilter = function() {
  const file = window.importedFiles.find(f => f.id === window.activeFileId);
  if (!file) return;
  const searchInput = document.getElementById('search-input');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
  let baseNotes = file.categories[window.activeCategoryName] || [];
  
  if (query) {
    baseNotes = baseNotes.filter(note => {
      return note.title.toLowerCase().includes(query) || 
             note.content.toLowerCase().includes(query) ||
             note.category.toLowerCase().includes(query);
    });
  }
  
  if (typeof window.renderNotesList === 'function') {
    window.renderNotesList(baseNotes);
  }
};

function setupTimelineHeatmap() {
  const groupSelect = document.getElementById('timeline-group-mode');
  if (groupSelect) {
    groupSelect.addEventListener('change', (e) => {
      window.timelineGroupMode = e.target.value;
      const file = window.importedFiles.find(f => f.id === window.activeFileId);
      if (file) {
        const notes = file.categories[window.activeCategoryName] || [];
        window.renderTimelineHeatmap(notes);
        window.updateTimelineFilterUI(notes);
      }
    });
  }
  
  const filterBadge = document.getElementById('timeline-filter-badge');
  if (filterBadge) {
    filterBadge.addEventListener('click', () => {
      window.currentTimelineFilter = null;
      const file = window.importedFiles.find(f => f.id === window.activeFileId);
      if (file) {
        const notes = file.categories[window.activeCategoryName] || [];
        window.updateTimelineFilterUI(notes);
      }
      window.renderNotesListWithActiveFilter();
    });
  }
}



// ==================== 👁️ 沉浸式专注阅读 + 本地划词高亮逻辑 ====================
let immersiveConfig = JSON.parse(localStorage.getItem('xinnote_immersive_config') || JSON.stringify({
  font: 'sans-serif',
  fontSize: '16',
  lineHeight: '1.6',
  theme: 'default'
}));

window.applyImmersiveStyles = function() {
  const readerBody = document.getElementById('reader-body');
  if (!readerBody) return;
  
  if (immersiveConfig.font === 'serif') {
    readerBody.style.fontFamily = 'Georgia, "Times New Roman", STSong, serif';
  } else if (immersiveConfig.font === 'monospace') {
    readerBody.style.fontFamily = 'Consolas, Monaco, monospace';
  } else {
    readerBody.style.fontFamily = '';
  }
  
  readerBody.style.fontSize = `${immersiveConfig.fontSize}px`;
  readerBody.style.lineHeight = immersiveConfig.lineHeight;
  
  const readerView = document.getElementById('reader-view');
  if (readerView) {
    if (immersiveConfig.theme === 'eye') {
      readerView.style.background = '#fdf6e3';
      readerView.style.color = '#586e75';
      readerBody.style.color = '#586e75';
    } else if (immersiveConfig.theme === 'parchment') {
      readerView.style.background = '#f4ecd8';
      readerView.style.color = '#5c4033';
      readerBody.style.color = '#5c4033';
    } else if (immersiveConfig.theme === 'dark') {
      readerView.style.background = '#0c0c0c';
      readerView.style.color = '#e0e0e0';
      readerBody.style.color = '#e0e0e0';
    } else {
      readerView.style.background = '';
      readerView.style.color = '';
      readerBody.style.color = '';
    }
  }
  
  // 更新 UI 控件值
  const fontSelect = document.getElementById('immersive-font');
  const sizeInput = document.getElementById('immersive-fontsize');
  const sizeVal = document.getElementById('immersive-fontsize-val');
  const lineInput = document.getElementById('immersive-lineheight');
  const lineVal = document.getElementById('immersive-lineheight-val');
  
  if (fontSelect) fontSelect.value = immersiveConfig.font;
  if (sizeInput) sizeInput.value = immersiveConfig.fontSize;
  if (sizeVal) sizeVal.textContent = `${immersiveConfig.fontSize}px`;
  if (lineInput) lineInput.value = immersiveConfig.lineHeight;
  if (lineVal) lineVal.textContent = immersiveConfig.lineHeight;
};

window.toggleImmersiveMode = function(active) {
  const sidebar = document.querySelector('.sidebar');
  const notesPanel = document.querySelector('.notes-panel');
  const viewTabs = document.getElementById('view-tabs');
  const controls = document.getElementById('immersive-controls');
  const readerHeader = document.querySelector('.reader-header');
  
  if (active) {
    if (sidebar) sidebar.style.display = 'none';
    if (notesPanel) notesPanel.style.display = 'none';
    if (viewTabs) viewTabs.style.display = 'none';
    if (readerHeader) readerHeader.style.display = 'none';
    if (controls) controls.style.display = 'flex';
  } else {
    if (sidebar) sidebar.style.display = '';
    if (notesPanel) notesPanel.style.display = '';
    if (viewTabs) viewTabs.style.display = '';
    if (readerHeader) readerHeader.style.display = '';
    if (controls) controls.style.display = 'none';
  }
};

window.loadAndApplyHighlights = function(noteId, container) {
  const key = `xinnote_hl_${noteId}`;
  const highlights = JSON.parse(localStorage.getItem(key) || '[]');
  if (highlights.length === 0) return;
  
  let html = container.innerHTML;
  highlights.forEach(hl => {
    const escaped = hl.text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'g');
    html = html.replace(regex, `<mark class="note-highlight" style="background: rgba(255, 235, 59, 0.45); color: #000; border-radius: 4px; padding: 0 2px; position: relative; cursor: pointer;" title="点击可清除此标注">${hl.text}</mark>`);
  });
  container.innerHTML = html;
  
  // 绑定点击高亮区域清除高亮
  container.querySelectorAll('.note-highlight').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('确认要删除这段文字的高亮标注吗？')) {
        const textToRemove = el.textContent;
        const remaining = highlights.filter(h => h.text !== textToRemove);
        localStorage.setItem(key, JSON.stringify(remaining));
        
        // 重新刷新读取视图
        if (window.currentSelectedNote) {
          window.selectNote(window.currentSelectedNote);
        }
      }
    });
  });
};

function setupImmersiveReading() {
  const btnToggle = document.getElementById('btn-toggle-immersive');
  const btnExit = document.getElementById('btn-exit-immersive');
  
  if (btnToggle) {
    btnToggle.addEventListener('click', () => window.toggleImmersiveMode(true));
  }
  if (btnExit) {
    btnExit.addEventListener('click', () => window.toggleImmersiveMode(false));
  }
  
  // 排版变化监听
  const fontSelect = document.getElementById('immersive-font');
  const sizeInput = document.getElementById('immersive-fontsize');
  const sizeVal = document.getElementById('immersive-fontsize-val');
  const lineInput = document.getElementById('immersive-lineheight');
  const lineVal = document.getElementById('immersive-lineheight-val');
  
  if (fontSelect) {
    fontSelect.addEventListener('change', (e) => {
      immersiveConfig.font = e.target.value;
      localStorage.setItem('xinnote_immersive_config', JSON.stringify(immersiveConfig));
      window.applyImmersiveStyles();
    });
  }
  
  if (sizeInput) {
    sizeInput.addEventListener('input', (e) => {
      immersiveConfig.fontSize = e.target.value;
      if (sizeVal) sizeVal.textContent = `${e.target.value}px`;
      localStorage.setItem('xinnote_immersive_config', JSON.stringify(immersiveConfig));
      window.applyImmersiveStyles();
    });
  }
  
  if (lineInput) {
    lineInput.addEventListener('input', (e) => {
      immersiveConfig.lineHeight = e.target.value;
      if (lineVal) lineVal.textContent = e.target.value;
      localStorage.setItem('xinnote_immersive_config', JSON.stringify(immersiveConfig));
      window.applyImmersiveStyles();
    });
  }
  
  // 主题按钮监听
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      immersiveConfig.theme = btn.getAttribute('data-theme');
      localStorage.setItem('xinnote_immersive_config', JSON.stringify(immersiveConfig));
      window.applyImmersiveStyles();
    });
  });
  
  // 创建高亮 Tooltip 气泡
  const hlTooltip = document.createElement('div');
  hlTooltip.id = 'note-highlight-tooltip';
  hlTooltip.style.cssText = 'display: none; position: fixed; z-index: 100001; background: rgba(30,30,30,0.9); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 6px 12px; cursor: pointer; color: #fff; font-size: 11px; font-weight: 600; box-shadow: 0 6px 20px rgba(0,0,0,0.4); align-items: center; gap: 4px; transition: opacity 0.2s;';
  hlTooltip.innerHTML = '✨ 划词高亮';
  document.body.appendChild(hlTooltip);
  
  const readerBody = document.getElementById('reader-body');
  if (readerBody) {
    readerBody.addEventListener('mouseup', (e) => {
      const selection = window.getSelection();
      const text = selection.toString().trim();
      if (text.length > 0 && window.currentSelectedNote) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        hlTooltip.style.display = 'flex';
        hlTooltip.style.left = `${rect.left + window.scrollX + (rect.width / 2) - 40}px`;
        hlTooltip.style.top = `${rect.top + window.scrollY - 36}px`;
        
        hlTooltip.onclick = (evt) => {
          evt.stopPropagation();
          evt.preventDefault();
          
          const key = `xinnote_hl_${window.currentSelectedNote.id}`;
          const highlights = JSON.parse(localStorage.getItem(key) || '[]');
          if (!highlights.some(h => h.text === text)) {
            highlights.push({ text: text, color: 'yellow' });
            localStorage.setItem(key, JSON.stringify(highlights));
          }
          
          hlTooltip.style.display = 'none';
          window.getSelection().removeAllRanges();
          
          // 立即更新高亮渲染
          window.loadAndApplyHighlights(window.currentSelectedNote.id, readerBody);
        };
      } else {
        hlTooltip.style.display = 'none';
      }
    });
    
    // 点击空白处关闭气泡
    document.addEventListener('mousedown', (e) => {
      if (e.target.id !== 'note-highlight-tooltip' && !hlTooltip.contains(e.target)) {
        hlTooltip.style.display = 'none';
      }
    });
  }
  
  // 初始化灯箱事件绑定
  setupLightboxEvents();
}

// ==================== 🖼️ 图片相册 + 📊 表格排序 + 🔗 离线外链接口拦截 ====================
let currentGalleryImages = [];
let currentImageIndex = 0;

window.interceptAndParseContent = function(noteId, rawContent) {
  currentGalleryImages = [];
  
  // 1. 🔍 图片提取正则
  const mdImgRegex = /!\[.*?\]\((.*?)\)/g;
  const rawImgRegex = /(?<!\()https?:\/\/[^\s\)]+\.(?:png|jpg|jpeg|gif|webp|bmp)(?=\s|$|\))/gi;
  
  let match;
  while ((match = mdImgRegex.exec(rawContent)) !== null) {
    if (!currentGalleryImages.includes(match[1])) currentGalleryImages.push(match[1]);
  }
  while ((match = rawImgRegex.exec(rawContent)) !== null) {
    if (!currentGalleryImages.includes(match[0])) currentGalleryImages.push(match[0]);
  }
  
  // 渲染顶部相册方阵
  const galleryContainer = document.getElementById('note-image-gallery');
  if (galleryContainer) {
    if (currentGalleryImages.length > 0) {
      galleryContainer.style.display = 'flex';
      galleryContainer.innerHTML = currentGalleryImages.map((src, idx) => `
        <div style="position: relative; width: 80px; height: 80px; flex-shrink: 0; border-radius: 8px; border: 1px solid var(--border-color); overflow: hidden; cursor: pointer; transition: transform 0.2s;" onclick="window.openLightbox(${idx})">
          <img src="${src}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'80\' height=\'80\'><rect width=\'80\' height=\'80\' fill=\'%23333\'/><text x=\'20\' y=\'45\' fill=\'%23fff\' font-size=\'12\'>🖼️ 无效链接</text></svg>'">
        </div>
      `).join('');
    } else {
      galleryContainer.style.display = 'none';
    }
  }
  
  // 2. 🔗 零联网外链卡片解析
  let parsed = rawContent;
  const urlRegex = /(?<![\(\!])https?:\/\/[^\s\)\#]+(?=\s|$|\))/g;
  parsed = parsed.replace(urlRegex, (url) => {
    if (/\.(?:png|jpg|jpeg|gif|webp|bmp)$/i.test(url)) return url;
    
    let domain = '外部链接';
    try {
      domain = new URL(url).hostname;
    } catch (e) {}
    
    return `<a href="${url}" target="_blank" class="offline-link-card" style="display: inline-flex; align-items: center; gap: 8px; margin: 6px 0; padding: 8px 16px; background: rgba(138, 180, 248, 0.05); border: 1px solid rgba(138, 180, 248, 0.12); border-radius: 10px; color: var(--primary); text-decoration: none; font-size: 12px; transition: all 0.2s; max-width: 100%; box-sizing: border-box;" onclick="event.stopPropagation();">
      <span style="font-size: 14px;">🔗</span>
      <span style="display: flex; flex-direction: column; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        <strong style="color: #fff; font-size: 11px; margin-bottom: 2px;">${domain}</strong>
        <span style="color: var(--text-muted); font-size: 10px; opacity: 0.8; overflow: hidden; text-overflow: ellipsis;">${url}</span>
      </span>
    </a>`;
  });
  
  return parsed;
};

// 🖼️ 灯箱控制
window.openLightbox = function(index) {
  const lightbox = document.getElementById('gallery-lightbox');
  const img = document.getElementById('lightbox-img');
  const counter = document.getElementById('lightbox-counter');
  
  if (!lightbox || !img || currentGalleryImages.length === 0) return;
  
  currentImageIndex = index;
  img.src = currentGalleryImages[index];
  if (counter) {
    counter.textContent = `${index + 1} / ${currentGalleryImages.length}`;
  }
  lightbox.style.display = 'flex';
};

window.closeLightbox = function() {
  const lightbox = document.getElementById('gallery-lightbox');
  if (lightbox) lightbox.style.display = 'none';
};

window.navigateLightbox = function(dir) {
  if (currentGalleryImages.length === 0) return;
  let nextIdx = currentImageIndex + dir;
  if (nextIdx < 0) nextIdx = currentGalleryImages.length - 1;
  if (nextIdx >= currentGalleryImages.length) nextIdx = 0;
  window.openLightbox(nextIdx);
};

window.downloadLightboxImage = function() {
  if (currentGalleryImages.length === 0) return;
  const src = currentGalleryImages[currentImageIndex];
  
  const a = document.createElement('a');
  a.href = src;
  a.download = src.split('/').pop() || 'download_image.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

// 📊 表格自适应且可点击排序
window.makeTablesSortable = function(container) {
  container.querySelectorAll('table').forEach(table => {
    if (!table.parentElement.classList.contains('table-scroll-wrapper')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'table-scroll-wrapper';
      wrapper.style.cssText = 'overflow-x: auto; max-width: 100%; border: 1px solid var(--border-color); border-radius: 12px; margin: 16px 0; background: rgba(255,255,255,0.01);';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
      
      table.style.width = '100%';
      table.style.borderCollapse = 'collapse';
      table.querySelectorAll('th, td').forEach(cell => {
        cell.style.padding = '10px 12px';
        cell.style.borderBottom = '1px solid var(--border-color)';
      });
    }
    
    const headers = table.querySelectorAll('th');
    headers.forEach((th, colIdx) => {
      th.style.cursor = 'pointer';
      th.style.userSelect = 'none';
      th.style.position = 'relative';
      th.style.paddingRight = '20px';
      th.style.background = 'rgba(255,255,255,0.03)';
      th.title = '点击进行排序';
      
      let asc = true;
      th.addEventListener('click', () => {
        const tbody = table.querySelector('tbody') || table;
        const rows = Array.from(tbody.querySelectorAll('tr')).filter(r => r.querySelector('td'));
        
        rows.sort((rowA, rowB) => {
          const valA = rowA.children[colIdx]?.textContent.trim() || '';
          const valB = rowB.children[colIdx]?.textContent.trim() || '';
          
          const numA = parseFloat(valA);
          const numB = parseFloat(valB);
          
          if (!isNaN(numA) && !isNaN(numB)) {
            return asc ? numA - numB : numB - numA;
          }
          return asc ? valA.localeCompare(valB, 'zh') : valB.localeCompare(valA, 'zh');
        });
        
        asc = !asc;
        
        headers.forEach(h => {
          const arrow = h.querySelector('.sort-indicator');
          if (arrow) arrow.remove();
        });
        
        const arrow = document.createElement('span');
        arrow.className = 'sort-indicator';
        arrow.style.cssText = 'position: absolute; right: 6px; top: 50%; transform: translateY(-50%); font-size: 10px; opacity: 0.75; color: var(--primary);';
        arrow.textContent = asc ? '▲' : '▼';
        th.appendChild(arrow);
        
        rows.forEach(r => tbody.appendChild(r));
      });
    });
  });
};

// 绑定灯箱事件
function setupLightboxEvents() {
  const lightbox = document.getElementById('gallery-lightbox');
  if (!lightbox) return;

  const closeBtn = document.getElementById('lightbox-close');
  const prevBtn = document.getElementById('lightbox-prev');
  const nextBtn = document.getElementById('lightbox-next');
  const downBtn = document.getElementById('lightbox-download');
  
  if (closeBtn) closeBtn.addEventListener('click', window.closeLightbox);
  if (prevBtn) prevBtn.addEventListener('click', () => window.navigateLightbox(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => window.navigateLightbox(1));
  if (downBtn) downBtn.addEventListener('click', window.downloadLightboxImage);
  
  document.addEventListener('keydown', (e) => {
    if (lightbox.style.display === 'flex') {
      if (e.key === 'Escape') window.closeLightbox();
      if (e.key === 'ArrowLeft') window.navigateLightbox(-1);
      if (e.key === 'ArrowRight') window.navigateLightbox(1);
    }
  });
}

// ============================================================================
// ==================== ✨ AI 智能助手增强功能扩展集锦 ====================
// ============================================================================

// --- 1. 自定义 AI 提示词模板 + 本地模板市场 ---
const PRESET_PROMPTS = [
  {
    id: 'preset_work',
    name: '职场复盘 (STAR 法则)',
    category: '职场',
    prompt_content: '请从 STAR 法则（情境 Situation、任务 Task、行动 Action、结果 Result）审视这段工作便签，评估其中的亮点与不足，并给出下一步改进的具体建议。以下是便签文本：\n{content}',
    isPreset: true
  },
  {
    id: 'preset_emotion',
    name: '情绪疏导 (拉康/心理学)',
    category: '心理',
    prompt_content: '请化身温暖且深刻的心理咨询师，剖析这段便签背后的潜意识焦虑与核心情绪，帮助我理清情绪脉络并进行疏导。以下是便签文本：\n{content}',
    isPreset: true
  },
  {
    id: 'preset_learning',
    name: '费曼白话学习法',
    category: '学习',
    prompt_content: '请提取这段学习笔记中的核心硬核知识点，并用费曼学习法进行白话解释，设计 2 个测试问题来检验我的掌握程度。以下是便签文本：\n{content}',
    isPreset: true
  }
];

window.getPromptTemplates = function() {
  const custom = JSON.parse(localStorage.getItem('xinnote_custom_prompts') || '[]');
  return [...PRESET_PROMPTS, ...custom];
};

window.renderPromptTemplates = function() {
  const grid = document.getElementById('prompt-templates-grid');
  if (!grid) return;
  
  const templates = window.getPromptTemplates();
  grid.innerHTML = templates.map(tpl => {
    return `
      <div class="template-card" style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span class="meta-tag" style="font-size: 10px; background: rgba(138, 180, 248, 0.12); color: var(--primary); padding: 2px 6px; border-radius: 4px;">${tpl.category}</span>
            ${tpl.isPreset ? '' : `<button onclick="window.deletePromptTemplate('${tpl.id}')" style="background: transparent; border: none; color: #ea4335; cursor: pointer; font-size: 11px;">删除</button>`}
          </div>
          <div style="font-weight: 600; font-size: 13px; color: #fff; margin-bottom: 6px;">${tpl.name}</div>
          <div style="font-size: 11px; color: var(--text-muted); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4; word-break: break-all;">${tpl.prompt_content}</div>
        </div>
        <button onclick="window.usePromptTemplate('${tpl.id}')" style="width: 100%; padding: 6px; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-color); color: var(--primary); border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; text-align: center; transition: all 0.2s;">一键分析</button>
      </div>
    `;
  }).join('');
};

window.saveNewPromptTemplate = function() {
  const name = document.getElementById('new-template-name').value.trim();
  const category = document.getElementById('new-template-cat').value.trim();
  const prompt_content = document.getElementById('new-template-content').value.trim();
  
  if (!name || !category || !prompt_content) {
    alert('请填写完整的名称、分类和提示词内容！');
    return;
  }
  
  const custom = JSON.parse(localStorage.getItem('xinnote_custom_prompts') || '[]');
  const newTpl = {
    id: 'tpl_' + Date.now(),
    name,
    category,
    prompt_content,
    isPreset: false
  };
  
  custom.push(newTpl);
  localStorage.setItem('xinnote_custom_prompts', JSON.stringify(custom));
  
  document.getElementById('new-template-name').value = '';
  document.getElementById('new-template-cat').value = '';
  document.getElementById('new-template-content').value = '';
  
  window.renderPromptTemplates();
  alert('✅ 自定义模板已成功存入本地市场！');
};

window.deletePromptTemplate = function(id) {
  if (!confirm('确认要删除该自定义提示词模板吗？')) return;
  let custom = JSON.parse(localStorage.getItem('xinnote_custom_prompts') || '[]');
  custom = custom.filter(t => t.id !== id);
  localStorage.setItem('xinnote_custom_prompts', JSON.stringify(custom));
  window.renderPromptTemplates();
};

window.usePromptTemplate = function(id) {
  const templates = window.getPromptTemplates();
  const tpl = templates.find(t => t.id === id);
  if (!tpl) return;
  
  let content = '';
  if (window.currentSelectedNote) {
    content = window.currentSelectedNote.content || '';
  }
  
  let text = tpl.prompt_content;
  if (text.includes('{content}')) {
    text = text.replace('{content}', content);
  } else {
    text = text + '\n\n' + content;
  }
  
  const aiChatInput = document.getElementById('ai-chat-input');
  if (aiChatInput) {
    aiChatInput.value = text;
    aiChatInput.style.height = 'auto';
    aiChatInput.style.height = aiChatInput.scrollHeight + 'px';
  }
  
  const modal = document.getElementById('prompt-market-modal');
  if (modal) modal.style.display = 'none';
  
  const btnTabAi = document.getElementById('btn-tab-ai');
  if (btnTabAi) btnTabAi.click();
};

window.exportPromptTemplates = function() {
  const custom = JSON.parse(localStorage.getItem('xinnote_custom_prompts') || '[]');
  const blob = new Blob([JSON.stringify(custom, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'templates.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

window.importPromptTemplates = function(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const templates = JSON.parse(e.target.result);
      if (!Array.isArray(templates)) {
        throw new Error('导入的模板数据格式不正确，应为 JSON 数组。');
      }
      
      const custom = JSON.parse(localStorage.getItem('xinnote_custom_prompts') || '[]');
      templates.forEach(tpl => {
        if (tpl.name && tpl.category && tpl.prompt_content) {
          custom.push({
            id: 'tpl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            name: tpl.name,
            category: tpl.category,
            prompt_content: tpl.prompt_content,
            isPreset: false
          });
        }
      });
      
      localStorage.setItem('xinnote_custom_prompts', JSON.stringify(custom));
      window.renderPromptTemplates();
      alert('✅ 提示词模板导入成功！');
    } catch (err) {
      alert('导入失败: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
};

// --- 2. IndexedDB 对话历史归档与复用 ---
let dbInstance = null;
const DB_NAME = 'xinnote_chat_history_db';
const DB_VERSION = 1;
window.currentChatSessionId = null;

window.initIndexedDB = function() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (e) => reject(e);
    request.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('chat_history')) {
        db.createObjectStore('chat_history', { keyPath: 'id' });
      }
    };
  });
};

window.saveChatSessionToDB = async function(session) {
  if (!dbInstance) await window.initIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction(['chat_history'], 'readwrite');
    const store = transaction.objectStore('chat_history');
    const request = store.put(session);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e);
  });
};

window.deleteChatSessionFromDB = async function(id) {
  if (!dbInstance) await window.initIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction(['chat_history'], 'readwrite');
    const store = transaction.objectStore('chat_history');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e);
  });
};

window.getChatHistoryFromDB = async function() {
  if (!dbInstance) await window.initIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction(['chat_history'], 'readonly');
    const store = transaction.objectStore('chat_history');
    const request = store.getAll();
    request.onsuccess = (e) => resolve(e.target.result || []);
    request.onerror = (e) => reject(e);
  });
};

window.autoArchiveCurrentChat = async function() {
  if (!window.aiMessageHistory || window.aiMessageHistory.length <= 1) return;
  
  const firstUserMsg = window.aiMessageHistory.find(m => m.role === 'user');
  const title = firstUserMsg ? firstUserMsg.content.substring(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '') : '未命名对话';
  
  if (!window.currentChatSessionId) {
    window.currentChatSessionId = 'session_' + Date.now();
  }
  
  const session = {
    id: window.currentChatSessionId,
    title: title,
    noteId: window.currentSelectedNote ? window.currentSelectedNote.id : null,
    messages: JSON.parse(JSON.stringify(window.aiMessageHistory)),
    updatedAt: Date.now()
  };
  
  try {
    await window.saveChatSessionToDB(session);
    window.renderChatHistoryList();
  } catch (e) {
    console.error('Failed to auto-archive chat:', e);
  }
};

window.renderChatHistoryList = async function() {
  const container = document.getElementById('chat-history-list');
  if (!container) return;
  
  const searchInput = document.getElementById('chat-history-search');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  
  try {
    let sessions = await window.getChatHistoryFromDB();
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    
    if (query) {
      sessions = sessions.filter(s => {
        if (s.title.toLowerCase().includes(query)) return true;
        return s.messages.some(m => m.content.toLowerCase().includes(query));
      });
    }
    
    if (sessions.length === 0) {
      container.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 11px; padding: 12px 0;">无归档对话</div>`;
      return;
    }
    
    container.innerHTML = sessions.map(s => {
      const activeClass = window.currentChatSessionId === s.id ? 'active-history-item' : '';
      return `
        <div class="history-session-item ${activeClass}" onclick="window.restoreChatSession('${s.id}')" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; border-radius: 6px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); cursor: pointer; transition: all 0.2s; gap: 6px;">
          <div style="flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 11px; color: #fff;">
            💬 ${s.title}
          </div>
          <button onclick="event.stopPropagation(); window.deleteChatSession('${s.id}')" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 10px; opacity: 0.6;" title="删除此条记录">✕</button>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to render chat history list:', err);
  }
};

window.restoreChatSession = async function(id) {
  try {
    const sessions = await window.getChatHistoryFromDB();
    const session = sessions.find(s => s.id === id);
    if (!session) return;
    
    window.currentChatSessionId = session.id;
    window.aiMessageHistory = JSON.parse(JSON.stringify(session.messages));
    
    const aiChatMessages = document.getElementById('ai-chat-messages');
    if (aiChatMessages) {
      aiChatMessages.innerHTML = '';
      
      window.aiMessageHistory.forEach(msg => {
        if (msg.role === 'system') return;
        const role = msg.role;
        const displayQuery = msg.role === 'user' ? msg.content.replace(/@([\w\u4e00-\u9fa5·\-_\s]+?)(?=\s|$|@)/g,
          (m, name) => `<span class="at-tag-chip">@${name.trim()}</span>`) : undefined;
        
        appendChatBubble(role, msg.content, displayQuery);
      });
    }
    
    if (session.noteId) {
      const note = (window.rawNotes || []).find(n => n.id === session.noteId);
      if (note) {
        if (typeof window.selectNote === 'function' && (!window.currentSelectedNote || window.currentSelectedNote.id !== note.id)) {
          window.selectNote(note);
        }
      }
    }
    
    const btnExport = document.getElementById('btn-export-ai');
    if (btnExport) btnExport.style.display = 'flex';
    
    window.renderChatHistoryList();
    
    const btnTabAi = document.getElementById('btn-tab-ai');
    if (btnTabAi) btnTabAi.click();
    
  } catch (err) {
    console.error('Failed to restore chat session:', err);
  }
};

window.deleteChatSession = async function(id) {
  if (!confirm('确认要删除该条历史对话记录吗？')) return;
  try {
    await window.deleteChatSessionFromDB(id);
    if (window.currentChatSessionId === id) {
      window.currentChatSessionId = null;
      window.aiMessageHistory = [];
      const aiChatMessages = document.getElementById('ai-chat-messages');
      if (aiChatMessages) {
        aiChatMessages.innerHTML = '';
        const btnNewChat = document.getElementById('btn-new-chat');
        if (btnNewChat) btnNewChat.click();
      }
    }
    window.renderChatHistoryList();
  } catch (err) {
    console.error('Failed to delete chat session:', err);
  }
};

// --- 3. 原生语音交互（STT/TTS） ---
let recognition = null;
let isRecording = false;

window.initSpeechRecognition = function() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('当前浏览器不支持 Web Speech API 语音识别');
    return;
  }
  
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.lang = 'zh-CN';
  recognition.interimResults = false;
  
  const btn = document.getElementById('btn-stt-ai');
  if (!btn) return;
  
  recognition.onstart = () => {
    isRecording = true;
    btn.style.background = 'rgba(234, 67, 53, 0.2)';
    btn.style.borderColor = '#ea4335';
    btn.style.color = '#ea4335';
    btn.innerHTML = '🎙️...';
  };
  
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    const aiChatInput = document.getElementById('ai-chat-input');
    if (aiChatInput) {
      aiChatInput.value += transcript;
      aiChatInput.style.height = 'auto';
      aiChatInput.style.height = aiChatInput.scrollHeight + 'px';
    }
  };
  
  recognition.onend = () => {
    isRecording = false;
    btn.style.background = '';
    btn.style.borderColor = '';
    btn.style.color = '';
    btn.innerHTML = '🎙️';
  };
  
  recognition.onerror = (e) => {
    console.error('语音识别错误', e);
    isRecording = false;
  };
  
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (isRecording) {
      recognition.stop();
    } else {
      recognition.start();
    }
  });
};

window.speakTtsText = function(btn) {
  const bubble = btn.closest('.chat-bubble');
  if (!bubble) return;
  const bubbleTextEl = bubble.querySelector('.bubble-text');
  if (!bubbleTextEl) return;
  
  const text = bubbleTextEl.textContent.trim();
  if (!text) return;
  
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    btn.innerHTML = '🔊 朗读';
    btn.style.color = '';
    return;
  }
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  
  utterance.onstart = () => {
    btn.innerHTML = '🛑 停止';
    btn.style.color = 'var(--primary)';
  };
  
  utterance.onend = utterance.onerror = () => {
    btn.innerHTML = '🔊 朗读';
    btn.style.color = '';
  };
  
  window.speechSynthesis.speak(utterance);
};

// --- 4. Tesseract.js 本地离线 OCR ---
window.handleOcrImageUpload = async function(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!window.currentSelectedNote) {
    alert('请先选择一篇便签，OCR 识别的内容将追加至该便签尾部。');
    return;
  }
  
  const btnOcr = document.getElementById('btn-ocr-note');
  if (!btnOcr) return;
  
  const originalHtml = btnOcr.innerHTML;
  btnOcr.disabled = true;
  btnOcr.innerHTML = '<span>⏳ 识别中 (0%)</span>';
  
  try {
    const result = await Tesseract.recognize(
      file,
      'chi_sim+eng',
      {
        logger: m => {
          if (m.status === 'recognizing text') {
            const pct = Math.round(m.progress * 100);
            btnOcr.innerHTML = `<span>⏳ 识别中 (${pct}%)</span>`;
          }
        }
      }
    );
    
    const text = result.data.text;
    if (!text.trim()) {
      alert('未在此图片中识别到任何文字！');
    } else {
      const separator = '\n\n---\n📷 **OCR 识别结果**：\n';
      const updatedContent = (window.currentSelectedNote.content || '') + separator + text;
      
      const updated = await ApiClient.updateNote(window.currentSelectedNote.id, {
        title: window.currentSelectedNote.title,
        category: window.currentSelectedNote.category,
        content: updatedContent
      });
      
      await loadNotesFromDB();
      const mappedNote = (window.rawNotes || []).find(n => n.id === updated.id);
      if (mappedNote && typeof window.selectNote === 'function') {
        window.selectNote(mappedNote);
      }
      alert('✅ OCR 识别成功，文本已追加到便签底部！');
    }
  } catch (err) {
    console.error('OCR 识别失败:', err);
    alert('OCR 识别失败: ' + err.message);
  } finally {
    btnOcr.disabled = false;
    btnOcr.innerHTML = originalHtml;
    event.target.value = '';
  }
};

// --- 5. 联合初始化与事件绑定挂载 ---
function setupAiEnhancements() {
  // A. 注入动态样式
  const style = document.createElement('style');
  style.textContent = `
    .history-session-item:hover {
      background: rgba(255, 255, 255, 0.08) !important;
      border-color: var(--primary) !important;
    }
    .active-history-item {
      background: rgba(138, 180, 248, 0.15) !important;
      border-color: var(--primary) !important;
    }
  `;
  document.head.appendChild(style);

  // B. 绑定 Prompt 市场模态框
  const btnPromptMarket = document.getElementById('btn-prompt-market');
  const promptMarketModal = document.getElementById('prompt-market-modal');
  const btnClosePromptMarket = document.getElementById('btn-close-prompt-market');

  if (btnPromptMarket && promptMarketModal) {
    btnPromptMarket.addEventListener('click', () => {
      window.renderPromptTemplates();
      promptMarketModal.style.display = 'flex';
    });
  }
  if (btnClosePromptMarket && promptMarketModal) {
    btnClosePromptMarket.addEventListener('click', () => {
      promptMarketModal.style.display = 'none';
    });
  }
  if (promptMarketModal) {
    promptMarketModal.addEventListener('click', (e) => {
      if (e.target === promptMarketModal) {
        promptMarketModal.style.display = 'none';
      }
    });
  }

  // C. 绑定 OCR 按钮触发图片选择
  const btnOcr = document.getElementById('btn-ocr-note');
  const ocrInput = document.getElementById('ocr-file-input');
  if (btnOcr && ocrInput) {
    btnOcr.addEventListener('click', () => {
      ocrInput.click();
    });
  }

  // D. 监听历史会话新建以重置 SessionId
  const btnNewChat = document.getElementById('btn-new-chat');
  if (btnNewChat) {
    btnNewChat.addEventListener('click', () => {
      window.currentChatSessionId = null;
      window.renderChatHistoryList();
    });
  }

  // E. 初始化语音识别
  window.initSpeechRecognition();

  // F. 初始化 IndexedDB 并渲染历史会话列表
  window.initIndexedDB().then(() => {
    window.renderChatHistoryList();
  }).catch(err => {
    console.error('IndexedDB 初始化失败:', err);
  });
}

// 绑定初始化生命周期挂载
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setupTimelineHeatmap();
    setupImmersiveReading();
    setupAiEnhancements();
  });
} else {
  setupTimelineHeatmap();
  setupImmersiveReading();
  setupAiEnhancements();
}
