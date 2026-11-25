#!/usr/bin/env node
'use strict';

/**
 * 精靈圖自動化去背與統一基準線對齊工具 (scripts/process_sprites.js)
 * - 使用邊界泛洪演算法 (Edge Flood-Fill) 去除純白背景，絕不誤傷角色內部白色高光或淺色被子
 * - 邊緣柔化抗鋸齒（去除白邊毛刺）
 * - 針對同網格生成之動作幀採用「共用裁切座標」，保證眨眼／說話／走路／思考／疲累 0px 位移抖動！
 * - 針對一體化睡姿圖對齊相同的腳底基準線，確保接地陰影完美貼合。
 */

const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

const CANVAS_SIZE = 512;
const DEFAULT_BASELINE_Y = 472;

function colorDistanceSq(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return dr * dr + dg * dg + db * db;
}

/**
 * 邊界 Flood-Fill 去背 + 抗鋸齒柔邊
 */
function removeWhiteBackground(image, { hardThreshold = 28, softThreshold = 62 } = {}) {
  const { width, height, data } = image.bitmap;
  const total = width * height;
  const visited = new Uint8Array(total);
  const isBg = new Uint8Array(total);

  const corners = [
    0,
    width - 1,
    (height - 1) * width,
    (height - 1) * width + (width - 1)
  ];
  let bgR = 0;
  let bgG = 0;
  let bgB = 0;
  corners.forEach((idx) => {
    const o = idx * 4;
    bgR += data[o];
    bgG += data[o + 1];
    bgB += data[o + 2];
  });
  bgR = Math.round(bgR / 4);
  bgG = Math.round(bgG / 4);
  bgB = Math.round(bgB / 4);

  const hardSq = hardThreshold * hardThreshold;
  const softSq = softThreshold * softThreshold;

  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const tryEnqueue = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const o = idx * 4;
    const a = data[o + 3];
    if (a < 10) {
      visited[idx] = 1;
      isBg[idx] = 1;
      queue[tail++] = idx;
      return;
    }
    const distSq = colorDistanceSq(data[o], data[o + 1], data[o + 2], bgR, bgG, bgB);
    if (distSq <= hardSq) {
      visited[idx] = 1;
      isBg[idx] = 1;
      queue[tail++] = idx;
    }
  };

  for (let x = 0; x < width; x++) {
    tryEnqueue(x, 0);
    tryEnqueue(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    tryEnqueue(0, y);
    tryEnqueue(width - 1, y);
  }

  while (head < tail) {
    const idx = queue[head++];
    const x = idx % width;
    const y = (idx - x) / width;
    tryEnqueue(x + 1, y);
    tryEnqueue(x - 1, y);
    tryEnqueue(x, y + 1);
    tryEnqueue(x, y - 1);
  }

  for (let i = 0; i < total; i++) {
    if (isBg[i]) {
      data[i * 4 + 3] = 0;
    }
  }

  // 兩輪柔化緊貼透明背景的抗鋸齒白邊
  for (let pass = 0; pass < 2; pass++) {
    const toFade = [];
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const o = idx * 4;
        if (data[o + 3] === 0) continue;

        const touchesTransparent =
          data[(idx - 1) * 4 + 3] === 0 ||
          data[(idx + 1) * 4 + 3] === 0 ||
          data[(idx - width) * 4 + 3] === 0 ||
          data[(idx + width) * 4 + 3] === 0;

        if (!touchesTransparent) continue;
        const distSq = colorDistanceSq(data[o], data[o + 1], data[o + 2], bgR, bgG, bgB);
        if (distSq <= softSq) {
          const factor = Math.max(0, Math.min(1, (Math.sqrt(distSq) - hardThreshold * 0.55) / (softThreshold - hardThreshold * 0.55)));
          toFade.push({ o, alpha: Math.round(data[o + 3] * factor) });
        }
      }
    }
    for (const item of toFade) {
      data[item.o + 3] = item.alpha;
    }
  }
}

function findOpaqueBounds(image, alphaThreshold = 20) {
  const { width, height, data } = image.bitmap;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      if (a >= alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1 };
  }
  return { minX, minY, maxX, maxY };
}

