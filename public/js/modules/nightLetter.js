/**
 * 心迹星图 深夜来信 · 前端交互模块
 * 职责：提供收信列表、阅信面板、回信输入、手动触发检测的完整 UI
 *
 * 生命周期：mount → unmount（自动清理 AbortController 和全局函数）
 * 通信模式：SSE 流式接收来信，非 SSE 查询历史
 */
import { ApiClient } from '../api.js';

// ── 模块状态 ────────────────────────────────────────────

let containerEl = null;
let currentThreadId = null;
let abortCtrl = null;
let triggerBtnBound = false;
let replyBtnBound = false;

// ── 生命周期 ────────────────────────────────────────────

export function mountNightLetter(container) {
  containerEl = container;
  renderMainView();
}

export function unmountNightLetter() {
  if (abortCtrl) {
    abortCtrl.abort();
    abortCtrl = null;
  }
  containerEl = null;
  currentThreadId = null;
  triggerBtnBound = false;
  replyBtnBound = false;
  // 清理全局转发函数
  delete window.triggerNightLetterCheck;
  delete window.replyToNightLetter;
  delete window.openNightLetterThread;
}

// ── 主视图渲染 ──────────────────────────────────────────

function renderMainView() {
  if (!containerEl) return;
  containerEl.innerHTML = `
    <div class="night-letter-container" style="max-width:860px;margin:0 auto;padding:20px 0;">
      <!-- 顶部区域 -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
        <div>
          <h2 style="font-size:22px;font-weight:700;margin:0;background:linear-gradient(135deg,#f5c542,#ff6b8a);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">💌 深夜来信</h2>
          <p style="color:var(--text-muted);font-size:13px;margin:4px 0 0 0;">历史伟人穿越时空，为你写来的私人信件</p>
        </div>
        <div style="display:flex;gap:8px;">
          <button id="nl-trigger-btn" class="nl-primary-btn" style="background:linear-gradient(135deg,#8ab4f8,#4285f4);color:#131314;border:none;border-radius:10px;padding:8px 18px;font-weight:600;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:6px;">
            🔍 检测来信
          </button>
        </div>
      </div>

      <!-- 状态/进度指示 -->
      <div id="nl-status" style="display:none;padding:10px 14px;background:rgba(138,180,248,0.06);border:1px solid rgba(138,180,248,0.12);border-radius:10px;margin-bottom:16px;font-size:13px;color:var(--text-muted);"></div>

      <!-- 加载状态 -->
      <div id="nl-loading" style="display:flex;justify-content:center;padding:60px 0;color:var(--text-muted);font-size:13px;">
        <span class="typing-loading">正在加载来信...</span>
      </div>

      <!-- 主内容：左侧 persona 列表 + 右侧信件面板 -->
      <div style="display:flex;gap:16px;">
        <!-- 左侧：人格列表 -->
        <div id="nl-persona-list" style="flex:0 0 200px;display:flex;flex-direction:column;gap:8px;"></div>

        <!-- 右侧：信件面板 -->
        <div id="nl-thread-view" style="flex:1;min-height:400px;border:1px solid var(--border-color);border-radius:14px;background:rgba(255,255,255,0.02);padding:16px;display:flex;flex-direction:column;">
          <div id="nl-letters" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:12px;">
            <div style="text-align:center;padding:60px 0;color:var(--text-muted);font-size:14px;">
              🌙 选择左侧来信，或点击「检测来信」获取新信
            </div>
          </div>
          <!-- 回信输入 -->
          <div id="nl-reply-area" style="display:none;margin-top:12px;border-top:1px solid var(--border-color);padding-top:12px;">
            <div style="display:flex;gap:8px;">
              <textarea id="nl-reply-input" placeholder="写下你的回信..." style="flex:1;background:rgba(255,255,255,0.03);border:1px solid var(--border-color);border-radius:10px;padding:10px;color:#fff;font-size:13px;resize:none;min-height:60px;max-height:120px;outline:none;"></textarea>
              <button id="nl-send-reply" class="nl-primary-btn" style="background:var(--primary);color:#131314;border:none;border-radius:10px;padding:8px 16px;font-weight:600;cursor:pointer;align-self:flex-end;font-size:13px;">发送</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <style>
      .nl-persona-card {
        padding:10px 12px;border-radius:10px;cursor:pointer;transition:all 0.2s;
        border:1px solid var(--border-color);background:rgba(255,255,255,0.02);
      }
      .nl-persona-card:hover { background:rgba(138,180,248,0.06); border-color:rgba(138,180,248,0.2); }
      .nl-persona-card.active { background:rgba(138,180,248,0.12); border-color:var(--primary); }
      .nl-letter-bubble { padding:14px;border-radius:12px;max-width:85%;line-height:1.6;font-size:13px; }
      .nl-letter-bubble.persona { align-self:flex-start;background:rgba(138,180,248,0.06);border:1px solid rgba(138,180,248,0.1); }
      .nl-letter-bubble.user { align-self:flex-end;background:rgba(66,133,244,0.1);border:1px solid rgba(66,133,244,0.15); }
      .nl-quote-snippet { border-left:2px solid var(--primary);padding-left:10px;margin:8px 0;font-style:italic;opacity:0.8;font-size:12px; }
    </style>
  `;

  // 加载数据
  loadPersonasAndThreads();

  // 全局函数转发（供 HTML onclick 调用）
  window.triggerNightLetterCheck = handleTriggerCheck;
  window.openNightLetterThread = openThread;
  window.replyToNightLetter = handleReply;
}

