const { globalShortcut, BrowserWindow } = require('electron');
const path = require('path');
const koffi = require('koffi');
const { getStore } = require('./store');
const { showOverlay, hideOverlay, saveAudioBuffer, cleanupTempAudio } = require('./recorder');
const { transcribeWithWhisper } = require('./api/whisper');
const { transcribeWithGroq } = require('./api/groq');
const { polishText } = require('./api/llm');
const { typeText, copyToClipboard } = require('./typer');

let recorderWindow = null;
let isRecording = false;
let keyPollTimer = null;

// Windows API: GetAsyncKeyState
const user32 = koffi.load('user32.dll');
const GetAsyncKeyState = user32.func('short __stdcall GetAsyncKeyState(int vKey)');

// Virtual Key Codes
const VK_LMENU = 0xA4;  // Left Alt
const VK_SPACE = 0x20;  // Space

function isKeyDown(vk) {
  // 高位元組被設定 = 鍵正被按住
  return (GetAsyncKeyState(vk) & 0x8000) !== 0;
}

// 建立隱藏的錄音視窗
function createRecorderWindow() {
  if (recorderWindow) return recorderWindow;

  recorderWindow = new BrowserWindow({
    show: false,
    width: 1,
    height: 1,
    webPreferences: {
      preload: path.join(__dirname, 'recorder-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  recorderWindow.loadFile(path.join(__dirname, 'recorder-page.html'));

  recorderWindow.on('closed', () => {
    recorderWindow = null;
  });

  return recorderWindow;
}

// 註冊全域快捷鍵
function registerShortcut() {
  globalShortcut.unregisterAll();

  const success = globalShortcut.register('Alt+Space', () => {
    if (!isRecording) {
      startRecording();
    }
  });

  if (success) {
    console.log('快捷鍵已註冊：按住 Left Alt + Space 錄音，放開停止');
  } else {
    console.error('快捷鍵 Alt+Space 註冊失敗');
  }

  return success;
}

// 開始錄音
function startRecording() {
  if (isRecording) return;
  isRecording = true;
  showOverlay('recording');

  const win = createRecorderWindow();
  win.webContents.send('start-recording');
  console.log('開始錄音');

  // 每 80ms 檢查按鍵是否放開
  keyPollTimer = setInterval(() => {
    const altDown = isKeyDown(VK_LMENU);
    const spaceDown = isKeyDown(VK_SPACE);

    // 只要 Alt 或 Space 其中一個放開，就停止錄音
    if (!altDown || !spaceDown) {
      stopRecordingAndProcess();
    }
  }, 80);
}

// 停止錄音並處理
function stopRecordingAndProcess() {
  if (!isRecording) return;
  isRecording = false;

  // 停止輪詢
  if (keyPollTimer) {
    clearInterval(keyPollTimer);
    keyPollTimer = null;
  }

  const win = createRecorderWindow();
  win.webContents.send('stop-recording');
  console.log('停止錄音，開始處理');
}

// 處理錄音完成的音訊資料
async function handleAudioData(audioBuffer) {
  const store = getStore();

  try {
    const audioPath = saveAudioBuffer(audioBuffer);

    // STT 辨識
    showOverlay('processing');
    const provider = store.get('sttProvider') || 'openai';
    let rawText;

    if (provider === 'groq') {
      rawText = await transcribeWithGroq(audioPath);
    } else {
      rawText = await transcribeWithWhisper(audioPath);
    }

    console.log('STT 結果:', rawText);

    if (!rawText || rawText.trim() === '') {
      showOverlay('done');
      setTimeout(hideOverlay, 1500);
      cleanupTempAudio();
      return;
    }

    // LLM 潤飾
    showOverlay('polishing');
    const polishedText = await polishText(rawText);
    console.log('潤飾結果:', polishedText);

    // 輸入文字
    const copyOnly = store.get('copyToClipboard');
    if (copyOnly) {
      copyToClipboard(polishedText);
    } else {
      await typeText(polishedText);
    }

    showOverlay('done');
    setTimeout(hideOverlay, 1500);
  } catch (err) {
    console.error('處理錄音失敗:', err);
    showOverlay('error');
    setTimeout(hideOverlay, 3000);
  } finally {
    cleanupTempAudio();
  }
}

function unregisterShortcut() {
  if (keyPollTimer) {
    clearInterval(keyPollTimer);
    keyPollTimer = null;
  }
  globalShortcut.unregisterAll();
}

module.exports = { registerShortcut, unregisterShortcut, handleAudioData, createRecorderWindow };
