import { callAi } from '../aiProviderService.js';
import { buildGalaxyContextPrompt } from './nlpDeepService.js';
import MindGalaxyRepository from '../../repositories/mindGalaxyRepository.js';

const repo = new MindGalaxyRepository();

const SYSTEM_PROMPT = `你是「心迹星图」星系向导，用户正在查看 TA 的心理星系。你的任务包括：
1. 根据星系特征和用户问题给出洞察
2. 通过特殊 JSON 标记指引前端高亮/聚焦星体，格式为: 【ACTION:{"bodyId":"<id>","action":"highlight|focus|timeline","params":{}}】

回答要求：
- 自然、共情、不超过 200 字
- 核心信念（giant_star）用 【ACTION:{"bodyId":"...","action":"focus"}】 聚焦
- 人物（binary_companion/person）用 【ACTION:{"bodyId":"...","action":"highlight"}】 高亮
- 演化相关用 【ACTION:{"bodyId":"","action":"timeline","params":{"targetTime":"..."}}】
- 无需标记时只输出文本`;

export async function guideStream(userId, question, { onText, onAction, signal }) {
  if (!question || typeof question !== 'string') {
    throw Object.assign(new Error('请输入您的问题'), { statusCode: 400 });
  }

  const snapshot = await repo.getLatestSnapshot(userId);
  if (!snapshot?.snapshot_json) {
    throw Object.assign(new Error('请先生成星系快照'), { statusCode: 404 });
  }

  const snapJson = typeof snapshot.snapshot_json === 'string'
    ? JSON.parse(snapshot.snapshot_json) : snapshot.snapshot_json;

  const context = buildGalaxyContextPrompt(snapJson);
  const userMessage = `星系摘要：${context}\n\n用户的问题：${question}`;

  try {
    const chunkBuf = [];
    let insideAction = false;

    await callAi({
      userId,
      model: 'deepseek-chat',
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      temperature: 0.5,
      maxTokens: 1024,
      stream: true,
      signal,
      onChunk: (chunk) => {
        if (signal?.aborted) return;
        chunkBuf.push(chunk);
        const text = chunkBuf.join('');

        const actionStart = text.lastIndexOf('【ACTION:');
        if (actionStart === -1) {
          if (onText) onText(chunk);
          return;
        }

        const afterBracket = text.indexOf('】', actionStart);
        if (afterBracket === -1) {
          insideAction = true;
          return;
        }

        insideAction = false;
        const actionJsonStr = text.substring(actionStart + 9, afterBracket);
        let actionData;
        try {
          actionData = JSON.parse(actionJsonStr);
        } catch {
          if (onText) onText(chunk);
          return;
        }

        if (onAction && actionData.bodyId !== undefined && actionData.action) {
          onAction(actionData);
        }
      }
    });
  } catch (err) {
    if (err.message && err.message.startsWith('AI_UNAVAILABLE')) {
      throw err;
    }
    const localResponse = handleLocalMode(question, snapJson);
    if (onText) onText(localResponse);
  }
}

function handleLocalMode(question, snapshot) {
  const bodies = snapshot?.bodies || [];
  const persons = bodies.filter(b => b.type === 'binary_companion' || b.type === 'person');
  const beliefs = bodies.filter(b => b.type === 'giant_star');

  if (/焦虑|担心|压力|紧张/.test(question) && persons.length > 0) {
    const names = persons.slice(0, 3).map(p => p.name).filter(Boolean).join('、');
    return `根据星系数据，您当前星系中有 ${persons.length} 个人物节点（${names}），可能与您的情绪有关。建议关注与这些人物相关的互动模式。`;
  }

  if (/信念|核心|价值/.test(question) && beliefs.length > 0) {
    const names = beliefs.slice(0, 3).map(b => b.name).filter(Boolean).join('、');
    return `您的星系中识别到 ${beliefs.length} 个核心信念节点（${names}）。这些是您当前心理星系的重要支柱。`;
  }

  return `您的星系共有 ${bodies.length} 个星体，类型为 ${snapshot.galaxyType || 'S'}。包含 ${persons.length} 个人物、${beliefs.length} 个核心信念。建议连接 AI 服务获取更深入的分析。`;
}
