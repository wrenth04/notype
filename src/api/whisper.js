const fs = require('fs');
const path = require('path');
const { getStore } = require('../store');

// OpenAI Whisper API 語音轉文字
async function transcribeWithWhisper(audioFilePath) {
  const store = getStore();
  const apiKey = store.get('openaiApiKey');
  const language = store.get('language') || 'zh';

  if (!apiKey) throw new Error('未設定 OpenAI API Key');

  const audioData = fs.readFileSync(audioFilePath);
  const blob = new Blob([audioData], { type: 'audio/webm' });

  const formData = new FormData();
  formData.append('file', blob, 'recording.webm');
  formData.append('model', 'whisper-1');
  formData.append('language', language.split('-')[0]); // zh-TW → zh
  formData.append('response_format', 'json');

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

module.exports = { transcribeWithWhisper };
