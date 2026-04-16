const Store = require('electron-store');

let store = null;

const defaults = {
  // API 設定
  sttProvider: 'openai', // 'openai' | 'groq'
  openaiApiKey: '',
  groqApiKey: '',

  // 語言設定
  language: 'zh-TW',

  // 快捷鍵
  shortcut: 'RightCtrl',

  // LLM 潤飾
  enablePolish: true,
  polishProvider: 'openai', // 'openai' | 'groq'

  // 其他
  copyToClipboard: false,
  launchAtStartup: false,
};

function getStore() {
  if (!store) {
    store = new Store({
      name: 'notype-settings',
      defaults,
    });
  }
  return store;
}

module.exports = { getStore, defaults };
