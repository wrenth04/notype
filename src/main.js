const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const { createTray } = require('./tray');
const { getStore } = require('./store');
const { registerShortcut, unregisterShortcut, handleAudioData, createRecorderWindow } = require('./shortcut');

// 防止多重啟動
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// 隱藏 dock 圖示（macOS），Windows 不顯示工作列
app.setLoginItemSettings({ openAtLogin: false });

let settingsWindow = null;

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return settingsWindow;
  }

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
    settingsWindow = null;
  });

  return settingsWindow;
}

app.whenReady().then(() => {
  // 初始化設定存儲
  const store = getStore();

  // IPC: 讀取設定
  ipcMain.handle('get-settings', () => store.store);

  // IPC: 儲存設定
  ipcMain.handle('save-settings', (_event, settings) => {
    for (const [key, value] of Object.entries(settings)) {
      store.set(key, value);
    }
    // 同步開機啟動設定
    app.setLoginItemSettings({ openAtLogin: settings.launchAtStartup ?? false });
    // 重新註冊快捷鍵（可能已更改）
    registerShortcut();
    return true;
  });

  // IPC: 測試 API Key
  ipcMain.handle('test-api-key', async (_event, provider, apiKey) => {
    try {
      if (provider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return res.ok;
      } else if (provider === 'groq') {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return res.ok;
      }
      return false;
    } catch {
      return false;
    }
  });

  // IPC: 接收錄音資料
  ipcMain.on('audio-data', async (_event, audioBuffer) => {
    await handleAudioData(audioBuffer);
  });

  // 建立系統匣
  createTray({
    onSettings: () => createSettingsWindow(),
    onQuit: () => app.quit(),
  });

  // 初始化隱藏錄音視窗
  createRecorderWindow();

  // 註冊全域快捷鍵
  registerShortcut();
});

// 所有視窗關閉時不退出（系統匣常駐）
app.on('window-all-closed', (e) => {
  e.preventDefault();
});

app.on('will-quit', () => {
  unregisterShortcut();
  globalShortcut.unregisterAll();
});

module.exports = { createSettingsWindow };
