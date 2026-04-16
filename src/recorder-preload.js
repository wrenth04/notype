const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('recorderBridge', {
  onStartRecording: (callback) => {
    ipcRenderer.on('start-recording', () => callback());
  },
  onStopRecording: (callback) => {
    ipcRenderer.on('stop-recording', () => callback());
  },
  sendAudioData: (buffer) => {
    ipcRenderer.send('audio-data', buffer);
  },
  reportLog: (level, scope, message, meta) => {
    ipcRenderer.send('renderer-log', { level, scope, message, meta });
  },
});