// ── 数据加载 ────────────────────────────────────────────

async function loadPersonasAndThreads() {
  const loadingEl = document.getElementById('nl-loading');
  const personaList = document.getElementById('nl-persona-list');
  if (!personaList) return;

  try {
    const [personasRes, threadsRes] = await Promise.all([
      ApiClient.listNightLetterPersonas(),
      ApiClient.listNightLetterThreads()
    ]);

    const personas = personasRes?.data?.personas || [];
    const threads = threadsRes?.data?.threads || [];

    // 渲染左侧 persona 列表（按是否有来信排序）
    const hasThread = new Map();
    threads.forEach(t => hasThread.set(t.persona_id, t));

    let html = '';
    personas.forEach(p => {
      const thread = hasThread.get(p.id);
      const tags = p.philosophy_tags ? tryParseJSON(p.philosophy_tags) : [];
      const tagStr = Array.isArray(tags) ? tags.slice(0, 2).join(' · ') : '';
      html += `
        <div class="nl-persona-card ${thread ? '' : ''}" data-persona-id="${p.id}"
             ${thread ? `onclick="window.openNightLetterThread('${thread.id}')"` : ''}
             style="opacity:${thread ? 1 : 0.5};">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:20px;">${p.avatar_emoji || '🏛️'}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;font-size:13px;color:#fff;">${escapeHtml(p.display_name)}</div>
              <div style="font-size:10px;color:var(--text-muted);">${escapeHtml(p.era || '')}</div>
            </div>
            ${thread && !thread.is_read ? '<span style="width:8px;height:8px;border-radius:50%;background:#ea4335;flex-shrink:0;"></span>' : ''}
          </div>
          ${tagStr ? `<div style="font-size:10px;color:var(--text-muted);margin-top:6px;">${escapeHtml(tagStr)}</div>` : ''}
          ${thread ? `<div style="font-size:10px;color:var(--primary);margin-top:4px;">💬 ${thread.letter_count || 1} 封信</div>` : '<div style="font-size:10px;color:var(--text-muted);margin-top:4px;">暂无来信</div>'}
        </div>
      `;
    });
    personaList.innerHTML = html;

    if (loadingEl) loadingEl.style.display = 'none';

    // 自动选中第一条未读
    const unread = threads.find(t => !t.is_read);
    if (unread) {
      openThread(unread.id);
    } else if (threads.length > 0) {
      openThread(threads[0].id);
    }

    // 绑定检测按钮
    if (!triggerBtnBound) {
      document.getElementById('nl-trigger-btn')?.addEventListener('click', handleTriggerCheck);
      triggerBtnBound = true;
    }

  } catch (err) {
    console.error('[nightLetter] 加载失败:', err);
    if (loadingEl) {
      loadingEl.innerHTML = `<span style="color:#ea4335;">❌ 加载失败: ${escapeHtml(err.message)}</span>`;
    }
  }
}

