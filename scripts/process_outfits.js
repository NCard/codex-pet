#!/usr/bin/env node
'use strict';

/**
 * 日系繪本飾品去背、透明鏡片處理與實機貼合校準腳本 (scripts/process_outfits.js)
 * - 邊界 Flood-Fill 去除純白背景 + 抗鋸齒柔邊
 * - 支援圓框眼鏡自動水平翻轉與半透明鏡片（露出奇異鳥眼睛！）
 * - 輸出緊湊裁切 256px 寬度等比透明 PNG 至 assets/images/outfits/
 * - 同步產出 4x2 貼合預覽圖（將 8 件飾品依 outfits_catalog.js 預設參數疊合在 kiwi.png 上）
 */

const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const catalog = require('../src/utils/outfits_catalog');

const ARTIFACT_DIR = 'C:/Users/2007016/.gemini/antigravity/brain/04cfc7db-0579-4c92-b9c2-248d709c2df8';
const OUT_DIR = path.resolve(__dirname, '../assets/images/outfits');
const KIWI_SPRITE = path.resolve(__dirname, '../assets/images/kiwi.png');
const PREVIEW_OUT = `${ARTIFACT_DIR}/scratch/outfits_calibration_preview.png`;

const SOURCES = [
  { id: '🎩', file: 'top_hat.png', src: `${ARTIFACT_DIR}/gentleman_top_hat_v2_1795749846120.jpg` },
  { id: '👑', file: 'crown.png', src: `${ARTIFACT_DIR}/mini_golden_crown_v2_1795749836672.jpg` },
  { id: '🌸', file: 'sakura.png', src: `${ARTIFACT_DIR}/sakura_hair_flower_1795749825758.jpg` },
  { id: '🧢', file: 'cap.png', src: `${ARTIFACT_DIR}/casual_baseball_cap_1795749830111.jpg` },
  { id: '🎧', file: 'headphones.png', src: `${ARTIFACT_DIR}/retro_headphones_v3_1795749870679.jpg` },
  { id: '🕶️', file: 'sunglasses.png', src: `${ARTIFACT_DIR}/kiwi_sunglasses_1795749842782.jpg` },
  { id: '👓', file: 'glasses.png', src: `${ARTIFACT_DIR}/literary_round_glasses_1795749841787.jpg`, flipX: true, translucentLenses: true },
  { id: '🎀', file: 'ribbon.png', src: `${ARTIFACT_DIR}/warm_storybook_bow_1795749846687.jpg` }
];

function colorDistSq(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return dr * dr + dg * dg + db * db;
}

function removeWhiteBgEdgeFlood(image, { hardDist = 30, softDist = 66 } = {}) {
  const { width, height, data } = image.bitmap;
  const visited = new Uint8Array(width * height);
  const bgMask = new Uint8Array(width * height);
  const hardSq = hardDist * hardDist;
  const softSq = softDist * softDist;

  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const trySeed = (x, y) => {
    const idx = y * width + x;
    if (visited[idx]) return;
    const p = idx * 4;
    if (colorDistSq(data[p], data[p + 1], data[p + 2], 255, 255, 255) <= hardSq) {
      visited[idx] = 1;
      bgMask[idx] = 1;
      queue[tail++] = idx;
    }
  };

  for (let x = 0; x < width; x++) {
    trySeed(x, 0);
    trySeed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    trySeed(0, y);
    trySeed(width - 1, y);
  }

  while (head < tail) {
    const idx = queue[head++];
    const x = idx % width;
    const y = (idx - x) / width;

    const neighbors = [
      [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]
    ];
    for (let n = 0; n < 4; n++) {
      const nx = neighbors[n][0];
      const ny = neighbors[n][1];
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nIdx = ny * width + nx;
      if (visited[nIdx]) continue;
      const p = nIdx * 4;
      if (colorDistSq(data[p], data[p + 1], data[p + 2], 255, 255, 255) <= hardSq) {
        visited[nIdx] = 1;
        bgMask[nIdx] = 1;
        queue[tail++] = nIdx;
      }
    }
  }

  // 清除背景像素 + 1-2px 抗鋸齒柔邊
  for (let idx = 0; idx < width * height; idx++) {
    const p = idx * 4;
    if (bgMask[idx]) {
      data[p + 3] = 0;
      continue;
    }
    const x = idx % width;
    const y = (idx - x) / width;
    let touchesBg = false;
    for (let dy = -1; dy <= 1 && !touchesBg; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && bgMask[ny * width + nx]) {
          touchesBg = true;
          break;
        }
      }
    }
    if (touchesBg) {
      const dSq = colorDistSq(data[p], data[p + 1], data[p + 2], 255, 255, 255);
      if (dSq < softSq) {
        const ratio = Math.max(0, (Math.sqrt(dSq) - hardDist) / (softDist - hardDist));
        data[p + 3] = Math.round(data[p + 3] * ratio);
      }
    }
  }
}

