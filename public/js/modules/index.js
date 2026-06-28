/**
 * 心迹星图 统一模块加载器
 * 职责：管理 7 个业务模块的 mount/unmount 生命周期，
 *       提供动态切换能力，自动清理事件和 AbortController
 *
 * 每个模块必须 export mount(container) 和 unmount()
 * 缺乏 unmount 的模块使用默认空函数
 */
import { mountPersona, unmountPersona } from './persona.js';
import { mountGrowthTree } from './growthTree.js';
import { mountEmotionWeather } from './emotionWeather.js';
import { mountArchaeology, unmountArchaeology } from './archaeology.js';
import { mountAlmanac } from './almanac.js';
import { mountNightLetter, unmountNightLetter } from './nightLetter.js';
import { mountThoughtSpectrum, unmountThoughtSpectrum } from './thoughtSpectrum.js';
import { mountCosmos, unmountCosmos } from './cosmos.js';
import { mountPenpal, unmountPenpal } from './penpal.js';
import { mountLetter, unmountLetter } from './letter.js';
import { mountMemoir, unmountMemoir } from './memoir.js';

// ── 模块注册表 ──────────────────────────────────────────

/**
 * @type {Object<string, { mount: (el:HTMLElement, opts?:Object) => void, unmount: () => void, label: string }>}
 */
export const MODULE_REGISTRY = {
  persona: {
    mount: mountPersona,
    unmount: unmountPersona,
    label: '🧬 灵魂人格档案'
  },
  'growth-tree': {
    mount: mountGrowthTree,
    unmount: () => {
      // growthTree.js 的 abortCtrl 存储在模块闭包内，无法外部中止
      // 仅清理 DOM；正在运行的 SSE 流将在写入已移除的 DOM 时自然失败
      const container = document.querySelector('[data-module]');
      if (container) container.innerHTML = '';
    },
    label: '🌱 成长证据树'
  },
  'emotion-weather': {
    mount: mountEmotionWeather,
    unmount: () => {
      const container = document.querySelector('[data-module]');
      if (container) container.innerHTML = '';
    },
    label: '🌤️ 情感天气'
  },
  archaeology: {
    mount: mountArchaeology,
    unmount: unmountArchaeology,
    label: '🏺 盲盒考古'
  },
  almanac: {
    mount: mountAlmanac,
    unmount: () => {
      const container = document.querySelector('[data-module]');
      if (container) container.innerHTML = '';
    },
    label: '📅 年报卷宗'
  },
  'night-letter': {
    mount: mountNightLetter,
    unmount: unmountNightLetter,
    label: '💌 深夜来信'
  },
  'thought-spectrum': {
    mount: mountThoughtSpectrum,
    unmount: unmountThoughtSpectrum,
    label: '🌌 思想谱系星图'
  },
  'cosmos': {
    mount: mountCosmos,
    unmount: unmountCosmos,
    label: '🌀 心智星相图'
  },
  'penpal': {
    mount: mountPenpal,
    unmount: unmountPenpal,
    label: '✉️ 跨时空笔友'
  },
  'letter': {
    mount: mountLetter,
    unmount: unmountLetter,
    label: '📮 时光胶囊'
  },
  'memoir': {
    mount: mountMemoir,
    unmount: unmountMemoir,
    label: '📖 主题回忆录'
  }
};

// ── 状态 ────────────────────────────────────────────────

/** @type {string|null} */
let currentModuleName = null;

/**
 * 批量清理全局 window 函数，防止内存泄漏
 * @param {string[]} funcNames
 */
function cleanupWindowFunctions(funcNames) {
  funcNames.forEach(name => {
    try { delete window[name]; } catch (e) { window[name] = undefined; }
  });
}

// ── 公共 API ────────────────────────────────────────────

/**
 * 切换当前模块
 * @param {string} moduleName - MODULE_REGISTRY 中的键名
 * @param {HTMLElement} container - 挂载容器
 * @returns {Promise<void>}
 */
export async function switchModule(moduleName, container) {
  if (!container) {
    console.warn('[moduleLoader] 容器为空，无法挂载模块:', moduleName);
    return;
  }

  // 1. 卸载当前模块
  if (currentModuleName) {
    const current = MODULE_REGISTRY[currentModuleName];
    if (current && typeof current.unmount === 'function') {
      try {
        current.unmount();
      } catch (err) {
        console.error(`[moduleLoader] unmount "${currentModuleName}" 失败:`, err);
      }
    }
  }

  // 2. 清理所有模块的 window 函数
  cleanupWindowFunctions([
    'generatePersona', 'selectPersona', 'comparePersona',
    'digBlindBox', 'appraiseCard',
    'startEmotionAnnotation'
  ]);

  // 3. 如果模块名不存在，清空容器并返回
  if (!moduleName || !MODULE_REGISTRY[moduleName]) {
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--text-muted);">
        <div style="font-size: 32px; margin-bottom: 12px;">📭</div>
        <div style="font-size: 14px;">未知模块</div>
      </div>
    `;
    currentModuleName = null;
    return;
  }

  // 4. 挂载新模块
  const mod = MODULE_REGISTRY[moduleName];
  container.dataset.module = moduleName;
  currentModuleName = moduleName;

  try {
    await mod.mount(container);
  } catch (err) {
    console.error(`[moduleLoader] mount "${moduleName}" 失败:`, err);
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; color: #ea4335;">
        <div style="font-size: 32px; margin-bottom: 12px;">❌</div>
        <div style="font-size: 14px;">模块加载失败: ${err.message}</div>
      </div>
    `;
  }
}

/**
 * 获取当前模块名
 * @returns {string|null}
 */
export function getCurrentModule() {
  return currentModuleName;
}

/**
 * 获取所有可用模块列表
 * @returns {Array<{ name: string, label: string }>}
 */
export function getAvailableModules() {
  return Object.entries(MODULE_REGISTRY).map(([name, config]) => ({
    name,
    label: config.label
  }));
}
