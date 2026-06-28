/**
 * 心迹星图 便签时间轴 + 情感热力图组件
 * 职责：将便签按时间分组渲染为热力柱状图，支持情感分析着色和筛选
 *
 * 用法:
 *   import { renderTimelineHeatmap, setupTimelineControls } from './components/timelineHeatmap.js';
 *   renderTimelineHeatmap(notes, wrapperEl);
 *   setupTimelineControls(groupSelectEl, filterBadgeEl);
 */

// ── 轻量情感分析（基于词频） ─────────────────────────────

const POSITIVE_WORDS = ['开心', '快乐', '高兴', '幸福', '喜悦', '兴奋', '轻松', '满足', '顺利', '乐观', '棒', '赞', '舒服', '惬意', '美好'];
const NEGATIVE_WORDS = ['焦虑', '难过', '痛苦', '伤心', '沮丧', '郁闷', '烦躁', '生气', '愤怒', '绝望', '压力', '累', '疲惫', '抑郁', '纠结', '无奈', '担心', '害怕'];

function analyzeSentiment(content) {
  if (!content) return { emotion: 'neutral', score: 0 };
  const text = content.toLowerCase();
  let posCount = 0;
  let negCount = 0;
  POSITIVE_WORDS.forEach(w => { posCount += (text.split(w).length - 1); });
  NEGATIVE_WORDS.forEach(w => { negCount += (text.split(w).length - 1); });
  if (posCount > negCount) return { emotion: 'positive', score: posCount - negCount };
  if (negCount > posCount) return { emotion: 'negative', score: negCount - posCount };
  return { emotion: 'neutral', score: 0 };
}

// ── 状态 ────────────────────────────────────────────────

let timelineGroupMode = 'month';
let currentTimelineFilter = null;

/**
 * 设置分组模式
 * @param {'year'|'month'} mode
 */
export function setTimelineGroupMode(mode) {
  timelineGroupMode = mode;
}

/**
 * 获取当前过滤键
 * @returns {string|null}
 */
export function getTimelineFilter() {
  return currentTimelineFilter;
}

/**
 * 设置过滤键
 * @param {string|null} key
 */
export function setTimelineFilter(key) {
  currentTimelineFilter = key;
}

// ── 渲染 ────────────────────────────────────────────────

/**
 * 渲染时间轴热力图
 * @param {Object[]} baseNotes - 便签列表
 * @param {HTMLElement} wrapper - 滚动容器
 * @param {Function} [onCellClick] - 点击单元格回调 (key) => void
 */
export function renderTimelineHeatmap(baseNotes, wrapper, onCellClick) {
  if (!wrapper) return;
  wrapper.innerHTML = '';

  if (!baseNotes || baseNotes.length === 0) {
    wrapper.innerHTML = '<div style="color:var(--text-muted);font-size:11px;padding:4px;">当前分类无数据</div>';
    return;
  }

  // 按时间分组
  const groups = {};
  baseNotes.forEach(note => {
    const dateObj = new Date(note.date || note.updated_at || note.created_at);
    if (isNaN(dateObj.getTime())) return;
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const key = timelineGroupMode === 'year' ? String(y) : `${y}-${m}`;

    if (!groups[key]) {
      groups[key] = { key, label: timelineGroupMode === 'year' ? `${y}年` : `${y}-${m}`, notes: [], posScore: 0, negScore: 0 };
    }
    groups[key].notes.push(note);
    const sent = analyzeSentiment(note.content);
    if (sent.emotion === 'positive') groups[key].posScore += sent.score;
    else if (sent.emotion === 'negative') groups[key].negScore += sent.score;
  });

  // 排序
  const sortedKeys = Object.keys(groups).sort();

  sortedKeys.forEach(key => {
    const g = groups[key];
    const total = g.notes.length;
    const maxBarHeight = 24;

    // 颜色方案
    let bg = 'rgba(255,255,255,0.02)';
    let border = '1px solid rgba(255,255,255,0.08)';
    let textColor = 'var(--text-muted)';
    let barColor = '#8ab4f8';

    if (g.posScore > g.negScore) {
      bg = 'linear-gradient(135deg, rgba(76,175,80,0.08), rgba(76,175,80,0.2))';
      border = '1px solid rgba(76,175,80,0.3)';
      textColor = '#81c784';
      barColor = '#4caf50';
    } else if (g.negScore > g.posScore) {
      bg = 'linear-gradient(135deg, rgba(234,67,53,0.08), rgba(234,67,53,0.2))';
      border = '1px solid rgba(234,67,53,0.3)';
      textColor = '#e57373';
      barColor = '#ea4335';
    } else if (total > 0) {
      bg = 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.08))';
      border = '1px solid rgba(255,255,255,0.15)';
      textColor = '#e3e3e3';
      barColor = '#9e9e9e';
    }

    if (currentTimelineFilter === key) {
      border = '2px solid var(--primary)';
      textColor = 'var(--primary)';
    }

    const barHeight = Math.max(3, Math.min(maxBarHeight, total * 3));

    const cell = document.createElement('div');
    cell.style.cssText = `
      flex-shrink:0;padding:6px 12px;background:${bg};border:${border};
      border-radius:10px;cursor:pointer;display:flex;flex-direction:column;
      align-items:center;gap:5px;min-width:64px;
      transition:all 0.2s cubic-bezier(0.16,1,0.3,1);user-select:none;
    `;

    if (currentTimelineFilter === key) {
      cell.style.boxShadow = '0 0 10px rgba(138,180,248,0.2)';
    }

    cell.innerHTML = `
      <span style="font-size:10px;font-weight:600;color:${textColor};">${g.label}</span>
      <div style="width:12px;height:${maxBarHeight}px;display:flex;align-items:flex-end;justify-content:center;background:rgba(255,255,255,0.03);border-radius:3px;overflow:hidden;">
        <div style="width:100%;height:${barHeight}px;background:${barColor};border-radius:2px;transition:height 0.3s;"></div>
      </div>
      <span style="font-size:9px;color:var(--text-muted);opacity:0.85;">${total} 篇</span>
    `;

    cell.onclick = () => {
      const newKey = currentTimelineFilter === key ? null : key;
      currentTimelineFilter = newKey;
      if (onCellClick) onCellClick(newKey);
    };

    wrapper.appendChild(cell);
  });
}

/**
 * 设置时间轴控件的事件绑定
 * @param {HTMLElement} groupSelect - 分组模式下拉框
 * @param {HTMLElement} filterBadge - 过滤标签
 * @param {Function} onRefresh - 刷新回调
 */
export function setupTimelineControls(groupSelect, filterBadge, onRefresh) {
  if (groupSelect) {
    groupSelect.addEventListener('change', (e) => {
      timelineGroupMode = e.target.value;
      if (onRefresh) onRefresh();
    });
  }

  if (filterBadge) {
    filterBadge.addEventListener('click', () => {
      currentTimelineFilter = null;
      if (onRefresh) onRefresh();
    });
  }
}
