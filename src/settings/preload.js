const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('noTypeAPI', {
  // 讀取設定
  getSettings: () => ipcRenderer.invoke('get-settings'),
  // 儲存設定
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  // 測試 API Key
  testApiKey: (provider, apiKey) => ipcRenderer.invoke('test-api-key', provider, apiKey),
});