/**
 * 處理單張精靈圖：
 * - 若傳入 sharedTransform（鎖定同一網格的等比縮放與偏移），保證同系列幀 0px 抖動
 * - 否則自動依自身緊密包圍盒置中對齊底部基準線
 */
async function processSprite(inputPath, outputPath, options = {}) {
  const img = await Jimp.read(inputPath);
  removeWhiteBackground(img, options);

  const canvas = new Jimp(CANVAS_SIZE, CANVAS_SIZE, 0x00000000);
  let contentW = 0;
  let contentH = 0;

  if (options.sharedTransform) {
    const { scale, offsetX, offsetY } = options.sharedTransform;
    const scaledW = Math.round(img.bitmap.width * scale);
    const scaledH = Math.round(img.bitmap.height * scale);
    img.resize(scaledW, scaledH, Jimp.RESIZE_BICUBIC);
    canvas.composite(img, Math.round(offsetX), Math.round(offsetY));
    contentW = scaledW;
    contentH = scaledH;
  } else {
    const targetHeight = options.targetHeight || 420;
    const maxTargetWidth = options.maxTargetWidth || 468;
    const baselineY = options.baselineY || DEFAULT_BASELINE_Y;
    const shiftX = options.shiftX || 0;

    const bounds = findOpaqueBounds(img);
    const cropW = bounds.maxX - bounds.minX + 1;
    const cropH = bounds.maxY - bounds.minY + 1;
    img.crop(bounds.minX, bounds.minY, cropW, cropH);

    const scale = Math.min(targetHeight / cropH, maxTargetWidth / cropW);
    contentW = Math.max(1, Math.round(cropW * scale));
    contentH = Math.max(1, Math.round(cropH * scale));
    img.resize(contentW, contentH, Jimp.RESIZE_BICUBIC);

    const pasteX = Math.round((CANVAS_SIZE - contentW) / 2 + shiftX);
    const pasteY = Math.round(baselineY - contentH);
    canvas.composite(img, pasteX, Math.max(6, pasteY));
  }

  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  canvas.deflateLevel(9);
  await canvas.writeAsync(outputPath);
  const stat = fs.statSync(outputPath);
  return {
    name: path.basename(outputPath),
    sizeKB: Number((stat.size / 1024).toFixed(1)),
    contentW,
    contentH
  };
}

/**
 * 合成同畫風懸空拍翅驚呼幀 (kiwi_dangling.png)：
 * 取 kiwi_happy_v3（雙翅舉起＋雙腳懸空下垂）的身體，無縫融合 kiwi_talk（大眼＋張嘴驚呼）的臉部。
 */
async function buildDanglingComposite(happyBodyPath, talkFacePath, outputPath, sharedTransform) {
  const body = await Jimp.read(happyBodyPath);
  const face = await Jimp.read(talkFacePath);
  removeWhiteBackground(body);
  removeWhiteBackground(face);

  const w = body.bitmap.width;
  const h = body.bitmap.height;
  // 臉部橢圓融合遮罩（中心約在臉部眼嘴區域，柔邊過渡）
  const cx = w * 0.62;
  const cy = h * 0.36;
  const rx = w * 0.21;
  const ry = h * 0.17;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= 1.0) continue;

      const idx = (y * w + x) * 4;
      const fA = face.bitmap.data[idx + 3];
      if (fA < 10) continue;

      // 內圈 0.72 內完全採用張嘴大眼臉，外圈 0.72~1.0 平滑羽化混合
      const blend = dist <= 0.72 ? 1 : (1 - dist) / 0.28;
      body.bitmap.data[idx] = Math.round(body.bitmap.data[idx] * (1 - blend) + face.bitmap.data[idx] * blend);
      body.bitmap.data[idx + 1] = Math.round(body.bitmap.data[idx + 1] * (1 - blend) + face.bitmap.data[idx + 1] * blend);
      body.bitmap.data[idx + 2] = Math.round(body.bitmap.data[idx + 2] * (1 - blend) + face.bitmap.data[idx + 2] * blend);
      body.bitmap.data[idx + 3] = Math.max(body.bitmap.data[idx + 3], Math.round(fA * blend));
    }
  }

  const canvas = new Jimp(CANVAS_SIZE, CANVAS_SIZE, 0x00000000);
  const { scale, offsetX, offsetY } = sharedTransform;
  body.resize(Math.round(w * scale), Math.round(h * scale), Jimp.RESIZE_BICUBIC);
  canvas.composite(body, Math.round(offsetX), Math.round(offsetY));
  canvas.deflateLevel(9);
  await canvas.writeAsync(outputPath);
  const stat = fs.statSync(outputPath);
  return { name: path.basename(outputPath), sizeKB: Number((stat.size / 1024).toFixed(1)) };
}

