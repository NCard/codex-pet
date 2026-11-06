const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const {
  getDailyResetInfo,
  getModelQuota,
  recordUsage,
  getUsageSummary,
  loadUsageData,
  saveUsageData
} = require('../src/utils/usage_tracker');
const { usagePath } = require('../src/utils/paths');

test('Usage Tracker Unit Tests', async (t) => {
  // 備份現存 usage 檔案
  let originalData = null;
  if (fs.existsSync(usagePath)) {
    originalData = fs.readFileSync(usagePath, 'utf8');
  }

  t.after(() => {
    // 復原原本的檔案
    if (originalData) {
      fs.writeFileSync(usagePath, originalData, 'utf8');
    } else if (fs.existsSync(usagePath)) {
      fs.unlinkSync(usagePath);
    }
  });

  await t.test('should calculate valid daily reset info with positive remaining time', () => {
    const info = getDailyResetInfo();
    assert.ok(info.resetTimeStr.includes(':'));
    assert.ok(info.remainingHours >= 0 && info.remainingHours <= 24);
    assert.ok(info.remainingMinutes >= 0 && info.remainingMinutes < 60);
    assert.ok(info.remainingMs > 0 && info.remainingMs <= 86400000);
    assert.ok(info.ptDateKey.match(/^\d{4}-\d{2}-\d{2}$/));
  });

  await t.test('should return correct model quotas', () => {
    const flashQuota = getModelQuota('gemini-2.5-flash');
    assert.strictEqual(flashQuota.limitRPD, 1500);
    assert.strictEqual(flashQuota.limitRPM, 15);

    const proQuota = getModelQuota('gemini-1.5-pro');
    assert.strictEqual(proQuota.limitRPD, 50);
    assert.strictEqual(proQuota.limitRPM, 2);
  });

  await t.test('should record and accumulate usage correctly', () => {
    // 初始化空資料
    saveUsageData({
      lastPtDate: getDailyResetInfo().ptDateKey,
      todayRequests: 5,
      todayTokens: 1000,
      totalRequests: 10,
      totalTokens: 2000,
      minuteTimestamps: []
    });

    recordUsage({ promptTokens: 100, candidateTokens: 50, totalTokens: 150 });
    const summary = getUsageSummary('gemini-2.5-flash');

    assert.strictEqual(summary.todayRequests, 6);
    assert.strictEqual(summary.todayTokens, 1150);
    assert.strictEqual(summary.remainingRequests, 1500 - 6);
    assert.strictEqual(summary.minuteRequests, 1);
  });
});

