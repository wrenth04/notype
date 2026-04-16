const { app, BrowserWindow, globalShortcut, ipcMain, shell } = require('electron');
const path = require('path');
const { createTray } = require('./tray');
const { getStore, normalizeVocabularyItems } = require('./store');
const { registerShortcut, unregisterShortcut, handleAudioData, createRecorderWindow } = require('./shortcut');
const logger = require('./logger');

logger.info('main', '應用程式啟動');

process.on('uncaughtException', (err) => {
  logger.error('main', '未捕捉例外', err);
});

process.on('unhandledRejection', (reason) => {
  logger.error('main', '未處理 Promise 拒絕', reason);
});

// 防止多重啟動
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  logger.warn('main', '無法取得單例鎖，準備退出');
  app.quit();
}

// 隱藏 dock 圖示（macOS），Windows 不顯示工作列
app.setLoginItemSettings({ openAtLogin: false });

let settingsWindow = null;

function createSettingsWindow() {
  if (settingsWindow) {
    logger.info('main', '設定視窗已存在，切換焦點');
    settingsWindow.focus();
    return settingsWindow;
  }

  logger.info('main', '建立設定視窗');

  settingsWindow = new BrowserWindow({
    width: 600,
    height: 520,
    resizable: false,
    title: 'NoType 設定',
    icon: path.join(__dirname, '..', 'assets', 'icon.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'settings', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  settingsWindow.loadFile(path.join(__dirname, 'settings', 'index.html'));
  settingsWindow.setMenuBarVisibility(false);

  settingsWindow.on('closed', () => {
    logger.info('main', '設定視窗已關閉');
    settingsWindow = null;
  });

  return settingsWindow;
}

app.whenReady().then(() => {
  logger.initLogger(app);
  logger.info('main', 'app.whenReady 完成');

  async function openLogDirectory() {
    const logFilePath = logger.getLogFilePath();
    if (!logFilePath) {
      logger.warn('main', '日誌路徑尚未初始化');
      return false;
    }

    const result = await shell.openPath(path.dirname(logFilePath));
    if (result) {
      logger.error('main', '開啟日誌資料夾失敗', result);
      return false;
    }

    logger.info('main', '已開啟日誌資料夾');
    return true;
  }

  // 初始化設定存儲
  const store = getStore();
  logger.info('main', '設定儲存初始化完成');

  // IPC: 讀取設定
  ipcMain.handle('get-settings', () => ({
    ...store.store,
    vocabularyItems: normalizeVocabularyItems(store.get('vocabularyItems')),
  }));

  // IPC: 儲存設定
  ipcMain.handle('save-settings', (_event, settings) => {
    logger.info('main', '收到儲存設定請求', { keys: Object.keys(settings) });
    for (const [key, value] of Object.entries(settings)) {
      if (key === 'vocabularyItems') {
        store.set(key, normalizeVocabularyItems(value));
        continue;
      }
      store.set(key, value);
    }
    app.setLoginItemSettings({ openAtLogin: settings.launchAtStartup ?? false });
    const shortcutRegistered = registerShortcut();
    logger.info('main', '設定儲存完成', { shortcutRegistered, shortcut: store.get('shortcut') });
    return true;
  });

  // IPC: 測試 API Key
  ipcMain.handle('test-api-key', async (_event, provider, apiKey) => {
    try {
      let res;
      if (provider === 'openai') {
        res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
      } else if (provider === 'groq') {
        res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
      } else {
        logger.warn('main', '未知的 API provider', { provider });
        return false;
      }

      if (!res.ok) {
        logger.warn('main', 'API Key 測試失敗', { provider, status: res.status });
      }
      return res.ok;
    } catch (err) {
      logger.error('main', 'API Key 測試發生錯誤', { provider, error: err instanceof Error ? err.message : String(err) });
      return false;
    }
  });

  // IPC: 接收錄音資料
  ipcMain.on('audio-data', async (_event, audioBuffer) => {
    logger.info('main', '收到錄音資料', { length: Array.isArray(audioBuffer) ? audioBuffer.length : 0 });
    await handleAudioData(audioBuffer);
  });

  ipcMain.on('renderer-log', (_event, payload) => {
    const { level = 'info', scope = 'renderer', message = 'renderer log', meta } = payload || {};
    if (level === 'error') {
      logger.error(scope, message, meta);
    } else if (level === 'warn') {
      logger.warn(scope, message, meta);
    } else {
      logger.info(scope, message, meta);
    }
  });

  ipcMain.handle('open-log-directory', async () => openLogDirectory());

  logger.info('main', 'IPC handlers 註冊完成');

  createTray({
    onSettings: () => createSettingsWindow(),
    onOpenLogs: () => openLogDirectory(),
    onQuit: () => app.quit(),
  });
  logger.info('main', '系統匣建立完成');

  createRecorderWindow();
  logger.info('main', '隱藏錄音視窗建立完成');

  registerShortcut();
  logger.info('main', '快捷鍵註冊流程完成');
}).catch((err) => {
  logger.error('main', 'app.whenReady 初始化失敗', err);
});

// 所有視窗關閉時不退出（系統匣常駐）
app.on('window-all-closed', (e) => {
  e.preventDefault();
});

app.on('will-quit', () => {
  logger.info('main', '應用程式即將退出');
  unregisterShortcut();
  globalShortcut.unregisterAll();
});

module.exports = { createSettingsWindow };
