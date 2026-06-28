/**
 * 心迹星图 轻量状态管理 Store
 * 职责：集中管理前端所有全局状态，替换 window.* 全局变量模式
 *
 * 用法：
 *   import { store } from './core/state.js';
 *   store.setState('notes', [...]);
 *   const notes = store.getState('notes');
 *   const unsub = store.subscribe('notes', (newVal, oldVal) => { ... });
 *
 * 设计原则：
 * - 不可变更新：setState 内部做浅拷贝，禁止外部直接变异 state
 * - 发布/订阅：subscribe 返回取消订阅函数，组件卸载时必须调用
 * - 零依赖：纯 ES module
 */
class 心迹星图Store {
  constructor() {
    /** @type {Object<string, any>} */
    this._state = this._getInitialState();
    /** @type {Object<string, Set<Function>>} */
    this._listeners = {};
  }

  // ── 初始状态定义 ──────────────────────────────────────

  /**
   * @returns {Object} 所有状态字段初始值
   */
  _getInitialState() {
    return {
      // 便签数据
      notes: [],
      categories: [],
      currentNote: null,
      activeFileId: 'db-notes',
      activeCategoryName: '全部便签',

      // 用户信息
      user: null,
      isLoggedIn: false,

      // AI 对话
      chatHistory: [],
      currentChatSessionId: null,
      selectedPerspectiveId: 'default',

      // UI 状态
      isLoading: false,
      isDarkTheme: true,
      searchQuery: '',
      deletedCount: 0,

      // 同步
      syncHistory: [],

      // 编辑模式
      isEditing: false,
    };
  }

  /**
   * 重置所有状态为初始值
   */
  reset() {
    this._state = this._getInitialState();
    this._notifyAll();
  }

  // ── 读取 ───────────────────────────────────────────────

  /**
   * 获取指定状态
   * @param {string} key
   * @returns {any}
   */
  getState(key) {
    if (key == null) {
      // 返回整个 state 的浅拷贝（防止外部变异）
      return { ...this._state };
    }
    return this._state[key];
  }

  // ── 写入 ───────────────────────────────────────────────

  /**
   * 设置指定状态，通过浅拷贝保证不可变
   * @param {string|Object} key - 键名，或 { key: value } 对象
   * @param {any} [value]
   */
  setState(key, value) {
    if (typeof key === 'object' && key !== null && !Array.isArray(key)) {
      // 批量更新：setState({ notes: [...], user: ... })
      const oldState = { ...this._state };
      let changed = false;
      for (const k in key) {
        if (Object.prototype.hasOwnProperty.call(key, k)) {
          if (this._state[k] !== key[k]) {
            this._state[k] = key[k];
            changed = true;
          }
        }
      }
      if (changed) {
        this._notifyListeners(null, oldState);
      }
      return;
    }

    const oldVal = this._state[key];
    if (oldVal === value) return; // 无变化，跳过通知
    this._state[key] = value;
    this._notifyListeners(key, oldVal);
  }

  // ── 订阅 ───────────────────────────────────────────────

  /**
   * 订阅状态变化
   * @param {string} key - 监听的键名，或 '*' 监听所有
   * @param {Function} callback - (newVal, oldVal) => void
   * @returns {Function} unsubscribe 函数
   */
  subscribe(key, callback) {
    if (!this._listeners[key]) {
      this._listeners[key] = new Set();
    }
    this._listeners[key].add(callback);

    const self = this;
    return function unsubscribe() {
      const set = self._listeners[key];
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          delete self._listeners[key];
        }
      }
    };
  }

  // ── 便捷 getter/setter（可选） ──────────────────────────

  get notes() { return this._state.notes || []; }
  set notes(val) { this.setState('notes', val); }

  get currentNote() { return this._state.currentNote || null; }
  set currentNote(val) { this.setState('currentNote', val); }

  get categories() { return this._state.categories || []; }
  set categories(val) { this.setState('categories', val); }

  get chatHistory() { return this._state.chatHistory || []; }
  set chatHistory(val) { this.setState('chatHistory', val); }

  get user() { return this._state.user || null; }
  set user(val) { this.setState('user', val); }

  get isLoggedIn() { return !!this._state.isLoggedIn; }
  set isLoggedIn(val) { this.setState('isLoggedIn', val); }

  get isLoading() { return !!this._state.isLoading; }
  set isLoading(val) { this.setState('isLoading', val); }

  // ── 内部 ───────────────────────────────────────────────

  /**
   * 通知指定 key 的订阅者
   * @param {string|null} key - null 表示通知所有
   * @param {any} oldVal
   */
  _notifyListeners(key, oldVal) {
    if (key && this._listeners[key]) {
      const newVal = this._state[key];
      for (const cb of this._listeners[key]) {
        try {
          cb(newVal, oldVal);
        } catch (err) {
          console.error(`[Store] subscriber error for key="${key}":`, err);
        }
      }
    }
    // 通知全局监听器
    if (this._listeners['*']) {
      for (const cb of this._listeners['*']) {
        try {
          cb(this._state, { ...oldVal });
        } catch (err) {
          console.error('[Store] global subscriber error:', err);
        }
      }
    }
  }

  /**
   * 通知所有订阅者（reset 时使用）
   */
  _notifyAll() {
    for (const key in this._listeners) {
      if (Object.prototype.hasOwnProperty.call(this._listeners, key)) {
        for (const cb of this._listeners[key]) {
          try {
            cb(this._state, {});
          } catch (err) {
            console.error(`[Store] notifyAll error for key="${key}":`, err);
          }
        }
      }
    }
  }
}

// 单例导出
export const store = new 心迹星图Store();
export default store;
