// 產生 NoType 圖示：藍色圓角背景 + 白色麥克風
// 輸出 64x64 PNG（系統匣）+ 256x256 PNG + ICO（安裝檔用）
const { PNG } = require('pngjs');
const { default: pngToIco } = require('png-to-ico');
const fs = require('fs');
const path = require('path');

// 顏色定義
const BG_TOP = [74, 144, 255];    // #4A90FF
const BG_BOT = [48, 112, 224];    // #3070E0
const WHITE = [255, 255, 255];

function generateIcon(size) {
  const png = new PNG({ width: size, height: size });
  const S = size; // 縮寫

  function setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= S || y < 0 || y >= S) return;
    const idx = (S * y + x) << 2;
    png.data[idx] = r;
    png.data[idx + 1] = g;
    png.data[idx + 2] = b;
    png.data[idx + 3] = a;
  }

  function dist(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
  }

  // 圓角矩形背景
  const radius = Math.round(S * 0.22);
  for (let y = 0; y < S; y++) {
    const t = y / S;
    const r = Math.round(BG_TOP[0] * (1 - t) + BG_BOT[0] * t);
    const g = Math.round(BG_TOP[1] * (1 - t) + BG_BOT[1] * t);
    const b = Math.round(BG_TOP[2] * (1 - t) + BG_BOT[2] * t);

    for (let x = 0; x < S; x++) {
      let inside = true;
      if (x < radius && y < radius && dist(x, y, radius, radius) > radius) inside = false;
      if (x >= S - radius && y < radius && dist(x, y, S - radius - 1, radius) > radius) inside = false;
      if (x < radius && y >= S - radius && dist(x, y, radius, S - radius - 1) > radius) inside = false;
      if (x >= S - radius && y >= S - radius && dist(x, y, S - radius - 1, S - radius - 1) > radius) inside = false;

      if (inside) {
        setPixel(x, y, r, g, b, 255);
      } else {
        setPixel(x, y, 0, 0, 0, 0);
      }
    }
  }

  // 麥克風（所有座標按比例縮放）
  const scale = S / 64;

  // 橢圓
  function fillEllipse(cx, cy, rx, ry, color) {
    for (let y = cy - ry; y <= cy + ry; y++) {
      for (let x = cx - rx; x <= cx + rx; x++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) {
          setPixel(Math.round(x), Math.round(y), ...color);
        }
      }
    }
  }

  // 粗線
  function drawLine(x1, y1, x2, y2, thickness, color) {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) * 2;
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
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

  // 弧線
  function drawArc(cx, cy, rx, ry, startAngle, endAngle, thickness, color) {
    const steps = Math.round(200 * scale);
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

  // 麥克風頭部
  fillEllipse(32 * scale, 20 * scale, 8 * scale, 13 * scale, WHITE);
  // U 型支架
  drawArc(32 * scale, 28 * scale, 13 * scale, 12 * scale, 0, Math.PI, 2.5 * scale, WHITE);
  // 底部直線
  drawLine(32 * scale, 40 * scale, 32 * scale, 48 * scale, 2.5 * scale, WHITE);
  // 底座橫線
  drawLine(24 * scale, 48 * scale, 40 * scale, 48 * scale, 2.5 * scale, WHITE);

  return PNG.sync.write(png);
}

async function main() {
  const assetsDir = path.join(__dirname, '..', 'assets');

  // 產生 64x64（系統匣用）
  const png64 = generateIcon(64);
  fs.writeFileSync(path.join(assetsDir, 'icon.png'), png64);
  console.log('✓ icon.png (64x64)');

  // 產生 256x256（安裝檔用）
  const png256 = generateIcon(256);
  const png256Path = path.join(assetsDir, 'icon-256.png');
  fs.writeFileSync(png256Path, png256);
  console.log('✓ icon-256.png (256x256)');

  // 轉為 ICO
  const icoBuffer = await pngToIco(png256Path);
  fs.writeFileSync(path.join(assetsDir, 'icon.ico'), icoBuffer);
  console.log('✓ icon.ico');
}

main().catch(console.error);
