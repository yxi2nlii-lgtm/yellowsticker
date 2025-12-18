// ===== Yellow Sticker: 交替发送 120 / 0（pointerdown 唯一触发，吞掉 click/touchstart）=====

const container = document.getElementById('emojiContainer');
const wrapper   = document.getElementById('featuresWrapper');
const root      = document.documentElement;

// ===================== 颜色与状态（黄色） =====================
const TARGET_HUE        = 55;
const TARGET_SATURATION = 100;
const TARGET_LIGHTNESS  = 70;

const MAX_CLICKS = 10;
const DECAY_DURATION_SEC = 30;
const DECAY_RATE_PER_SEC = MAX_CLICKS / DECAY_DURATION_SEC;

let clickCount = 0;
let decayInterval = null;

// 从 CSS 读取交互参数
const maxDistance     = parseFloat(getComputedStyle(root).getPropertyValue('--max-move-distance')) || 30;
const maxSqueezeScale = parseFloat(getComputedStyle(root).getPropertyValue('--max-squeeze-scale')) || 0.90;
const maxStretchScale = parseFloat(getComputedStyle(root).getPropertyValue('--max-stretch-scale')) || 1.05;
const faceShiftRatio  = parseFloat(getComputedStyle(root).getPropertyValue('--face-shift-ratio')) || 0.15;

// ===================== Blynk 配置 =====================
const AUTH_TOKEN  = 'OqSFS2EppKQRi0DYBOTFNEQgW7pljRjT';
const BLYNK_HOST  = 'blynk.cloud';
const VIRTUAL_PIN = 'V1';

const ANGLE_ON  = 120; // 第 1/3/5... 次发送
const ANGLE_OFF = 0;   // 第 2/4/6... 次发送

// ✅ 交替状态：false -> 下次发120；true -> 下次发0
let isExtended = false;

// ✅ 防止一次交互触发两次
let lastTriggerMs = 0;
const TRIGGER_GUARD_MS = 300;

async function sendCommand(value) {
  const url = `https://${BLYNK_HOST}/external/api/update?token=${AUTH_TOKEN}&${VIRTUAL_PIN}=${value}`;
  console.log('[Blynk] sending', value);

  try {
    const r = await fetch(url);
    if (!r.ok) console.error('[Blynk] failed', r.status);
  } catch (e) {
    console.error('[Blynk] network error', e);
  }
}

// ===================== 状态存储（颜色记忆） =====================
function saveState() {
  localStorage.setItem('emojiClickCount', clickCount);
  localStorage.setItem('emojiLastUpdateTime', Date.now());
}

function updateColor() {
  const progress = clickCount / MAX_CLICKS;

  const currentSaturation = Math.round(TARGET_SATURATION * progress);
  const currentLightness  = Math.round(100 - (100 - TARGET_LIGHTNESS) * progress);

  if (progress === 0) {
    root.style.setProperty('--face-color', 'transparent');
    container.style.boxShadow = 'none';
  } else {
    const hslColor = `hsl(${TARGET_HUE}, ${currentSaturation}%, ${currentLightness}%)`;
    root.style.setProperty('--face-color', hslColor);

    const shadowOffsetY = 4 * progress;
    const shadowBlur    = 15 + 10 * progress;
    const shadowOpacity = 0.1 + 0.2 * progress;

    container.style.boxShadow = `0 ${shadowOffsetY}px ${shadowBlur}px 0 rgba(0, 0, 0, ${shadowOpacity})`;
  }
}

function updateDecay() {
  if (clickCount <= 0) {
    clickCount = 0;
    clearInterval(decayInterval);
    decayInterval = null;
    updateColor();
    saveState();
    return;
  }

  clickCount = Math.max(0, clickCount - (1 * DECAY_RATE_PER_SEC));
  updateColor();
  saveState();
}

// ===================== ✅ 点击：交替发送 120 / 0 =====================
function triggerToggleOnce() {
  const now = Date.now();
  if (now - lastTriggerMs < TRIGGER_GUARD_MS) return;
  lastTriggerMs = now;

  // 点击抖动
  container.classList.remove('click-shake');
  void container.offsetWidth;
  container.classList.add('click-shake');

  // 颜色记忆
  clickCount = Math.min(MAX_CLICKS, clickCount + 1);
  updateColor();
  saveState();

  // 交替发送
  const valueToSend = isExtended ? ANGLE_OFF : ANGLE_ON; // false->120, true->0
  sendCommand(valueToSend);

  // 翻转状态
  isExtended = !isExtended;

  if (!decayInterval) decayInterval = setInterval(updateDecay, 1000);
}

