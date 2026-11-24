/**
 * AI 用量與配額追蹤引擎 (AI Usage & Quota Tracker)
 * 負責記錄 API 請求次數、Token 消耗量、計算太平洋時間 (PT) 每日額度重設倒數、以及監控 RPM 頻率
 */

const fs = require('fs');
const paths = require('./paths');

let customUsagePath = null;
function setUsageFilePath(newPath) {
  customUsagePath = newPath;
}
function getUsageFilePath() {
  return customUsagePath || paths.usagePath;
}

// 模型免費層配額常數定義
const MODEL_QUOTAS = {
  'pro': { limitRPD: 50, limitRPM: 2, limitTPM: 32000 },
  'default': { limitRPD: 1500, limitRPM: 15, limitTPM: 1000000 },
  'groq': { limitRPD: 14400, limitRPM: 30, limitTPM: 500000 },
  'ollama': { limitRPD: 999999, limitRPM: 999, limitTPM: 9999999, isUnlimited: true },
  'external': { limitRPD: 5000, limitRPM: 60, limitTPM: 1000000 }
};

/**
 * 計算 Google AI Studio 太平洋時間 (PT 00:00) 每日配額重設時間與倒數
 * @param {Date} [now=new Date()]
 */
function getDailyResetInfo(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });

  const parts = formatter.formatToParts(now);
  const getPart = (type) => parseInt(parts.find(p => p.type === type).value, 10);

  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  const hour = getPart('hour') % 24;
  const minute = getPart('minute');
  const second = getPart('second');

  const elapsedSecondsInPtDay = hour * 3600 + minute * 60 + second;
  const remainingSecondsUntilReset = 86400 - elapsedSecondsInPtDay;
  const remainingMs = remainingSecondsUntilReset * 1000;
  const nextResetDate = new Date(now.getTime() + remainingMs);

  const hoursLeft = Math.floor(remainingSecondsUntilReset / 3600);
  const minutesLeft = Math.floor((remainingSecondsUntilReset % 3600) / 60);

  const resetTimeStr = nextResetDate.toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const ptDateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return {
    ptDateKey,
    resetTimeStr,
    remainingHours: hoursLeft,
    remainingMinutes: minutesLeft,
    remainingSeconds: remainingSecondsUntilReset % 60,
    remainingMs,
    nextResetDate
  };
}

/**
 * 取得特定模型配額標準
 */
function getModelQuota(modelName = '', provider = 'gemini') {
  const cleanProvider = (provider || 'gemini').toLowerCase();
  if (cleanProvider === 'ollama') {
    return MODEL_QUOTAS['ollama'];
  }
  if (cleanProvider === 'groq') {
    return MODEL_QUOTAS['groq'];
  }
  if (cleanProvider !== 'gemini') {
    return MODEL_QUOTAS['external'];
  }
  const clean = (modelName || '').toLowerCase();
  if (clean.includes('pro')) {
    return MODEL_QUOTAS['pro'];
  }
  return MODEL_QUOTAS['default'];
}

/**
 * 讀取本地用量紀錄
 */
