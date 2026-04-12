const fs = require('fs');
const { getStore } = require('../store');

// Groq Whisper API 語音轉文字
async function transcribeWithGroq(audioFilePath) {
  const store = getStore();
  const apiKey = store.get('groqApiKey');
  const language = store.get('language') || 'zh';

  if (!apiKey) throw new Error('未設定 Groq API Key');

  const audioData = fs.readFileSync(audioFilePath);
  const blob = new Blob([audioData], { type: 'audio/webm' });

  const formData = new FormData();
  formData.append('file', blob, 'recording.webm');
  formData.append('model', 'whisper-large-v3');
  formData.append('language', language.split('-')[0]);
  formData.append('response_format', 'json');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API 錯誤 (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.text;
}

module.exports = { transcribeWithGroq };
