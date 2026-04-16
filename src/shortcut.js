const { BrowserWindow } = require('electron');
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
let shortcutMonitorTimer = null;
let shortcutStates = {
  default: false,
  translate: false,
};
let activeRecordingMode = 'default';

const user32 = koffi.load('user32.dll');
const GetAsyncKeyState = user32.func('short __stdcall GetAsyncKeyState(int vKey)');

const VK_RCONTROL = 0xA3;
const VK_LSHIFT = 0xA0;
const VK_RSHIFT = 0xA1;
const VK_LMENU = 0xA4;
const VK_SPACE = 0x20;

const SHORTCUT_DEFINITIONS = {
  RightCtrl: {
    value: 'RightCtrl',
    display: '右 Ctrl',
    keys: [VK_RCONTROL],
  },
  'RightCtrl+Shift': {
    value: 'RightCtrl+Shift',
    display: '右 Ctrl + Shift',
    keys: [VK_RCONTROL, VK_LSHIFT],
  },
  'RightCtrl+RightShift': {
    value: 'RightCtrl+RightShift',
    display: '右 Ctrl + 右 Shift',
    keys: [VK_RCONTROL, VK_RSHIFT],
  },
  'RightCtrl+LeftAlt': {
    value: 'RightCtrl+LeftAlt',
    display: '右 Ctrl + 左 Alt',
    keys: [VK_RCONTROL, VK_LMENU],
  },
  'RightCtrl+Space': {
    value: 'RightCtrl+Space',
    display: '右 Ctrl + Space',
    keys: [VK_RCONTROL, VK_SPACE],
  },
};

const SHORTCUT_SETTING_KEYS = {
  default: 'shortcut',
  translate: 'secondaryShortcut',
};

function isKeyDown(vk) {
  return (GetAsyncKeyState(vk) & 0x8000) !== 0;
}

function isShortcutPressed(shortcut) {
  return shortcut.keys.every((vk) => isKeyDown(vk));
}

function getShortcutConfig(mode) {
  const store = getStore();
  const settingKey = SHORTCUT_SETTING_KEYS[mode];
  const fallbackValue = mode === 'translate' ? 'RightCtrl+Shift' : 'RightCtrl';
  const configuredShortcut = store.get(settingKey);
  const shortcut = SHORTCUT_DEFINITIONS[configuredShortcut];

  if (!shortcut) {
    logger.warn('shortcut', '偵測到不支援的快捷鍵設定，回退為預設值', { mode, configuredShortcut, fallbackValue });
    store.set(settingKey, fallbackValue);
    return SHORTCUT_DEFINITIONS[fallbackValue];
  }

  return shortcut;
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
  if (shortcutMonitorTimer) {
    clearInterval(shortcutMonitorTimer);
    shortcutMonitorTimer = null;
  }

  const shortcuts = {
    default: getShortcutConfig('default'),
    translate: getShortcutConfig('translate'),
  };

  shortcutStates = {
    default: isShortcutPressed(shortcuts.default),
    translate: isShortcutPressed(shortcuts.translate),
  };

  shortcutMonitorTimer = setInterval(() => {
    const isTranslatePressed = isShortcutPressed(shortcuts.translate);
    const isDefaultPressed = isShortcutPressed(shortcuts.default) && !isTranslatePressed;

    if (!shortcutStates.translate && isTranslatePressed) {
      startRecording('translate');
    } else if (!shortcutStates.default && isDefaultPressed) {
      startRecording('default');
    }

    if (activeRecordingMode === 'translate' && shortcutStates.translate && !isTranslatePressed) {
      stopRecordingAndProcess();
    } else if (activeRecordingMode === 'default' && shortcutStates.default && !isDefaultPressed) {
      stopRecordingAndProcess();
    }

    shortcutStates.default = isDefaultPressed;
    shortcutStates.translate = isTranslatePressed;
  }, 50);

  logger.info('shortcut', '快捷鍵監聽已啟動', {
    defaultShortcut: shortcuts.default.value,
    translateShortcut: shortcuts.translate.value,
  });
  return true;
}

function startRecording(mode = 'default') {
  if (isRecording) return;
  isRecording = true;
  activeRecordingMode = mode;
  logger.info('shortcut', '開始錄音', { mode });
  showOverlay('recording');

  const win = createRecorderWindow();
  win.webContents.send('start-recording');
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
  const recordingMode = activeRecordingMode;

  try {
    logger.info('shortcut', '開始處理錄音資料', {
      length: Array.isArray(audioBuffer) ? audioBuffer.length : 0,
      mode: recordingMode,
    });
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
    const targetLanguage = recordingMode === 'translate' ? store.get('outputLanguage') : null;
    const polishedText = await polishText(rawText, { targetLanguage, mode: recordingMode });
    logger.info('shortcut', '文字潤飾完成', { length: polishedText.length, mode: recordingMode, targetLanguage });

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
    activeRecordingMode = 'default';
    logger.info('shortcut', '錄音暫存檔已清理');
  }
}

function unregisterShortcut() {
  if (keyPollTimer) {
    clearInterval(keyPollTimer);
    keyPollTimer = null;
  }

  if (shortcutMonitorTimer) {
    clearInterval(shortcutMonitorTimer);
    shortcutMonitorTimer = null;
  }

  shortcutStates = {
    default: false,
    translate: false,
  };
  activeRecordingMode = 'default';
  logger.info('shortcut', '快捷鍵監聽已停止');
}

module.exports = { registerShortcut, unregisterShortcut, handleAudioData, createRecorderWindow };
