# A6 · report_export_config_contract
> 文档化 reportService.js + exportService.js + configService.js 的完整接口契约

## 需求摘要
梳理报告 8 章生成结构、导出格式枚举、配置 CRUD 接口，供 C23, C24, C26 引用。

## 构建拓扑图
```
[串行] A6 → C23, C24, C26
[并行] A6 ∥ A5
```

## 数据契约总览

```typescript
interface ObservationReport {
  id: string;
  galaxySnapshotId: string;
  overview: OverviewChapter;
  coreBeliefs: BeliefReportItem[];
  emotionSpectrum: EmotionSpectrumChapter;
  relationshipGalaxy: RelationshipChapter;
  evolutionTimeline: EvolutionChapter;
  shadows: ShadowChapter;
  typology: TypologyChapter;
  summary: SummaryChapter;
  chapterOrder: string[];
  generatedAt: string;
}

interface OverviewChapter {
  hubbleType: string;
  starCount: number;
  nebulaKinds: number;
  coreMass: number;
  selfStability: number;
  selfIntegration: number;
  spiralArms: number;
  windingTightness: number;
  flatness: number;
  timeRange: { start: string; end: string };
  analyzedNodeCount: number;
  nodeTypeDistribution: Record<string, number>;
  oneLineSummary: string;
  confidence: 'high' | 'mid' | 'low';
}

interface BeliefReportItem {
  id: string; label: string; strength: number; level: string;
  polarity: string; formedAt: string | null;
  evidence: { excerpt: string; recordId: string }[];
  confidence: 'high' | 'mid';
}

interface EmotionSpectrumChapter {
  dominant: string;
  distribution: { emotion: string; ratio: number }[];
  cycle: string;
  triggers: { stimulus: string; emotion: string; confidence: number }[];
}

interface RelationshipChapter {
  topPersons: { id: string; name: string; intimacy: number; polarity: number; influence: number }[];
  patterns: string[];
}

interface EvolutionChapter {
  nodes: { date: string; type: 'growth' | 'trauma'; description: string }[];
  trend: string;
}

interface ShadowChapter {
  repressedThemes: string[];
  cognitiveBiases: string[];
  unintegrated: string[];
}

interface TypologyChapter {
  type: string; traits: string[]; strengths: string[]; blindSpots: string[]; suggestions: string[];
}

interface SummaryChapter {
  summaryLines: string[]; coreStrengths: string[]; blindSpots: string[]; suggestions: string[];
}
```

## 函数签名

```javascript
// reportService.js
export async function generateReport(userId, snapshotId) → ObservationReport

// exportService.js
export async function exportData(userId, format) → { data, contentType, filename }
export async function exportReportPDF(userId, reportId, writable) → void

// configService.js
export default { create(userId, config) → config, applyToSnapshot(snapshot, config) → snapshot }
```

## 报告 8 章顺序

```javascript
CHAPTER_ORDER = [
  'overview', 'coreBeliefs', 'emotionSpectrum', 'relationshipGalaxy',
  'evolutionTimeline', 'shadows', 'typology', 'summary'
]
```

## 导出格式枚举

| format | 内容 | contentType |
|--------|------|-------------|
| json | 完整 GalaxySnapshot | application/json |
| csv | bodies 扁平表 (id,type,name,pos_x,...) | text/csv |

## 配置 schema

```typescript
interface GalaxyConfig {
  id: string; userId: string; name: string;
  template: 'default' | 'psychology' | 'art' | 'minimal';
  colorScheme: Record<string, string>;
  spiralArms: number; windingTightness: number;
  hiddenNodeIds: string[]; renamedNodes: Record<string, string>;
  privacyMode: 'local' | 'cloud'; deleteAfterAnalysis: boolean;
  updatedAt: string;
}
```

## PDF 导出关键细节

- 用 PDFKit (`import PDFDocument from 'pdfkit'`)
- 中文字体路径：`server/fonts/msyh.ttc`，注册名 `'Cn'`
- 字体加载失败回退到 Helvetica-Bold
- 8 章分页排版，页脚带页码
- 页面尺寸 A4，margins: 50/50/45/45

## LLM 润色函数

| 函数 | 用途 | temperature |
|------|------|------------|
| polishOverview | 生成 30 字概述 | 0.3 |
| polishSuggestions | 生成 2 条成长建议 | 0.5 |

两个函数都有 try/catch，失败不阻塞。

## 验收清单
- [输入] 无图谱数据 → generateReport throw '暂无心智图谱数据'
- [输入] 正常快照 → 返回 8 章完整 report
- [输入] exportData('json') → 返回 JSON 字符串
- [输入] 快照含 5 bodies → CSV 含 header + 5 行

## 影响分析
- reportService.js 被 C23（图表嵌入）修改
- exportService.js 被 C23 修改（PDF 绘图扩展）
- configService.js 被 C35（映射规则 UI）修改

## 风险提示
- PDF 中文字体文件可能不存在—必须 try/catch
- polishOverview / polishSuggestions 调 LLM 可选
- applyToSnapshot 是原地修改
