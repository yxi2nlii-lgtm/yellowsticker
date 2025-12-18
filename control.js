// --- Yellow Sticker: 发 120° 指令 ---

// 你的 Blynk 密钥
const AUTH_TOKEN = 'OqSFS2EppKQRi0DYBOTFNEQgW7pljRjT';

// Blynk 云端服务器
const BLYNK_HOST = 'blynk.cloud';

// ESP32 程序中对应的虚拟引脚（保持你原来的写法：v1）
const VIRTUAL_PIN = 'v1';

// Yellow 贴纸动作角度（=120°）
const PICKUP_ANGLE = 120;

// 推送后立即把云端恢复成 0
const RETURN_ANGLE = 0;


/**
 * 发送指令给 Blynk：先发 120°，再重置回 0°
 * @param {number} value - 要推送的角度
 */
async function sendCommand(value) {

    // 构造两个 URL
    const url_push  = `https://${BLYNK_HOST}/external/api/update?token=${AUTH_TOKEN}&${VIRTUAL_PIN}=${value}`;
    const url_reset = `https://${BLYNK_HOST}/external/api/update?token=${AUTH_TOKEN}&${VIRTUAL_PIN}=${RETURN_ANGLE}`;

    document.getElementById('status').innerText =
        `Status: Sending ${value} degrees...`;

    try {
        // Step 1: 推送 120°
        let response_push = await fetch(url_push);

        if (!response_push.ok) {
            document.getElementById('status').innerText =
                `Status: PUSH Failed (Code ${response_push.status})`;
            console.error('PUSH API error:', response_push.statusText);
            return;
        }

        document.getElementById('status').innerText =
            `Status: PUSH Success. Resetting cloud...`;

        // Step 2: 重置为 0°
        let response_reset = await fetch(url_reset);

        if (response_reset.ok) {
            document.getElementById('status').innerText =
                `Status: Command ${value}° sent & cloud reset to 0.`;
            console.log(`Command ${value} sent, then reset to 0.`);
        } else {
            document.getElementById('status').innerText =
                `Status: PUSH Success but RESET Failed (Code ${response_reset.status})`;
            console.error('RESET API error:', response_reset.statusText);
        }

    } catch (error) {
        document.getElementById('status').innerText =
            `Status: Network Error`;
        console.error('Network error:', error);
    }
}


// --- 绑定 Yellow 按钮事件 ---
// ✅ 这里把输入从 pickUpButton 改成 yellowButton（黄色按钮）
document.getElementById('yellowButton').addEventListener('click', () => {
    sendCommand(PICKUP_ANGLE);    // 这里发的是 120°
});
