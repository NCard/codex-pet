/**
 * AI 模型快取與連線測試紀錄儲存引擎 (Model Cache & Connection Test Store)
 * 獨立儲存於 ai_model_cache.json，與 pet_state.json 完全隔離，
 * 避免設定預覽、放棄修改或主視窗狀態保存覆蓋掉模型測試紀錄與清單快取。
 */

const fs = require('fs');
const paths = require('./paths');

let customCachePath = null;

function setModelCacheFilePath(newPath) {
  customCachePath = newPath;
}

function getModelCacheFilePath() {
  return customCachePath || paths.modelCachePath;
}

function createEmptyCache() {
  return {
    version: 1,
    modelsByProvider: {},
    testResults: {},
    updatedAt: 0
  };
}

function loadModelCache() {
  const targetPath = getModelCacheFilePath();
  const empty = createEmptyCache();
  try {
    if (fs.existsSync(targetPath)) {
      const raw = fs.readFileSync(targetPath, 'utf8');
      if (raw && raw.trim()) {
        const parsed = JSON.parse(raw);
        return {
          ...empty,
          ...parsed,
          modelsByProvider: (parsed.modelsByProvider && typeof parsed.modelsByProvider === 'object') ? parsed.modelsByProvider : {},
          testResults: (parsed.testResults && typeof parsed.testResults === 'object') ? parsed.testResults : {}
        };
      }
    }
  } catch (e) {
    console.error('Failed to load model cache:', e);
  }
  return empty;
}

function saveModelCache(data) {
  const targetPath = getModelCacheFilePath();
  try {
    const payload = {
      version: 1,
      modelsByProvider: data.modelsByProvider || {},
      testResults: data.testResults || {},
      updatedAt: Date.now()
    };
    fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Failed to save model cache:', e);
    return false;
  }
}

function makeTestKey(providerId, modelId) {
  const pid = (providerId || 'gemini').toLowerCase().trim();
  const mid = (modelId || '').trim();
  return `${pid}:${mid}`;
}

function getTestResult(providerId, modelId) {
  const cache = loadModelCache();
  const pid = (providerId || 'gemini').toLowerCase().trim();
  const key = makeTestKey(pid, modelId);
  if (cache.testResults[key]) return cache.testResults[key];
  if (pid === 'gemini' && cache.testResults[modelId]) return cache.testResults[modelId];
  return null;
}

function saveTestResult(providerId, modelId, record) {
  const cache = loadModelCache();
  const pid = (providerId || 'gemini').toLowerCase().trim();
  const mid = (modelId || '').trim();
  if (!mid) return cache;

  const key = makeTestKey(pid, mid);
  cache.testResults[key] = {
    providerId: pid,
    modelId: mid,
    success: Boolean(record.success),
    supportsTools: Boolean(record.supportsTools),
    latencyMs: Number(record.latencyMs) || 0,
    error: record.error || null,
    testedAt: record.testedAt || Date.now()
  };
  saveModelCache(cache);
  return cache;
}

function getAllTestResults() {
  const cache = loadModelCache();
  const items = [];
  for (const [key, val] of Object.entries(cache.testResults || {})) {
    if (!val || typeof val !== 'object') continue;
    let providerId = val.providerId;
    let modelId = val.modelId;
    if (!providerId || !modelId) {
      const idx = key.indexOf(':');
      if (idx > 0) {
        providerId = providerId || key.slice(0, idx);
        modelId = modelId || key.slice(idx + 1);
      } else {
        providerId = providerId || 'gemini';
        modelId = modelId || key;
      }
    }
    items.push({
      key,
      providerId,
      modelId,
      success: Boolean(val.success),
      supportsTools: Boolean(val.supportsTools),
      latencyMs: Number(val.latencyMs) || 0,
      error: val.error || null,
      testedAt: val.testedAt || 0
    });
  }
  items.sort((a, b) => (b.testedAt || 0) - (a.testedAt || 0));
  return items;
}

