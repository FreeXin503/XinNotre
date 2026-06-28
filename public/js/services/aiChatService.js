/**
 * 心迹星图 AI 对话服务
 * 职责：封装 AI 流式对话、多专家联合模式、RAG 上下文检索
 *
 * 核心设计：
 * - 流式连接断开后自动重试 2 次（指数退避）
 * - AbortController 在请求完成/失败后自动清理
 * - 多专家模式下单个专家失败不影响其他专家
 * - 消息历史超 50 轮自动截断（保留最后 20 轮）
 * - SSE 解析支持 incomplete JSON chunk
 */
import { ApiClient } from '../api.js';

// ── 常量 ────────────────────────────────────────────────

const MAX_HISTORY_ROUNDS = 50;    // 最大历史轮数
const TRIM_HISTORY_TO = 20;       // 超出后保留的轮数
const MAX_RETRIES = 2;            // 流式断开最大重试次数
const RETRY_DELAY_MS = 1000;      // 重试基础延迟

// ── 自定义错误 ──────────────────────────────────────────

export class AiChatError extends Error {
  constructor(message, code = 'AI_ERROR', details = undefined) {
    super(message);
    this.name = 'AiChatError';
    this.code = code;
    this.details = details;
  }
}

// ── 消息历史管理 ────────────────────────────────────────

/**
 * 修剪消息历史（防止上下文超长）
 * @param {Array<{role:string,content:string}>} messages
 * @param {number} [maxRounds=MAX_HISTORY_ROUNDS]
 * @returns {Array<{role:string,content:string}>}
 */
export function trimHistory(messages, maxRounds = MAX_HISTORY_ROUNDS) {
  if (!messages || messages.length === 0) return [];

  // 统计用户轮数
  let userCount = 0;
  for (const m of messages) {
    if (m.role === 'user') userCount++;
  }

  if (userCount <= maxRounds) return messages;

  // 从后往前保留 TRIM_HISTORY_TO 轮
  let keep = 0;
  const result = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') keep++;
    result.unshift(messages[i]);
    if (keep >= TRIM_HISTORY_TO) break;
  }
  return result;
}

// ── 上下文构建 ──────────────────────────────────────────

/**
 * 构建 @ 引用上下文文本
 * @param {Array<{type:string,name:string,id:string}>} atRefs
 * @param {Object[]} rawNotes
 * @param {Object[]} importedFiles
 * @returns {string}
 */
export function buildAtRefContext(atRefs, rawNotes, importedFiles) {
  if (!atRefs || atRefs.length === 0) return '';

  const contextBlocks = atRefs.map(ref => {
    if (ref.type === 'all') {
      const notes = (rawNotes || []).slice(0, 20);
      return '【引用：全部便签（前20篇样本）】\n' +
        notes.map(n => `• ${n.title}: ${(n.content || '').substring(0, 150)}`).join('\n');
    }

    if (ref.type === 'category') {
      const catNotes = (rawNotes || []).filter(n => (n.category || '未分类') === ref.name);
      return `【引用目录「${ref.name}」，共${catNotes.length}篇便签】\n` +
        catNotes.slice(0, 8).map(n => `• ${n.title}\n  ${(n.content || '').substring(0, 200)}`).join('\n\n');
    }

    if (ref.type === 'file') {
      const file = (importedFiles || []).find(f => f.id === ref.id);
      if (file) {
        return `【引用整个备份文件「${file.name}」，共${file.notes.length}篇便签】\n` +
          file.notes.slice(0, 12).map(n => `• ${n.title} (分类: ${n.category || '无'})\n  ${(n.content || '').substring(0, 150)}`).join('\n\n');
      }
    }

    if (ref.type === 'note') {
      const note = (rawNotes || []).find(n => n.id === ref.id);
      if (note) return `【引用便签「${note.title}」，分类：${note.category || '未分类'}】\n${note.content || ''}`;
    }

    return '';
  }).filter(Boolean);

  if (contextBlocks.length === 0) return '';

  return '\n\n【用户手动 @ 引用的上下文片段，请优先参考这些内容回答】\n' +
    contextBlocks.join('\n\n---\n\n');
}

// ── 单专家对话 ──────────────────────────────────────────

/**
 * @typedef {Object} ChatOptions
 * @property {Array<{role:string,content:string}>} messages
 * @property {string} [model='gemini-2.5-flash-preview-05-20']
 * @property {string} [contextMode='all']
 * @property {string} [currentNoteId]
 * @property {string} [currentCategory]
 * @property {string} [systemInstruction]
 * @property {string} [lengthMode]
 */

/**
 * @typedef {Object} ChatCallbacks
 * @property {(data:{content?:string,reasoning?:string})=>void} onChunk
 * @property {()=>void} onDone
 * @property {(err:Error)=>void} onError
 */

