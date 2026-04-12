// 產生 NoType 系統匣圖示：藍色圓角背景 + 白色麥克風
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const SIZE = 64; // 64x64 以確保在高 DPI 螢幕上清晰
const png = new PNG({ width: SIZE, height: SIZE });

// 顏色定義
const BG_TOP = [74, 144, 255];    // #4A90FF 漸層上方
const BG_BOT = [48, 112, 224];    // #3070E0 漸層下方
const WHITE = [255, 255, 255];
const TRANSPARENT = [0, 0, 0, 0];

// 工具函式：設定像素
function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const idx = (SIZE * y + x) << 2;
  png.data[idx] = r;
  png.data[idx + 1] = g;
  png.data[idx + 2] = b;
  png.data[idx + 3] = a;
}

// 工具函式：距離計算
function dist(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

// 畫圓角矩形背景（帶漸層）
function drawBackground() {
  const radius = 14;
  for (let y = 0; y < SIZE; y++) {
    // 漸層顏色
    const t = y / SIZE;
    const r = Math.round(BG_TOP[0] * (1 - t) + BG_BOT[0] * t);
    const g = Math.round(BG_TOP[1] * (1 - t) + BG_BOT[1] * t);
    const b = Math.round(BG_TOP[2] * (1 - t) + BG_BOT[2] * t);

    for (let x = 0; x < SIZE; x++) {
      // 檢查圓角
      let inside = true;
      // 左上
      if (x < radius && y < radius && dist(x, y, radius, radius) > radius) inside = false;
      // 右上
      if (x >= SIZE - radius && y < radius && dist(x, y, SIZE - radius - 1, radius) > radius) inside = false;
      // 左下
      if (x < radius && y >= SIZE - radius && dist(x, y, radius, SIZE - radius - 1) > radius) inside = false;
      // 右下
      if (x >= SIZE - radius && y >= SIZE - radius && dist(x, y, SIZE - radius - 1, SIZE - radius - 1) > radius) inside = false;

      if (inside) {
        setPixel(x, y, r, g, b, 255);
      } else {
        setPixel(x, y, 0, 0, 0, 0);
      }
    }
  }
}

// 畫實心橢圓
function fillEllipse(cx, cy, rx, ry, color) {
  for (let y = cy - ry; y <= cy + ry; y++) {
    for (let x = cx - rx; x <= cx + rx; x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) {
        setPixel(Math.round(x), Math.round(y), ...color);
      }
    }
  }
}

// 畫粗線
function drawLine(x1, y1, x2, y2, thickness, color) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) * 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = x1 + (x2 - x1) * t;
    const cy = y1 + (y2 - y1) * t;
    for (let dy = -thickness; dy <= thickness; dy++) {
      for (let dx = -thickness; dx <= thickness; dx++) {
        if (dx * dx + dy * dy <= thickness * thickness) {
          setPixel(Math.round(cx + dx), Math.round(cy + dy), ...color);
        }
      }
    }
  }
}

// 畫弧線（麥克風支架）
function drawArc(cx, cy, rx, ry, startAngle, endAngle, thickness, color) {
  const steps = 200;
  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + (endAngle - startAngle) * (i / steps);
    const x = cx + rx * Math.cos(angle);
    const y = cy + ry * Math.sin(angle);
    for (let dy = -thickness; dy <= thickness; dy++) {
      for (let dx = -thickness; dx <= thickness; dx++) {
        if (dx * dx + dy * dy <= thickness * thickness) {
          setPixel(Math.round(x + dx), Math.round(y + dy), ...color);
        }
      }
    }
  }
}

// 繪製
drawBackground();

// 麥克風頭部（白色橢圓）
fillEllipse(32, 20, 8, 13, WHITE);

// 麥克風弧形支架（U 型）
drawArc(32, 28, 13, 12, 0, Math.PI, 2.5, WHITE);

// 支架底部直線
drawLine(32, 40, 32, 48, 2.5, WHITE);

// 底座橫線
drawLine(24, 48, 40, 48, 2.5, WHITE);

// 寫入檔案
const outPath = path.join(__dirname, '..', 'assets', 'icon.png');
const buffer = PNG.sync.write(png);
fs.writeFileSync(outPath, buffer);
console.log(`圖示已產生：${outPath} (${SIZE}x${SIZE})`);
