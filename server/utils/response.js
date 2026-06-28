/**
 * 心迹星图 统一 HTTP 响应格式
 * 标准化所有 API 响应结构，配合 asyncHandler 自动捕获异步错误
 *
 * 成功响应格式: { success: true, data, timestamp }
 * 失败响应格式: { success: false, error: message, details?, timestamp }
 * 分页响应格式: { success: true, data: { items, total, page, pageSize, totalPages } }
 */
import { query, withTransaction, clampInt } from '../config/database.js';
import { config } from '../config/index.js';

/**
 * 成功响应
 * @param {import('express').Response} res
 * @param {any} data
 * @param {number} [statusCode=200]
 */
export function success(res, data, statusCode = 200) {
  if (res.headersSent) return;
  res.status(statusCode).json({
    success: true,
    data,
    timestamp: new Date().toISOString()
  });
}

/**
 * 失败响应
 * @param {import('express').Response} res
 * @param {string} message
 * @param {number} [statusCode=400]
 * @param {any} [details]
 */
export function fail(res, message, statusCode = 400, details = undefined) {
  if (res.headersSent) return;
  const body = {
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  };
  if (details !== undefined) {
    body.details = details;
  }
  res.status(statusCode).json(body);
}

/**
 * 分页响应
 * @param {import('express').Response} res
 * @param {any[]} items
 * @param {number} total
 * @param {number} page
 * @param {number} pageSize
 */
export function paginated(res, items, total, page, pageSize) {
  if (res.headersSent) return;
  res.json({
    success: true,
    data: {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 0
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * 异步控制器包装器 —— 自动捕获 async 错误并走 fail() 响应
 * 用法:
 *   router.get('/notes', asyncHandler(getNotes));
 *
 * @param {Function} fn - async (req, res, next) => Promise<any>
 * @returns {import('express').RequestHandler}
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      console.error(`[asyncHandler] Unhandled error in ${req.method} ${req.originalUrl}:`, err.message);
      if (res.headersSent) return;
      const statusCode = err.statusCode || err.status || 500;
      const message = statusCode === 500 ? 'Internal server error' : err.message;
      res.status(statusCode).json({
        success: false,
        error: message,
        ...(config.nodeEnv !== 'production' && statusCode === 500 ? { stack: err.stack } : {}),
        timestamp: new Date().toISOString()
      });
    });
  };
}
