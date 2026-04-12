// 設定欄位 ID 對應
const FIELDS = [
  'sttProvider', 'openaiApiKey', 'groqApiKey',
  'language', 'shortcut', 'enablePolish', 'polishProvider',
  'copyToClipboard', 'launchAtStartup',
];

// 載入設定
async function loadSettings() {
  const settings = await window.noTypeAPI.getSettings();
  for (const id of FIELDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (el.type === 'checkbox') {
      el.checked = settings[id] ?? false;
    } else {
      el.value = settings[id] ?? '';
    }
  }
}

// 收集設定
function collectSettings() {
  const settings = {};
  for (const id of FIELDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    settings[id] = el.type === 'checkbox' ? el.checked : el.value;
  }
  return settings;
}

// 儲存設定
async function saveSettings() {
  const settings = collectSettings();
  await window.noTypeAPI.saveSettings(settings);

  const status = document.getElementById('saveStatus');
  status.textContent = '✓ 已儲存';
  status.classList.add('show');
  setTimeout(() => status.classList.remove('show'), 2000);
}

// 測試 API Key
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

// 快捷鍵錄製
function setupShortcutCapture() {
  const input = document.getElementById('shortcut');
  let capturing = false;

  input.addEventListener('focus', () => {
    capturing = true;
    input.value = '請按下組合鍵...';
  });

  input.addEventListener('blur', () => {
    capturing = false;
    // 如果沒有錄到鍵，恢復原值
    if (input.value === '請按下組合鍵...') {
      loadSettings(); // 重新載入
    }
  });

  input.addEventListener('keydown', (e) => {
    if (!capturing) return;
    e.preventDefault();

    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Super');

    // 排除單獨的修飾鍵
    const modKeys = ['Control', 'Alt', 'Shift', 'Meta'];
    if (!modKeys.includes(e.key)) {
      parts.push(e.key === ' ' ? 'Space' : e.key);
      input.value = parts.join('+');
      capturing = false;
      input.blur();
    }
  });
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupShortcutCapture();

  document.getElementById('saveBtn').addEventListener('click', saveSettings);

  // 測試按鈕
  document.querySelectorAll('.btn-test').forEach((btn) => {
    btn.addEventListener('click', () => testApiKey(btn.dataset.provider));
  });
});
