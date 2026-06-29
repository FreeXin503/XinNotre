import { ApiClient } from '../../api.js';

let digitalTwinState = {
  isInitialized: false,
  isProcessing: false,
};

export function initDigitalTwin() {
  if (digitalTwinState.isInitialized) return;
  digitalTwinState.isInitialized = true;

  const btnOpen = document.getElementById('btn-digital-twin');
  const panel = document.getElementById('digital-twin-panel');
  const btnClose = document.getElementById('dt-close');
  const btnSend = document.getElementById('dt-send');
  const input = document.getElementById('dt-input');
  const output = document.getElementById('dt-output');
  const btnEvolve = document.getElementById('dt-evolve-btn');
  const evolveStatus = document.getElementById('dt-evolve-status');

  if (btnOpen && panel) {
    btnOpen.addEventListener('click', () => {
      panel.classList.toggle('visible');
    });
  }

  const appendMessage = (role, text) => {
    const msgDiv = document.createElement('div');
    msgDiv.className = `dt-msg ${role === 'user' ? 'dt-user' : 'dt-twin'}`;
    const nameDiv = document.createElement('div');
    nameDiv.className = 'dt-name';
    nameDiv.textContent = role === 'user' ? '你' : '数字孪生体';
    const contentDiv = document.createElement('div');
    contentDiv.className = 'dt-content';
    const p = document.createElement('p');
    p.textContent = text;
    contentDiv.appendChild(p);
    msgDiv.appendChild(nameDiv);
    msgDiv.appendChild(contentDiv);
    output.appendChild(msgDiv);
    output.scrollTop = output.scrollHeight;
  };

  const handleSend = async () => {
    const text = input.value.trim();
    if (!text || digitalTwinState.isProcessing) return;

    input.value = '';
    appendMessage('user', text);
    digitalTwinState.isProcessing = true;
    
    // Add loading indicator
    const loadingId = 'dt-loading-' + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.id = loadingId;
    loadingDiv.className = 'dt-msg dt-twin';
    loadingDiv.innerHTML = '<div class="dt-name">数字孪生体</div><div class="dt-content"><p style="color:#666;font-style:italic;">思考中...</p></div>';
    output.appendChild(loadingDiv);
    output.scrollTop = output.scrollHeight;

    try {
      // Mock API call since actual API endpoint might need context
      const res = await ApiClient.post('/cosmos/digital-twin/chat', { message: text });
      document.getElementById(loadingId)?.remove();
      if (res.success && res.data) {
        appendMessage('twin', res.data.reply || res.data.message || '我感受到了你的想法。');
      } else {
        appendMessage('twin', '【孪生体连接出现波动，暂时无法回应】');
      }
    } catch (err) {
      document.getElementById(loadingId)?.remove();
      appendMessage('twin', '【信号微弱，请稍后再试】');
    } finally {
      digitalTwinState.isProcessing = false;
    }
  };

  if (btnSend && input) {
    btnSend.addEventListener('click', handleSend);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
  }

  if (btnEvolve && evolveStatus) {
    btnEvolve.addEventListener('click', async () => {
      if (digitalTwinState.isProcessing) return;
      btnEvolve.style.display = 'none';
      evolveStatus.style.display = 'block';
      digitalTwinState.isProcessing = true;

      try {
        const res = await ApiClient.post('/cosmos/evolve');
        if (res.success) {
          appendMessage('twin', '我已经完成了新一轮的演化，现在的我融合了你更多的记忆与认知。');
        } else {
          appendMessage('twin', '演化遇到了一些阻力。');
        }
      } catch (err) {
        appendMessage('twin', '演化过程中信号中断。');
      } finally {
        btnEvolve.style.display = 'inline-block';
        evolveStatus.style.display = 'none';
        digitalTwinState.isProcessing = false;
      }
    });
  }
}
