import crypto from 'crypto';
import { config } from '../config/index.js';

const ALGORITHM = 'aes-256-gcm';
const MIN_KEY_BYTES = 32;

let encryptionKey = null;

/**
 * 启动自检: 必须由 index.js 在 server 启动第一条调用
 * 若 ENCRYPTION_KEY 缺失/非 base64/长度不足 32 字节, 直接 throw, 外部应 process.exit(1)
 */
export function assertKeyReady() {
  const raw = config.encryptionKey;
  if (!raw) {
    throw new Error(
      `[cryptoService] 致命: 环境变量 ENCRYPTION_KEY 未设置。\n` +
      `请在 server/.env 中添加:\n` +
      `ENCRYPTION_KEY=$(openssl rand -base64 32)\n` +
      `或将已存的 base64 密钥填入。`
    );
  }
  const buf = Buffer.from(raw, 'base64');
  if (buf.length < MIN_KEY_BYTES) {
    throw new Error(
      `[cryptoService] 致命: ENCRYPTION_KEY 解码后仅 ${buf.length} 字节,需要 >= ${MIN_KEY_BYTES} 字节。\n` +
      `请重新生成: openssl rand -base64 32`
    );
  }
  encryptionKey = buf;
  console.log('[cryptoService] ✅ 加密密钥已就绪');
}

function deriveKey() {
  if (!encryptionKey) {
    // 若 assertKeyReady() 未被调用, 说明启动流程未走完, 直接抛错
    throw new Error('[cryptoService] 加密密钥未初始化, 请先调用 assertKeyReady()');
  }
  // 直接用 base64 解码后的 32 字节作为 AES-256 密钥
  return encryptionKey;
}

/**
 * AES-256-GCM 加密
 * @param {string} plaintext - UTF-8 明文字符串
 * @returns {string} 格式: "ivHex:authTagHex:ciphertextHex"
 */
export function encrypt(plaintext) {
  if (plaintext == null) {
    throw new TypeError('[cryptoService.encrypt] plaintext 不能为 null/undefined');
  }
  const key = deriveKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * AES-256-GCM 解密
 * @param {string} ciphertext - encrypt 输出的格式
 * @returns {string} 明文 UTF-8 字符串
 * @throws {Error} 密钥不匹配 / 数据损坏时抛错, 绝不返回空串
 */
export function decrypt(ciphertext) {
  if (!ciphertext || typeof ciphertext !== 'string') {
    throw new TypeError('[cryptoService.decrypt] ciphertext 必须为非空字符串');
  }
  const key = deriveKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('[cryptoService.decrypt] ciphertext 格式无效, 应为 "iv:authTag:cipher"');
  }
  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
