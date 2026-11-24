const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  getDailyResetInfo,
  getModelQuota,
  recordUsage,
  getUsageSummary,
  loadUsageData,
  saveUsageData,
  setUsageFilePath
} = require('../src/utils/usage_tracker');

test('Usage Tracker Unit Tests', async (t) => {
  const tempUsagePath = path.join(__dirname, 'temp_usage_test.json');
  setUsageFilePath(tempUsagePath);

  t.after(() => {
    setUsageFilePath(null);
    if (fs.existsSync(tempUsagePath)) {
      try {
        fs.unlinkSync(tempUsagePath);
      } catch (_) {}
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

  await t.test('should track per-model usage independently and maintain backward compatibility', () => {
    // 模擬已記錄的模型
    saveUsageData({
      lastPtDate: getDailyResetInfo().ptDateKey,
      todayRequests: 10,
      todayTokens: 2000,
      totalRequests: 20,
      totalTokens: 4000,
      minuteTimestamps: [],
      byModel: {
        'gemini-2.5-flash': {
          todayRequests: 8,
          todayTokens: 1600,
          totalRequests: 16,
          totalTokens: 3200,
          minuteTimestamps: []
        },
        'gemini-2.0-flash': {
          todayRequests: 2,
          todayTokens: 400,
          totalRequests: 4,
          totalTokens: 800,
          minuteTimestamps: []
        }
      }
    });

    // 針對 gemini-2.5-flash 記錄一次
    recordUsage({ model: 'gemini-2.5-flash', totalTokens: 200 });
    const flashSummary = getUsageSummary('gemini-2.5-flash');
    assert.strictEqual(flashSummary.todayRequests, 9);
    assert.strictEqual(flashSummary.todayTokens, 1800);
    assert.strictEqual(flashSummary.remainingRequests, 1500 - 9);

    // gemini-2.0-flash 應不受影響
    const flash2Summary = getUsageSummary('gemini-2.0-flash');
    assert.strictEqual(flash2Summary.todayRequests, 2);
    assert.strictEqual(flash2Summary.todayTokens, 400);

    // 尚未呼叫過的 pro 模型，應為 0 次，不影響其 50 次額度
    const proSummary = getUsageSummary('gemini-1.5-pro');
    assert.strictEqual(proSummary.todayRequests, 0);
    assert.strictEqual(proSummary.remainingRequests, 50);

    // 全域總次數應為 11 (原本 10 + 新增 1)
    assert.strictEqual(flashSummary.globalTodayRequests, 11);
  });

  await t.test('should safely migrate legacy data without byModel without resetting counts', () => {
    saveUsageData({
      lastPtDate: getDailyResetInfo().ptDateKey,
      todayRequests: 42,
      todayTokens: 8400,
      totalRequests: 100,
      totalTokens: 20000,
      minuteTimestamps: []
      // 舊版資料無 byModel 欄位
    });

    const summary = getUsageSummary('gemini-3.5-flash-lite');
    // 升級時絕不歸零，舊有 42 次完整承接
    assert.strictEqual(summary.todayRequests, 42);
    assert.strictEqual(summary.todayTokens, 8400);
    assert.strictEqual(summary.globalTodayRequests, 42);
  });
});

