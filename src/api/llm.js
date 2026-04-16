const { getStore, getEnabledVocabularyItems } = require('../store');

const BASE_POLISH_PROMPT = `你是一個文字編輯助手。請將以下語音轉錄的文字潤飾為自然、專業的書面文字。

規則：
1. 移除口語贅詞（嗯、呃、那個、就是、然後、對、這個）
2. 修正文法和語序
3. 加入適當的標點符號
4. 保持原意不變，不要添加新內容
5. 如果原文是中文，輸出繁體中文
6. 只輸出潤飾後的文字，不要加任何說明`;

const LANGUAGE_LABELS = {
  'zh-TW': '繁體中文',
  'zh-CN': '簡體中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
};

const MAX_VOCABULARY_PROMPT_LENGTH = 1500;

function buildVocabularyRules(items) {
  if (!items.length) return '';

  const parts = [];
  for (const item of items) {
    const nextPart = `標準字詞：${item.term}`;
    const candidate = parts.length === 0 ? nextPart : `${parts.join('\n')}
${nextPart}`;
    if (candidate.length > MAX_VOCABULARY_PROMPT_LENGTH) break;
    parts.push(nextPart);
  }

  if (!parts.length) return '';

  return `

另外請遵守以下字詞規則：
- 以下標準字詞請優先保留原樣，不要改寫成別的近音字、通用詞或翻譯。
- 若原文已經是這些字詞，請維持不變。
- 若你不確定，請保留原文，不要自行替換。
${parts.join('\n')}`;
}

function buildOutputLanguageRule(targetLanguage) {
  if (!targetLanguage) return '';
  const label = LANGUAGE_LABELS[targetLanguage] || targetLanguage;
  return `

另外，最終輸出請一律使用${label}。若原文不是該語言，請在保留原意的前提下翻譯成${label}後再輸出。`;
}

function buildPolishPrompt(items, options = {}) {
  return `${BASE_POLISH_PROMPT}${buildOutputLanguageRule(options.targetLanguage)}${buildVocabularyRules(items)}`;
}

// 使用 OpenAI GPT 潤飾文字
async function polishWithOpenAI(rawText, options = {}) {
  const store = getStore();
  const apiKey = store.get('openaiApiKey');
  const prompt = buildPolishPrompt(getEnabledVocabularyItems(), options);
  if (!apiKey) throw new Error('未設定 OpenAI API Key');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: rawText },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI LLM 錯誤 (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content.trim();
}

// 使用 Groq LLM 潤飾文字
async function polishWithGroq(rawText, options = {}) {
  const store = getStore();
  const apiKey = store.get('groqApiKey');
  const prompt = buildPolishPrompt(getEnabledVocabularyItems(), options);
  if (!apiKey) throw new Error('未設定 Groq API Key');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: rawText },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq LLM 錯誤 (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content.trim();
}

// 統一潤飾入口
async function polishText(rawText, options = {}) {
  const store = getStore();
  const enabled = store.get('enablePolish');
  const shouldForcePolish = Boolean(options.targetLanguage);
  if (!enabled && !shouldForcePolish) return rawText;

  const provider = store.get('polishProvider') || 'openai';
  if (provider === 'groq') {
    return polishWithGroq(rawText, options);
  }
  return polishWithOpenAI(rawText, options);
}

module.exports = { polishText, polishWithOpenAI, polishWithGroq, buildPolishPrompt };
