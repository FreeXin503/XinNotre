/**
 * 共享 SSE (Server-Sent Events) 辅助函数
 * 所有流式控制器统一使用此模块，消除重复定义。
 *
 * 用法:
 *   import { setupSSE, sendSSE } from '../utils/sse.js';
 *   setupSSE(res);                              // 设置 SSE 响应头
 *   sendSSE(res, 'chunk', { content: delta });  // 发送事件
 *   sendSSE(res, 'done', {});                   // 结束流
 *   sendSSE(res, 'error', { message: '...' });  // 错误流
 */

/**
 * 设置 SSE 响应头（Content-Type, Cache-Control, Connection）
 * 必须在发送任何事件之前调用。
 * @param {import('express').Response} res
 */
export function setupSSE(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
}

/**
 * 发送一条 SSE 事件
 * 自动跳过已关闭的连接，防止 write-after-end 崩溃。
 * @param {import('express').Response} res
 * @param {string} event - 事件名（chunk, done, error, status 等）
 * @param {object} data - 事件数据，将被 JSON.stringify
 */
export function sendSSE(res, event, data) {
  if (!res.writable || res.writableEnded) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
