/**
 * 心迹星图 统一请求参数验证中间件
 * 前置验证：在路由层拦截非法入参，不继续执行 controller
 *
 * 用法:
 *   import { validate } from '../middleware/validate.js';
 *   router.post('/notes', authMiddleware, validate('createNote'), createNote);
 *
 * 验证失败返回 400:
 *   { success: false, error: '字段 title 验证失败', details: [...] }
 */

// ── Schema 定义 ──────────────────────────────────────────

/** @type {Object<string, Object>} */
export const schemas = {
  createNote: {
    body: {
      title: { type: 'string', maxLength: 500, required: true, label: '标题' },
      content: { type: 'string', maxLength: 100000, default: '', label: '内容' },
      category: { type: 'string', maxLength: 100, default: '未分类', label: '分类' }
    }
  },

  updateNote: {
    body: {
      title: { type: 'string', maxLength: 500, label: '标题' },
      content: { type: 'string', maxLength: 100000, label: '内容' },
      category: { type: 'string', maxLength: 100, label: '分类' }
    },
    params: {
      id: { type: 'string', pattern: /^[A-Za-z0-9_-]{8,64}$/, label: '便签ID' }
    }
  },

  login: {
    body: {
      username: { type: 'string', minLength: 2, maxLength: 50, required: true, label: '用户名' },
      password: { type: 'string', minLength: 4, maxLength: 128, required: true, label: '密码' }
    }
  },

  aiChat: {
    body: {
      messages: { type: 'array', required: true, label: '消息列表' },
      model: { type: 'string', default: 'deepseek-chat', label: '模型' },
      contextMode: {
        type: 'string',
        enum: ['all', 'category', 'note', 'kb', 'none'],
        default: 'all',
        label: '上下文模式'
      },
      currentNoteId: { type: 'string', optional: true, label: '当前便签ID' },
      currentCategory: { type: 'string', optional: true, label: '当前分类' }
    }
  },

  pagination: {
    query: {
      page: { type: 'number', min: 1, max: 10000, default: 1, coerce: true, label: '页码' },
      pageSize: { type: 'number', min: 1, max: 200, default: 50, coerce: true, label: '每页条数' }
    }
  },

  createTag: {
    body: {
      name: { type: 'string', maxLength: 50, required: true, label: '标签名' },
      color: { type: 'string', maxLength: 20, default: '#4ed8ff', label: '颜色' }
    }
  },

  createKnowledgeBase: {
    body: {
      name: { type: 'string', maxLength: 200, required: true, label: '知识库名称' },
      description: { type: 'string', maxLength: 2000, optional: true, label: '描述' },
      icon: { type: 'string', maxLength: 10, default: '📚', label: '图标' }
    }
  }
};

// ── 验证引擎 ─────────────────────────────────────────────

/**
 * @typedef {Object} FieldRule
 * @property {string} type - 'string' | 'number' | 'array' | 'boolean'
 * @property {number} [minLength]
 * @property {number} [maxLength]
 * @property {number} [min]
 * @property {number} [max]
 * @property {RegExp} [pattern]
 * @property {any} [default]
 * @property {string[]} [enum]
 * @property {boolean} [required]
 * @property {boolean} [optional]
 * @property {boolean} [coerce]
 * @property {string} label - 中文标签，用于错误提示
 */

/**
 * 验证单个字段值
 * @param {string} fieldKey
 * @param {any} value
 * @param {FieldRule} rule
 * @returns {{ valid: boolean, value: any, error?: string }}
 */
function validateField(fieldKey, value, rule) {
  // 处理空值/未传
  const isMissing = value === undefined || value === null;

  if (isMissing) {
    if (rule.required) {
      return { valid: false, value, error: `${rule.label}(${fieldKey}) 为必填项` };
    }
    if (rule.default !== undefined) {
      return { valid: true, value: rule.default };
    }
    return { valid: true, value };
  }

  // 类型转换 (coerce)
  let coerced = value;
  if (rule.coerce && rule.type === 'number') {
    coerced = Number(value);
    if (isNaN(coerced)) {
      return { valid: false, value, error: `${rule.label}(${fieldKey}) 必须是数字` };
    }
  }

  // 类型检查
  if (rule.type === 'array') {
    if (!Array.isArray(coerced)) {
      return { valid: false, value, error: `${rule.label}(${fieldKey}) 必须是数组` };
    }
  } else if (rule.type === 'number') {
    if (typeof coerced !== 'number' || isNaN(coerced)) {
      return { valid: false, value, error: `${rule.label}(${fieldKey}) 必须是数字` };
    }
  } else if (rule.type === 'string') {
    if (typeof coerced !== 'string') {
      return { valid: false, value, error: `${rule.label}(${fieldKey}) 必须是字符串` };
    }
  }

  // minLength / maxLength (string/array)
  if (rule.minLength !== undefined && (typeof coerced === 'string' || Array.isArray(coerced))) {
    if (coerced.length < rule.minLength) {
      return { valid: false, value, error: `${rule.label}(${fieldKey}) 长度不能小于 ${rule.minLength}` };
    }
  }
  if (rule.maxLength !== undefined && (typeof coerced === 'string' || Array.isArray(coerced))) {
    if (coerced.length > rule.maxLength) {
      return { valid: false, value, error: `${rule.label}(${fieldKey}) 长度不能超过 ${rule.maxLength}` };
    }
  }

  // min / max (number)
  if (rule.type === 'number') {
    if (rule.min !== undefined && coerced < rule.min) {
      return { valid: false, value, error: `${rule.label}(${fieldKey}) 不能小于 ${rule.min}` };
    }
    if (rule.max !== undefined && coerced > rule.max) {
      return { valid: false, value, error: `${rule.label}(${fieldKey}) 不能大于 ${rule.max}` };
    }
  }

  // pattern (string)
  if (rule.pattern && typeof coerced === 'string') {
    if (!rule.pattern.test(coerced)) {
      return { valid: false, value, error: `${rule.label}(${fieldKey}) 格式不正确` };
    }
  }

  // enum
  if (rule.enum && !rule.enum.includes(coerced)) {
    return { valid: false, value, error: `${rule.label}(${fieldKey}) 必须是以下值之一: ${rule.enum.join(', ')}` };
  }

  return { valid: true, value: coerced };
}

/**
 * 验证中间件生成器
 * @param {string} schemaKey - schemas 中的键名
 * @returns {import('express').RequestHandler}
 */
export function validate(schemaKey) {
  const schema = schemas[schemaKey];
  if (!schema) {
    throw new Error(`未知验证 schema: ${schemaKey}`);
  }

  return (req, res, next) => {
    const errors = [];

    for (const [sourceType, fields] of Object.entries(schema)) {
      /** @type {Object} */
      let target;
      if (sourceType === 'body') target = req.body;
      else if (sourceType === 'query') target = req.query;
      else if (sourceType === 'params') target = req.params;
      else continue;

      for (const [fieldKey, rule] of Object.entries(fields)) {
        const result = validateField(fieldKey, target[fieldKey], rule);
        if (!result.valid) {
          errors.push(result.error);
        } else {
          // 将转换后的值写回（支持 coerce / default）
          target[fieldKey] = result.value;
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: '请求参数验证失败',
        details: errors,
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
}
