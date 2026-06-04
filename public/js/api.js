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

  getHeaders() {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  },

  async register(username, password) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '注册失败');
    return data;
  },

  async login(username, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '登录失败');
    this.setToken(data.token);
    this.setUsername(data.user.username);
    return data;
  },

  async getNotes(filters = {}) {
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.search) params.append('search', filters.search);
    
    const res = await fetch(`${API_BASE}/notes?${params.toString()}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '获取便签失败');
    return data;
  },

  async getNoteDetail(id) {
    const res = await fetch(`${API_BASE}/notes/${id}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '获取详情失败');
    return data;
  },

  async createNote(note) {
    const res = await fetch(`${API_BASE}/notes`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(note)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '新建便签失败');
    return data;
  },

  async updateNote(id, note) {
    const res = await fetch(`${API_BASE}/notes/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(note)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '更新便签失败');
    return data;
  },

  async deleteNote(id, hard = false) {
    const res = await fetch(`${API_BASE}/notes/${id}?hard=${hard}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '删除便签失败');
    return data;
  },

  async syncPush(notes) {
    const res = await fetch(`${API_BASE}/sync/push`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ notes })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '数据同步失败');
    return data;
  },

  // SSE streaming AI Chat
  chatStream(payload, onChunk, onDone, onError) {
    const token = this.getToken();
    fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    }).then(response => {
      if (!response.ok) {
        throw new Error(`AI 请求失败 (状态码 ${response.status})`);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      function read() {
        reader.read().then(({ done, value }) => {
          if (done) {
            onDone();
            return;
          }
          
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop(); // save trailing fragment

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
          onError(err);
        });
      }
      
      read();
    }).catch(err => {
      onError(err);
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