/**
 * 依主立繪計算共用鎖定對齊變換參數
 */
async function computeSharedTransform(referencePath, targetHeight = 420, baselineY = DEFAULT_BASELINE_Y) {
  const refImg = await Jimp.read(referencePath);
  removeWhiteBackground(refImg);
  const bounds = findOpaqueBounds(refImg);
  const cropW = bounds.maxX - bounds.minX + 1;
  const cropH = bounds.maxY - bounds.minY + 1;
  const scale = targetHeight / cropH;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const offsetX = CANVAS_SIZE / 2 - centerX * scale;
  const offsetY = baselineY - (bounds.maxY + 1) * scale;
  return { scale, offsetX, offsetY, cropW, cropH };
}

async function runBatchFromArtifacts(artifactDir, outputDir) {
  const idleRaw = path.join(artifactDir, 'kiwi_idle_1795575300802.jpg');
  const shared = await computeSharedTransform(idleRaw, 420, DEFAULT_BASELINE_Y);
  console.log('Shared grid transform:', shared);

  const lockedJobs = [
    ['kiwi_idle_1795575300802.jpg', 'kiwi.png'],
    ['kiwi_blink_1795575381589.jpg', 'kiwi_blink.png'],
    ['kiwi_talk_1795575385546.jpg', 'kiwi_talk.png'],
    ['kiwi_walk1_v2_1795575402108.jpg', 'kiwi_walk1.png'],
    ['kiwi_walk2_v3_1795575428379.jpg', 'kiwi_walk2.png'],
    ['kiwi_happy_v3_1795575423251.jpg', 'kiwi_happy.png'],
    ['kiwi_happy_v2_1795575403816.jpg', 'kiwi_jump.png'],
    ['kiwi_thinking_1795575419404.jpg', 'kiwi_thinking.png'],
    ['kiwi_tired_1795575430038.jpg', 'kiwi_tired.png'],
    ['kiwi_eating1_1795575449746.jpg', 'kiwi_eating.png'],
    ['kiwi_eating1_1795575432479.jpg', 'kiwi_eating2.png']
  ];

  const results = [];
  for (const [srcName, dstName] of lockedJobs) {
    const res = await processSprite(
      path.join(artifactDir, srcName),
      path.join(outputDir, dstName),
      { sharedTransform: shared }
    );
    results.push(res);
  }

  // 合成懸空拍翅驚呼圖
  const danglingRes = await buildDanglingComposite(
    path.join(artifactDir, 'kiwi_happy_v3_1795575423251.jpg'),
    path.join(artifactDir, 'kiwi_talk_1795575385546.jpg'),
    path.join(outputDir, 'kiwi_dangling.png'),
    shared
  );
  results.push(danglingRes);

  // 一體化睡姿圖：依底部基準線自然置中，寬度稍大讓毛絨窩完整舒適
  const sleepRes = await processSprite(
    path.join(artifactDir, 'kiwi_sleep_1795575389649.jpg'),
    path.join(outputDir, 'kiwi_sleep.png'),
    { targetHeight: 430, maxTargetWidth: 484, baselineY: DEFAULT_BASELINE_Y + 6 }
  );
  results.push(sleepRes);

  console.table(results);
}

if (require.main === module) {
  const [cmd, arg1, arg2] = process.argv.slice(2);
  if (cmd === '--batch' && arg1 && arg2) {
    runBatchFromArtifacts(arg1, arg2).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  } else {
    console.log('Usage: node scripts/process_sprites.js --batch <artifactDir> <outputDir>');
  }
}

module.exports = {
  removeWhiteBackground,
  findOpaqueBounds,
  processSprite,
  computeSharedTransform,
  buildDanglingComposite
};
