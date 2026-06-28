# A1 · preprocess_contract
> 文档化 `server/services/mindGalaxy/preprocessService.js` 的完整接口契约

## 需求摘要
梳理预处理服务的函数签名、输入/输出类型、脱敏规则、分段规则，供后续 C13~C16, C28, C29, C30, C32 子 agent 引用。

## 构建拓扑图
```
[串行] A1 → C13, C14, C15, C16, C28, C29, C30, C32
```
本 plan 无代码改动，纯文档。

## 数据契约总览

```typescript
// ========= preprocessService 共享类型 =========

interface DataSourceInput {
  type: string;        // 'notes' | 'knowledge' | 'article' | 'chat' | 'voice'
  text: string;        // 原始文本
  ref: string;         // 引用标识（如 noteId / kbId）
  timestamp: string;  // ISO 8601 或可解析字符串
}

interface PreprocessOptions {
  desensitize?: boolean; // 默认 true
  words?: string[];      // 白名单（未使用，预留）
}

interface PreprocessResult {
  records: PreprocessRecord[];
  segments: PreprocessSegment[];
  meta: {
    totalRecords: number;
    totalSegments: number;
    fragmentCount: number;
    inputChars: number;
  };
}

interface PreprocessRecord {
  type: string;
  ref: string;
  hash: string;        // 16 位 SHA256 短哈希
  timestamp: string;   // ISO 8601
  segmentCount: number;
  fragmentSegments: number;
  wordCount: number;
}

interface PreprocessSegment {
  index: number;
  text: string;
  wordCount: number;
  isFragment: boolean;         // < 10 字
  recordType: string;
  recordRef: string;
  recordHash: string;
  timestamp: string;
  positionWeight: number;      // 首尾段 1.1，其余 1.0
}
```

## 函数签名清单

```javascript
export async function preprocess(userId, { sources, options }) → PreprocessResult
function isTemplateText(text) → boolean     // 7 种正则
function isPureSymbolOrEmoji(text) → boolean // 中文字数 < 2 过滤
function shortHash(text) → string            // 16 位 hex
function desensitize(text) → { text, personCount }
function segmentText(text) → Segment[]
```

## 脱敏规则表

| 类型 | 规则 | 示例 |
|------|------|------|
| 人名 | 姓氏+名字匹配 → `人物A` `人物B` | "张三" → "人物A" |
| 手机号 | 11 位数字 → `138****1234` | "13812345678" → "138****5678" |
| 邮箱 | `***@domain.com` | "a@b.com" → "***@b.com" |
| 地址 | **未实现** | 需 C29/C30 补充 |

## 分段规则

- 按 `\n{2,}` 或句号后换行分段
- 段落 > 500 字 → 按句号二次切分
- 失速保护：总段数 > 10000 截断
- 碎片段标记 `isFragment = wordCount < 10`

## 验收清单
- [输入] 给定 `sources: []` → 输出 `{ records: [], segments: [], meta: {...} }`
- [输入] 给定 5 篇含模板内容 → 正确去噪
- [输入] 给定包含"张三伟 13812345678 a@b.com"的文本 → 脱敏后无真实信息

## 影响分析
- 文件 `preprocessService.js` 本身不改
- 下游 C13~C16 需读取 `segments` 数组结构
- C29/C30 需在本文件新增 `purgeRawText` 函数

## 风险提示
- `desensitize()` 当前实现遍历字符，对长文本(>50KB)有性能风险
- 人物白名单 `words` 参数已定义但未使用
