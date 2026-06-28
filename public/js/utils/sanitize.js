/**
 * 统一安全渲染工具
 * F2-1: DOMPurify 封装 + escapeHtml
 *
 * 加载方式:
 *   <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.9/dist/purify.min.js"></script>
 *   (或 vendor 本地化)
 */

/* global DOMPurify */

const SANITIZE_ALLOWED_TAGS = [
  'a','b','i','em','strong','code','pre','blockquote',
  'ul','ol','li','p','br','hr','h1','h2','h3','h4',
  'table','thead','tbody','tr','th','td','img','del','span','div','input'
];

const SANITIZE_ALLOWED_ATTR = [
  'href','src','alt','title','class','target','rel',
  'width','height','type','checked','disabled','data-note-id'
];

/**
 * 渲染 Markdown 并清除危险 tag/attr
 * 返回可直接 innerHTML 的安全字符串
 * 若 DOMPurify 未加载则降级为 escapeHtml
 */
export function renderMarkdownSafe(input) {
  if (input == null || input === '') return '';

  const raw = typeof marked !== 'undefined' && marked.parse
    ? marked.parse(String(input), { breaks: true, gfm: true, async: false })
    : String(input);

  if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
    return DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: SANITIZE_ALLOWED_TAGS,
      ALLOWED_ATTR: SANITIZE_ALLOWED_ATTR,
      ALLOW_DATA_ATTR: true
    });
  }

  // 降级: 全转义
  return escapeHtml(raw);
}

/**
 * 纯文本转义 (用于 chip/标题/preview)
 */
export function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}
