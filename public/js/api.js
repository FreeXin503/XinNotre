const API_BASE = (typeof window !== 'undefined' && window.__XINN_CONFIG__?.apiBase) || '/api';
const DEFAULT_TIMEOUT_MS = 30000;

class ApiTimeoutError extends Error {
  constructor(path) {
    super(`请求超时: ${path}`);
    this.name = 'ApiTimeoutError';
  }
}

export const ApiClient = {
  getToken() {
    return localStorage.getItem('xinnote_token');
  },

  setToken(token) {
    localStorage.setItem('xinnote_token', token);
  },

  clearToken() {
    localStorage.removeItem('xinnote_token');
  },

  getUsername() {
    return localStorage.getItem('xinnote_username') || '未登录用户';
  },

  setUsername(name) {
    localStorage.setItem('xinnote_username', name);
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  handleAuthFailure(message) {
    this.clearToken();
    localStorage.removeItem('xinnote_username');
    throw new Error(message || '登录已失效，请重新登录');
  },

  async request(path, options = {}) {
    const { timeout = DEFAULT_TIMEOUT_MS, retries = 0, responseType } = options;
    const ctrl = new AbortController();
    const timer = timeout > 0 ? setTimeout(() => ctrl.abort('timeout'), timeout) : null;

    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(`${API_BASE}${path}`, {
          ...options,
          signal: options.signal || ctrl.signal,
          headers: { ...this.getHeaders(options.headers), ...(options.headers || {}) }
        });

        if (res.status === 401) {
          const data = await res.json().catch(() => ({}));
          this.handleAuthFailure(data.error || '登录已失效，请重新登录');
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `请求失败 (${res.status})`);
        }

        if (responseType === 'blob') return await res.blob();
        const data = await res.json().catch(() => ({}));
        return data;
      } catch (err) {
        lastErr = err;
        if (err.name === 'AbortError') break;
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 500;
          await new Promise(r => setTimeout(r, delay));
        }
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    throw lastErr;
  },

  getHeaders(extra) {
    const token = this.getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  },

  async register(username, password) {
    return this.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
  },

  async login(username, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    this.setToken(data.token);
    this.setUsername(data.user.username);
    return data;
  },

  async getNotes(filters = {}) {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', filters.page);
    if (filters.pageSize) params.set('pageSize', filters.pageSize);
    if (filters.category) params.set('category', filters.category);
    if (filters.search) params.set('search', filters.search);

    return this.request(`/notes?${params.toString()}`, {
      method: 'GET',
      headers: this.getHeaders(),
      retries: 1
    });
  },

  async getDeletedNotes(filters = {}) {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', filters.page);
    if (filters.pageSize) params.set('pageSize', filters.pageSize);
    return this.request(`/notes/deleted?${params.toString()}`, {
      method: 'GET',
      headers: this.getHeaders(),
      retries: 1
    });
  },

  async getNoteDetail(id) {
    return this.request(`/notes/${id}`, { method: 'GET', headers: this.getHeaders(), retries: 1 });
  },

  async createNote(note) {
    return this.request('/notes', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(note)
    });
  },

  async updateNote(id, note) {
    return this.request(`/notes/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(note)
    });
  },

  async deleteNote(id, hard = false) {
    return this.request(`/notes/${id}?hard=${hard}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
  },

  async restoreNote(id) {
    return this.request(`/notes/${id}/restore`, {
      method: 'POST',
      headers: this.getHeaders()
    });
  },

  async syncPush(notes) {
    return this.request('/sync/push', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ notes })
    });
  },

  async getSyncHistory() {
    return this.request('/sync/history', {
      method: 'GET',
      headers: this.getHeaders(),
      retries: 1
    });
  },

  async getHealth() {
    return this.request('/health', { method: 'GET', headers: this.getHeaders(), retries: 1 });
  },

  // ── Unified SSE reader ──
  _sse(path, options, { onChunk, onDone, onError, onResult, onProgress, onStatus }) {
    const token = this.getToken();
    const fetchOpts = {
      method: options.method || 'POST',
      headers: { ...this.getHeaders(), ...(options.headers || {}) },
      body: options.body || undefined,
      signal: options.signal || undefined,
      timeout: 0  // SSE 不超时
    };
    if (token && !fetchOpts.headers['Authorization']) {
      fetchOpts.headers['Authorization'] = `Bearer ${token}`;
    }

    fetch(`${API_BASE}${path}`, fetchOpts).then(response => {
      if (!response.ok) {
        throw new Error(`请求失败 (${response.status})`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const signal = fetchOpts.signal;
      let doneFlag = false;

      function read() {
        reader.read().then(({ done, value }) => {
          if (doneFlag) return;
          if (signal?.aborted) { doneFlag = true; reader.cancel(); onDone?.(); return; }
          if (done) { doneFlag = true; onDone?.(); return; }
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop();
          for (const ev of events) {
            if (!ev.trim()) continue;
            const lines = ev.split('\n');
            let eventType = 'chunk';
            let dataStr = '';
            for (const line of lines) {
              if (line.startsWith('event: ')) eventType = line.substring(7).trim();
              else if (line.startsWith('data: ')) dataStr = line.substring(6).trim();
            }
            if (dataStr) {
              try {
                const data = JSON.parse(dataStr);
                if (eventType === 'chunk') onChunk?.(data);
                else if (eventType === 'done') { doneFlag = true; onDone?.(); return; }
                else if (eventType === 'error') { doneFlag = true; onError?.(new Error(data.message || 'SSE error')); return; }
                else if (eventType === 'result') onResult?.(data);
                else if (eventType === 'progress') onProgress?.(data);
                else if (eventType === 'status') onStatus?.(data);
              } catch { /* partial JSON, skip */ }
            }
          }
          read();
        }).catch(err => {
          if (doneFlag) return;
          doneFlag = true;
          if (err.name !== 'AbortError') {
            onError?.(err);
            onDone?.();
          } else {
            onDone?.();
          }
        });
      }
      read();
    }).catch(err => {
      if (err.name !== 'AbortError') {
        onError?.(err);
        onDone?.();
      } else {
        onDone?.();
      }
    });
  },

  chatStream(payload, onChunk, onDone, onError, signal, { onResult, onProgress, onStatus } = {}) {
    return this._sse('/ai/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal
    }, { onChunk, onDone, onError, onResult, onProgress, onStatus });
  },

  async getSkills() {
    const res = await fetch(`${API_BASE}/skills`, { method: 'GET', headers: this.getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '获取技能列表失败');
    return data;
  },

  // A1 Archaeology Blind Box
  async digBlindBox(digMode = 'random', seed = '') {
    return this.request('/archaeology/dig', {
      method: 'POST', headers: this.getHeaders(),
      body: JSON.stringify({ digMode, seed })
    });
  },

  async listArchaeologyCards() {
    return this.request('/archaeology/cards', { headers: this.getHeaders() });
  },

  subscribeArchaeologyAppraise(cardId, payload, handlers) {
    return this._sse(`/archaeology/${cardId}/appraise`, {
      method: 'POST', body: JSON.stringify(payload),
      signal: handlers?.signal
    }, handlers);
  },

  // B1 Soul Persona Archive
  subscribePersonaGenerate(payload, handlers) {
    return this._sse('/persona/generate', {
      method: 'POST', body: JSON.stringify(payload),
      signal: handlers?.signal
    }, handlers);
  },

  async listPersonas() {
    return this.request('/persona/history', { headers: this.getHeaders() });
  },

  async getPersonaDiff(fromId, toId) {
    return this.request(`/persona/diff?from=${fromId}&to=${toId}`, { headers: this.getHeaders() });
  },

  // A2 Emotion Weather Grid
  subscribeEmotionAnnotation(payload, handlers) {
    return this._sse('/annotation/emotion', {
      method: 'POST', body: JSON.stringify(payload),
      signal: handlers?.signal
    }, handlers);
  },

  async getWeatherGrid(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/weather/grid?${q}`, { headers: this.getHeaders() });
  },

  subscribeClimateDiagnosis(payload, handlers) {
    return this._sse('/weather/diagnosis', {
      method: 'POST', body: JSON.stringify(payload),
      signal: handlers?.signal
    }, handlers);
  },

  // D1 Life Almanac
  subscribeAlmanacPublish(payload, handlers) {
    return this._sse('/almanac/publish', {
      method: 'POST', body: JSON.stringify(payload),
      signal: handlers?.signal
    }, handlers);
  },

  async downloadAlmanacPdf(id) {
    const blob = await this.request(`/almanac/pdf/${id}`, {
      method: 'POST',
      headers: this.getHeaders(),
      responseType: 'blob',
      timeout: 60000
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `almanac-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  async listAlmanacs() {
    return this.request('/almanac/list', { headers: this.getHeaders() });
  },

  // B2 Growth Evidence Tree
  subscribeGoalExtraction(payload, handlers) {
    return this._sse('/goal/extract', {
      method: 'POST', body: JSON.stringify(payload),
      signal: handlers?.signal
    }, handlers);
  },

  async listGoals(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/goals?${q}`, { headers: this.getHeaders() });
  },

  async updateGoalStatus(id, status, settledYear) {
    return this.request(`/goals/${id}/status`, {
      method: 'PUT', headers: this.getHeaders(),
      body: JSON.stringify({ status, settledYear })
    });
  },

  async linkEvidence(goalId, noteId, evidenceType, noteText) {
    return this.request(`/goals/${goalId}/evidence`, {
      method: 'POST', headers: this.getHeaders(),
      body: JSON.stringify({ noteId, evidenceType, noteText })
    });
  },

  subscribeSettleYear(payload, handlers) {
    return this._sse('/goals/settle', {
      method: 'POST', body: JSON.stringify(payload),
      signal: handlers?.signal
    }, handlers);
  },

  getLengthMode() {
    const v = localStorage.getItem('ai_length_mode');
    return (v === 'short' || v === 'medium' || v === 'long') ? v : 'medium';
  },

  setLengthMode(mode) {
    if (mode === 'short' || mode === 'medium' || mode === 'long') {
      localStorage.setItem('ai_length_mode', mode);
    }
  },

  // ── E1 Night Letters — 逆向精神叩问 ──
  async listNightLetterPersonas() {
    return this.request('/night-letters/personas', { headers: this.getHeaders() });
  },

  async listNightLetterThreads() {
    return this.request('/night-letters/threads', { headers: this.getHeaders() });
  },

  async getNightLetters(threadId) {
    return this.request(`/night-letters/threads/${threadId}/letters`, { headers: this.getHeaders() });
  },

  subscribeTriggerNightLetter(payload, handlers) {
    return this._sse('/night-letters/check', {
      method: 'POST', body: JSON.stringify(payload || {}),
      signal: handlers?.signal
    }, handlers);
  },

  subscribeReplyNightLetter(threadId, message, handlers) {
    return this._sse(`/night-letters/threads/${threadId}/reply`, {
      method: 'POST', body: JSON.stringify({ message }),
      signal: handlers?.signal
    }, handlers);
  },

  // ── E2 Thought Spectrum — 思想谱系星图 ──
  subscribeGenerateSpectrum(payload, handlers) {
    return this._sse('/thought-spectrum/generate', {
      method: 'POST', body: JSON.stringify(payload),
      signal: handlers?.signal
    }, handlers);
  },

  async listThoughtSpectrum() {
    return this.request('/thought-spectrum/history', { headers: this.getHeaders() });
  },

  async getTopicEvolution(topicId) {
    return this.request(`/thought-spectrum/evolution?topicId=${topicId}`, { headers: this.getHeaders() });
  },

  async manageTopics(action, topicName) {
    return this.request('/thought-spectrum/topics', {
      method: 'POST', headers: this.getHeaders(),
      body: JSON.stringify({ action, topicName })
    });
  },

  // ── C1 跨时空笔友 ──
  async listPenpalThreads() {
    return this.request('/penpal/threads', { headers: this.getHeaders() });
  },
  async createPenpalThread(data) {
    return this.request('/penpal/threads', {
      method: 'POST', headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
  },
  subscribePenpalMessage(threadId, payload, handlers) {
    return this._sse(`/penpal/threads/${threadId}/messages`, {
      method: 'POST', body: JSON.stringify(payload),
      signal: handlers?.signal
    }, handlers);
  },
  async getPenpalLetters(threadId) {
    return this.request(`/penpal/threads/${threadId}/letters`, { headers: this.getHeaders() });
  },

  // ── C2 时光胶囊 ──
  async createLetter(data) {
    return this.request('/letter', {
      method: 'POST', headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
  },
  async listLetters() {
    return this.request('/letters', { headers: this.getHeaders() });
  },
  subscribeOpenLetter(id, handlers) {
    return this._sse(`/letter/${id}/open`, {
      method: 'GET', headers: this.getHeaders(),
      signal: handlers?.signal
    }, handlers);
  },

  // ── D2 主题回忆录 ──
  async listMemoirs() {
    return this.request('/memoir/', { headers: this.getHeaders() });
  },
  subscribeGenerateMemoir(payload, handlers) {
    return this._sse('/memoir/generate', {
      method: 'POST', body: JSON.stringify(payload),
      signal: handlers?.signal
    }, handlers);
  },
  async getMemoirExport(memoirId) {
    return this.request(`/memoir/${memoirId}/export`, { headers: this.getHeaders() });
  },
  async publishMemoir(memoirId) {
    return this.request(`/memoir/${memoirId}/publish`, {
      method: 'POST', headers: this.getHeaders()
    });
  },

  // ── E3 Mind Cosmos Snapshot ──
  async getCosmosSnapshot(params = {}) {
    const q = new URLSearchParams();
    if (params.startDate) q.set('start_date', params.startDate);
    if (params.endDate) q.set('end_date', params.endDate);
    const qs = q.toString();
    return this.request(`/cosmos/snapshot${qs ? '?' + qs : ''}`, { headers: this.getHeaders() });
  },

  subscribeGenerateCosmos(payload, handlers) {
    return this._sse('/cosmos/generate', {
      method: 'POST', body: JSON.stringify(payload),
      signal: handlers?.signal
    }, handlers);
  },

  async getCosmosEvolution(range = '6months') {
    return this.request(`/cosmos/evolution?range=${encodeURIComponent(range)}`, { headers: this.getHeaders() });
  },

  async getCosmosSnapshotById(id) {
    return this.request(`/cosmos/snapshot/${id}`, { headers: this.getHeaders() });
  },

  // ── Mind Galaxy v2 ──
  async analyzeMindGalaxy(text, source = 'notes') {
    return this.request('/mind-galaxy/analyze', {
      method: 'POST', headers: this.getHeaders(),
      body: JSON.stringify({ text, source })
    });
  },

  subscribeMindGalaxyAnalyze(payload, handlers) {
    return this._sse('/mind-galaxy/analyze-stream', {
      method: 'POST', body: JSON.stringify(payload),
      signal: handlers?.signal
    }, handlers);
  },

  async getMindGraph() {
    return this.request('/mind-galaxy/graph', { headers: this.getHeaders() });
  },

  async getGalaxySnapshot() {
    return this.request('/mind-galaxy/snapshot', { headers: this.getHeaders() });
  },

  subscribeGenerateGalaxy(payload, handlers) {
    return this._sse('/mind-galaxy/generate', {
      method: 'POST', body: JSON.stringify(payload),
      signal: handlers?.signal
    }, handlers);
  },

  async getGalaxyEvolution(range = '6months') {
    return this.request(`/mind-galaxy/evolution?range=${encodeURIComponent(range)}`, { headers: this.getHeaders() });
  },

  async getGalaxyReport(snapshotId) {
    return this.request(`/mind-galaxy/report/${snapshotId}`, { headers: this.getHeaders() });
  },

  async getGalaxyConfigs() {
    return this.request('/mind-galaxy/config', { headers: this.getHeaders() });
  },

  async saveGalaxyConfig(config) {
    return this.request('/mind-galaxy/config', {
      method: 'POST', headers: this.getHeaders(),
      body: JSON.stringify(config)
    });
  },

  async exportGalaxy(format) {
    return this.request(`/mind-galaxy/export/${format}`, {
      method: 'POST', headers: this.getHeaders()
    });
  }
};
