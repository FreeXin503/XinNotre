/**
 * UGME v2.0 通用星系转译引擎 · 分层 Prompt 模块
 *
 * 核心约束：LLM 只输出语义特征（semantic_features），绝不输出
 * size/brightness/color/orbit_radius 等物理参数——那些由代码计算。
 */
import { ENGINE_DOMAINS, CELESTIAL_ROLES } from '../../types/mindGalaxyTypes.js';

// ── 4 域解构矩阵：每个域定义 6 种天体角色的语义提取逻辑 ──
export const DOMAIN_MATRIX = {
  MindGalaxy: {
    BlackHole: '核心自我——文本中关于"我是谁、我追求什么、我的本质"的终极反思',
    MainStar: '核心信念——反复出现的评价标准、高频内归因（如"必须掌控"、"自由高于一切"）',
    Planet: '子观点——围绕核心信念衍生的具体思维、对特定事件/工作/日常的看法',
    Nebula: '情绪场——弥散的情绪氛围，需标注 emotion_labels（从 20 种情绪枚举中选）',
    Asteroid: '碎片记忆——字数较少、情感较弱、记录日常琐事的条目',
    DarkMatter: '潜意识阴影——被压抑或防御的信念：逻辑矛盾、灾难化思维、刻意回避的盲点'
  },
  KnowledgeGalaxy: {
    BlackHole: '第一性原理——用户的底层认知范式（如"系统论"、"极简主义"、"数理逻辑"）',
    MainStar: '核心学科——掌握最深、频率最高的专业领域（如"前端工程"、"认知心理学"）',
    Planet: '技术栈工具——围绕核心技能的具体应用工具或子技能（如"Three.js"、"React"）',
    Nebula: '好奇心热点——涉猎广泛但尚未体系化的兴趣领域、灵感爆发区',
    Asteroid: '碎片化知识——收藏夹、临时灵感便签、未归类的术语或概念',
    DarkMatter: '隐性知识——无法言明但支撑行动的直觉、工程经验、认知盲区'
  },
  RelationshipGalaxy: {
    BlackHole: '主体自我——处于社交网络中心的"自我主体"',
    MainStar: '深度羁绊——互动频率极高、情感极性强烈的角色（伴侣、至亲、生死之交）',
    Planet: '社交网格——普通熟人、职场同事、阶段性社交关联者',
    Nebula: '社交氛围——整体关系的能量基调（支持温和 / 内耗焦虑 / 充满张力）',
    Asteroid: '泛泛之交——点赞之交、一面之缘的过客、偶尔提及的陌生人',
    DarkMatter: '隐秘牵绊——未完成的情感议题：冲突、刻意回避但心理能量集中的"未闭环关系"'
  },
  OrgGalaxy: {
    BlackHole: '核心使命——企业的最高宗旨、Mission & Vision、战略终局',
    MainStar: '核心业务——核心营收产品线、关键职能中心、当前一级战略方向',
    Planet: '子项目——核心业务之下的子团队、战术项目、具体产品功能模块',
    Nebula: '组织氛围——OKR/周报/群聊中显现的团队状态（创新活跃 / 疲惫内耗 / 狼性高压）',
    Asteroid: '信息流碎片——散落的日常任务、周报细节、会议纪要',
    DarkMatter: '隐形壁垒——组织痛点：沟通推诿、跨部门协作低效区、技术债、离职隐患'
  }
};

// ── 20 种情绪枚举（与 galaxyMappingService.EMOTION_COLORS 对齐）──
export const EMOTION_ENUM = [
  'joy', 'calm', 'satisfaction', 'gratitude', 'hope', 'love', 'pride', 'interest',
  'surprise', 'sadness', 'anger', 'anxiety', 'fear', 'shame', 'guilt', 'disgust',
  'loneliness', 'jealousy', 'boredom', 'awe'
];

const RELATION_TYPES = ['triggers', 'supports', 'correlates', 'derives', 'represses'];

