/**
 * 心迹星图 聊天历史服务（IndexedDB 持久化）
 * 职责：存储/读取/搜索/删除历史对话记录
 */
import { store } from '../core/state.js';

const DB_NAME = 'xinnote_chat_db';
const DB_VERSION = 1;
const STORE_NAME = 'chat_history';

let dbInstance = null;

/**
 * 初始化 IndexedDB
 * @returns {Promise<IDBDatabase>}
 */
async function initDB() {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('[chatHistory] IndexedDB 初始化失败:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * 保存/更新聊天会话
 * @param {Object} session - { id, title, noteId, messages, updatedAt }
 */
export async function saveSession(session) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(session);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * 删除聊天会话
 * @param {string} id
 */
export async function deleteSession(id) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * 获取所有会话（按更新时间倒序）
 * @returns {Promise<Object[]>}
 */
export async function getAllSessions() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = (e) => {
      const sessions = e.target.result || [];
      sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      resolve(sessions);
    };
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * 搜索会话（标题或内容匹配）
 * @param {string} query
 * @returns {Promise<Object[]>}
 */
export async function searchSessions(query) {
  if (!query || !query.trim()) return getAllSessions();

  const q = query.trim().toLowerCase();
  const all = await getAllSessions();
  return all.filter(s => {
    if (s.title && s.title.toLowerCase().includes(q)) return true;
    if (s.messages && s.messages.some(m => m.content && m.content.toLowerCase().includes(q))) return true;
    return false;
  });
}

/**
 * 自动归档当前对话
 */
export async function autoArchive() {
  const chatHistory = store.getState('chatHistory') || [];
  if (chatHistory.length <= 1) return;

  const currentChatSessionId = store.getState('currentChatSessionId');
  const currentNote = store.getState('currentNote');

  const firstUserMsg = chatHistory.find(m => m.role === 'user');
  const title = firstUserMsg
    ? firstUserMsg.content.substring(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '')
    : '未命名对话';

  const sessionId = currentChatSessionId || 'session_' + Date.now();

  const session = {
    id: sessionId,
    title,
    noteId: currentNote ? currentNote.id : null,
    messages: JSON.parse(JSON.stringify(chatHistory)),
    updatedAt: Date.now()
  };

  try {
    await saveSession(session);
    store.setState('currentChatSessionId', sessionId);
  } catch (err) {
    console.error('[chatHistory] 自动归档失败:', err);
  }
}
