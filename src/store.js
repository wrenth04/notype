const Store = require('electron-store');

let store = null;

const MAX_VOCABULARY_ITEMS = 200;
const MAX_TERM_LENGTH = 80;
const MAX_ALIAS_LENGTH = 80;
const MAX_ALIASES_PER_ITEM = 20;

const defaults = {
  // API 設定
  sttProvider: 'openai', // 'openai' | 'groq'
  openaiApiKey: '',
  groqApiKey: '',

  // 語言設定
  language: 'zh-TW',

  // 快捷鍵
  shortcut: 'RightCtrl',
  secondaryShortcut: 'RightCtrl+Shift',

  // 輸出語言
  outputLanguage: 'en',

  // LLM 潤飾
  enablePolish: true,
  polishProvider: 'openai', // 'openai' | 'groq'

  // 字詞列表
  vocabularyItems: [],

  // 其他
  copyToClipboard: false,
  launchAtStartup: false,
};

function createVocabularyId() {
  return `vocab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeVocabularyItems(items) {
  if (!Array.isArray(items)) return [];

  const normalizedItems = [];
  const seenTerms = new Set();

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;

    const term = typeof item.term === 'string' ? item.term.trim().slice(0, MAX_TERM_LENGTH) : '';
    if (!term) continue;

    const dedupeKey = term.toLocaleLowerCase();
    if (seenTerms.has(dedupeKey)) continue;
    seenTerms.add(dedupeKey);

    const seenAliases = new Set([dedupeKey]);
    const aliases = Array.isArray(item.aliases)
      ? item.aliases
          .map((alias) => typeof alias === 'string' ? alias.trim().slice(0, MAX_ALIAS_LENGTH) : '')
          .filter((alias) => {
            if (!alias) return false;
            const aliasKey = alias.toLocaleLowerCase();
            if (seenAliases.has(aliasKey)) return false;
            seenAliases.add(aliasKey);
            return true;
          })
          .slice(0, MAX_ALIASES_PER_ITEM)
      : [];

    normalizedItems.push({
      id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : createVocabularyId(),
      term,
      aliases,
      enabled: item.enabled !== false,
    });

    if (normalizedItems.length >= MAX_VOCABULARY_ITEMS) break;
  }

  return normalizedItems;
}

function getEnabledVocabularyItems(input) {
  const items = input === undefined ? getStore().get('vocabularyItems') : input;
  return normalizeVocabularyItems(items).filter((item) => item.enabled);
}

function getStore() {
  if (!store) {
    store = new Store({
      name: 'notype-settings',
      defaults,
    });
  }
  return store;
}

module.exports = {
  getStore,
  defaults,
  normalizeVocabularyItems,
  getEnabledVocabularyItems,
  MAX_VOCABULARY_ITEMS,
};