/**
 * 針對耳機頭帶中空區域與圓框眼鏡內部白色區域處理
 */
function cleanEnclosedWhiteOrLenses(image, { mode = 'erase' } = {}) {
  const { width, height, data } = image.bitmap;
  for (let i = 0; i < width * height * 4; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = (0.299 * r + 0.587 * g + 0.114 * b);
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;

    if (mode === 'translucentLenses') {
      // 淡青白／純白鏡片內部改為 24% 輕透玻璃感，保留深棕與金色鏡框不透明
      if (lum > 218 && sat < 0.22) {
        data[i + 3] = Math.round(data[i + 3] * 0.22);
      }
    } else if (mode === 'eraseInnerWhite') {
      // 清除完全純白低飽和封閉中空背景（如耳機頭帶中間空白）
      if (lum > 242 && sat < 0.08) {
        data[i + 3] = 0;
      }
    }
  }
}

function cropToOpaqueBounds(image, pad = 6) {
  const { width, height, data } = image.bitmap;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      if (a > 18) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return image;
  const cx = Math.max(0, minX - pad);
  const cy = Math.max(0, minY - pad);
  const cw = Math.min(width - cx, (maxX - minX + 1) + pad * 2);
  const ch = Math.min(height - cy, (maxY - minY + 1) + pad * 2);
  return image.clone().crop(cx, cy, cw, ch);
}

async function processAll() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const processedMap = {};

  for (const item of SOURCES) {
    if (!fs.existsSync(item.src)) {
      console.warn('Missing source:', item.src);
      continue;
    }
    let img = await Jimp.read(item.src);
    if (item.flipX) {
      img.flip(true, false);
    }
    removeWhiteBgEdgeFlood(img, { hardDist: 30, softDist: 64 });
    if (item.translucentLenses) {
      cleanEnclosedWhiteOrLenses(img, { mode: 'translucentLenses' });
    }
    if (item.file === 'headphones.png') {
      cleanEnclosedWhiteOrLenses(img, { mode: 'eraseInnerWhite' });
    }

    img = cropToOpaqueBounds(img, 8);
    // 統一縮放最大邊為 256px（清晰輕量且保留原長寬比）
    if (img.bitmap.width >= img.bitmap.height) {
      img.resize(256, Jimp.AUTO, Jimp.RESIZE_BICUBIC);
    } else {
      img.resize(Jimp.AUTO, 256, Jimp.RESIZE_BICUBIC);
    }

    const outPath = path.join(OUT_DIR, item.file);
    await img.writeAsync(outPath);
    processedMap[item.id] = img;
    console.log(`Processed ${item.file}: ${img.bitmap.width}x${img.bitmap.height}`);
  }

  // 產出 4x2 貼合檢視板（每格 360x360，將飾品依 outfits_catalog 預設比例疊合在 kiwi.png 上）
  const kiwiBase = (await Jimp.read(KIWI_SPRITE)).resize(320, 320, Jimp.RESIZE_BICUBIC);
  const CELL = 360;
  const PAD = 20;
  const grid = new Jimp(CELL * 4, CELL * 2, 0xf3f7eeff);

  SOURCES.forEach((item, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const ox = col * CELL + PAD;
    const oy = row * CELL + PAD;

    grid.composite(kiwiBase, ox, oy);

    const outfitImg = processedMap[item.id];
    if (!outfitImg) return;
    const cfg = catalog.getDefaultOutfitConfig(item.id);
    const targetW = Math.max(12, Math.round(320 * (cfg.scale / 100)));
    const scaled = outfitImg.clone().resize(targetW, Jimp.AUTO, Jimp.RESIZE_BICUBIC);
    if (cfg.rotate) {
      // Jimp.rotate 正值為逆時針，CSS rotate() 正值為順時針，因此取負值對齊 CSS 表現
      scaled.rotate(-cfg.rotate, true);
    }
    const centerX = ox + Math.round(320 * (cfg.x / 100));
    const centerY = oy + Math.round(320 * (cfg.y / 100));
    const drawX = Math.round(centerX - scaled.bitmap.width / 2);
    const drawY = Math.round(centerY - scaled.bitmap.height / 2);
    grid.composite(scaled, drawX, drawY);
  });

  await grid.writeAsync(PREVIEW_OUT);
  console.log('Saved calibration preview:', PREVIEW_OUT);
}

processAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