// ✅ 只用 pointerdown 触发
function onPointerDown(e) {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  triggerToggleOnce();
}

// ✅ 吞掉 click/touchstart，防止合成事件/旧监听器造成双触发
function swallow(e) {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
}

// ===================== 跟随移动（表情跟手） =====================
function handleInteraction(event) {
  event.preventDefault();

  container.classList.remove('click-shake');

  const clientX = event.clientX || (event.touches ? event.touches[0].clientX : undefined);
  const clientY = event.clientY || (event.touches ? event.touches[0].clientY : undefined);
  if (clientX === undefined || clientY === undefined) return;

  const rect = container.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top  + rect.height / 2;

  let dx = clientX - cx;
  let dy = clientY - cy;

  const dist = Math.sqrt(dx * dx + dy * dy);
  let moveX = dx;
  let moveY = dy;

  if (dist > maxDistance) {
    const ratio = maxDistance / dist;
    moveX = dx * ratio;
    moveY = dy * ratio;
  }

  const faceMoveX = moveX * -faceShiftRatio;
  const faceMoveY = moveY * -faceShiftRatio;
  container.style.transform = `translate(${faceMoveX}px, ${faceMoveY}px)`;

  let scaleX = 1;
  if (Math.abs(moveX) > Math.abs(moveY)) {
    const hr = Math.abs(moveX) / maxDistance;
    scaleX = 1 - (1 - maxSqueezeScale) * hr;
  } else if (Math.abs(moveY) > 0.01) {
    const vr = Math.abs(moveY) / maxDistance;
    scaleX = 1 + (maxStretchScale - 1) * vr;
  }

  let scaleY = 1;
  if (Math.abs(moveY) > Math.abs(moveX)) {
    const vr = Math.abs(moveY) / maxDistance;
    scaleY = 1 - (1 - maxSqueezeScale) * vr;
  } else if (Math.abs(moveX) > 0.01) {
    const hr = Math.abs(moveX) / maxDistance;
    scaleY = 1 + (maxStretchScale - 1) * hr;
  }

  wrapper.style.transform = `translate(${moveX}px, ${moveY}px) scaleX(${scaleX}) scaleY(${scaleY})`;
}

function resetPosition() {
  wrapper.style.transform = 'translate(0, 0) scaleX(1) scaleY(1)';
  container.style.transform = 'translate(0, 0)';
  container.classList.remove('click-shake');
}

// ===================== 初始化（颜色记忆 + 衰减） =====================
function initializeState() {
  const savedCount = localStorage.getItem('emojiClickCount');
  const lastUpdate = localStorage.getItem('emojiLastUpdateTime');
  const now = Date.now();

  if (savedCount && lastUpdate) {
    const initialCount = parseFloat(savedCount);
    const elapsedSec = (now - parseInt(lastUpdate, 10)) / 1000;
    clickCount = Math.max(0, initialCount - elapsedSec * DECAY_RATE_PER_SEC);
  } else {
    clickCount = 0;
  }

  updateColor();

  if (clickCount > 0) {
    decayInterval = setInterval(updateDecay, 1000);
  }
}

// --- 启动 ---
initializeState();

// --- 绑定事件 ---
// ✅ 吞掉 click/touchstart（capture=true）
container.addEventListener('click', swallow, true);
container.addEventListener('touchstart', swallow, { passive: false, capture: true });

// ✅ 唯一触发：pointerdown
container.addEventListener('pointerdown', onPointerDown, { passive: false });

// 跟随移动
document.addEventListener('mousemove', handleInteraction, { passive: false });
document.addEventListener('touchmove', handleInteraction, { passive: false });

// 复位
document.addEventListener('mouseup', resetPosition);
document.addEventListener('touchend', resetPosition);
document.addEventListener('touchcancel', resetPosition);

// 禁用右键菜单
container.addEventListener('contextmenu', (e) => e.preventDefault());
