const LENGTH_MAP = {
  short: { label: '短', instruction: '请用简短的1-2句话回答，控制在100-200字以内。', maxTokens: 512 },
  medium: { label: '中', instruction: '请用中等长度回答，控制在400-800字之间。', maxTokens: 2048 },
  long: { label: '长', instruction: '请用详细的长篇回答，控制在1500-3000字之间。', maxTokens: 4096 }
};

export function getLengthInstruction(mode) {
  const cfg = LENGTH_MAP[mode] || LENGTH_MAP.medium;
  return cfg.instruction;
}

export function getLengthMaxTokens(mode) {
  const cfg = LENGTH_MAP[mode] || LENGTH_MAP.medium;
  return cfg.maxTokens;
}

export function getLengthLabel(mode) {
  const cfg = LENGTH_MAP[mode] || LENGTH_MAP.medium;
  return cfg.label;
}

export function injectLengthToSystemPrompt(systemPrompt, mode) {
  const instruction = getLengthInstruction(mode);
  return `${systemPrompt}\n\n【长度要求】${instruction}`;
}
