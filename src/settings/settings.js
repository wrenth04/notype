const FIELDS = [
  'sttProvider', 'openaiApiKey', 'groqApiKey',
  'language', 'shortcut', 'enablePolish', 'polishProvider',
  'copyToClipboard', 'launchAtStartup',
];

const SUPPORTED_SHORTCUT = {
  value: 'RightCtrl',
  display: '右 Ctrl',
};

async function loadSettings() {
  const settings = await window.noTypeAPI.getSettings();
  for (const id of FIELDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (el.type === 'checkbox') {
      el.checked = settings[id] ?? false;
    } else if (id === 'shortcut') {
      el.value = settings[id] === SUPPORTED_SHORTCUT.value ? SUPPORTED_SHORTCUT.display : SUPPORTED_SHORTCUT.display;
      el.dataset.shortcutValue = SUPPORTED_SHORTCUT.value;
    } else {
      el.value = settings[id] ?? '';
    }
  }
}

function collectSettings() {
  const settings = {};
  for (const id of FIELDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (id === 'shortcut') {
      settings[id] = el.dataset.shortcutValue || SUPPORTED_SHORTCUT.value;
    } else {
      settings[id] = el.type === 'checkbox' ? el.checked : el.value;
    }
  }
  return settings;
}

async function saveSettings() {
  const settings = collectSettings();
  await window.noTypeAPI.saveSettings(settings);

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

function setupShortcutCapture() {
  const input = document.getElementById('shortcut');
  const status = document.getElementById('saveStatus');
  let capturing = false;

  input.addEventListener('focus', () => {
    capturing = true;
    input.value = '請按右 Ctrl...';
  });

  input.addEventListener('blur', () => {
    capturing = false;
    if (input.value === '請按右 Ctrl...') {
      input.value = SUPPORTED_SHORTCUT.display;
      input.dataset.shortcutValue = SUPPORTED_SHORTCUT.value;
    }
  });

  input.addEventListener('keydown', (e) => {
    if (!capturing) return;
    e.preventDefault();

    if (e.code === 'ControlRight') {
      input.value = SUPPORTED_SHORTCUT.display;
      input.dataset.shortcutValue = SUPPORTED_SHORTCUT.value;
      capturing = false;
      input.blur();
      return;
    }

    status.textContent = '目前只支援右 Ctrl';
    status.classList.add('show');
    setTimeout(() => status.classList.remove('show'), 2000);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupShortcutCapture();

  document.getElementById('saveBtn').addEventListener('click', saveSettings);

  document.querySelectorAll('.btn-test').forEach((btn) => {
    btn.addEventListener('click', () => testApiKey(btn.dataset.provider));
  });
});
