const API_BASE = '/api';

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
    const res = await fetch(`${API_BASE}${path}`, options);
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      this.handleAuthFailure(data.error || '登录已失效，请重新登录');
    }
    if (!res.ok) {
      throw new Error(data.error || '请求失败');
    }
    return data;
  },

  getHeaders() {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  },

  async register(username, password) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    return data;
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
    if (filters.category) params.append('category', filters.category);
    if (filters.search) params.append('search', filters.search);

    return this.request(`/notes?${params.toString()}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
  },

  async getDeletedNotes() {
    return this.request('/notes/deleted', {
      method: 'GET',
      headers: this.getHeaders()
    });
  },

  async getNoteDetail(id) {
    return this.request(`/notes/${id}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
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
      headers: this.getHeaders()
    });
  },

  async getHealth() {
    return this.request('/health', {
      method: 'GET',
      headers: this.getHeaders()
    });
  },

  // SSE streaming AI Chat
  chatStream(payload, onChunk, onDone, onError, signal) {
    const token = this.getToken();
    fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload),
      signal
    }).then(response => {
      if (!response.ok) {
        throw new Error(`AI 请求失败 (状态码 ${response.status})`);
      }

      if (signal?.aborted) {
        onDone();
        return;
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      function read() {
        reader.read().then(({ done, value }) => {
          if (signal?.aborted) {
            reader.cancel();
            onDone();
            return;
          }
          if (done) {
            onDone();
            return;
          }
          
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop();

          for (const ev of events) {
            if (!ev.trim()) continue;
            
            const lines = ev.split('\n');
            let eventType = 'chunk';
            let dataStr = '';

            for (const line of lines) {
              if (line.startsWith('event: ')) {
                eventType = line.substring(7).trim();
              } else if (line.startsWith('data: ')) {
                dataStr = line.substring(6).trim();
              }
            }

            if (dataStr) {
              try {
                const data = JSON.parse(dataStr);
                if (eventType === 'chunk') {
                  onChunk(data);
                } else if (eventType === 'done') {
                  onDone();
                  return;
                } else if (eventType === 'error') {
                  onError(new Error(data.message));
                  return;
                }
              } catch (e) {
                // partial JSON parse error
              }
            }
          }
          read();
        }).catch(err => {
          if (err.name === 'AbortError') {
            onDone();
          } else {
            onError(err);
          }
        });
      }
      
      read();
    }).catch(err => {
      if (err.name === 'AbortError') {
        onDone();
      } else {
        onError(err);
      }
    });
  },

  async getSkills() {
    const res = await fetch(`${API_BASE}/skills`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '获取技能列表失败');
    return data;
  }
};