function getCachedModels(providerId) {
  const cache = loadModelCache();
  const pid = (providerId || 'gemini').toLowerCase().trim();
  const entry = cache.modelsByProvider[pid];
  if (entry && Array.isArray(entry.models)) {
    return entry.models;
  }
  return [];
}

function setCachedModels(providerId, models) {
  const cache = loadModelCache();
  const pid = (providerId || 'gemini').toLowerCase().trim();
  cache.modelsByProvider[pid] = {
    models: Array.isArray(models) ? models : [],
    cachedAt: Date.now()
  };
  saveModelCache(cache);
  return cache;
}

function clearTestResults(providerId = null) {
  const cache = loadModelCache();
  if (!providerId) {
    cache.testResults = {};
  } else {
    const pid = providerId.toLowerCase().trim();
    for (const key of Object.keys(cache.testResults)) {
      const entry = cache.testResults[key];
      if (key.startsWith(`${pid}:`) || entry?.providerId === pid || (pid === 'gemini' && !key.includes(':'))) {
        delete cache.testResults[key];
      }
    }
  }
  saveModelCache(cache);
  return cache;
}

function clearModelsCache(providerId = null) {
  const cache = loadModelCache();
  if (!providerId) {
    cache.modelsByProvider = {};
  } else {
    const pid = providerId.toLowerCase().trim();
    delete cache.modelsByProvider[pid];
  }
  saveModelCache(cache);
  return cache;
}

function clearAllCache() {
  const empty = createEmptyCache();
  saveModelCache(empty);
  return empty;
}

/**
 * 將舊版儲存在 pet_state.json 內的 modelTestResults 無縫遷移至獨立檔案
 */
function migrateLegacyTestResults(legacyMap) {
  if (!legacyMap || typeof legacyMap !== 'object') return false;
  const entries = Object.entries(legacyMap);
  if (entries.length === 0) return false;

  const cache = loadModelCache();
  let migrated = false;

  for (const [key, val] of entries) {
    if (!val || typeof val !== 'object') continue;
    let pid = 'gemini';
    let mid = key;
    const idx = key.indexOf(':');
    if (idx > 0) {
      pid = key.slice(0, idx).toLowerCase();
      mid = key.slice(idx + 1);
    }
    const normalizedKey = makeTestKey(pid, mid);
    const existing = cache.testResults[normalizedKey];
    if (!existing || (val.testedAt || 0) > (existing.testedAt || 0)) {
      cache.testResults[normalizedKey] = {
        providerId: pid,
        modelId: mid,
        success: Boolean(val.success),
        supportsTools: Boolean(val.supportsTools),
        latencyMs: Number(val.latencyMs) || 0,
        error: val.error || null,
        testedAt: val.testedAt || Date.now()
      };
      migrated = true;
    }
  }

  if (migrated) {
    saveModelCache(cache);
  }
  return migrated;
}

function getCacheStats() {
  const cache = loadModelCache();
  const targetPath = getModelCacheFilePath();
  let sizeBytes = 0;
  try {
    if (fs.existsSync(targetPath)) {
      sizeBytes = fs.statSync(targetPath).size;
    }
  } catch (_) {}

  let totalCachedModels = 0;
  for (const entry of Object.values(cache.modelsByProvider || {})) {
    if (entry && Array.isArray(entry.models)) {
      totalCachedModels += entry.models.length;
    }
  }

  return {
    testCount: Object.keys(cache.testResults || {}).length,
    providerCount: Object.keys(cache.modelsByProvider || {}).length,
    totalCachedModels,
    sizeBytes,
    updatedAt: cache.updatedAt || 0
  };
}

module.exports = {
  setModelCacheFilePath,
  getModelCacheFilePath,
  loadModelCache,
  saveModelCache,
  getTestResult,
  saveTestResult,
  getAllTestResults,
  getCachedModels,
  setCachedModels,
  clearTestResults,
  clearModelsCache,
  clearAllCache,
  migrateLegacyTestResults,
  getCacheStats
};