// ── 打开来信线程 ────────────────────────────────────────

async function openThread(threadId) {
  if (!threadId) return;
  currentThreadId = threadId;
  const lettersEl = document.getElementById('nl-letters');
  const replyArea = document.getElementById('nl-reply-area');
  if (!lettersEl) return;

  lettersEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">加载中...</div>';

  try {
    const res = await ApiClient.getNightLetters(threadId);
    const data = res?.data || res;
    const letters = data.letters || [];
    const thread = data.thread || {};

    lettersEl.innerHTML = '';

    if (letters.length === 0) {
      lettersEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">暂无信件内容</div>';
      return;
    }

    letters.forEach(l => {
      const isPersona = l.role === 'persona';
      const bubble = document.createElement('div');
      bubble.className = `nl-letter-bubble ${isPersona ? 'persona' : 'user'}`;

      let quotesHtml = '';
      if (isPersona && l.quoted_note_snippets) {
        const snippets = typeof l.quoted_note_snippets === 'string'
          ? tryParseJSON(l.quoted_note_snippets)
          : l.quoted_note_snippets;
        if (Array.isArray(snippets) && snippets.length > 0) {
          quotesHtml = snippets.slice(0, 2).map(s =>
            `<div class="nl-quote-snippet">💭 "${escapeHtml(s.quote || '').substring(0,150)}"</div>`
          ).join('');
        }
      }

      const roleLabel = isPersona
        ? (thread.persona?.display_name || '来信')
        : '你的回信';

      bubble.innerHTML = `
        <div style="font-size:10px;color:var(--text-muted);margin-bottom:6px;font-weight:600;">${escapeHtml(roleLabel)}</div>
        <div class="markdown-body" style="font-size:13px;line-height:1.7;">${l.content ? marked.parse(l.content) : ''}</div>
        ${quotesHtml}
        <div style="font-size:10px;color:var(--text-muted);margin-top:8px;">${formatTime(l.created_at)}</div>
      `;
      lettersEl.appendChild(bubble);
    });

    // 滚动到底部
    lettersEl.scrollTop = lettersEl.scrollHeight;

    // 显示回信区域
    if (replyArea) replyArea.style.display = 'block';
    setupReplyInput();

  } catch (err) {
    lettersEl.innerHTML = `<div style="text-align:center;padding:40px;color:#ea4335;">❌ 加载失败: ${escapeHtml(err.message)}</div>`;
  }
}

// ── 检测来信触发 ────────────────────────────────────────

