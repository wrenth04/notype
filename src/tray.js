const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let tray = null;

function createTray({ onSettings, onQuit }) {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  tray.setToolTip('NoType — AI 語音輸入');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '⚙️ 設定',
      click: () => onSettings(),
    },
    { type: 'separator' },
    {
      label: '關於 NoType',
      click: () => {
        const { dialog } = require('electron');
        dialog.showMessageBox({
          type: 'info',
          title: '關於 NoType',
          message: 'NoType v1.0.0',
          detail: 'AI 語音輸入工具 — 用說的取代打字\n\n按住快捷鍵說話，AI 幫你轉成專業文字。',
        });
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => onQuit(),
    },
  ]);

  tray.setContextMenu(contextMenu);

  // 左鍵點擊也開啟選單
  tray.on('click', () => {
    tray.popUpContextMenu(contextMenu);
  });

  return tray;
}

function getTray() {
  return tray;
}

module.exports = { createTray, getTray };
