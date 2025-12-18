// ===== Yellow Sticker: 点击表情发送 120°（并重置回 0） =====

// 交互输入：点击这个元素（HTML 里必须有 id="emojiContainer"）
const container = document.getElementById('emojiContainer');
const wrapper   = document.getElementById('featuresWrapper');
const root      = document.documentElement;

// ===================== 颜色与状态（黄色） =====================
const TARGET_HUE        = 55;   // 🟡 黄色
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

// ===================== Blynk 配置（每次点击发送 120°） =====================
const AUTH_TOKEN   = 'OqSFS2EppKQRi0DYBOTFNEQgW7pljRjT';
const BLYNK_HOST   = 'blynk.cloud';
const VIRTUAL_PIN  = 'V1';

const PICKUP_ANGLE = 120; // ✅ 每点击一下输出 120
const RETURN_ANGLE = 0;   // 发送后复位为 0（脉冲触发）

async function sendCommand(value) {
  const urlPush  = `https://${BLYNK_HOST}/external/api/update?token=${AUTH_TOKEN}&${VIRTUAL_PIN}=${value}`;
  const urlReset = `https://${BLYNK_HOST}/external/api/update?token=${AUTH_TOKEN}&${VIRTUAL_PIN}=${RETURN_ANGLE}`;

  console.log('[Blynk] sending', value);

  try {
    // Step 1: PUSH 120
    const r1 = await fetch(urlPush);
    if (!r1.ok) {
      console.error('[Blynk] PUSH failed', r1.status);
      return;
    }

    // Step 2: RESET 0（让下一次点击仍能触发）
    const r2 = await fetch(urlReset);
    if (!r2.ok) {
      console.error('[Blynk] RESET failed', r2.status);
    } else {
      console.log('[Blynk] done, reset to 0');
    }
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
  const progress = clickCount / MAX_CLICKS; // 0..1

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

// ===================== ✅ 点击：每次都发送 120° =====================
function handleClickEffect() {
  container.classList.remove('click-shake');
  void container.offsetWidth;
  container.classList.add('click-shake');

  // 颜色记忆
  clickCount = Math.min(MAX_CLICKS, clickCount + 1);
  updateColor();
  saveState();

  // ✅ 每点击一下：输出 120
  sendCommand(PICKUP_ANGLE);

  if (!decayInterval) {
    decayInterval = setInterval(updateDecay, 1000);
  }
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
    const decayAmount = elapsedSec * DECAY_RATE_PER_SEC;
    clickCount = Math.max(0, initialCount - decayAmount);
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
document.addEventListener('mousemove', handleInteraction, { passive: false });
document.addEventListener('touchmove', handleInteraction, { passive: false });

container.addEventListener('click', handleClickEffect);
container.addEventListener(
  'touchstart',
  (e) => { e.preventDefault(); handleClickEffect(); },
  { passive: false }
);

document.addEventListener('mouseup', resetPosition);
document.addEventListener('touchend', resetPosition);
document.addEventListener('touchcancel', resetPosition);

container.addEventListener('contextmenu', (e) => e.preventDefault());
