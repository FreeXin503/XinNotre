/**
 * 心智星系 v2 · NLP 深度分析服务
 * 职责：LLM 提取核心信念 / 认知模式 / 关系动力 / 成长节点 / 创伤
 */
import { callAi, extractJson } from '../aiProviderService.js';

const DEEP_ANALYSIS_PROMPT = `你是一位资深心理学分析专家。请阅读以下文本记录，并进行深度心理分析。

## 输出格式要求
请严格按以下 JSON 格式返回，不要附加任何其他文字：

{
  "beliefs": [
    {
      "id": "b-1",
      "label": "信念描述(一句话)",
      "level": "core|middle|concrete",
      "strength": 0.8,
      "polarity": "pos|neg",
      "formedAt": "YYYY-MM",
      "evidence": ["日记原文证据1", "日记原文证据2"],
      "confidence": 0.9
    }
  ],
  "cognitivePatterns": {
    "attributionStyle": "internal|external|mixed",
    "attributionNote": "简要解释",
    "biases": [
      {
        "name": "灾难化思维|非黑即白|过度概括|读心术|情绪化推理|应该陈述|标签化|个人化",
        "evidence": ["证据1"],
        "confidence": 0.7
      }
    ],
    "timePerspective": "past|present|future|mixed",
    "selfTalkTone": "critical|supportive|neutral|mixed",
    "selfTalkEvidence": ["证据1"]
  },
  "relationshipDynamics": {
    "patterns": ["在关系中常...的模式的描述"],
    "unfinishedBusiness": ["未完成的议题"],
    "projections": [{"target": "对谁的描述", "likelyProjection": "可能的投射内容", "confidence": 0.5}]
  },
  "growthNodes": [
    {
      "time": "YYYY-MM",
      "description": "什么信念发生了根本性改变",
      "from": "旧信念",
      "to": "新信念",
      "triggerEvent": "触发事件描述",
      "confidence": 0.7
    }
  ],
  "traumas": [
    {
      "theme": "反复出现的创伤主题",
      "emotionIntensity": 0.9,
      "evidence": ["反复出现的文本证据"],
      "defenseMechanisms": ["压抑|否认|合理化|投射|升华|理智化|退行"],
      "confidence": 0.6
    }
  ]
}

## 分析要求
1. beliefs 应识别核心信念(3-5个)、中层信念(10-20个)、具体观点(不限)
2. 每个信念必须有原文证据支持(从下文中直接引用)
3. 置信度 confidence 必须标注
4. 若数据不足，相应数组可为空
5. 不要编造无证据的结论

## 待分析文本
`;

/**
 * 构建分段文本摘要，用于 LLM 输入
 */
function buildCorpusText(segments, maxChars = 8000) {
  const sorted = [...segments].sort((a, b) => {
    try { return new Date(a.timestamp) - new Date(b.timestamp); } catch { return 0; }
  });

  let text = '';
  for (const seg of sorted) {
    if (text.length > maxChars) break;
    const line = `[${seg.timestamp || '--'}] ${seg.text}`;
    if (text.length + line.length + 2 <= maxChars) {
      text += line + '\n\n';
    }
  }
  return text.trim();
}

/**
 * @param {number} userId
 * @param {{ segments: Object[], basicResult?: Object, options?: Object }} params
 * @returns {Promise<Object>}
 */
export async function analyzeDeep(userId, { segments, basicResult = {}, options = {} }) {
  const { model = 'deepseek-chat', signal = null, onChunk = null } = options;

  if (!Array.isArray(segments) || segments.length === 0) {
    return {
      beliefs: [],
      cognitivePatterns: null,
      relationshipDynamics: null,
      growthNodes: [],
      traumas: [],
      downgraded: true,
      downgradeReason: '无文本输入'
    };
  }

  const meaningful = segments.filter(s => !s.isFragment);
  const totalChars = meaningful.reduce((s, seg) => s + (seg.text || '').length, 0);

  // 数据不足降级
  if (totalChars < 5000) {
    return {
      beliefs: [],
      cognitivePatterns: {
        attributionStyle: 'mixed',
        biases: [],
        timePerspective: 'present',
        selfTalkTone: 'neutral'
      },
      relationshipDynamics: { patterns: [], unfinishedBusiness: [], projections: [] },
      growthNodes: [],
      traumas: [],
      downgraded: true,
      downgradeReason: `语料仅 ${totalChars} 字，需 ≥5000 字做深度分析`
    };
  }

  const corpus = buildCorpusText(meaningful, 8000);
  const userMessage = DEEP_ANALYSIS_PROMPT + '\n\n' + corpus;
  const systemPrompt = '只返回 JSON，不要任何解释文字。';

  try {
    const response = await callAi({
      userId,
      model,
      systemPrompt,
      userMessage,
      temperature: 0.3,
      maxTokens: 4096,
      stream: true,
      signal,
      onChunk
    });

    let jsonText = response;
    if (typeof response !== 'string') {
      jsonText = JSON.stringify(response);
    }

    const parsed = extractJson(jsonText);

    return {
      beliefs: (parsed.beliefs || []).map(b => ({
        ...b,
        level: b.level || 'concrete',
        strength: typeof b.strength === 'number' ? b.strength : 0.5,
        polarity: b.polarity === 'neg' ? 'neg' : 'pos',
        confidence: typeof b.confidence === 'number' ? b.confidence : 0.5
      })),
      cognitivePatterns: parsed.cognitivePatterns || null,
      relationshipDynamics: parsed.relationshipDynamics || null,
      growthNodes: (parsed.growthNodes || []).map(n => ({
        ...n,
        confidence: typeof n.confidence === 'number' ? n.confidence : 0.6
      })),
      traumas: (parsed.traumas || []).map(t => ({
        ...t,
        emotionIntensity: typeof t.emotionIntensity === 'number' ? t.emotionIntensity : 0.5,
        confidence: typeof t.confidence === 'number' ? t.confidence : 0.5
      })),
      downgraded: false
    };
  } catch (e) {
    // 重试一次，降温度
    try {
      const retryResponse = await callAi({
        userId,
        model,
        systemPrompt: systemPrompt + '\n请确保只返回合法 JSON。',
        userMessage,
        temperature: 0.2,
        maxTokens: 4096,
        stream: false
      });

      const parsed = extractJson(
        typeof retryResponse === 'string' ? retryResponse : JSON.stringify(retryResponse)
      );

      return {
        beliefs: parsed.beliefs || [],
        cognitivePatterns: parsed.cognitivePatterns || null,
        relationshipDynamics: parsed.relationshipDynamics || null,
        growthNodes: parsed.growthNodes || [],
        traumas: parsed.traumas || [],
        downgraded: false
      };
    } catch (retryErr) {
      throw new Error(`AI_UNAVAILABLE: ${e.message || '分析服务不可用'}`);
    }
  }
}