/**
 * 发送单专家流式对话消息
 * @param {ChatOptions} options
 * @param {ChatCallbacks} callbacks
 * @param {AbortSignal} [signal]
 * @param {number} [retryCount=0]
 */
export function sendChatMessage(options, callbacks, signal, retryCount = 0) {
  const { messages, model, contextMode, currentNoteId, currentCategory, systemInstruction, lengthMode } = options;

  const payload = {
    messages: trimHistory(messages),
    model: model || 'gemini-2.5-flash-preview-05-20',
    contextMode: contextMode || 'all',
    currentNoteId: currentNoteId || null,
    currentCategory: currentCategory || null,
    ...(systemInstruction ? { systemInstruction } : {}),
    ...(lengthMode ? { lengthMode } : {})
  };

  ApiClient.chatStream(
    payload,
    // onChunk
    (chunk) => {
      try { callbacks.onChunk(chunk); } catch (e) {
        console.error('[aiChatService] onChunk callback error:', e);
      }
    },
    // onDone
    () => {
      try { callbacks.onDone(); } catch (e) {
        console.error('[aiChatService] onDone callback error:', e);
      }
    },
    // onError
    (err) => {
      console.error(`[aiChatService] Stream error (retry=${retryCount}):`, err.message);

      if (retryCount < MAX_RETRIES && !signal?.aborted) {
        const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
        console.log(`[aiChatService] Retrying in ${delay}ms...`);
        setTimeout(() => {
          if (!signal?.aborted) {
            sendChatMessage(options, callbacks, signal, retryCount + 1);
          }
        }, delay);
      } else {
        try {
          callbacks.onError(retryCount >= MAX_RETRIES
            ? new AiChatError('AI 服务连接中断，请稍后重试', 'STREAM_DISCONNECTED')
            : err);
        } catch (e) {
          console.error('[aiChatService] onError callback error:', e);
        }
      }
    },
    signal
  );
}

// ── 多专家群聊模式 ──────────────────────────────────────────

/**
 * @typedef {Object} MultiAgentOptions
 * @property {string} id - 视角/专家 ID
 * @property {string} name - 专家名
 * @property {string} personaPrompt - 角色设定
 * @property {ChatOptions} chatOptions
 */

/**
 * @typedef {Object} MultiAgentCallbacks
 * @property {(agentId:string, data:{content?:string,reasoning?:string})=>void} onAgentChunk
 * @property {(agentId:string)=>void} onAgentDone
 * @property {()=>void} onAllDone
 * @property {(agentId:string, err:Error)=>void} onError
 */

/**
 * 多专家群聊模式：所有专家并行回答
 * @param {MultiAgentOptions[]} agents
 * @param {MultiAgentCallbacks} callbacks
 * @param {AbortSignal} [signal]
 */
export function sendMultiAgentChat(agents, callbacks, signal) {
  if (!agents || agents.length === 0) {
    callbacks.onAllDone();
    return;
  }

  let completedCount = 0;
  const totalAgents = agents.length;

  agents.forEach(agent => {
    const callbacksWithAgent = {
      onChunk: (data) => {
        try { callbacks.onAgentChunk(agent.id, data); } catch (e) {
          console.error(`[aiChatService] onAgentChunk error for ${agent.id}:`, e);
        }
      },
      onDone: () => {
        completedCount++;
        try { callbacks.onAgentDone(agent.id); } catch (e) {
          console.error(`[aiChatService] onAgentDone error for ${agent.id}:`, e);
        }
        if (completedCount >= totalAgents) {
          try { callbacks.onAllDone(); } catch (e) {
            console.error('[aiChatService] onAllDone error:', e);
          }
        }
      },
      onError: (err) => {
        completedCount++;
        try { callbacks.onError(agent.id, err); } catch (e) {
          console.error(`[aiChatService] onError callback error for ${agent.id}:`, e);
        }
        if (completedCount >= totalAgents) {
          try { callbacks.onAllDone(); } catch (e) {
            console.error('[aiChatService] onAllDone error:', e);
          }
        }
      }
    };

    sendChatMessage(agent.chatOptions, callbacksWithAgent, signal);
  });
}

// ── 单专家轮次对话（轮流模式辅助） ──────────────────────

/**
 * 发送单个专家的一轮回答（用于轮流对话模式）
 * @param {ChatOptions} options
 * @param {ChatCallbacks} callbacks
 * @param {AbortSignal} [signal]
 * @returns {Promise<void>} 在 onDone/onError 后 resolve
 */
export function sendSingleAgentTurn(options, callbacks, signal) {
  return new Promise((resolve) => {
    sendChatMessage(options, {
      onChunk: callbacks.onChunk,
      onDone: () => {
        try { callbacks.onDone(); } catch (e) { /* ignore */ }
        resolve();
      },
      onError: (err) => {
        try { callbacks.onError(err); } catch (e) { /* ignore */ }
        resolve();
      }
    }, signal);
  });
}
