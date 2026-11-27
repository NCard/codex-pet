#!/usr/bin/env node
'use strict';

/**
 * 主題背景紋理去背與錯落無縫高解析圖磚處理腳本 (scripts/process_theme_bg.js)
 * 將純白底色之單色細線插畫轉換為抗鋸齒透明 PNG（640x1280 半錯落無縫磚），
 * 讓奇異鳥與植物小花在重複平鋪時呈現自然對角錯落節奏，不顯僵硬網格感。
 */

const path = require('path');
const Jimp = require('jimp');

const SRC = process.argv[2] || 'C:/Users/2007016/.gemini/antigravity/brain/04cfc7db-0579-4c92-b9c2-248d709c2df8/kiwi_wallpaper_tile_1795748531622.jpg';
const OUT_TILE = path.resolve(__dirname, '../src/assets/images/themes/kiwi/bg_pattern.png');
const OUT_PREVIEW = process.argv[3] || '';

async function main() {
  const baseTile = await Jimp.read(SRC);
  const TILE_SIZE = 640;
  baseTile.resize(TILE_SIZE, TILE_SIZE, Jimp.RESIZE_BICUBIC);

  const { width, height, data } = baseTile.bitmap;
  const INK_R = 46;  // #2e7d32
  const INK_G = 125;
  const INK_B = 50;
  const MAX_ALPHA = 0.165;

  for (let i = 0; i < width * height * 4; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    if (lum >= 0.93) {
      data[i] = INK_R;
      data[i + 1] = INK_G;
      data[i + 2] = INK_B;
      data[i + 3] = 0;
    } else {
      const strength = Math.min(1, Math.max(0, (0.93 - lum) / 0.48));
      data[i] = INK_R;
      data[i + 1] = INK_G;
      data[i + 2] = INK_B;
      data[i + 3] = Math.round(strength * 255 * MAX_ALPHA);
    }
  }

  // 建立 640x1280 棋盤對角錯落無縫壁紙磚：
  // 上半部：左上奇異果切片、右下向右奇異鳥；
  // 下半部：水平鏡像（左下向左奇異鳥、右上奇異果切片），完美對角交錯且四邊留白零裁切！
  const staggered = new Jimp(TILE_SIZE, TILE_SIZE * 2, 0x00000000);
  staggered.composite(baseTile, 0, 0);

  const flipped = baseTile.clone().flip(true, false);
  staggered.composite(flipped, 0, TILE_SIZE);

  await staggered.writeAsync(OUT_TILE);
  console.log('Saved staggered theme tile:', OUT_TILE);

  if (OUT_PREVIEW) {
    const previewTile = staggered.clone().resize(320, 640, Jimp.RESIZE_BICUBIC);
    const preview = new Jimp(960, 640, 0xf7faf3ff);
    for (let col = 0; col < 3; col++) {
      preview.composite(previewTile, col * 320, 0);
    }
    await preview.writeAsync(OUT_PREVIEW);
    console.log('Saved tiled preview:', OUT_PREVIEW);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
