const { globalShortcut, BrowserWindow } = require('electron');
const path = require('path');
const koffi = require('koffi');
const { getStore } = require('./store');
const { showOverlay, hideOverlay, saveAudioBuffer, cleanupTempAudio } = require('./recorder');
const { transcribeWithWhisper } = require('./api/whisper');
const { transcribeWithGroq } = require('./api/groq');
const { polishText } = require('./api/llm');
const { typeText, copyToClipboard } = require('./typer');
const logger = require('./logger');

let recorderWindow = null;
let isRecording = false;
let keyPollTimer = null;

const user32 = koffi.load('user32.dll');
const GetAsyncKeyState = user32.func('short __stdcall GetAsyncKeyState(int vKey)');

const VK_LMENU = 0xA4;
const VK_SPACE = 0x20;

function isKeyDown(vk) {
  return (GetAsyncKeyState(vk) & 0x8000) !== 0;
}

function attachRecorderWindowLogging(win) {
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logger.error('shortcut', '錄音視窗載入失敗', { errorCode, errorDescription, validatedURL });
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    logger.error('shortcut', '錄音視窗 renderer process 結束', details);
  });
}

function createRecorderWindow() {
  if (recorderWindow) return recorderWindow;

  logger.info('shortcut', '建立隱藏錄音視窗');

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

  attachRecorderWindowLogging(recorderWindow);
  recorderWindow.loadFile(path.join(__dirname, 'recorder-page.html'));

  recorderWindow.on('closed', () => {
    logger.info('shortcut', '錄音視窗已關閉');
    recorderWindow = null;
  });

  return recorderWindow;
}

function registerShortcut() {
  globalShortcut.unregisterAll();

  const success = globalShortcut.register('Alt+Space', () => {
    if (!isRecording) {
      startRecording();
    }
  });

  if (success) {
    logger.info('shortcut', '快捷鍵已註冊', { shortcut: 'Alt+Space' });
  } else {
    logger.error('shortcut', '快捷鍵註冊失敗', { shortcut: 'Alt+Space' });
  }

  return success;
}

function startRecording() {
  if (isRecording) return;
  isRecording = true;
  logger.info('shortcut', '開始錄音');
  showOverlay('recording');

  const win = createRecorderWindow();
  win.webContents.send('start-recording');

  keyPollTimer = setInterval(() => {
    const altDown = isKeyDown(VK_LMENU);
    const spaceDown = isKeyDown(VK_SPACE);

    if (!altDown || !spaceDown) {
      stopRecordingAndProcess();
    }
  }, 80);
}

function stopRecordingAndProcess() {
  if (!isRecording) return;
  isRecording = false;

  if (keyPollTimer) {
    clearInterval(keyPollTimer);
    keyPollTimer = null;
  }

  const win = createRecorderWindow();
  win.webContents.send('stop-recording');
  logger.info('shortcut', '停止錄音，開始處理');
}

async function handleAudioData(audioBuffer) {
  const store = getStore();

  try {
    logger.info('shortcut', '開始處理錄音資料', { length: Array.isArray(audioBuffer) ? audioBuffer.length : 0 });
    const audioPath = saveAudioBuffer(audioBuffer);

    showOverlay('processing');
    const provider = store.get('sttProvider') || 'openai';
    logger.info('shortcut', '開始 STT', { provider });

    let rawText;
    if (provider === 'groq') {
      rawText = await transcribeWithGroq(audioPath);
    } else {
      rawText = await transcribeWithWhisper(audioPath);
    }

    logger.info('shortcut', 'STT 完成', { hasText: Boolean(rawText && rawText.trim()) });

    if (!rawText || rawText.trim() === '') {
      logger.warn('shortcut', 'STT 結果為空');
      showOverlay('done');
      setTimeout(hideOverlay, 1500);
      cleanupTempAudio();
      return;
    }

    showOverlay('polishing');
    const polishedText = await polishText(rawText);
    logger.info('shortcut', '文字潤飾完成', { length: polishedText.length });

    const copyOnly = store.get('copyToClipboard');
    if (copyOnly) {
      copyToClipboard(polishedText);
      logger.info('shortcut', '文字已複製到剪貼簿');
    } else {
      await typeText(polishedText);
      logger.info('shortcut', '文字已輸入到目標欄位');
    }

    showOverlay('done');
    setTimeout(hideOverlay, 1500);
  } catch (err) {
    logger.error('shortcut', '處理錄音失敗', err);
    showOverlay('error');
    setTimeout(hideOverlay, 3000);
  } finally {
    cleanupTempAudio();
    logger.info('shortcut', '錄音暫存檔已清理');
  }
}

function unregisterShortcut() {
  if (keyPollTimer) {
    clearInterval(keyPollTimer);
    keyPollTimer = null;
  }
  globalShortcut.unregisterAll();
  logger.info('shortcut', '快捷鍵已解除註冊');
}

module.exports = { registerShortcut, unregisterShortcut, handleAudioData, createRecorderWindow };
