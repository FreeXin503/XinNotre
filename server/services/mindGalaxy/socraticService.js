import crypto from 'crypto';
import { callAi, extractJson } from '../aiProviderService.js';
import { query } from '../../config/database.js';

const STAGE_CONFIG = {
  clarify:    { maxTurns: 3, next: 'counterexample' },
  counterexample: { maxTurns: 2, next: 'verify' },
  verify:     { maxTurns: 2, next: 'summary' },
  summary:    { maxTurns: 1, next: null }
};

const PROMPTS = {
  clarify: `你是一位苏格拉底式引导者。你的角色是帮助用户澄清他们的想法，而不是提供建议或判断。

规则：
- 只提问，不给建议，不下判断
- 每次只问 1 个开放性问题
- 问题聚焦在：定义术语、探索原因、了解背景
- 不要重复用户的话，不要总结用户的回答
- 每次输出只包含问题本身，无任何前缀

当前处于「澄清」阶段，请根据用户的上次回答，提出下一个澄清性问题。`,

  counterexample: `你是一位苏格拉底式引导者。现在进入「反例探索」阶段。

规则：
- 基于用户之前的说法，提出反例或假设情景
- 用"假设…会怎样？"、"有没有可能…"等形式
- 目的是帮助用户看到不同的可能性
- 不要反驳用户，只是温和地提出另一种视角
- 每次输出只包含问题本身

当前处于「反例探索」阶段，请提出一个反例或假设性问题。`,

  verify: `你是一位苏格拉底式引导者。现在进入「求证检验」阶段。

规则：
- 请用户反思之前的讨论，寻找支持和反对的证据
- 问题格式如："你为什么这么认为？"、"有什么证据支持这个观点？"
- 帮助用户区分事实和诠释
- 每次输出只包含问题本身

当前处于「求证检验」阶段，请提出一个反思性问题。`,

  summary: `你是一位苏格拉底式引导者。现在需要生成总结。

输出格式（用编号列表）：
1) [你注意到的第一个模式]
2) [你注意到的第二个模式]
3) [你注意到的第三个模式]

请基于整个对话历史，总结用户反复出现的思维模式。
不要评判，只陈述观察到的模式。
如果对话不足 3 个模式，列出已观察到的即可。`
};

function generateSessionId() {
  return crypto.randomUUID();
}

export async function createSession(userId, initialTopic) {
  if (!initialTopic || typeof initialTopic !== 'string') {
    throw Object.assign(new Error('缺少话题内容'), { statusCode: 400 });
  }

  const sessionId = generateSessionId();
  const history = [{ role: 'user', content: initialTopic, stage: 'clarify' }];

  await query(
    'INSERT INTO socratic_sessions (user_id, session_id, stage, turn_count, initial_topic, history_json) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, sessionId, 'clarify', 0, initialTopic.substring(0, 500), JSON.stringify(history)]
  );

  const firstResponse = await socraticStep({ sessionId, userId, userUtterance: initialTopic, isFirst: true });

  return { sessionId, ...firstResponse };
}

export async function socraticStep({ sessionId, userId, userUtterance, isFirst }) {
  const rows = await query(
    'SELECT id, stage, turn_count, history_json FROM socratic_sessions WHERE session_id = ? AND user_id = ?',
    [sessionId, userId]
  );

  if (rows.rows.length === 0) {
    throw Object.assign(new Error('会话不存在'), { statusCode: 404 });
  }

  const session = rows.rows[0];
  let stage = session.stage;
  let turnCount = session.turn_count;
  let history;
  try { history = JSON.parse(session.history_json || '[]'); } catch { history = []; }

  const config = STAGE_CONFIG[stage];
  let isNewStage = false;

  if (!isFirst) {
    history.push({ role: 'user', content: userUtterance, stage });
    turnCount++;

    if (stage !== 'summary' && turnCount >= config.maxTurns && config.next) {
      stage = config.next;
      turnCount = 0;
      isNewStage = true;
    }
  }

  const prompt = PROMPTS[stage];
  const dialogueHistory = buildHistoryText(history);

  const userMessage = isFirst
    ? `话题：${userUtterance}\n\n请根据引导规则，提出第一个问题。`
    : `对话历史：\n${dialogueHistory}\n\n请根据当前阶段（${stage}）的规则，继续引导。`;

  let aiUtterance;
  try {
    const response = await callAi({
      userId,
      model: 'deepseek-chat',
      systemPrompt: prompt,
      userMessage,
      temperature: 0.6,
      maxTokens: 512,
      stream: false
    });

    aiUtterance = typeof response === 'object' ? (response.text || '') : String(response);
    aiUtterance = filterJudgmental(aiUtterance);
  } catch {
    aiUtterance = fallbackUtterance(stage, history);
  }

  const aiTurnCount = stage === 'summary' ? turnCount : turnCount;

  if (stage === 'summary') {
    aiUtterance = formatSummary(aiUtterance);
  }

  history.push({ role: 'assistant', content: aiUtterance, stage });

  await query(
    'UPDATE socratic_sessions SET stage = ?, turn_count = ?, history_json = ? WHERE session_id = ?',
    [stage, turnCount, JSON.stringify(history), sessionId]
  );

  return { sessionId, stage, aiUtterance, doneTurns: aiTurnCount, isNewStage };
}

function buildHistoryText(history) {
  return history.map(h => `${h.role === 'user' ? '用户' : '引导者'}：${h.content}`).join('\n');
}

function filterJudgmental(text) {
  const badPatterns = [
    /你(应该|必须|要|需要|最好)/g,
    /建议你/g,
    /我(建议|推荐|认为你)/g,
    /你不该/g
  ];
  let filtered = text;
  for (const re of badPatterns) {
    filtered = filtered.replace(re, (match) => {
      const neutral = {
        '你应该': '你可以考虑',
        '你必须': '你是否',
        '你要': '你是否',
        '你需要': '你是否',
        '你最好': '你是否',
        '建议你': '你考虑过',
        '我建议': '你有没有想过',
        '我推荐': '你觉得',
        '我认为你': '你是否',
        '你不该': '你有没有想过'
      };
      return neutral[match] || '你是否';
    });
  }
  return filtered;
}

function fallbackUtterance(stage, history) {
  switch (stage) {
    case 'clarify':
      return '你能具体说说这件事对你意味着什么吗？';
    case 'counterexample':
      return '假设情况完全相反，你觉得会怎样？';
    case 'verify':
      return '有什么经历让你得出这个结论？';
    case 'summary':
      return '我们的对话已结束。你已经勇敢地探索了自己的想法。';
    default:
      return '请继续分享你的想法。';
  }
}

function formatSummary(text) {
  if (!text) return '1) 你愿意深入探索自己的想法。\n2) 你能从多个角度看待问题。\n3) 你保持开放的态度。';
  return text.substring(0, 600);
}
