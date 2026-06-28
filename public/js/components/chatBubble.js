/**
 * 心迹星图 AI 对话气泡渲染组件
 * 职责：渲染用户/AI 消息气泡、思考过程、追问建议卡片
 */
import { ApiClient } from '../api.js';

/**
 * 渲染消息气泡
 * @param {HTMLElement} container - 消息列表容器
 * @param {'user'|'ai'} role
 * @param {string} content - Markdown 原文
 * @param {string} [displayHtml] - 用户气泡的可选显示 HTML（@高亮等）
 * @param {Object} [perspective] - 当前视角配置
 * @returns {HTMLElement} 创建的气泡元素
 */
export function appendChatBubble(container, role, content, displayHtml, perspective) {
  const isAi = role === 'ai';
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;

  // 级联入场动画
  const bubbleCount = container.querySelectorAll('.chat-bubble').length;
  bubble.style.animationDelay = `${Math.min(bubbleCount * 0.035, 0.35)}s`;

  const username = ApiClient.getUsername() || 'User';

  // 头像
  let avatarHtml, senderName;
  if (isAi && perspective) {
    avatarHtml = `<div class="bubble-avatar-inner" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;">${perspective.avatarSvg || ''}</div>`;
    senderName = perspective.senderName || 'AI';
  } else if (isAi) {
    avatarHtml = `<div class="bubble-avatar-inner" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:11px;font-weight:700;color:#fff;">✦</div>`;
    senderName = '智能助理';
  } else {
    avatarHtml = `<div class="bubble-avatar-inner" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:11px;font-weight:700;color:#fff;">${username.substring(0, 2).toUpperCase()}</div>`;
    senderName = username;
  }

  let renderedContent;
  if (!isAi && displayHtml) {
    renderedContent = displayHtml;
  } else {
    renderedContent = typeof marked !== 'undefined' ? marked.parse(content || '') : (content || '');
  }

  bubble.innerHTML = `
    <div class="bubble-avatar" style="${isAi ? 'background: var(--gradient-gemini);' : ''}">
      ${avatarHtml}
    </div>
    <div class="bubble-content-wrapper">
      <div class="bubble-sender-name" style="display:flex;align-items:center;justify-content:space-between;">
        <span>${senderName}</span>
        ${isAi ? `<button class="tts-speak-btn" onclick="window.speakTtsText(this)" style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:11px;display:flex;align-items:center;gap:3px;" title="朗读回答">🔊 朗读</button>` : ''}
      </div>
      ${isAi ? `
        <div class="thinking-container" style="display:none;margin-bottom:12px;background:rgba(255,255,255,0.01);border-left:2px solid var(--border-color);padding-left:12px;">
          <div class="thinking-header" style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:4px;cursor:pointer;">💭 深度思考路径过程</div>
          <div class="thinking-body markdown-body" style="font-size:12px;color:var(--text-muted);opacity:0.85;line-height:1.5;"></div>
        </div>
      ` : ''}
      <div class="bubble-text markdown-body">${renderedContent}</div>
    </div>
  `;

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  return bubble;
}

/**
 * 渲染动态追问建议卡片
 * @param {HTMLElement} container - 消息列表容器
 * @param {Object} [perspective] - 当前视角（用于取 presets）
 * @param {HTMLElement} inputEl - 输入框（用于填充点击的问题）
 * @param {Function} sendFn - 发送函数
 */
export function appendFollowUpSuggestions(container, perspective, inputEl, sendFn) {
  // 清理旧的
  const existing = document.getElementById('ai-chat-dynamic-suggestions');
  if (existing) existing.remove();

  let options = [];

  if (perspective && perspective.presets && perspective.presets.length > 0) {
    options = [...perspective.presets].sort(() => 0.5 - Math.random()).slice(0, 2);
  }

  const globalOptions = [
    { icon: '🔮', title: '心魔拆解', question: '请帮我梳理：我过去的便签日记中，有没有反复出现的"自我怀疑"或"心魔焦虑"？它们是如何被我战胜的？' },
    { icon: '📈', title: '能力突跃', question: '根据我记录的日记，指出我在什么时间节点（哪年哪月）发生了最明显的技术或心智飞跃？' },
    { icon: '🍀', title: '小确幸盘点', question: '我的便签日记里，写下了哪些最微小但最能治愈我、让我感到幸福快乐的生活碎片？' }
  ];
  options.push(globalOptions[Math.floor(Math.random() * globalOptions.length)]);

  const suggestionsEl = document.createElement('div');
  suggestionsEl.id = 'ai-chat-dynamic-suggestions';
  suggestionsEl.className = 'ai-preset-cards-grid';
  suggestionsEl.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;padding:12px;border-top:1px dashed rgba(255,255,255,0.06);width:100%;max-width:820px;align-self:center;animation:fadeInUp 0.3s ease;';

  options.forEach(opt => {
    const card = document.createElement('div');
    card.className = 'ai-preset-card';
    card.style.cssText = 'flex:1;min-width:200px;padding:10px 14px;background:rgba(138,180,248,0.03);border:1px solid rgba(138,180,248,0.1);border-radius:12px;cursor:pointer;font-size:12px;transition:all 0.2s;';
    card.innerHTML = `
      <div style="font-weight:600;color:var(--primary);margin-bottom:2px;">${opt.icon || '✨'} ${opt.title || '延伸探讨'}</div>
      <div style="color:var(--text-muted);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${opt.question || opt.desc}</div>
    `;
    card.onclick = () => {
      if (inputEl) inputEl.value = opt.question || opt.desc;
      if (sendFn) sendFn();
    };
    suggestionsEl.appendChild(card);
  });

  container.appendChild(suggestionsEl);
  setTimeout(() => { container.scrollTop = container.scrollHeight; }, 100);
}

/**
 * 流式渲染节流器
 * @param {HTMLElement} element
 * @param {string} text
 * @param {number} [delay=80]
 */
export function scheduleMarkdownRender(element, text, delay = 80) {
  if (!element) return;
  if (element._renderTimeout) return;
  element._renderTimeout = setTimeout(() => {
    element._renderTimeout = null;
    element.innerHTML = typeof marked !== 'undefined' ? marked.parse(text) : text;
  }, delay);
}
