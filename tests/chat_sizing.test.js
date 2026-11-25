const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  MIN_CHAT_WIDTH,
  MAX_CHAT_WIDTH,
  MIN_CHAT_HEIGHT,
  MAX_CHAT_HEIGHT,
  getAdaptiveChatSize,
  resolveChatSize,
  computeAnchoredWindowBounds
} = require('../src/utils/chat_sizing');

describe('Chat Bubble Resolution-Adaptive Sizing Unit Tests', () => {
  test('should compute scaled defaults across compact, FHD, QHD, and 4K resolutions', () => {
    const compact = getAdaptiveChatSize(1366, 768);
    assert.strictEqual(compact.tier, 'compact');
    assert.ok(compact.width >= 260 && compact.width <= 300);
    assert.ok(compact.height >= 180 && compact.height <= 220);

    const fhd = getAdaptiveChatSize(1920, 1040);
    assert.strictEqual(fhd.tier, 'fhd');
    assert.ok(fhd.width > compact.width);
    assert.ok(fhd.height > compact.height);

    const qhd = getAdaptiveChatSize(2560, 1400);
    assert.strictEqual(qhd.tier, 'qhd');
    assert.ok(qhd.width > fhd.width);
    assert.ok(qhd.height > fhd.height);

    const uhd = getAdaptiveChatSize(3840, 2120);
    assert.strictEqual(uhd.tier, 'uhd');
    assert.ok(uhd.width > qhd.width);
    assert.ok(uhd.height > qhd.height);
  });

  test('resolveChatSize should honor auto mode vs manual mode with safe clamping', () => {
    const autoRes = resolveChatSize({ chatSizeMode: 'auto', chatWidth: 600, chatHeight: 500 }, 1920, 1040);
    assert.strictEqual(autoRes.mode, 'auto');
    assert.strictEqual(autoRes.chatWidth, autoRes.recommended.width);
    assert.strictEqual(autoRes.chatHeight, autoRes.recommended.height);

    const manualRes = resolveChatSize({ chatSizeMode: 'manual', chatWidth: 460, chatHeight: 330 }, 1920, 1040);
    assert.strictEqual(manualRes.mode, 'manual');
    assert.strictEqual(manualRes.chatWidth, 460);
    assert.strictEqual(manualRes.chatHeight, 330);
    assert.strictEqual(manualRes.windowWidth, 500);
    assert.strictEqual(manualRes.windowHeight, 750);
    // Ensure enough vertical headroom for ESC hint + bubble header + input + kiwi
    assert.ok(manualRes.windowHeight - manualRes.chatHeight >= 410);

    // Extreme manual values should be safely clamped
    const extremeLow = resolveChatSize({ chatSizeMode: 'manual', chatWidth: 50, chatHeight: 20 }, 1920, 1040);
    assert.strictEqual(extremeLow.chatWidth, MIN_CHAT_WIDTH);
    assert.strictEqual(extremeLow.chatHeight, MIN_CHAT_HEIGHT);

    const extremeHigh = resolveChatSize({ chatSizeMode: 'manual', chatWidth: 9999, chatHeight: 9999 }, 3840, 2160);
    assert.strictEqual(extremeHigh.chatWidth, MAX_CHAT_WIDTH);
    assert.strictEqual(extremeHigh.chatHeight, MAX_CHAT_HEIGHT);
  });

  test('computeAnchoredWindowBounds should keep bottom-center anchored and stay inside workArea', () => {
    const cur = { x: 500, y: 400, width: 320, height: 580 };
    const workArea = { x: 0, y: 0, width: 1920, height: 1040 };
    const next = computeAnchoredWindowBounds(cur, { windowWidth: 440, windowHeight: 680 }, workArea);

    // Center X stays 500 + 160 = 660 -> next.x = 660 - 220 = 440
    assert.strictEqual(next.x, 440);
    // Bottom Y stays 400 + 580 = 980 -> next.y = 980 - 680 = 300
    assert.strictEqual(next.y, 300);
    assert.strictEqual(next.width, 440);
    assert.strictEqual(next.height, 680);

    // Clamping near top-left edge
    const edgeCur = { x: 10, y: 20, width: 320, height: 580 };
    const edgeNext = computeAnchoredWindowBounds(edgeCur, { windowWidth: 480, windowHeight: 720 }, workArea);
    assert.ok(edgeNext.x >= 0);
    assert.ok(edgeNext.y >= 0);
  });
});
