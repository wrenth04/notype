const FIELDS = [
  'sttProvider', 'openaiApiKey', 'groqApiKey',
  'language', 'shortcut', 'secondaryShortcut', 'outputLanguage', 'enablePolish', 'polishProvider',
  'copyToClipboard', 'launchAtStartup',
];

const SHORTCUT_FIELD_CONFIG = {
  shortcut: {
    defaultValue: 'RightCtrl',
    options: [
      { value: 'RightCtrl', display: '右 Ctrl', codes: ['ControlRight'] },
    ],
  },
  secondaryShortcut: {
    defaultValue: 'RightCtrl+Shift',
    options: [
      { value: 'RightCtrl+Shift', display: '右 Ctrl + Shift', codes: ['ControlRight', 'ShiftLeft'] },
      { value: 'RightCtrl+RightShift', display: '右 Ctrl + 右 Shift', codes: ['ControlRight', 'ShiftRight'] },
      { value: 'RightCtrl+LeftAlt', display: '右 Ctrl + 左 Alt', codes: ['ControlRight', 'AltLeft'] },
      { value: 'RightCtrl+Space', display: '右 Ctrl + Space', codes: ['ControlRight', 'Space'] },
    ],
  },
};

const MAX_VOCABULARY_ITEMS = 200;
let vocabularyItems = [];

