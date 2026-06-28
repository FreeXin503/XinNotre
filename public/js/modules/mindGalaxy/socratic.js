const STAGE_LABELS = {
  clarify: '澄清探索',
  counterexample: '反例探究',
  verify: '求证检验',
  summary: '总结反思'
};

let currentSessionId = null;
let currentStage = 'clarify';
let doneTurns = 0;

export function initSocratic() {
  const btn = document.getElementById('btn-socratic');
  const input = document.getElementById('socratic-input');
  const sendBtn = document.getElementById('socratic-send');
  const output = document.getElementById('socratic-output');
  const topicInput = document.getElementById('socratic-topic');
  const startBtn = document.getElementById('socratic-start');

  if (!btn || !output) return;

  btn.addEventListener('click', () => {
    const panel = document.getElementById('socratic-panel');
    if (panel) {
      panel.classList.toggle('visible');
    }
    if (!currentSessionId) {
      output.innerHTML = '<div class="socratic-prompt">你想探索什么？输入一个让你困惑的话题。</div>';
    }
  });

  if (startBtn && topicInput) {
    startBtn.addEventListener('click', async () => {
      const topic = topicInput.value.trim();
      if (!topic) return;
      await startNewSession(topic);
    });
    topicInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        startBtn.click();
      }
    });
  }

  if (sendBtn && input) {
    sendBtn.addEventListener('click', async () => {
      const msg = input.value.trim();
      if (!msg || !currentSessionId) return;
      input.value = '';
      await sendReply(msg);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
      }
    });
  }
}

async function startNewSession(topic) {
  const output = document.getElementById('socratic-output');
  const topicInput = document.getElementById('socratic-topic');
  const inputArea = document.getElementById('socratic-input-area');

  if (!output) return;

  output.innerHTML = '<div class="socratic-thinking">开启对话...</div>';

  try {
    const { ApiClient } = await import('../../api.js');
    const client = ApiClient;
    const res = await client.request('/mind-galaxy/socratic/start', {
      method: 'POST',
      body: JSON.stringify({ topic }),
      headers: client.getHeaders()
    });

    if (!res?.success || !res.data) {
      output.innerHTML = '<div class="socratic-error">启动失败</div>';
      return;
    }

    currentSessionId = res.data.sessionId;
    currentStage = res.data.stage;
    doneTurns = res.data.doneTurns || 0;

    if (topicInput) topicInput.style.display = 'none';
    if (inputArea) inputArea.style.display = 'flex';

    renderStage();
    output.innerHTML = formatMessage('assistant', res.data.aiUtterance, currentStage);
  } catch {
    output.innerHTML = '<div class="socratic-error">服务不可用</div>';
  }
}

async function sendReply(message) {
  if (!currentSessionId) return;
  const output = document.getElementById('socratic-output');

  output.innerHTML += formatMessage('user', message, currentStage);
  output.innerHTML += '<div class="socratic-thinking">思考中...</div>';
  output.scrollTop = output.scrollHeight;

  try {
    const { ApiClient } = await import('../../api.js');
    const client = ApiClient;
    const res = await client.request('/mind-galaxy/socratic/step', {
      method: 'POST',
      body: JSON.stringify({ sessionId: currentSessionId, userUtterance: message }),
      headers: client.getHeaders()
    });

    output.querySelector('.socratic-thinking')?.remove();

    if (!res?.success || !res.data) {
      output.innerHTML += '<div class="socratic-error">回复失败</div>';
      return;
    }

    currentStage = res.data.stage;
    doneTurns = res.data.doneTurns || 0;

    if (res.data.isNewStage) {
      renderStage();
    }

    output.innerHTML += formatMessage('assistant', res.data.aiUtterance, currentStage);
    output.scrollTop = output.scrollHeight;

    if (currentStage === 'summary') {
      const input = document.getElementById('socratic-input');
      const sendBtn = document.getElementById('socratic-send');
      if (input) input.disabled = true;
      if (sendBtn) sendBtn.disabled = true;
      output.innerHTML += '<div class="socratic-done">探索已完成</div>';
    }
  } catch {
    output.querySelector('.socratic-thinking')?.remove();
    output.innerHTML += '<div class="socratic-error">连接中断</div>';
  }
}

function formatMessage(role, content, stage) {
  const name = role === 'user' ? '你' : '引导者';
  const stageLabel = STAGE_LABELS[stage] || '';
  const lines = (content || '').split('\n').filter(Boolean).map(l => `<p>${l}</p>`).join('');
  const stageTag = role === 'assistant' && stageLabel ? `<span class="socratic-stage-tag">${stageLabel}</span>` : '';
  return `<div class="socratic-msg socratic-${role}">${stageTag}<div class="socratic-name">${name}</div><div class="socratic-content">${lines}</div></div>`;
}

function renderStage() {
  const indicator = document.getElementById('socratic-stage-indicator');
  if (!indicator) return;
  const stageLabel = STAGE_LABELS[currentStage] || currentStage;
  indicator.textContent = `阶段：${stageLabel}`;

  const stages = ['clarify', 'counterexample', 'verify', 'summary'];
  const currentIdx = stages.indexOf(currentStage);
  indicator.innerHTML = stages.map((s, i) =>
    `<span class="stage-dot ${i < currentIdx ? 'done' : i === currentIdx ? 'active' : ''}" data-stage="${s}"></span>`
  ).join('') + `<span class="stage-label">${stageLabel}</span>`;
}

export function disposeSocratic() {
  currentSessionId = null;
  currentStage = 'clarify';
  doneTurns = 0;

  const input = document.getElementById('socratic-input');
  const sendBtn = document.getElementById('socratic-send');
  const topicInput = document.getElementById('socratic-topic');
  const inputArea = document.getElementById('socratic-input-area');
  if (input) input.disabled = false;
  if (sendBtn) sendBtn.disabled = false;
  if (topicInput) topicInput.style.display = '';
  if (inputArea) inputArea.style.display = 'none';
}
