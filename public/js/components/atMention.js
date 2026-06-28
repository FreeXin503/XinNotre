/**
 * 心迹星图 @ 引用智能弹窗系统
 * 职责：在 AI 输入框中处理 @ 触发、搜索、选取引用上下文
 *
 * 用法:
 *   import { initAtMention } from './components/atMention.js';
 *   initAtMention(chatInput, popupEl, itemsEl, contextBar, contextChips);
 *
 * 键盘导航: ArrowDown/Up 选择, Enter/Tab 确认, Escape 关闭
 */
import { ApiClient } from '../api.js';

/**
 * 初始化 @ 引用弹窗
 * @param {HTMLTextAreaElement} chatInput - AI 输入框
 * @param {HTMLElement} popup - 弹窗容器
 * @param {HTMLElement} itemsEl - 弹窗列表容器
 * @param {HTMLElement} contextBar - 已选引用条
 * @param {HTMLElement} contextChips - 已选引用标签容器
 * @returns {Object} { handleInput, handleKey, selectedRefs, clearAllRefs }
 */
export function initAtMention(chatInput, popup, itemsEl, contextBar, contextChips) {
  if (!chatInput || !popup) return null;

  /** @type {{ type: string, name: string, id: string }[]} */
  const selectedRefs = [];
  let atActive = false;
  let atStart = -1;
  let atQuery = '';
  let atItems = [];
  let atSelIdx = 0;

  // ── 构建列表 ────────────────────────────────────────

  function buildItems(q) {
    const notes = window.rawNotes || [];
    const items = [];
    const ql = q.toLowerCase();

    // 1. 全部便签
    if (!q || '全部便签'.includes(ql) || 'all'.includes(ql)) {
      items.push({ type: 'all', name: '全部便签', id: '__all__', icon: '🌍', meta: `全量 ${notes.length} 篇便签（智能 RAG 关联）`, badge: 'all' });
    }

    // 2. 分类目录
    const catMap = {};
    notes.forEach(n => { const c = n.category || '未分类'; catMap[c] = (catMap[c] || 0) + 1; });
    Object.entries(catMap)
      .filter(([c]) => !ql || c.toLowerCase().includes(ql))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .forEach(([cat, count]) => {
        items.push({ type: 'category', name: cat, id: cat, icon: '📁', meta: `${count} 篇便签`, badge: 'folder' });
      });

    // 3. 便签条目
    if (q) {
      const matched = notes.filter(n =>
        (n.title || '').toLowerCase().includes(ql) ||
        (n.content || '').toLowerCase().includes(ql)
      );
      matched.slice(0, 8).forEach(n => {
        items.push({
          type: 'note', name: n.title || '无标题', id: n.id, icon: '📄',
          meta: `${n.category || '未分类'} · ${(n.content || '').substring(0, 50)}...`,
          badge: 'note'
        });
      });
    }
    return items;
  }

  // ── 渲染 ──────────────────────────────────────────────

  function renderPopup() {
    if (!itemsEl) return;
    if (atItems.length === 0) {
      itemsEl.innerHTML = '<div class="at-popup-empty" style="padding:12px;text-align:center;color:var(--text-muted);font-size:12px;">😶 未找到匹配的目录或便签</div>';
      return;
    }

    let html = '';
    let lastType = null;
    atItems.forEach((item, i) => {
      if (item.type !== lastType && item.type !== 'all') {
        html += `<div class="at-popup-section-label" style="padding:4px 10px;font-size:10px;color:var(--text-muted);font-weight:600;">${item.type === 'category' ? '📁 目录' : '📄 便签'}</div>`;
        lastType = item.type;
      }
      html += `
        <div class="at-popup-item ${i === atSelIdx ? 'at-selected' : ''}" data-idx="${i}" onclick="window._atSelectItem(${i})"
             style="display:flex;align-items:center;gap:8px;padding:6px 10px;cursor:pointer;border-radius:6px;${i === atSelIdx ? 'background:rgba(138,180,248,0.12);' : ''}transition:background 0.15s;">
          <span>${item.icon}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12px;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(item.name)}</div>
            <div style="font-size:10px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(item.meta)}</div>
          </div>
          <span style="font-size:9px;padding:1px 6px;border-radius:4px;background:rgba(255,255,255,0.06);color:var(--text-muted);white-space:nowrap;">${item.type === 'all' ? '全量' : item.type === 'category' ? '目录' : '便签'}</span>
        </div>`;
    });
    itemsEl.innerHTML = html;
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function showPopup(q) {
    atItems = buildItems(q);
    atSelIdx = 0;
    if (atItems.length === 0 && !q) { hidePopup(); return; }
    renderPopup();
    popup.style.display = 'block';
    popup.style.position = 'absolute';
  }

  function hidePopup() {
    popup.style.display = 'none';
    atActive = false;
  }

  // ── 已选引用标签条 ────────────────────────────────────

  function renderContextBar() {
    if (!contextBar || !contextChips) return;
    if (selectedRefs.length === 0) {
      contextBar.style.display = 'none';
      return;
    }
    contextBar.style.display = 'flex';
    contextChips.innerHTML = selectedRefs.map((ref, i) => {
      const icon = ref.type === 'all' ? '🌍' : ref.type === 'category' ? '📁' : ref.type === 'file' ? '📦' : '📄';
      return `<span class="at-context-chip" style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:rgba(138,180,248,0.1);border:1px solid rgba(138,180,248,0.15);border-radius:6px;font-size:11px;color:var(--primary);">
        ${icon} ${escapeHtml(ref.name)}
        <span class="at-chip-remove" onclick="window._atRemoveRef(${i})" style="cursor:pointer;opacity:0.6;margin-left:2px;" title="移除引用">✕</span>
      </span>`;
    }).join('');
  }

  // ── 公共方法 ──────────────────────────────────────────

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

    // 添加到已选引用列表
    if (!selectedRefs.find(r => r.id === item.id && r.type === item.type)) {
      selectedRefs.push({ type: item.type, name: item.name, id: item.id });
      renderContextBar();
    }

    hidePopup();
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  };

  window._atRemoveRef = function(idx) {
    const ref = selectedRefs[idx];
    if (!ref) return;
    selectedRefs.splice(idx, 1);
    renderContextBar();
    chatInput.value = chatInput.value.replace(`@${ref.name} `, '').replace(`@${ref.name}`, '');
  };

  /**
   * 输入处理（在 input 事件中调用）
   * @param {Event} e
   */
  function handleInput(e) {
    const val = chatInput.value;
    const cur = chatInput.selectionStart;
    const before = val.substring(0, cur);
    const lastAt = before.lastIndexOf('@');

    if (lastAt !== -1) {
      const afterAt = before.substring(lastAt + 1);
      if (!/\s/.test(afterAt)) {
        atActive = true;
        atStart = lastAt;
        atQuery = afterAt;
        showPopup(afterAt);
        return;
      }
    }
    hidePopup();
  }

  /**
   * 键盘导航处理
   * @param {KeyboardEvent} e
   * @returns {boolean} true 表示已消费该事件
   */
  function handleKey(e) {
    if (!atActive || popup.style.display === 'none') return false;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      atSelIdx = Math.min(atSelIdx + 1, atItems.length - 1);
      renderPopup();
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      atSelIdx = Math.max(atSelIdx - 1, 0);
      renderPopup();
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (atItems.length > 0) {
        e.preventDefault();
        window._atSelectItem(atSelIdx);
        return true;
      }
    }
    if (e.key === 'Escape') {
      hidePopup();
      return true;
    }
    return false;
  }

  function clearAllRefs() {
    selectedRefs.length = 0;
    renderContextBar();
  }

  // ── 外部点击关闭弹窗 ──────────────────────────────────

  document.addEventListener('click', (e) => {
    if (!popup.contains(e.target) && e.target !== chatInput) {
      hidePopup();
    }
  });

  return {
    handleInput,
    handleKey,
    selectedRefs,
    clearAllRefs,
    renderContextBar
  };
}