function createVocabularyId() {
  return `vocab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeAliases(value) {
  const seen = new Set();
  return String(value || '')
    .split(',')
    .map((alias) => alias.trim())
    .filter((alias) => {
      if (!alias) return false;
      const key = alias.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function createVocabularyRow(item = {}) {
  const row = document.createElement('div');
  row.className = 'vocabulary-item';
  row.dataset.id = item.id || createVocabularyId();

  const header = document.createElement('div');
  header.className = 'vocabulary-item-header';

  const enabledLabel = document.createElement('label');
  enabledLabel.className = 'checkbox-inline';

  const enabledInput = document.createElement('input');
  enabledInput.type = 'checkbox';
  enabledInput.className = 'vocabulary-enabled';
  enabledInput.checked = item.enabled !== false;

  const enabledText = document.createElement('span');
  enabledText.textContent = '啟用';

  enabledLabel.appendChild(enabledInput);
  enabledLabel.appendChild(enabledText);

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'btn-danger vocabulary-remove';
  removeButton.textContent = '刪除';

  header.appendChild(enabledLabel);
  header.appendChild(removeButton);

  const termGroup = document.createElement('div');
  termGroup.className = 'form-group';
  const termLabel = document.createElement('label');
  termLabel.textContent = '正確字詞';
  const termInput = document.createElement('input');
  termInput.type = 'text';
  termInput.className = 'vocabulary-term';
  termInput.placeholder = '例如：Claude Code';
  termInput.value = item.term || '';
  termGroup.appendChild(termLabel);
  termGroup.appendChild(termInput);

  const aliasesGroup = document.createElement('div');
  aliasesGroup.className = 'form-group';
  const aliasesLabel = document.createElement('label');
  aliasesLabel.textContent = '常見錯詞 / 別名';
  const aliasesInput = document.createElement('input');
  aliasesInput.type = 'text';
  aliasesInput.className = 'vocabulary-aliases';
  aliasesInput.placeholder = '用逗號分隔，例如：claude code, 克勞德 code';
  aliasesInput.value = (item.aliases || []).join(', ');
  aliasesGroup.appendChild(aliasesLabel);
  aliasesGroup.appendChild(aliasesInput);

  row.appendChild(header);
  row.appendChild(termGroup);
  row.appendChild(aliasesGroup);

  removeButton.addEventListener('click', () => {
    row.remove();
    if (!document.querySelector('.vocabulary-item')) {
      renderVocabularyItems([]);
    }
  });

  return row;
}

function renderVocabularyItems(items) {
  const list = document.getElementById('vocabularyList');
  list.innerHTML = '';

  const safeItems = Array.isArray(items) ? items : [];
  if (safeItems.length === 0) {
    list.appendChild(createVocabularyRow());
    return;
  }

  safeItems.forEach((item) => list.appendChild(createVocabularyRow(item)));
}

function collectVocabularyItems() {
  const rows = document.querySelectorAll('.vocabulary-item');
  const items = [];
  const seenTerms = new Set();

  rows.forEach((row) => {
    const term = row.querySelector('.vocabulary-term').value.trim();
    if (!term) return;

    const termKey = term.toLocaleLowerCase();
    if (seenTerms.has(termKey)) return;
    seenTerms.add(termKey);

    items.push({
      id: row.dataset.id || createVocabularyId(),
      term,
      aliases: normalizeAliases(row.querySelector('.vocabulary-aliases').value),
      enabled: row.querySelector('.vocabulary-enabled').checked,
    });
  });

  return items.slice(0, MAX_VOCABULARY_ITEMS);
}

function getShortcutOption(fieldId, value) {
  const fieldConfig = SHORTCUT_FIELD_CONFIG[fieldId];
  if (!fieldConfig) return null;
  return fieldConfig.options.find((option) => option.value === value) || null;
}

function getDefaultShortcutOption(fieldId) {
  const fieldConfig = SHORTCUT_FIELD_CONFIG[fieldId];
  if (!fieldConfig) return null;
  return getShortcutOption(fieldId, fieldConfig.defaultValue) || fieldConfig.options[0] || null;
}

async function loadSettings() {
  const settings = await window.noTypeAPI.getSettings();
  for (const id of FIELDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (el.type === 'checkbox') {
      el.checked = settings[id] ?? false;
    } else if (SHORTCUT_FIELD_CONFIG[id]) {
      const option = getShortcutOption(id, settings[id]) || getDefaultShortcutOption(id);
      if (!option) continue;
      el.value = option.display;
      el.dataset.shortcutValue = option.value;
    } else {
      el.value = settings[id] ?? '';
    }
  }

  vocabularyItems = Array.isArray(settings.vocabularyItems) ? settings.vocabularyItems : [];
  renderVocabularyItems(vocabularyItems);
}

function collectSettings() {
  const settings = {};
  for (const id of FIELDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (SHORTCUT_FIELD_CONFIG[id]) {
      const fallback = getDefaultShortcutOption(id);
      settings[id] = el.dataset.shortcutValue || fallback?.value || '';
    } else {
      settings[id] = el.type === 'checkbox' ? el.checked : el.value;
    }
  }

  settings.vocabularyItems = collectVocabularyItems();
  return settings;
}

async function saveSettings() {
  const settings = collectSettings();
  await window.noTypeAPI.saveSettings(settings);
  vocabularyItems = settings.vocabularyItems;
  renderVocabularyItems(vocabularyItems);

  const status = document.getElementById('saveStatus');
  status.textContent = '✓ 已儲存';
  status.classList.add('show');
  setTimeout(() => status.classList.remove('show'), 2000);
}

async function testApiKey(provider) {
  const keyField = provider === 'openai' ? 'openaiApiKey' : 'groqApiKey';
  const apiKey = document.getElementById(keyField).value;
  const btn = document.querySelector(`[data-provider="${provider}"]`);

  if (!apiKey) {
    btn.textContent = '請輸入 Key';
    btn.className = 'btn-test error';
    setTimeout(() => { btn.textContent = '測試'; btn.className = 'btn-test'; }, 2000);
    return;
  }

  btn.textContent = '測試中...';
  btn.disabled = true;

  try {
    const result = await window.noTypeAPI.testApiKey(provider, apiKey);
    btn.textContent = result ? '✓ 成功' : '✗ 失敗';
    btn.className = `btn-test ${result ? 'success' : 'error'}`;
  } catch {
    btn.textContent = '✗ 錯誤';
    btn.className = 'btn-test error';
  }

  btn.disabled = false;
  setTimeout(() => { btn.textContent = '測試'; btn.className = 'btn-test'; }, 3000);
}

function getShortcutCapturePlaceholder(fieldId) {
  if (fieldId === 'secondaryShortcut') {
    return '請按想要的組合鍵...';
  }
  return '請按右 Ctrl...';
}

function setupShortcutCapture(fieldId) {
  const input = document.getElementById(fieldId);
  const status = document.getElementById('saveStatus');
  const fieldConfig = SHORTCUT_FIELD_CONFIG[fieldId];
  if (!input || !status || !fieldConfig) return;

  let capturing = false;
  const pressedCodes = new Set();

  input.addEventListener('focus', () => {
    capturing = true;
    pressedCodes.clear();
    input.value = getShortcutCapturePlaceholder(fieldId);
  });

  input.addEventListener('blur', () => {
    capturing = false;
    pressedCodes.clear();
    if (input.value === getShortcutCapturePlaceholder(fieldId)) {
      const fallback = getShortcutOption(fieldId, input.dataset.shortcutValue) || getDefaultShortcutOption(fieldId);
      if (!fallback) return;
      input.value = fallback.display;
      input.dataset.shortcutValue = fallback.value;
    }
  });

  input.addEventListener('keydown', (e) => {
    if (!capturing) return;
    e.preventDefault();
    pressedCodes.add(e.code);

    const matchedOption = fieldConfig.options.find((option) => (
      option.codes.length === pressedCodes.size
      && option.codes.every((code) => pressedCodes.has(code))
    ));

    if (matchedOption) {
      input.value = matchedOption.display;
      input.dataset.shortcutValue = matchedOption.value;
      capturing = false;
      pressedCodes.clear();
      input.blur();
      return;
    }

    const hasPotentialMatch = fieldConfig.options.some((option) => (
      pressedCodes.size <= option.codes.length
      && Array.from(pressedCodes).every((code) => option.codes.includes(code))
    ));

    if (hasPotentialMatch) return;

    const supportedOptions = fieldConfig.options.map((option) => option.display).join('、');
    status.textContent = `目前支援：${supportedOptions}`;
    status.classList.add('show');
    setTimeout(() => status.classList.remove('show'), 2000);
    pressedCodes.clear();
    input.value = getShortcutCapturePlaceholder(fieldId);
  });

  input.addEventListener('keyup', (e) => {
    if (!capturing) return;
    pressedCodes.delete(e.code);
  });
}

function setupVocabularyEditor() {
  document.getElementById('addVocabularyBtn').addEventListener('click', () => {
    const list = document.getElementById('vocabularyList');
    list.appendChild(createVocabularyRow());
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  Object.keys(SHORTCUT_FIELD_CONFIG).forEach((fieldId) => setupShortcutCapture(fieldId));
  setupVocabularyEditor();

  document.getElementById('saveBtn').addEventListener('click', saveSettings);

  document.querySelectorAll('.btn-test').forEach((btn) => {
    btn.addEventListener('click', () => testApiKey(btn.dataset.provider));
  });
});
