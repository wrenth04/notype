const fs = require('fs');
const { getStore, getEnabledVocabularyItems } = require('../store');

const MAX_STT_PROMPT_LENGTH = 1200;

function buildVocabularyPrompt(items) {
  if (!items.length) return '';

  const parts = [];
  for (const item of items) {
    const aliases = item.aliases.length ? `（也可能聽成：${item.aliases.join('、')}）` : '';
    const nextPart = `${item.term}${aliases}`;
    const candidate = parts.length === 0 ? nextPart : `${parts.join('；')}；${nextPart}`;
    if (candidate.length > MAX_STT_PROMPT_LENGTH) break;
    parts.push(nextPart);
  }

  return parts.length ? `以下字詞是音訊中可能出現的專有名詞與慣用寫法，請優先正確辨識：${parts.join('；')}` : '';
}

// OpenAI Whisper API 語音轉文字
async function transcribeWithWhisper(audioFilePath) {
  const store = getStore();
  const apiKey = store.get('openaiApiKey');
  const language = store.get('language') || 'zh';
  const vocabularyPrompt = buildVocabularyPrompt(getEnabledVocabularyItems());

  if (!apiKey) throw new Error('未設定 OpenAI API Key');

  const audioData = fs.readFileSync(audioFilePath);
  const blob = new Blob([audioData], { type: 'audio/webm' });

  const formData = new FormData();
  formData.append('file', blob, 'recording.webm');
  formData.append('model', 'whisper-1');
  formData.append('language', language.split('-')[0]); // zh-TW → zh
  formData.append('response_format', 'json');
  if (vocabularyPrompt) {
    formData.append('prompt', vocabularyPrompt);
  }

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Whisper API 錯誤 (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.text;
}

module.exports = { transcribeWithWhisper, buildVocabularyPrompt };
