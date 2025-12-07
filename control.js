// --- 替换为您的密钥信息 ---
const AUTH_TOKEN = 'OqSFS2EppKQRi0DYBOTFNEQgW7pljRjT'; 

// Blynk 的服务器地址
const BLYNK_HOST = 'blynk.cloud'; 
// 您在 ESP32 代码中设置的虚拟引脚
const VIRTUAL_PIN = 'v1'; 
// 舵机转到最大角度（拾取）
const PICKUP_ANGLE = 120;
// 舵机返回初始角度（重置云端状态）
const RETURN_ANGLE = 0; // 必须重新定义并使用！


/**
 * 构造并发送 HTTP GET 请求到 Blynk API，并立即重置云端状态
 * @param {number} value 要设置的舵机角度 (应为 90)
 */
async function sendCommand(value) { // *** 必须添加 async 关键字 ***
    // 构造 PUSH URL (发送 90 度)
    const url_push = `https://${BLYNK_HOST}/external/api/update?token=${AUTH_TOKEN}&${VIRTUAL_PIN}=${value}`;
    
    // 构造 RESET URL (发送 0 度，重置云端状态)
    const url_reset = `https://${BLYNK_HOST}/external/api/update?token=${AUTH_TOKEN}&${VIRTUAL_PIN}=${RETURN_ANGLE}`;

    document.getElementById('status').innerText = `Status: Sending ${value} degrees...`;

    try {
        // 1. 发送 PUSH 命令 (90度)
        let response_push = await fetch(url_push);
        
        if (!response_push.ok) {
            document.getElementById('status').innerText = `Status: PUSH Failed! (Code: ${response_push.status})`;
            console.error('PUSH API request failed:', response_push.statusText);
            return; 
        }
        document.getElementById('status').innerText = `Status: PUSH Success. Resetting cloud...`;

        // 2. 发送 RESET 命令 (0度) 以重置云端 V1 状态
        let response_reset = await fetch(url_reset);

        if (response_reset.ok) {
            document.getElementById('status').innerText = `Status: Command ${value}° Sent & Cloud Reset Successfully!`;
            console.log(`Command ${value} sent, and cloud state successfully reset to 0.`);
        } else {
             document.getElementById('status').innerText = `Status: PUSH Success, but RESET Failed! (Code: ${response_reset.status})`;
            console.error('RESET API request failed:', response_reset.statusText);
        }

    } catch (error) {
        document.getElementById('status').innerText = `Status: Network Error! Could not reach Blynk.`;
        console.error('Network error:', error);
    }
}


// --- 事件监听器：绑定点击事件 ---

// 1. "I pick it up" 按钮：发送 90 度指令
document.getElementById('pickUpButton').addEventListener('click', () => {
    sendCommand(PICKUP_ANGLE); 
});

// 2. !!! 保持移除 "Return" 按钮的监听器 !!!
