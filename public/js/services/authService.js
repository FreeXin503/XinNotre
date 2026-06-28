/**
 * 心迹星图 认证服务
 * 职责：封装登录/注册/登出/Token 管理
 */
import { ApiClient } from '../api.js';
import { store } from '../core/state.js';

export class AuthError extends Error {
  constructor(message, code = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

/**
 * 登录
 * @param {string} username
 * @param {string} password
 * @returns {Promise<Object>}
 */
export async function login(username, password) {
  try {
    const data = await ApiClient.login(username, password);
    store.setState({
      user: data.user,
      isLoggedIn: true
    });
    return data;
  } catch (err) {
    store.setState({ isLoggedIn: false, user: null });
    throw new AuthError(err.message, 'LOGIN_FAILED');
  }
}

/**
 * 注册
 * @param {string} username
 * @param {string} password
 * @returns {Promise<Object>}
 */
export async function register(username, password) {
  try {
    return await ApiClient.register(username, password);
  } catch (err) {
    throw new AuthError(err.message, 'REGISTER_FAILED');
  }
}

/**
 * 登出
 */
export function logout() {
  ApiClient.clearToken();
  store.reset();
}

/**
 * 检查登录状态
 * @returns {boolean}
 */
export function isLoggedIn() {
  return ApiClient.isLoggedIn();
}

/**
 * 获取当前用户名
 * @returns {string}
 */
export function getUsername() {
  return ApiClient.getUsername();
}
