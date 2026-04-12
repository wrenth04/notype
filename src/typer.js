const { clipboard } = require('electron');
const koffi = require('koffi');

// Windows API
const user32 = koffi.load('user32.dll');
const keybd_event = user32.func('void __stdcall keybd_event(uint8_t bVk, uint8_t bScan, uint32_t dwFlags, uintptr_t dwExtraInfo)');

// Virtual Key Codes
const VK_LMENU = 0xA4;   // Left Alt
const VK_RMENU = 0xA5;   // Right Alt
const VK_MENU = 0x12;    // Alt (通用)
const VK_SPACE = 0x20;
const VK_CONTROL = 0x11;
const VK_V = 0x56;
const KEYEVENTF_KEYUP = 0x0002;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 強制釋放所有可能卡住的修飾鍵
function releaseAllModifiers() {
  keybd_event(VK_LMENU, 0, KEYEVENTF_KEYUP, 0);
  keybd_event(VK_RMENU, 0, KEYEVENTF_KEYUP, 0);
  keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, 0);
  keybd_event(VK_SPACE, 0, KEYEVENTF_KEYUP, 0);
  keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);
}

// 模擬 Ctrl+V 貼上
async function simulateCtrlV() {
  // 先強制釋放所有修飾鍵，避免 Alt 卡住
  releaseAllModifiers();
  await sleep(150);

  // 按下 Ctrl
  keybd_event(VK_CONTROL, 0, 0, 0);
  await sleep(50);
  // 按下 V
  keybd_event(VK_V, 0, 0, 0);
  await sleep(50);
  // 放開 V
  keybd_event(VK_V, 0, KEYEVENTF_KEYUP, 0);
  await sleep(50);
  // 放開 Ctrl
  keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);
  await sleep(50);

  // 再次確保沒有鍵卡住
  releaseAllModifiers();
}

// 透過剪貼簿 + Ctrl+V 輸入文字到當前游標位置
async function typeText(text) {
  console.log('[typer] 準備輸入文字:', text);

  // 備份剪貼簿
  const original = clipboard.readText();

  // 寫入文字到剪貼簿
  clipboard.writeText(text);
  await sleep(200);

  // 模擬 Ctrl+V
  await simulateCtrlV();
  console.log('[typer] Ctrl+V 已送出');

  // 恢復剪貼簿
  setTimeout(() => {
    clipboard.writeText(original);
  }, 1000);
}

// 僅複製到剪貼簿
function copyToClipboard(text) {
  clipboard.writeText(text);
}

module.exports = { typeText, copyToClipboard };
