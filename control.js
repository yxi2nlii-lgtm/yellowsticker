// ===== 强制兜底版：点击一次只发送一次（交替 120 / 0）=====

const container = document.getElementById('emojiContainer');
const wrapper   = document.getElementById('featuresWrapper');
const root      = document.documentElement;

// ------- 颜色相关（保留你原本逻辑） -------
const TARGET_HUE        = 55;
const TARGET_SATURATION = 100;
const TARGET_LIGHTNESS  = 70;

const MAX_CLICKS = 10;
const DECAY_DURATION_SEC = 30;
const DECAY_RATE_PER_SEC = MAX_CLICKS / DECAY_DURATION_SEC;

let clickCount = 0;
let decayInterval = null;

// ------- Blynk -------
const AUTH_TOKEN  = 'OqSFS2EppKQRi0DYBOTFNEQgW7pljRjT';
const BLYNK_HOST  = 'blynk.cloud';
const VIRTUAL_PIN = 'V1';

const ANGLE_ON  = 120;
const ANGLE_OFF = 0;

// ------- toggle 状态 -------
let isExtended = false;

// ✅ 超强防双触发：锁 1 秒（你现在问题是“一下立刻两次”，这个能硬挡）
let lockUntilMs = 0;
const LOCK_MS = 1000;

// 从 CSS 读取交互参数
const maxDistance     = parseFloat(getComputedStyle(root).getPropertyValue('--max-move-distance')) || 30;
const maxSqueezeScale = parseFloat(getComputedStyle(root).getPropertyValue('--max-squeeze-scale')) || 0.90;
const maxStretchScale = parseFloat(getComputedStyle(root).getPropertyValue('--max-stretch-scale')) || 1.05;
const faceShiftRatio  = parseFloat(getComputedStyle(root).getPropertyValue('--face-shift-ratio')) || 0.15;

// ✅ 关键：让触摸不再合成 click（配合下面吞事件更稳）
container.style.touchAction = 'none';

async function sendCommand(value) {
  const url = `https://${BLYNK_HOST}/external/api/update?token=${AUTH_TOKEN}&${VIRTUAL_PIN}=${value}`;
  console.log('[Blynk] sending', value, 'url=', url);

  try {
    const res = await fetch(url);
    if (!res.ok) console.error('[Blynk] failed', res.status);
  } catch (e) {
    console.error('[Blynk] network error', e);
  }
}

// ------- 颜色记忆 -------
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

// ✅ 真正的触发逻辑：一次交互只走一次
function triggerToggleOnce() {
  const now = Date.now();
  if (now < lockUntilMs) {
    console.log('[Guard] blocked duplicate trigger');
    return;
  }
  lockUntilMs = now + LOCK_MS;

  // 视觉反馈
  container.classList.remove('click-shake');
  void container.offsetWidth;
  container.classList.add('click-shake');

  // 颜色记忆
  clickCount = Math.min(MAX_CLICKS, clickCount + 1);
  updateColor();
  saveState();

  // toggle：1次120，2次0，3次120...
  const valueToSend = isExtended ? ANGLE_OFF : ANGLE_ON;
  console.log('>>> trigger -> send', valueToSend);
  sendCommand(valueToSend);

  isExtended = !isExtended;

  if (!decayInterval) decayInterval = setInterval(updateDecay, 1000);
}

// ✅ 只用 pointerdown
function onPointerDown(e) {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  triggerToggleOnce();
}

// ✅ 兜底：把 click / touchstart 事件吞掉（防止页面里残留旧监听器）
function swallow(e) {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
}

// ------- 跟随移动（保留） -------
function handleInteraction(event) {
  event.preventDefault();

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

// ✅ 绑定：吞掉 click/touchstart（capture=true），并只用 pointerdown 触发
container.addEventListener('click', swallow, true);
container.addEventListener('touchstart', swallow, { passive: false, capture: true });
container.addEventListener('pointerdown', onPointerDown, { passive: false });

document.addEventListener('mousemove', handleInteraction, { passive: false });
document.addEventListener('touchmove', handleInteraction, { passive: false });

document.addEventListener('mouseup', resetPosition);
document.addEventListener('touchend', resetPosition);
document.addEventListener('touchcancel', resetPosition);

container.addEventListener('contextmenu', (e) => e.preventDefault());
