import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

let cachedSkills = null;

/**
 * 从目录加载 SKILL.md (同原有逻辑, 仅同步一次)
 */
function loadSkillsFromDir(skillsDir) {
  if (!fs.existsSync(skillsDir)) return [];
  const subdirs = fs.readdirSync(skillsDir);
  const skills = [];

  for (const dir of subdirs) {
    const skillPath = path.join(skillsDir, dir, 'SKILL.md');
    if (!fs.existsSync(skillPath)) continue;

    const content = fs.readFileSync(skillPath, 'utf-8');

    const frontmatterMatch = content.match(/^---([\s\S]*?)---/);
    let name = dir;
    let description = '';
    if (frontmatterMatch) {
      const yamlLines = frontmatterMatch[1].split('\n');
      yamlLines.forEach(line => {
        const index = line.indexOf(':');
        if (index !== -1) {
          const key = line.substring(0, index).trim();
          const val = line.substring(index + 1).trim();
          if (key === 'name') name = val;
          if (key === 'description') description = val;
        }
      });
    }

    let icon = '🧠';
    let senderName = name;
    let color = '#4285f4';

    if (name.includes('munger')) { icon = '📚'; senderName = '查理·芒格'; color = '#8B4513'; }
    else if (name.includes('musk')) { icon = '⚡'; senderName = '埃隆·马斯克'; color = '#1a1a1a'; }
    else if (name.includes('jobs')) { icon = '🍎'; senderName = '史蒂夫·乔布斯'; color = '#555555'; }
    else if (name.includes('bezos')) { icon = '📦'; senderName = '杰夫·贝索斯'; color = '#FF9900'; }
    else if (name.includes('huang')) { icon = '🎮'; senderName = '黄仁勋'; color = '#76B900'; }
    else if (name.includes('leijun')) { icon = '📱'; senderName = '雷军'; color = '#FF6900'; }
    else if (name.includes('mayun') || name.includes('ma-yun')) { icon = '🌐'; senderName = '马云'; color = '#FF6A00'; }
    else if (name.includes('buffett')) { icon = '💰'; senderName = '沃伦·巴菲特'; color = '#003B71'; }
    else if (name.includes('xiaolong') || name.includes('xiao-long')) { icon = '💬'; senderName = '张小龙'; color = '#07C160'; }
    else if (name.includes('cagan')) { icon = '🏗️'; senderName = 'Marty Cagan'; color = '#E91E63'; }
    else if (name.includes('nuwa')) { icon = '🏺'; senderName = '女娲'; color = '#9b72cb'; }
    else if (name.includes('team') || name.includes('all-stars') || name.includes('squad')) { icon = '🏆'; senderName = '开发天团'; color = '#FFD700'; }
    else if (name.includes('aristotle')) { icon = '🏛️'; senderName = '亚里士多德'; color = '#B8860B'; }
    else if (name.includes('confucius')) { icon = '🎓'; senderName = '孔子'; color = '#C62828'; }
    else if (name.includes('einstein')) { icon = '🔬'; senderName = '爱因斯坦'; color = '#FF9800'; }
    else if (name.includes('darwin')) { icon = '🧬'; senderName = '达尔文'; color = '#2E7D32'; }
    else if (name.includes('galileo')) { icon = '🔭'; senderName = '伽利略'; color = '#1565C0'; }
    else if (name.includes('newton')) { icon = '🍎'; senderName = '牛顿'; color = '#4A148C'; }
    else if (name.includes('khan') || name.includes('genghis')) { icon = '🏹'; senderName = '成吉思汗'; color = '#D84315'; }
    else if (name.includes('guiguzi')) { icon = '🎯'; senderName = '鬼谷子'; color = '#37474F'; }
    else if (name.includes('gutenberg')) { icon = '📖'; senderName = '古腾堡'; color = '#5D4037'; }
    else if (name.includes('hanfeizi') || name.includes('hanfei')) { icon = '⚖️'; senderName = '韩非子'; color = '#455A64'; }
    else if (name.includes('laozi')) { icon = '☯️'; senderName = '老子'; color = '#33691E'; }
    else if (name.includes('sakyamuni') || name.includes('buddha')) { icon = '🪷'; senderName = '释迦牟尼'; color = '#E65100'; }
    else if (name.includes('xunzi')) { icon = '📜'; senderName = '荀子'; color = '#6A1B9A'; }
    else if (name.includes('zhuangzi')) { icon = '🦋'; senderName = '庄子'; color = '#00838F'; }
    else if (name.includes('caizhixin')) { icon = '💎'; senderName = '蔡智鑫'; color = '#0277BD'; }
    else if (name.includes('cai-lun') || name.includes('cailun')) { icon = '📜'; senderName = '蔡伦'; color = '#BF360C'; }
    else if (name.includes('chen-pingan') || name.includes('pingan')) { icon = '⚔️'; senderName = '陈平安'; color = '#1B5E20'; }

    const initial = senderName.charAt(0).toUpperCase();
    const avatarSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="4" fill="${color}"/><text x="6" y="17" font-size="13" fill="white" font-weight="bold">${initial}</text></svg>`;

    let replyRules = '';
    const rulesMatch = content.match(/## 角色扮演规则([\s\S]*?)(##|$)/);
    if (rulesMatch) {
      replyRules = rulesMatch[1].trim();
    }

    const presets = [];
    const modelsMatch = content.match(/### 模型\d+: ([\s\S]*?)(### 模型|##|$)/g);
    if (modelsMatch) {
      modelsMatch.slice(0, 4).forEach((modelBlock) => {
        const lines = modelBlock.split('\n');
        const modelName = lines[0].replace(/### 模型\d+:\s*/, '').trim();
        let desc = '';
        const descMatch = modelBlock.match(/\*\*一句话\*\*：([^\n]+)/);
        if (descMatch) {
          desc = descMatch[1].trim();
        }
        presets.push({
          icon: '🎯',
          title: modelName.substring(0, 8),
          desc: desc.substring(0, 18) + (desc.length > 18 ? '...' : ''),
          question: `帮我用「${senderName}」的「${modelName}」模型，分析一下我便签中体现的问题或当前状态。`
        });
      });
    }

    if (presets.length === 0) {
      if (senderName === '开发天团') {
        presets.push(
          { icon: '🔍', title: '代码审计', desc: '对我的项目进行全方位代码与安全审计', question: '请帮我审计我当前的 OPPO 便签导出系统源码，查找其中的代码逻辑、异常处理和潜在 Bug。' },
          { icon: '🚀', title: '需求分析', desc: '基于我的个人需求设计一个新功能 PRD', question: '请开发天团以专业的视角，帮我把"增加导出为 PDF 文件和批量删除"的需求设计成一份完美的 PRD 规划。' },
          { icon: '🛠️', title: '架构重构', desc: '分析当前项目结构并给出重构建议', question: '请评估我当前的系统目录结构与代码组织，给出高内聚低耦合的重构设计方案。' }
        );
      } else {
        presets.push(
          { icon: '🔍', title: '思维分析', desc: '深入剖析我当前的决策框架', question: `请以「${senderName}」的视角分析我最近写的便签，我有哪些需要改进的地方？` },
          { icon: '💡', title: '核心问题', desc: '提炼核心瓶颈与发展建议', question: `以「${senderName}」的视角审视我最核心的瓶颈是什么？` }
        );
      }
    }

    skills.push({
      id: dir,
      name: senderName,
      icon,
      senderName,
      avatarSvg,
      loadingText: '正在运用独特心智模型思考中...',
      welcomeTitle: `以「${senderName}」视角，看清事物的本质`,
      welcomeDesc: description.replace(/\r?\n/g, ' ') || `我是 ${senderName}。让我用我的思维模型和决策启发式帮你梳理。`,
      personaPrompt: content,
      replyRules,
      presets
    });
  }
  return skills;
}

/**
 * 启动时加载所有 skills (一次性), 结果缓存于内存
 * 应在 index.js startServer 开头调用
 */
export function initSkillCache() {
  const allSkills = [];

  const nvwoSkillsDir = path.join(PROJECT_ROOT, 'nvwo/.agents/skills');
  allSkills.push(...loadSkillsFromDir(nvwoSkillsDir));

  const starsSkillsDir = path.join(PROJECT_ROOT, 'Xins-Software-Dev-All-Stars/skills');
  allSkills.push(...loadSkillsFromDir(starsSkillsDir));

  const traeSkillsDir = path.join(PROJECT_ROOT, '.trae/skills');
  allSkills.push(...loadSkillsFromDir(traeSkillsDir));

  // Deduplicate by id (last one wins, .trae/skills takes priority)
  const skillMap = new Map();
  allSkills.forEach(s => skillMap.set(s.id, s));

  cachedSkills = Array.from(skillMap.values());
  console.log(`[skillCache] ✅ 已加载 ${cachedSkills.length} 个技能`);
}

/**
 * 获取缓存的 skills 列表
 * @returns {Array}
 */
export function getCachedSkills() {
  return cachedSkills || [];
}
