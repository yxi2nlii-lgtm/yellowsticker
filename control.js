// ===== Yellow Sticker: 点击表情「交替」发送 120 / 0（防止一次点击触发两次）=====

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

// ✅ toggle 状态：false -> 下一次发120；true -> 下一次发0
let isExtended = false;

// ✅ 防止一次交互触发两次（合成 click / pointer 之类）
let lastTriggerMs = 0;
const TRIGGER_GUARD_MS = 250;

// 从 CSS 读取交互参数
const maxDistance     = parseFloat(getComputedStyle(root).getPropertyValue('--max-move-distance')) || 30;
const maxSqueezeScale = parseFloat(getComputedStyle(root).getPropertyValue('--max-squeeze-scale')) || 0.90;
const maxStretchScale = parseFloat(getComputedStyle(root).getPropertyValue('--max-stretch-scale')) || 1.05;
const faceShiftRatio  = parseFloat(getComputedStyle(root).getPropertyValue('--face-shift-ratio')) || 0.15;

// ===================== Blynk 配置（每次点击只发一个值：120 或 0） =====================
const AUTH_TOKEN  = 'OqSFS2EppKQRi0DYBOTFNEQgW7pljRjT';
const BLYNK_HOST  = 'blynk.cloud';
const VIRTUAL_PIN = 'V1';

const ANGLE_ON  = 120;
const ANGLE_OFF = 0;

async function sendCommand(value) {
  const url = `https://${BLYNK_HOST}/external/api/update?token=${AUTH_TOKEN}&${VIRTUAL_PIN}=${value}`;
  console.log('[Blynk] sending', value);

  try {
    const res = await fetch(url);
    if (!res.ok) console.error('[Blynk] failed', res.status);
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

  const stepsToDecay = 1 * DECAY_RATE_PER_SEC;
  clickCount = Math.max(0, clickCount - stepsToDecay);
  updateColor();
  saveState();
}

// ===================== ✅ 点击：交替发送 120 / 0（只触发一次） =====================
function triggerOnce() {
  const now = Date.now();
  if (now - lastTriggerMs < TRIGGER_GUARD_MS) return; // 防抖：挡掉“同一次交互”的第二次触发
  lastTriggerMs = now;

  container.classList.remove('click-shake');
  void container.offsetWidth;
  container.classList.add('click-shake');

  // 颜色记忆
  clickCount = Math.min(MAX_CLICKS, clickCount + 1);
  updateColor();
  saveState();

  // toggle 发送
  const valueToSend = isExtended ? ANGLE_OFF : ANGLE_ON; // false->120, true->0
  sendCommand(valueToSend);
  console.log('>>> trigger -> send', valueToSend);

  isExtended = !isExtended;

  if (!decayInterval) decayInterval = setInterval(updateDecay, 1000);
}

// 用 pointerdown 统一 mouse / touch / pen，避免 touch+click 双触发
function onPointerDown(e) {
  e.preventDefault();
  triggerOnce();
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
  let moveX = dx, moveY = dy;

  if (dist > maxDistance) {
    const ratio = maxDistance / dist;
    moveX = dx * ratio;
    moveY = dy * ratio;
  }

  container.style.transform = `translate(${moveX * -faceShiftRatio}px, ${moveY * -faceShiftRatio}px)`;

  let scaleX = 1, scaleY = 1;
  if (Math.abs(moveX) > Math.abs(moveY)) {
    const hr = Math.abs(moveX) / maxDistance;
    scaleX = 1 - (1 - maxSqueezeScale) * hr;
    scaleY = 1 + (maxStretchScale - 1) * hr;
  } else if (Math.abs(moveY) > 0.01) {
    const vr = Math.abs(moveY) / maxDistance;
    scaleY = 1 - (1 - maxSqueezeScale) * vr;
    scaleX = 1 + (maxStretchScale - 1) * vr;
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
  if (clickCount > 0) decayInterval = setInterval(updateDecay, 1000);
}

// --- 启动 ---
initializeState();

// --- 绑定事件 ---
// ✅ 关键：只绑定 pointerdown（不要再绑 click/touchstart）
container.addEventListener('pointerdown', onPointerDown, { passive: false });

// 其他交互保持
document.addEventListener('mousemove', handleInteraction, { passive: false });
document.addEventListener('touchmove', handleInteraction, { passive: false });

document.addEventListener('mouseup', resetPosition);
document.addEventListener('touchend', resetPosition);
document.addEventListener('touchcancel', resetPosition);

container.addEventListener('contextmenu', (e) => e.preventDefault());
