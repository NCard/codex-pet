const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const modelCache = require('../src/utils/model_cache');

test('Model Cache & Connection Test Store Unit Tests', async (t) => {
  const tempCachePath = path.join(__dirname, 'temp_model_cache_test.json');
  modelCache.setModelCacheFilePath(tempCachePath);

  t.after(() => {
    modelCache.setModelCacheFilePath(null);
    if (fs.existsSync(tempCachePath)) {
      try {
        fs.unlinkSync(tempCachePath);
      } catch (_) {}
    }
  });

  await t.test('should persist connection test records independently across providers', () => {
    modelCache.clearAllCache();
    modelCache.saveTestResult('gemini', 'gemini-3.5-flash-lite', {
      success: true,
      supportsTools: true,
      latencyMs: 780,
      testedAt: 1000
    });
    modelCache.saveTestResult('groq', 'llama-3.3-70b-versatile', {
      success: true,
      supportsTools: true,
      latencyMs: 320,
      testedAt: 2000
    });
    modelCache.saveTestResult('gemini', 'gemini-3.8-flash', {
      success: false,
      supportsTools: true,
      latencyMs: 10000,
      error: '連線逾時',
      testedAt: 3000
    });

    const geminiRec = modelCache.getTestResult('gemini', 'gemini-3.5-flash-lite');
    assert.strictEqual(geminiRec.success, true);
    assert.strictEqual(geminiRec.latencyMs, 780);

    const groqRec = modelCache.getTestResult('groq', 'llama-3.3-70b-versatile');
    assert.strictEqual(groqRec.success, true);
    assert.strictEqual(groqRec.latencyMs, 320);

    // getAllTestResults should be sorted newest first
    const all = modelCache.getAllTestResults();
    assert.strictEqual(all.length, 3);
    assert.strictEqual(all[0].modelId, 'gemini-3.8-flash');
    assert.strictEqual(all[1].modelId, 'llama-3.3-70b-versatile');
    assert.strictEqual(all[2].modelId, 'gemini-3.5-flash-lite');
  });

  await t.test('should persist and clear cached model lists per provider without affecting test records', () => {
    modelCache.setCachedModels('groq', [
      { id: 'llama-3.3-70b-versatile', displayName: 'Llama 3.3 70B' },
      { id: 'llama-3.1-8b-instant', displayName: 'Llama 3.1 8B' }
    ]);

    const cached = modelCache.getCachedModels('groq');
    assert.strictEqual(cached.length, 2);

    const stats = modelCache.getCacheStats();
    assert.strictEqual(stats.totalCachedModels, 2);
    assert.strictEqual(stats.testCount, 3);
    assert.ok(stats.sizeBytes > 0);

    // Clear only models cache — test records must remain intact
    modelCache.clearModelsCache();
    assert.strictEqual(modelCache.getCachedModels('groq').length, 0);
    assert.strictEqual(modelCache.getAllTestResults().length, 3);

    // Clear only test results
    modelCache.clearTestResults();
    assert.strictEqual(modelCache.getAllTestResults().length, 0);
  });

  await t.test('should migrate legacy pet_state modelTestResults cleanly without overwriting newer records', () => {
    modelCache.clearAllCache();
    modelCache.saveTestResult('gemini', 'gemini-3.5-flash-lite', {
      success: true,
      supportsTools: true,
      latencyMs: 500,
      testedAt: 5000
    });

    const migrated = modelCache.migrateLegacyTestResults({
      'gemini-3.5-flash-lite': { success: false, latencyMs: 9999, error: 'old', testedAt: 1000 },
      'gemini-3.1-flash-lite': { success: true, supportsTools: true, latencyMs: 1452, testedAt: 2000 }
    });

    assert.strictEqual(migrated, true);
    // Newer record should be preserved
    assert.strictEqual(modelCache.getTestResult('gemini', 'gemini-3.5-flash-lite').latencyMs, 500);
    // Older legacy entry not yet present should be migrated
    assert.strictEqual(modelCache.getTestResult('gemini', 'gemini-3.1-flash-lite').latencyMs, 1452);
  });
});