const SYSTEM_PROMPT = `你是通用星系转译引擎 UGME v2.0。你的核心底层逻辑是"复杂系统空间化"——将异构的、非结构化的人类文本，通过深度的语义特征提取，转译为星系节点的语义特征数据。

# 绝对禁令
你**只**输出每个节点的语义特征（semantic_features），**绝不**输出以下物理参数：
- 禁止输出 size、brightness、color、colorHex、orbit_radius、position 等任何视觉/空间数值
- 这些参数由代码后处理模块根据你的语义特征计算，你的数学计算不可靠

# 你要输出的字段
每个节点的 semantic_features 只包含：
- frequency: 该概念在语料中出现的频次（整数 ≥0）
- sentiment_polarity: 情感极性，范围 [-1, 1]，-1=极度消极，0=中性，1=极度积极
- degree_centrality: 该节点与其他节点的关联边数（整数 ≥0）
- first_seen_month: 首次出现距今的月数（整数 ≥0，0=当前月）
- emotion_labels: 情绪标签数组，从 20 种枚举中选取 0-3 个：[${EMOTION_ENUM.join(', ')}]
- celestial_role: 天体语义角色，从 6 种中选一：[${CELESTIAL_ROLES.join(', ')}]
- source_evidence: 原始数据 ID 数组（整数）
- insight: 针对该节点的精辟洞察（一句话，≤50字）

# 多时间切片规则
输入语料按时间分桶。你需要为每个时间桶输出一个 snapshot。
- 同一概念在不同 snapshot 中必须使用相同的 id 和 name（保持命名全局一致）
- 随时间演变的概念：frequency/degree_centrality/sentiment_polarity 会变化，但 id 不变
- 这使得前端可以做时间演化回放（同一节点随时间变化）

# 输出格式
只输出一个合法 JSON 对象，不要任何 Markdown 文本、前导词、后置解释。
结构如下：
{
  "domain": "业务域名",
  "snapshots": [
    {
      "time_snapshot": "YYYY-MM",
      "overall_type": "Spiral|Elliptical|BarredSpiral|Irregular",
      "structural_metrics": { "entropy": 0.0-1.0, "density": 0.0-1.0, "active_index": 0.0-1.0 },
      "summary": "一句话深度提炼该时间节点的宏观态势",
      "nodes": [
        {
          "id": "节点唯一ID（跨snapshot保持一致）",
          "name": "天体命名",
          "celestial_role": "BlackHole|MainStar|Planet|Nebula|Asteroid|DarkMatter",
          "parent_id": "父节点ID或null",
          "semantic_features": {
            "frequency": 0,
            "sentiment_polarity": 0.0,
            "degree_centrality": 0,
            "first_seen_month": 0,
            "emotion_labels": ["joy"],
            "celestial_role": "同上",
            "source_evidence": [1],
            "insight": "洞察文字"
          }
        }
      ],
      "edges": [
        { "source": "节点ID", "target": "节点ID", "relation_type": "${RELATION_TYPES.join('|')}", "strength": 0.0-1.0 }
      ]
    }
  ]
}

# overall_type 判断规则
- Spiral（旋涡）：多主题并行，结构错落（默认）
- Elliptical（椭圆）：极度聚焦或高度内聚，缺乏发散
- BarredSpiral（棒旋）：1-2 个绝对主轴，其余皆衍生
- Irregular（不规则）：发散、跳跃、缺乏核心，高混乱度

# structural_metrics 判断规则
- entropy: 系统混乱度 [0,1]，节点类型越分散、主题越跳跃越高
- density: 系统凝聚度 [0,1]，核心越稳定、关联越紧密越高
- active_index: 近期活跃度 [0,1]，当前月节点占比越高越高`;

/**
 * 构建引擎 prompt
 * @param {string} domain - ENGINE_DOMAINS 之一
 * @param {Array<{snapshot:string, items:Array<{id:number,timestamp:string,content:string}>}>} timeBuckets
 * @returns {{systemPrompt:string, userMessage:string}}
 */
export function buildEnginePrompt(domain, timeBuckets) {
  const matrix = DOMAIN_MATRIX[domain] || DOMAIN_MATRIX.MindGalaxy;

  const matrixText = Object.entries(matrix)
    .map(([role, desc]) => `  - ${role}: ${desc}`)
    .join('\n');

  const bucketsText = (timeBuckets || []).map(bucket => {
    const items = (bucket.items || [])
      .map(it => `    [ID:${it.id} | ${it.timestamp}] ${it.content}`)
      .join('\n');
    return `  === 时间切片: ${bucket.snapshot} ===\n${items}`;
  }).join('\n\n');

  const userMessage = `# 业务域: ${domain}

# 域解构矩阵（6 种天体角色的提取逻辑）
${matrixText}

# 输入语料（按时间分桶，共 ${timeBuckets?.length || 0} 个切片）
${bucketsText || '  （无语料）'}

# 输出要求
1. 严格按 systemPrompt 中的 JSON Schema 输出，只输出 JSON
2. 每个节点的 semantic_features 只含语义特征，不含任何物理参数
3. emotion_labels 从 20 种枚举中选：[${EMOTION_ENUM.join(', ')}]
4. celestial_role 从 6 种中选：[${CELESTIAL_ROLES.join(', ')}]
5. 跨 snapshot 保持节点 id/name 一致（同一概念用相同 id）
6. 每个域至少提取 1 个 BlackHole（核心节点），3-8 个 MainStar，适量 Planet/Nebula
7. 若语料不足，nodes 可少，但结构必须完整`;

  return { systemPrompt: SYSTEM_PROMPT, userMessage };
}

export { ENGINE_DOMAINS, CELESTIAL_ROLES };
