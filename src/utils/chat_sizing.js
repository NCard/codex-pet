/**
 * 對話氣泡尺寸自適應與主視窗邊界計算引擎 (chat_sizing.js)
 * 依據螢幕工作區解析度自動推算最適對話氣泡寬高，並支援手動自訂與底部中心錨定縮放。
 */

const MIN_CHAT_WIDTH = 240;
const MAX_CHAT_WIDTH = 640;
const MIN_CHAT_HEIGHT = 140;
const MAX_CHAT_HEIGHT = 540;

const WINDOW_EXTRA_WIDTH = 40;
const WINDOW_EXTRA_HEIGHT = 360;
const MIN_WINDOW_WIDTH = 320;
const MIN_WINDOW_HEIGHT = 520;

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function roundToStep(val, step = 10) {
  return Math.round(val / step) * step;
}

/**
 * 根據邏輯螢幕解析度 (workAreaSize) 推算建議對話氣泡尺寸
 * @param {number} screenWidth
 * @param {number} screenHeight
 */
function getAdaptiveChatSize(screenWidth = 1920, screenHeight = 1080) {
  const sw = (typeof screenWidth === 'number' && screenWidth > 0) ? screenWidth : 1920;
  const sh = (typeof screenHeight === 'number' && screenHeight > 0) ? screenHeight : 1080;

  let width;
  let height;
  let tier;
  let tierLabel;

  if (sw <= 1440 || sh <= 820) {
    tier = 'compact';
    tierLabel = '精巧螢幕 (HD / 筆電)';
    width = roundToStep(clamp(sw * 0.21, 260, 300));
    height = roundToStep(clamp(sh * 0.24, 180, 220));
  } else if (sw <= 2048) {
    tier = 'fhd';
    tierLabel = '標準螢幕 (FHD 1080p)';
    width = roundToStep(clamp(sw * 0.185, 320, 380));
    height = roundToStep(clamp(sh * 0.24, 230, 280));
  } else if (sw <= 2880) {
    tier = 'qhd';
    tierLabel = '高解析螢幕 (2K / QHD)';
    width = roundToStep(clamp(sw * 0.165, 390, 460));
    height = roundToStep(clamp(sh * 0.23, 290, 360));
  } else {
    tier = 'uhd';
    tierLabel = '超大解析螢幕 (4K / 超寬)';
    width = roundToStep(clamp(sw * 0.135, 470, 560));
    height = roundToStep(clamp(sh * 0.22, 360, 460));
  }

  // 安全防呆：確保包含奇異鳥本體的整體視窗不會超出螢幕工作區
  const maxSafeChatWidth = Math.max(MIN_CHAT_WIDTH, Math.floor(sw * 0.85) - WINDOW_EXTRA_WIDTH);
  const maxSafeChatHeight = Math.max(MIN_CHAT_HEIGHT, Math.floor(sh * 0.92) - WINDOW_EXTRA_HEIGHT);

  width = clamp(width, MIN_CHAT_WIDTH, Math.min(MAX_CHAT_WIDTH, maxSafeChatWidth));
  height = clamp(height, MIN_CHAT_HEIGHT, Math.min(MAX_CHAT_HEIGHT, maxSafeChatHeight));

  return {
    width,
    height,
    tier,
    tierLabel
  };
}

/**
 * 結合使用者設定與螢幕解析度，解析最終對話寬高與透明主視窗尺寸
 */
function resolveChatSize(settings = {}, screenWidth = 1920, screenHeight = 1080) {
  const sw = (typeof screenWidth === 'number' && screenWidth > 0) ? screenWidth : 1920;
  const sh = (typeof screenHeight === 'number' && screenHeight > 0) ? screenHeight : 1080;

  const adaptive = getAdaptiveChatSize(sw, sh);
  const mode = settings?.chatSizeMode === 'manual' ? 'manual' : 'auto';

  const maxSafeChatWidth = Math.max(MIN_CHAT_WIDTH, Math.floor(sw * 0.9) - WINDOW_EXTRA_WIDTH);
  const maxSafeChatHeight = Math.max(MIN_CHAT_HEIGHT, Math.floor(sh * 0.95) - WINDOW_EXTRA_HEIGHT);

  let chatWidth = adaptive.width;
  let chatHeight = adaptive.height;

  if (mode === 'manual') {
    const rawW = Number(settings?.chatWidth);
    const rawH = Number(settings?.chatHeight);
    if (Number.isFinite(rawW) && rawW > 0) {
      chatWidth = clamp(Math.round(rawW), MIN_CHAT_WIDTH, Math.min(MAX_CHAT_WIDTH, maxSafeChatWidth));
    }
    if (Number.isFinite(rawH) && rawH > 0) {
      chatHeight = clamp(Math.round(rawH), MIN_CHAT_HEIGHT, Math.min(MAX_CHAT_HEIGHT, maxSafeChatHeight));
    }
  }

  const windowWidth = Math.min(sw, Math.max(MIN_WINDOW_WIDTH, chatWidth + WINDOW_EXTRA_WIDTH));
  const windowHeight = Math.min(sh, Math.max(MIN_WINDOW_HEIGHT, chatHeight + WINDOW_EXTRA_HEIGHT));

  return {
    mode,
    chatWidth,
    chatHeight,
    windowWidth,
    windowHeight,
    recommended: adaptive
  };
}

/**
 * 以底部中心（奇異鳥站立點）為錨點計算新視窗座標，避免調整對話框大小時奇異鳥亂跳
 */
function computeAnchoredWindowBounds(currentBounds, targetSize, workArea) {
  const curX = Number(currentBounds?.x) || 0;
  const curY = Number(currentBounds?.y) || 0;
  const curW = Number(currentBounds?.width) || MIN_WINDOW_WIDTH;
  const curH = Number(currentBounds?.height) || MIN_WINDOW_HEIGHT;

  const newW = Math.round(targetSize.windowWidth || curW);
  const newH = Math.round(targetSize.windowHeight || curH);

  let newX = Math.round(curX + (curW - newW) / 2);
  let newY = Math.round(curY + (curH - newH));

  if (workArea && typeof workArea.width === 'number' && typeof workArea.height === 'number') {
    const minX = workArea.x || 0;
    const minY = workArea.y || 0;
    const maxX = minX + workArea.width - newW;
    const maxY = minY + workArea.height - newH;

    if (maxX >= minX) newX = clamp(newX, minX, maxX);
    if (maxY >= minY) newY = clamp(newY, minY, maxY);
  }

  return { x: newX, y: newY, width: newW, height: newH };
}

module.exports = {
  MIN_CHAT_WIDTH,
  MAX_CHAT_WIDTH,
  MIN_CHAT_HEIGHT,
  MAX_CHAT_HEIGHT,
  WINDOW_EXTRA_WIDTH,
  WINDOW_EXTRA_HEIGHT,
  getAdaptiveChatSize,
  resolveChatSize,
  computeAnchoredWindowBounds
};