function handleTriggerCheck() {
  const statusEl = document.getElementById('nl-status');
  const btn = document.getElementById('nl-trigger-btn');
  if (!statusEl || !btn) return;

  if (abortCtrl) {
    abortCtrl.abort();
    abortCtrl = null;
  }
  abortCtrl = new AbortController();

  btn.disabled = true;
  btn.innerHTML = '<span>⏳ 检测中...</span>';
  statusEl.style.display = 'block';
  statusEl.innerHTML = '🔄 正在扫描近期日记...';

  ApiClient.subscribeTriggerNightLetter({}, {
    signal: abortCtrl.signal,
    onStatus: (data) => {
      statusEl.innerHTML = `🔄 ${escapeHtml(data.message || '')}`;
    },
    onChunk: (data) => {
      // 生成过程中的流式文本不显示在状态栏
    },
    onResult: (data) => {
      if (data.shouldSend) {
        const name = data.personaName || '历史智者';
        const emoji = data.personaEmoji || '📜';
        statusEl.innerHTML = `✅ ${emoji} ${escapeHtml(name)} 给你写了一封信！`;
        // 刷新线程列表
        loadPersonasAndThreads();
        if (data.threadId) {
          setTimeout(() => openThread(data.threadId), 500);
        }
      } else {
        statusEl.innerHTML = '💫 目前未检测到适合触发来信的情绪波动。继续保持记录！';
      }
    },
    onError: (err) => {
      statusEl.innerHTML = `❌ ${escapeHtml(err.message || '检测出错')}`;
    },
    onDone: () => {
      btn.disabled = false;
      btn.innerHTML = '🔍 检测来信';
      abortCtrl = null;
    }
  });
}

// ── 回信 ────────────────────────────────────────────────

function setupReplyInput() {
  const input = document.getElementById('nl-reply-input');
  const sendBtn = document.getElementById('nl-send-reply');
  if (!input || !sendBtn) return;

  if (!replyBtnBound) {
    const doSend = () => {
      const text = input.value.trim();
      if (!text || !currentThreadId) return;
      handleReply(text);
      input.value = '';
    };

    sendBtn.onclick = doSend;
    input.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        doSend();
      }
    };
    replyBtnBound = true;
  }
}

function handleReply(text) {
  if (!currentThreadId) return;
  const lettersEl = document.getElementById('nl-letters');
  if (!lettersEl) return;

  if (abortCtrl) {
    abortCtrl.abort();
    abortCtrl = null;
  }
  abortCtrl = new AbortController();

  // 立即渲染用户消息
  const userBubble = document.createElement('div');
  userBubble.className = 'nl-letter-bubble user';
  userBubble.innerHTML = `
    <div style="font-size:10px;color:var(--text-muted);margin-bottom:6px;font-weight:600;">你的回信</div>
    <div style="font-size:13px;line-height:1.7;">${escapeHtml(text)}</div>
  `;
  lettersEl.appendChild(userBubble);

  // 渲染等待泡
  const waitBubble = document.createElement('div');
  waitBubble.className = 'nl-letter-bubble persona';
  waitBubble.id = 'nl-waiting-bubble';
  waitBubble.innerHTML = '<span class="typing-loading" style="color:var(--text-muted);font-style:italic;">正在回信...</span>';
  lettersEl.appendChild(waitBubble);
  lettersEl.scrollTop = lettersEl.scrollHeight;

  ApiClient.subscribeReplyNightLetter(currentThreadId, text, {
    signal: abortCtrl.signal,
    onChunk: (data) => {
      const waiting = document.getElementById('nl-waiting-bubble');
      if (!waiting) return;
      const existing = waiting.querySelector('.ai-response');
      if (existing) {
        existing.innerHTML = marked.parse(existing.dataset.fullContent + (data.content || ''));
        existing.dataset.fullContent += data.content || '';
      } else {
        waiting.innerHTML = `
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:6px;font-weight:600;">来信回复</div>
          <div class="ai-response markdown-body" data-full-content="${escapeHtml(data.content || '')}" style="font-size:13px;line-height:1.7;">
            ${marked.parse(data.content || '')}
          </div>`;
      }
      lettersEl.scrollTop = lettersEl.scrollHeight;
    },
    onResult: () => {},
    onDone: () => {
      abortCtrl = null;
    },
    onError: (err) => {
      const waiting = document.getElementById('nl-waiting-bubble');
      if (waiting) {
        waiting.innerHTML += `<div style="color:#ea4335;margin-top:8px;font-size:12px;">❌ ${escapeHtml(err.message)}</div>`;
      }
      abortCtrl = null;
    }
  });
}

// ── 工具函数 ────────────────────────────────────────────

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
  return d.toLocaleDateString('zh-CN');
}

function tryParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}
