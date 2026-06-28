import { ApiClient } from '../api.js';

const MODES = [
  { value: 'short', label: '短' },
  { value: 'medium', label: '中' },
  { value: 'long', label: '长' }
];

const POPOVER_CLASS = 'lm-popover';

export function mountLengthModeSelector(containerId, onChange) {
  const container = document.getElementById(containerId);
  if (!container || container.dataset.lmMounted) return;
  container.dataset.lmMounted = '1';

  const current = ApiClient.getLengthMode();
  const currentMode = MODES.find(m => m.value === current) || MODES[1];

  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'lm-wrapper';

  const trigger = document.createElement('button');
  trigger.className = 'lm-trigger';
  trigger.textContent = currentMode.label;

  const popover = document.createElement('div');
  popover.className = POPOVER_CLASS;

  const select = (mode) => {
    ApiClient.setLengthMode(mode);
    const modeObj = MODES.find(m => m.value === mode);
    trigger.textContent = modeObj ? modeObj.label : mode;
    popover.querySelectorAll('.lm-item').forEach(el => {
      el.classList.toggle('active', el.dataset.mode === mode);
    });
    closePopover();
    if (onChange) onChange(mode);
  };

  MODES.forEach((m, i) => {
    const item = document.createElement('button');
    item.className = 'lm-item';
    if (m.value === current) item.classList.add('active');
    item.dataset.mode = m.value;
    item.textContent = m.label;
    item.onclick = () => select(m.value);
    popover.appendChild(item);
    if (i < MODES.length - 1) {
      const divider = document.createElement('div');
      divider.className = 'lm-divider';
      popover.appendChild(divider);
    }
  });

  const openPopover = () => {
    wrapper.appendChild(popover);
    requestAnimationFrame(() => {
      popover.classList.add('lm-open');
      popover.classList.remove('lm-closing');
      trigger.classList.add('lm-open');
    });
  };

  const closePopover = () => {
    popover.classList.add('lm-closing');
    popover.classList.remove('lm-open');
    trigger.classList.remove('lm-open');
    setTimeout(() => {
      if (popover.parentNode) popover.parentNode.removeChild(popover);
    }, 250);
  };

  trigger.onclick = (e) => {
    e.stopPropagation();
    if (popover.parentNode) {
      closePopover();
    } else {
      openPopover();
    }
  };

  document.addEventListener('click', (e) => {
    if (!popover.parentNode) return;
    if (wrapper.contains(e.target)) return;
    closePopover();
  }, true);

  wrapper.appendChild(trigger);
  container.appendChild(wrapper);
}