function loadUsageData() {
  const defaultData = {
    lastPtDate: '',
    todayRequests: 0,
    todayTokens: 0,
    totalRequests: 0,
    totalTokens: 0,
    minuteTimestamps: [],
    byModel: {}
  };

  const targetPath = getUsageFilePath();
  try {
    if (fs.existsSync(targetPath)) {
      const raw = fs.readFileSync(targetPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!parsed.byModel || typeof parsed.byModel !== 'object') {
        parsed.byModel = {};
      }
      return { ...defaultData, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load usage data:', e);
  }
  return defaultData;
}

/**
 * 儲存本地用量紀錄
 */
function saveUsageData(data) {
  const targetPath = getUsageFilePath();
  try {
    fs.writeFileSync(targetPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save usage data:', e);
  }
}

/**
 * 記錄一次 API 調用用量
 */
function recordUsage({ model = '', promptTokens = 0, candidateTokens = 0, totalTokens = 0 } = {}) {
  const data = loadUsageData();
  const resetInfo = getDailyResetInfo();
  const nowMs = Date.now();

  // 若跨日 (依據 PT 週期)，自動歸零本日用量
  if (data.lastPtDate !== resetInfo.ptDateKey) {
    data.lastPtDate = resetInfo.ptDateKey;
    data.todayRequests = 0;
    data.todayTokens = 0;
    if (data.byModel && typeof data.byModel === 'object') {
      for (const m of Object.keys(data.byModel)) {
        if (data.byModel[m]) {
          data.byModel[m].todayRequests = 0;
          data.byModel[m].todayTokens = 0;
          data.byModel[m].minuteTimestamps = [];
        }
      }
    }
  }

  const addedTokens = totalTokens > 0 ? totalTokens : (promptTokens + candidateTokens);

  data.todayRequests += 1;
  data.todayTokens += addedTokens;
  data.totalRequests += 1;
  data.totalTokens += addedTokens;

  // 滑動窗口記錄最近 60 秒內的請求時間戳
  data.minuteTimestamps = (data.minuteTimestamps || [])
    .filter(ts => nowMs - ts < 60000);
  data.minuteTimestamps.push(nowMs);

  const cleanModel = (model || '').trim();
  if (cleanModel) {
    if (!data.byModel) data.byModel = {};
    if (!data.byModel[cleanModel]) {
      data.byModel[cleanModel] = {
        todayRequests: 0,
        todayTokens: 0,
        totalRequests: 0,
        totalTokens: 0,
        minuteTimestamps: []
      };
    }
    const mData = data.byModel[cleanModel];
    mData.todayRequests = (mData.todayRequests || 0) + 1;
    mData.todayTokens = (mData.todayTokens || 0) + addedTokens;
    mData.totalRequests = (mData.totalRequests || 0) + 1;
    mData.totalTokens = (mData.totalTokens || 0) + addedTokens;
    mData.minuteTimestamps = (mData.minuteTimestamps || []).filter(ts => nowMs - ts < 60000);
    mData.minuteTimestamps.push(nowMs);
  }

  saveUsageData(data);
  return data;
}

/**
 * 獲取即時用量摘要與狀態
 */
function getUsageSummary(currentModel = 'gemini-3.5-flash-lite', provider = 'gemini') {
  const data = loadUsageData();
  const resetInfo = getDailyResetInfo();
  const quota = getModelQuota(currentModel, provider);
  const nowMs = Date.now();
  const cleanModel = (currentModel || '').trim();

  const isCrossDay = data.lastPtDate !== resetInfo.ptDateKey;

  // 全域用量
  const globalTodayReqs = isCrossDay ? 0 : (data.todayRequests || 0);
  const globalTodayToks = isCrossDay ? 0 : (data.todayTokens || 0);

  // 分模型用量
  const mData = (!isCrossDay && data.byModel && cleanModel && data.byModel[cleanModel]) ? data.byModel[cleanModel] : null;

  let todayReqs = 0;
  let todayToks = 0;
  let modelMinuteCount = 0;

  if (mData) {
    todayReqs = mData.todayRequests || 0;
    todayToks = mData.todayTokens || 0;
    modelMinuteCount = (mData.minuteTimestamps || []).filter(ts => nowMs - ts < 60000).length;
  } else if (Object.keys(data.byModel || {}).length === 0 && globalTodayReqs > 0) {
    // 舊版升級相容相容：byModel 為空時沿用 globalTodayReqs
    todayReqs = globalTodayReqs;
    todayToks = globalTodayToks;
    modelMinuteCount = (data.minuteTimestamps || []).filter(ts => nowMs - ts < 60000).length;
  }

  const remainingRequests = Math.max(0, quota.limitRPD - todayReqs);
  const percentUsed = Math.min(100, Math.round((todayReqs / quota.limitRPD) * 100));
  const isRateLimitClose = modelMinuteCount >= Math.floor(quota.limitRPM * 0.8);

  return {
    model: cleanModel,
    todayRequests: todayReqs,
    todayTokens: todayToks,
    globalTodayRequests: globalTodayReqs,
    globalTodayTokens: globalTodayToks,
    totalRequests: data.totalRequests || 0,
    totalTokens: data.totalTokens || 0,
    limitRPD: quota.limitRPD,
    limitRPM: quota.limitRPM,
    isUnlimited: Boolean(quota.isUnlimited),
    remainingRequests,
    percentUsed,
    minuteRequests: modelMinuteCount,
    isRateLimitClose,
    resetInfo
  };
}

module.exports = {
  getDailyResetInfo,
  getModelQuota,
  recordUsage,
  getUsageSummary,
  loadUsageData,
  saveUsageData,
  setUsageFilePath
};

