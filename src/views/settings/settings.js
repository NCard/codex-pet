const { ipcRenderer, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const {
  petStatePath: statePath,
  dataDir,
  logDir,
  historyPath,
  usagePath
} = require('../../utils/paths');
const { getUsageSummary, loadUsageData, resetUsageData } = require('../../utils/usage_tracker');
const modelCache = require('../../utils/model_cache');
const cryptoUtils = require('../../utils/crypto_utils');
const { getScenarioPreset } = require('../../utils/scenarios');
const { getAdaptiveChatSize, resolveChatSize } = require('../../utils/chat_sizing');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { AIProviderFactory } = require('../../services/ai_provider');

// 預設設定
const defaultSettings = {
  bedX: -4,
  bedY: -15,
  bedScale: 170,
  bedZ: -1,
  animSpeed: 1.0,
  chatSizeMode: 'auto',
  chatWidth: 350,
  chatHeight: 250,
  aiProvider: 'gemini',
  apiKey: '',
  aiBaseUrl: '',
  aiModel: 'gemini-3.5-flash-lite',
  providerConfigs: {},
  thinkingLevel: 'medium',
  aiScenario: 'general',
  aiCustomScenario: '',
  aiPersonality: 'default',
  aiCustomPrompt: '',
  contextTimeout: 5,
  summonShortcut: 'Ctrl+Shift+K',
  enableClipboard: false,
  enableClipboardSmartWatch: false,
  enableAlarmStalking: true,
  alarmStalkingDelay: 15,
  enableAlarmSound: true
};

let petState = {};
let isDirty = false;
let isBedEditing = false;
let pendingClose = false;
let workingProviderConfigs = {};
let activeProviderId = 'gemini';

try {
  if (fs.existsSync(statePath)) {
    petState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    if (petState.settings && petState.settings.summonShortcut) {
      petState.settings.summonShortcut = petState.settings.summonShortcut.replace(/CommandOrControl/g, 'Ctrl');
    }
  }
} catch (e) {
  console.error('Error reading state:', e);
}

if (!petState.settings) {
  petState.settings = { ...defaultSettings };
}

const els = {
  bedX: document.getElementById('bed-x'),
  bedY: document.getElementById('bed-y'),
  bedScale: document.getElementById('bed-scale'),
  bedZ: document.getElementById('bed-z'),
  animSpeed: document.getElementById('anim-speed'),
  chatSizeMode: document.getElementById('setting-chatSizeMode'),
  chatWidth: document.getElementById('setting-chatWidth'),
  chatHeight: document.getElementById('setting-chatHeight'),
  aiProvider: document.getElementById('setting-aiProvider'),
  apiKey: document.getElementById('setting-apiKey'),
  baseUrl: document.getElementById('setting-baseUrl'),
  aiModel: document.getElementById('setting-aiModel'),
  customModel: document.getElementById('setting-customModel'),
  thinkingLevel: document.getElementById('setting-thinkingLevel'),
  aiScenario: document.getElementById('setting-aiScenario'),
  aiCustomScenario: document.getElementById('setting-customScenario'),
  aiPersonality: document.getElementById('ai-personality'),
  aiCustomPrompt: document.getElementById('custom-personality-input'),
  contextTimeout: document.getElementById('setting-contextTimeout'),
  summonShortcut: document.getElementById('setting-shortcut'),
  enableClipboard: document.getElementById('setting-enableClipboard'),
  enableClipboardSmartWatch: document.getElementById('setting-enableClipboardSmartWatch'),
  enableAlarmStalking: document.getElementById('setting-enableAlarmStalking'),
  alarmStalkingDelay: document.getElementById('setting-alarmStalkingDelay'),
  enableAlarmSound: document.getElementById('setting-enableAlarmSound')
};

const vals = {
  bedX: document.getElementById('val-bed-x'),
  bedY: document.getElementById('val-bed-y'),
  bedScale: document.getElementById('val-bed-scale'),
  animSpeed: document.getElementById('val-anim-speed'),
  chatWidth: document.getElementById('val-chat-width'),
  chatHeight: document.getElementById('val-chat-height')
};

function getDetectedDisplaySize() {
  try {
    const info = ipcRenderer.sendSync('get-display-info');
    if (info && info.width > 0 && info.height > 0) {
      return info;
    }
  } catch (_) {}
  return {
    width: window.screen?.availWidth || window.screen?.width || 1920,
    height: window.screen?.availHeight || window.screen?.height || 1080,
    scaleFactor: window.devicePixelRatio || 1
  };
}

function updateChatSizeInfoBanner() {
  const infoEl = document.getElementById('chat-size-resolution-info');
  if (!infoEl) return;
  const display = getDetectedDisplaySize();
  const rec = getAdaptiveChatSize(display.width, display.height);
  const mode = els.chatSizeMode ? els.chatSizeMode.value : 'auto';
  const modeNote = mode === 'auto' ? '目前為自動適應模式' : '目前為手動自訂模式';
  infoEl.innerText = `🖥️ 偵測螢幕工作區：${display.width} × ${display.height}（${rec.tierLabel}）• 建議尺寸 ${rec.width} × ${rec.height} px（${modeNote}）`;
}

// 1. 分頁切換
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

function activateTab(targetTabId) {
  tabBtns.forEach(b => {
    b.classList.toggle('active', b.dataset.tab === targetTabId);
  });
  tabContents.forEach(c => {
    c.classList.toggle('active', c.id === targetTabId);
  });
  if (targetTabId === 'tab-appearance') {
    updateChatSizeInfoBanner();
  }
}

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    activateTab(btn.dataset.tab);
  });
});

function getActiveProviderId() {
  return (els.aiProvider && els.aiProvider.value) ? els.aiProvider.value.toLowerCase() : 'gemini';
}

function getEffectiveModelId() {
  const customVal = els.customModel ? els.customModel.value.trim() : '';
  if (customVal) return customVal;
  return els.aiModel ? els.aiModel.value : 'gemini-3.5-flash-lite';
}

function getTestResultRecord(providerId, modelId) {
  return modelCache.getTestResult(providerId, modelId);
}

function saveTestResultRecord(providerId, modelId, record) {
  modelCache.saveTestResult(providerId, modelId, record);
  updateDataManagementUI();
}

function snapshotCurrentProviderInputs(targetProviderId) {
  const pid = targetProviderId || activeProviderId || 'gemini';
  const preset = AIProviderFactory.getPreset(pid);
  workingProviderConfigs[pid] = {
    apiKey: els.apiKey ? els.apiKey.value.trim() : '',
    baseUrl: els.baseUrl ? els.baseUrl.value.trim() : (preset.baseUrl || ''),
    model: els.aiModel ? els.aiModel.value : (preset.defaultModel || ''),
    customModel: els.customModel ? els.customModel.value.trim() : ''
  };
}

function populateDefaultModelsForProvider(providerId, preferredModel = '') {
  if (!els.aiModel) return;
  const preset = AIProviderFactory.getPreset(providerId);
  const cachedModels = modelCache.getCachedModels(providerId);
  const sourceModels = (cachedModels && cachedModels.length > 0) ? cachedModels : (preset.defaultModels || []);
  els.aiModel.innerHTML = '';

  const addedIds = new Set();
  sourceModels.forEach(m => {
    cachedModelsMetadata[`${providerId}:${m.id}`] = m;
    if (providerId === 'gemini') cachedModelsMetadata[m.id] = m;
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.innerText = m.displayName || m.id;
    els.aiModel.appendChild(opt);
    addedIds.add(m.id);
  });

  if (preferredModel && !addedIds.has(preferredModel)) {
    const opt = document.createElement('option');
    opt.value = preferredModel;
    opt.innerText = preferredModel;
    els.aiModel.appendChild(opt);
    addedIds.add(preferredModel);
  }

  if (addedIds.size === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.innerText = '請點擊「重新整理」或於下方手動輸入模型 ID';
    els.aiModel.appendChild(opt);
  }

  if (preferredModel && addedIds.has(preferredModel)) {
    els.aiModel.value = preferredModel;
  } else if (preset.defaultModel && addedIds.has(preset.defaultModel)) {
    els.aiModel.value = preset.defaultModel;
  }
}

function applyProviderUI(providerId, { loadSavedValues = true } = {}) {
  const preset = AIProviderFactory.getPreset(providerId);
  activeProviderId = preset.id;

  const labelApiKey = document.getElementById('label-apiKey');
  const providerDescHint = document.getElementById('provider-desc-hint');
  const apiKeyHint = document.getElementById('apikey-hint');
  const baseUrlGroup = document.getElementById('baseUrl-group');
  const customModelGroup = document.getElementById('custom-model-group');
  const btnOpenProviderKey = document.getElementById('btn-open-provider-key');

  if (labelApiKey) {
    labelApiKey.innerText = preset.requiresApiKey ? `${preset.name.split(' ')[0]} API Key` : `${preset.name.split(' ')[0]} API Key (選填)`;
  }
  if (els.apiKey) {
    els.apiKey.placeholder = preset.keyPlaceholder || '請填寫您的 API Key...';
  }
  if (providerDescHint) {
    providerDescHint.innerText = `* ${preset.description} 各服務商金鑰將獨立保存。`;
  }
  if (apiKeyHint) {
    apiKeyHint.innerText = preset.requiresApiKey
      ? '* 請填寫 API Key 以啟用 AI 對話與工具功能（切換服務商不會清除已填金鑰）。'
      : '* 此服務商無需強制填寫 API Key，若本機或中轉端點有設驗證密碼再填寫即可。';
  }
  if (baseUrlGroup) {
    baseUrlGroup.style.display = preset.allowCustomBaseUrl ? 'block' : 'none';
  }
  if (customModelGroup) {
    const showCustomInput = ['custom', 'ollama', 'openrouter'].includes(preset.id);
    customModelGroup.style.display = showCustomInput ? 'block' : 'none';
  }
  if (btnOpenProviderKey) {
    btnOpenProviderKey.style.display = preset.keyUrl ? 'inline-block' : 'none';
  }

  if (loadSavedValues) {
    const cfg = workingProviderConfigs[preset.id] || {};
    const defaultEnvKey = preset.id === 'gemini' ? (process.env.GEMINI_API_KEY || '') : '';
    if (els.apiKey) els.apiKey.value = cfg.apiKey || defaultEnvKey;
    if (els.baseUrl) els.baseUrl.value = cfg.baseUrl || preset.baseUrl || '';
    if (els.customModel) els.customModel.value = cfg.customModel || '';

    const preferredModel = cfg.model || preset.defaultModel || '';
    populateDefaultModelsForProvider(preset.id, preferredModel);
  }

  // 更新配額頁中的外部控制台按鈕文字
  const btnOpenDashboard = document.getElementById('btn-open-aistudio');
  if (btnOpenDashboard) {
    if (preset.id === 'gemini') {
      btnOpenDashboard.innerText = '🌐 前往 AI Studio';
      btnOpenDashboard.style.display = 'inline-block';
    } else if (preset.keyUrl) {
      btnOpenDashboard.innerText = `🌐 前往 ${preset.name.split(' ')[0]}`;
      btnOpenDashboard.style.display = 'inline-block';
    } else {
      btnOpenDashboard.style.display = 'none';
    }
  }
}

// 2. 初始化介面
function initUI() {
  const s = petState.settings;
  els.bedX.value = s.bedX ?? defaultSettings.bedX;
  els.bedY.value = s.bedY ?? defaultSettings.bedY;
  els.bedScale.value = s.bedScale ?? defaultSettings.bedScale;
  els.bedZ.value = s.bedZ ?? defaultSettings.bedZ;
  els.animSpeed.value = s.animSpeed ?? defaultSettings.animSpeed;

  const detectedDisplay = getDetectedDisplaySize();
  const resolvedChat = resolveChatSize(s, detectedDisplay.width, detectedDisplay.height);
  if (els.chatSizeMode) els.chatSizeMode.value = resolvedChat.mode;
  if (els.chatWidth) els.chatWidth.value = resolvedChat.chatWidth;
  if (els.chatHeight) els.chatHeight.value = resolvedChat.chatHeight;
  updateChatSizeInfoBanner();

  // 遷移舊版儲存在 pet_state.json 的測試紀錄至獨立 ai_model_cache.json
  if (s.modelTestResults && typeof s.modelTestResults === 'object') {
    modelCache.migrateLegacyTestResults(s.modelTestResults);
  }

  // 初始化多服務商獨立設定（向下相容舊版僅有 apiKey / aiModel 的結構）
  workingProviderConfigs = {};
  if (s.providerConfigs && typeof s.providerConfigs === 'object') {
    for (const [k, v] of Object.entries(s.providerConfigs)) {
      if (v && typeof v === 'object') {
        workingProviderConfigs[k] = { ...v };
      }
    }
  }
  const initialProvider = (s.aiProvider || 'gemini').toLowerCase();
  if (!workingProviderConfigs[initialProvider]) {
    workingProviderConfigs[initialProvider] = {
      apiKey: s.apiKey || '',
      baseUrl: s.aiBaseUrl || AIProviderFactory.getPreset(initialProvider).baseUrl || '',
      model: s.aiModel || AIProviderFactory.getPreset(initialProvider).defaultModel || '',
      customModel: ''
    };
  } else {
    if (!workingProviderConfigs[initialProvider].apiKey && s.apiKey) {
      workingProviderConfigs[initialProvider].apiKey = s.apiKey;
    }
    if (!workingProviderConfigs[initialProvider].model && s.aiModel) {
      workingProviderConfigs[initialProvider].model = s.aiModel;
    }
  }

  if (els.aiProvider) {
    els.aiProvider.value = initialProvider;
  }
  applyProviderUI(initialProvider, { loadSavedValues: true });

  if (els.thinkingLevel) els.thinkingLevel.value = s.thinkingLevel ?? defaultSettings.thinkingLevel;
  if (els.aiScenario) els.aiScenario.value = s.aiScenario ?? defaultSettings.aiScenario;
  if (els.aiCustomScenario) els.aiCustomScenario.value = s.aiCustomScenario ?? defaultSettings.aiCustomScenario;
  updateScenarioUI(els.aiScenario ? els.aiScenario.value : defaultSettings.aiScenario);
  els.aiPersonality.value = s.aiPersonality ?? defaultSettings.aiPersonality;
  els.aiCustomPrompt.value = s.aiCustomPrompt ?? defaultSettings.aiCustomPrompt;
  els.contextTimeout.value = s.contextTimeout ?? defaultSettings.contextTimeout;
  els.summonShortcut.value = s.summonShortcut ?? defaultSettings.summonShortcut;
  els.enableClipboard.checked = s.enableClipboard !== undefined ? Boolean(s.enableClipboard) : defaultSettings.enableClipboard;
  els.enableClipboardSmartWatch.checked = s.enableClipboardSmartWatch !== undefined ? Boolean(s.enableClipboardSmartWatch) : defaultSettings.enableClipboardSmartWatch;
  els.enableAlarmStalking.checked = s.enableAlarmStalking !== undefined ? Boolean(s.enableAlarmStalking) : defaultSettings.enableAlarmStalking;
  els.alarmStalkingDelay.value = s.alarmStalkingDelay ?? defaultSettings.alarmStalkingDelay;
  els.enableAlarmSound.checked = s.enableAlarmSound !== undefined ? Boolean(s.enableAlarmSound) : defaultSettings.enableAlarmSound;
  
  if (els.aiPersonality.value === 'custom') {
    document.getElementById('custom-personality-group').style.display = 'block';
  } else {
    document.getElementById('custom-personality-group').style.display = 'none';
  }
  
  // 動態讀取 package.json 的當前版本，避免 HTML 寫死
  try {
    const pkg = require('../../../package.json');
    const aboutVerEl = document.getElementById('about-app-version');
    if (aboutVerEl && pkg && pkg.version) {
      aboutVerEl.innerText = `v${pkg.version}`;
    }
  } catch(e) {}

  updateLabels();
  updateBedEditUI();
  updateQuotaUI();
  updateModelSelectOptionsLabels();
  updateModelInfoCard();
  updateDataManagementUI();
  setDirty(false);
  
  // 若本機尚未快取此服務商模型清單，才自動靜默抓一次；已有快取則直接秒開顯示
  if (modelCache.getCachedModels(initialProvider).length === 0) {
    refreshModels(true);
  }
}

const cachedModelsMetadata = {
  'gemini-3.5-flash-lite': {
    id: 'gemini-3.5-flash-lite',
    displayName: 'Gemini 3.5 Flash Lite',
    description: '輕量高性價比模型，兼顧極速回應與工具自主調用能力。',
    contextStr: '1M Tokens',
    outputTokenLimit: 8192,
    badge: '推薦免費使用 (15 RPM)',
    tier: 'flash',
    supportsTools: true
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    description: '最新世代主力模型，速度極快且深度支援思考推理與 Agent 工具。',
    contextStr: '1M Tokens',
    outputTokenLimit: 8192,
    badge: '推薦免費使用 (15 RPM)',
    tier: 'flash',
    supportsTools: true
  },
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    description: '新一代多模態主力工作模型，具備優異的多步驟決策與工具調用能力。',
    contextStr: '1M Tokens',
    outputTokenLimit: 8192,
    badge: '推薦免費使用 (15 RPM)',
    tier: 'flash',
    supportsTools: true
  },
  'gemini-1.5-flash': {
    id: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    description: '速度與效率兼具的高吞吐量模型，穩定且免費額度充足。',
    contextStr: '1M Tokens',
    outputTokenLimit: 8192,
    badge: '推薦免費使用 (15 RPM)',
    tier: 'flash',
    supportsTools: true
  },
  'gemini-1.5-pro': {
    id: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    description: '高難度複雜問題推導旗艦模型。注意：免費層頻率限制較嚴格 (2 RPM)。',
    contextStr: '2M Tokens',
    outputTokenLimit: 8192,
    badge: '深度旗艦 (2 RPM)',
    tier: 'pro',
    supportsTools: true
  }
};

function updateModelInfoCard(modelId = '') {
  const card = document.getElementById('model-info-card');
  if (!card) return;
  const providerId = getActiveProviderId();
  const preset = AIProviderFactory.getPreset(providerId);
  const id = modelId || getEffectiveModelId() || preset.defaultModel || 'gemini-3.5-flash-lite';
  const meta = cachedModelsMetadata[`${providerId}:${id}`] || cachedModelsMetadata[id] || {
    id,
    displayName: id || '尚未指定模型',
    description: `${preset.name} 模型，支援智慧對話與工具調用。`,
    contextStr: '標準上下文',
    outputTokenLimit: 8192,
    badge: providerId === 'ollama'
      ? '本機免費無上限'
      : (id.includes('pro') ? '深度旗艦' : (id.includes('flash') || id.includes('lite') ? '推薦主力' : preset.name.split(' ')[0])),
    tier: id.includes('pro') ? 'pro' : (id.includes('1.0') ? 'legacy' : 'flash'),
    supportsTools: !id.includes('1.0')
  };

  const nameEl = document.getElementById('model-info-name');
  const badgeEl = document.getElementById('model-info-badge');
  const descEl = document.getElementById('model-info-desc');
  const ctxEl = document.getElementById('model-info-ctx');
  const outEl = document.getElementById('model-info-out');
  const toolsEl = document.getElementById('model-info-tools');
  const rpmEl = document.getElementById('model-info-rpm');

  if (nameEl) nameEl.innerText = meta.displayName || meta.id;
  if (badgeEl) {
    badgeEl.innerText = meta.badge || (meta.tier === 'pro' ? '深度旗艦' : '推薦使用');
    badgeEl.className = `model-info-badge ${meta.tier || 'flash'}`;
  }
  if (descEl) descEl.innerText = meta.description || preset.description;
  if (ctxEl) ctxEl.innerText = meta.contextStr || (meta.inputTokenLimit ? `${Math.round(meta.inputTokenLimit / 1000)}k Tokens` : '標準上下文');
  if (outEl) outEl.innerText = meta.outputTokenLimit ? `${Number(meta.outputTokenLimit).toLocaleString()} Tokens` : '依模型上限';
  if (toolsEl) {
    toolsEl.innerText = meta.supportsTools ? '✅ 完整支援' : '⚠️ 可能不支援';
    toolsEl.style.color = meta.supportsTools ? '#15803d' : '#b91c1c';
  }
  if (rpmEl) {
    if (providerId === 'ollama') {
      rpmEl.innerText = '無上限 (本機)';
    } else if (providerId === 'groq') {
      rpmEl.innerText = '30 RPM';
    } else if (providerId === 'gemini') {
      rpmEl.innerText = meta.tier === 'pro' ? '2 RPM' : '15 RPM';
    } else {
      rpmEl.innerText = '依方案而定';
    }
  }

  // 更新上次測試紀錄
  const testRecordEl = document.getElementById('model-info-test-record');
  const testRecordTextEl = document.getElementById('model-info-test-text');
  const test = getTestResultRecord(providerId, id);

  if (testRecordEl && testRecordTextEl) {
    if (test) {
      const d = new Date(test.testedAt || Date.now());
      const dateStr = `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      if (test.success && test.supportsTools) {
        testRecordEl.className = 'model-info-test-record success';
        testRecordTextEl.innerText = `上次測試：${dateStr} (✅ 連線正常，延遲 ${test.latencyMs}ms，支援 Agent 工具)`;
      } else if (test.success && !test.supportsTools) {
        testRecordEl.className = 'model-info-test-record warning';
        testRecordTextEl.innerText = `上次測試：${dateStr} (⚠️ 連線正常但無 Agent 工具支援，延遲 ${test.latencyMs}ms)`;
      } else {
        testRecordEl.className = 'model-info-test-record error';
        testRecordTextEl.innerText = `上次測試：${dateStr} (❌ 測試失敗：${test.error || '連線錯誤'})`;
      }
    } else {
      testRecordEl.className = 'model-info-test-record';
      testRecordTextEl.innerText = '尚未進行連線測試 (可點擊上方「🧪 測試連線」即時檢測)';
    }
  }
}

function updateModelSelectOptionsLabels() {
  const select = els.aiModel;
  if (!select) return;
  const providerId = getActiveProviderId();

  const currentVal = select.value;
  const optionsArr = Array.from(select.options);

  optionsArr.forEach(opt => {
    const modelId = opt.value;
    if (!modelId) return;
    const meta = cachedModelsMetadata[`${providerId}:${modelId}`] || cachedModelsMetadata[modelId] || {};
    const baseName = meta.displayName || modelId;
    const test = getTestResultRecord(providerId, modelId);

    if (!test) {
      opt.innerText = baseName;
    } else if (test.success && test.supportsTools) {
      opt.innerText = `✅ ${baseName} (${test.latencyMs}ms)`;
    } else if (test.success && !test.supportsTools) {
      opt.innerText = `⚠️ ${baseName} (無工具 • ${test.latencyMs}ms)`;
    } else {
      const errBrief = (test.error || '').includes('429') ? '配額超限' : '不可用';
      opt.innerText = `❌ ${baseName} (${errBrief})`;
    }
  });

  // 智慧排序：可用模型 (✅) 自動置頂，尚未測試居中，不可用模型 (❌) 排在最後
  optionsArr.sort((a, b) => {
    const getScore = (opt) => {
      const t = getTestResultRecord(providerId, opt.value);
      if (!t) return 2; // 未測試
      if (t.success && t.supportsTools) return 0; // 最優先置頂
      if (t.success && !t.supportsTools) return 1;
      return 3; // 不可用置底
    };
    return getScore(a) - getScore(b);
  });

  select.innerHTML = '';
  optionsArr.forEach(opt => select.appendChild(opt));
  select.value = currentVal;
}

async function refreshModels(silent = false) {
  const providerId = getActiveProviderId();
  const preset = AIProviderFactory.getPreset(providerId);
  const apiKey = els.apiKey.value.trim() || (providerId === 'gemini' ? (process.env.GEMINI_API_KEY || '') : '');
  const baseUrl = (els.baseUrl && els.baseUrl.value.trim()) || preset.baseUrl || '';

  if (preset.requiresApiKey && !apiKey) {
    if (!silent) alert(`請先填寫 ${preset.name} 的 API Key 才能獲取模型列表！`);
    return;
  }
  if (!preset.requiresApiKey && !baseUrl && providerId === 'custom') {
    if (!silent) alert('請先填寫自訂端點的 Base URL！');
    return;
  }
  
  const btnRefreshModels = document.getElementById('btn-refresh-models');
  if (btnRefreshModels) {
    btnRefreshModels.disabled = true;
    btnRefreshModels.innerText = '載入中...';
  }
  
  try {
    const provider = AIProviderFactory.create(providerId, apiKey, '', { baseUrl });
    const models = await provider.getAvailableModels();
    
    if (models && models.length > 0) {
      modelCache.setCachedModels(providerId, models);
      const currentVal = els.aiModel.value;
      els.aiModel.innerHTML = '';
      models.forEach(m => {
        cachedModelsMetadata[`${providerId}:${m.id}`] = m;
        if (providerId === 'gemini') cachedModelsMetadata[m.id] = m;
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.innerText = m.displayName || m.id;
        els.aiModel.appendChild(opt);
      });
      const hasCurrent = models.some(m => m.id === currentVal);
      if (hasCurrent) {
        els.aiModel.value = currentVal;
      } else {
        const savedModel = workingProviderConfigs[providerId]?.model || petState.settings.aiModel;
        els.aiModel.value = models.some(m => m.id === savedModel) ? savedModel : models[0].id;
      }
      updateModelSelectOptionsLabels();
      updateModelInfoCard(getEffectiveModelId());
      updateDataManagementUI();
    }
  } catch (e) {
    console.error('Failed to fetch models', e);
    if (!silent) {
      alert('獲取失敗: ' + (e.message || String(e)));
    }
  } finally {
    if (btnRefreshModels) {
      btnRefreshModels.disabled = false;
      btnRefreshModels.innerText = '🔄 重新整理';
    }
  }
}

document.getElementById('btn-refresh-models')?.addEventListener('click', () => {
  refreshModels(false);
});

document.getElementById('btn-open-provider-key')?.addEventListener('click', () => {
  const preset = AIProviderFactory.getPreset(getActiveProviderId());
  if (preset.keyUrl) {
    shell.openExternal(preset.keyUrl);
  }
});

// 測試連線按鈕
const btnTestModel = document.getElementById('btn-test-model');
const testStatusEl = document.getElementById('test-model-status');
btnTestModel?.addEventListener('click', async () => {
  const providerId = getActiveProviderId();
  const preset = AIProviderFactory.getPreset(providerId);
  const apiKey = els.apiKey.value.trim() || (providerId === 'gemini' ? (process.env.GEMINI_API_KEY || '') : '');
  const baseUrl = (els.baseUrl && els.baseUrl.value.trim()) || preset.baseUrl || '';

  if (preset.requiresApiKey && !apiKey) {
    alert(`請先填寫 ${preset.name} 的 API Key 才能進行連線測試！`);
    return;
  }
  if (providerId === 'custom' && !baseUrl) {
    alert('請先填寫自訂端點的 Base URL 才能進行連線測試！');
    return;
  }

  const currentModel = getEffectiveModelId();
  if (!currentModel) {
    alert('請先選擇或手動輸入要測試的模型 ID！');
    return;
  }

  btnTestModel.disabled = true;
  btnTestModel.innerText = '測試中 (0s)...';
  let elapsedSec = 0;
  if (testStatusEl) {
    testStatusEl.style.display = 'block';
    testStatusEl.style.background = '#f1f5f9';
    testStatusEl.style.color = '#475569';
    testStatusEl.innerText = `正在測試 [${preset.name.split(' ')[0]}] ${currentModel} 連線與工具呼叫能力... (已耗時 0 秒)`;
  }

  const timerInterval = setInterval(() => {
    elapsedSec += 1;
    btnTestModel.innerText = `測試中 (${elapsedSec}s)...`;
    if (testStatusEl && testStatusEl.style.color === '#475569') {
      testStatusEl.innerText = `正在測試 [${preset.name.split(' ')[0]}] ${currentModel} 連線與工具呼叫能力... (已耗時 ${elapsedSec} 秒)`;
    }
  }, 1000);

  try {
    const provider = AIProviderFactory.create(providerId, apiKey, currentModel, { baseUrl });
    const result = await provider.testModelAvailability(currentModel, 10000);
    clearInterval(timerInterval);
    if (result.success) {
      testStatusEl.style.background = '#dcfce7';
      testStatusEl.style.color = '#15803d';
      testStatusEl.innerText = `✅ 測試成功 (${result.latencyMs}ms)：模型連線正常且支援 Agent 工具呼叫！`;
    } else {
      testStatusEl.style.background = '#fee2e2';
      testStatusEl.style.color = '#b91c1c';
      testStatusEl.innerText = `❌ 測試失敗 (${result.latencyMs}ms)：${result.error}`;
    }

    // 儲存測試結果紀錄
    saveTestResultRecord(providerId, currentModel, {
      success: Boolean(result.success),
      supportsTools: Boolean(result.supportsTools),
      latencyMs: result.latencyMs,
      error: result.error || null,
      testedAt: Date.now()
    });

    updateModelSelectOptionsLabels();
    updateModelInfoCard(currentModel);
  } catch (err) {
    testStatusEl.style.background = '#fee2e2';
    testStatusEl.style.color = '#b91c1c';
    testStatusEl.innerText = `❌ 測試失敗：${err.message || String(err)}`;

    saveTestResultRecord(providerId, currentModel, {
      success: false,
      supportsTools: false,
      latencyMs: 0,
      error: err.message || String(err),
      testedAt: Date.now()
    });

    updateModelSelectOptionsLabels();
    updateModelInfoCard(currentModel);
  } finally {
    clearInterval(timerInterval);
    btnTestModel.disabled = false;
    btnTestModel.innerText = '🧪 測試連線';
  }
});

// 內頁膠囊小頁籤 (Sub-tabs) 切換委派（依所屬父分頁隔離，互不干擾）
function activateSubTab(targetId, scopeEl) {
  const scope = scopeEl || document;
  scope.querySelectorAll('.sub-tab-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-subtab') === targetId);
  });
  scope.querySelectorAll('.subtab-content').forEach(c => {
    c.classList.toggle('active', c.id === targetId);
  });
  if (targetId === 'subtab-data') {
    updateDataManagementUI();
  } else if (targetId === 'subtab-quota') {
    updateQuotaUI();
  } else if (targetId === 'subtab-chat-ui') {
    updateChatSizeInfoBanner();
  }
}

document.querySelectorAll('.sub-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const parentTab = btn.closest('.tab-content') || document;
    const targetId = btn.getAttribute('data-subtab');
    activateSubTab(targetId, parentTab);
  });
});

// 🔍 即時跨分頁搜尋設定 (Settings Live Search)
function initSettingsSearch() {
  const searchInput = document.getElementById('settings-search-input');
  const clearBtn = document.getElementById('btn-clear-search');
  const statusBar = document.getElementById('search-status-bar');
  const statusText = document.getElementById('search-status-text');
  const exitBtn = document.getElementById('btn-exit-search');
  const emptyState = document.getElementById('search-empty-state');

  if (!searchInput) return;

  const allSections = Array.from(document.querySelectorAll('.tab-content .section'));

  function navigateToSection(sectionEl) {
    if (!sectionEl) return;
    // 離開搜尋模式並切換至對應頂層分頁與子分頁
    searchInput.value = '';
    applySearch('');

    const parentTab = sectionEl.closest('.tab-content');
    if (parentTab && parentTab.id) {
      activateTab(parentTab.id);
    }
    const parentSubTab = sectionEl.closest('.subtab-content');
    if (parentSubTab && parentSubTab.id) {
      activateSubTab(parentSubTab.id, parentTab || document);
    }

    if (typeof sectionEl.scrollIntoView === 'function') {
      sectionEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    sectionEl.classList.remove('section-jump-highlight');
    // 觸發重排以重播動畫
    void sectionEl.offsetWidth;
    sectionEl.classList.add('section-jump-highlight');
    setTimeout(() => sectionEl.classList.remove('section-jump-highlight'), 1200);
  }

  // 為每個設定區塊準備可點擊的來源位置標籤（僅在搜尋模式顯示）
  allSections.forEach(section => {
    const locationPath = section.getAttribute('data-search-path') || '';
    if (!locationPath || section.querySelector('.search-location-chip')) return;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'search-location-chip';
    chip.title = '點擊離開搜尋並定位至此分頁';
    chip.innerText = `📍 ${locationPath}  ↗`;
    chip.addEventListener('click', () => navigateToSection(section));
    section.insertBefore(chip, section.firstChild);
  });

  function applySearch(rawQuery) {
    const query = String(rawQuery || '').trim().toLowerCase();
    const tokens = query ? query.split(/\s+/).filter(Boolean) : [];

    if (tokens.length === 0) {
      document.body.classList.remove('is-searching');
      allSections.forEach(s => s.classList.remove('search-match'));
      if (clearBtn) clearBtn.style.display = 'none';
      if (statusBar) statusBar.style.display = 'none';
      if (emptyState) emptyState.style.display = 'none';
      return;
    }

    document.body.classList.add('is-searching');
    if (clearBtn) clearBtn.style.display = 'inline-flex';
    if (statusBar) statusBar.style.display = 'flex';

    let matchCount = 0;
    let matchedData = false;
    let matchedQuota = false;
    let matchedChatUi = false;

    allSections.forEach(section => {
      const keywords = (section.getAttribute('data-search-keywords') || '').toLowerCase();
      const locPath = (section.getAttribute('data-search-path') || '').toLowerCase();
      const visibleText = (section.textContent || '').toLowerCase();
      const haystack = `${keywords} ${locPath} ${visibleText}`;

      const isMatch = tokens.every(token => haystack.includes(token));
      section.classList.toggle('search-match', isMatch);

      if (isMatch) {
        matchCount += 1;
        if (section.closest('#subtab-data')) matchedData = true;
        if (section.closest('#subtab-quota')) matchedQuota = true;
        if (section.closest('#subtab-chat-ui')) matchedChatUi = true;
      }
    });

    if (matchedData) updateDataManagementUI();
    if (matchedQuota) updateQuotaUI();
    if (matchedChatUi) updateChatSizeInfoBanner();

    if (statusText) {
      statusText.innerText = matchCount > 0
        ? `找到 ${matchCount} 個相關設定（可直接調整，或點位置標籤前往分頁）`
        : '找不到符合條件的設定';
    }
    if (emptyState) {
      emptyState.style.display = matchCount === 0 ? 'block' : 'none';
    }
  }

  searchInput.addEventListener('input', () => {
    applySearch(searchInput.value);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      applySearch('');
      searchInput.blur();
    }
  });

  clearBtn?.addEventListener('click', () => {
    searchInput.value = '';
    applySearch('');
    searchInput.focus();
  });

  exitBtn?.addEventListener('click', () => {
    searchInput.value = '';
    applySearch('');
  });

  // 支援 Ctrl+F 快速聚焦搜尋列
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });
}

initSettingsSearch();

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileSizeSafe(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.statSync(filePath).size;
    }
  } catch (_) {}
  return 0;
}

function escapeHtmlBasic(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function updateDataManagementUI() {
  const listEl = document.getElementById('test-history-list');
  const countBadge = document.getElementById('test-records-count-badge');
  const records = modelCache.getAllTestResults();

  if (countBadge) {
    countBadge.innerText = `${records.length} 筆紀錄`;
  }

  if (listEl) {
    if (records.length === 0) {
      listEl.innerHTML = '<div class="test-history-empty">尚無連線測試紀錄。請至「模型 API」分頁點擊「🧪 測試連線」。</div>';
    } else {
      listEl.innerHTML = records.map(rec => {
        const d = new Date(rec.testedAt || Date.now());
        const timeStr = `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        let cls = 'error';
        let statusLabel = '❌ 失敗';
        if (rec.success && rec.supportsTools) {
          cls = 'success';
          statusLabel = `✅ 可用 (${rec.latencyMs}ms)`;
        } else if (rec.success && !rec.supportsTools) {
          cls = 'warning';
          statusLabel = `⚠️ 無工具 (${rec.latencyMs}ms)`;
        }
        const errHtml = (!rec.success && rec.error)
          ? `<div class="test-history-err">${escapeHtmlBasic(rec.error)}</div>`
          : '';
        return `
          <div class="test-history-item ${cls}">
            <div class="test-history-top">
              <span class="test-history-model" title="${escapeHtmlBasic(rec.modelId)}">${escapeHtmlBasic(rec.modelId)}</span>
              <span class="test-history-provider">${escapeHtmlBasic(rec.providerId)}</span>
            </div>
            <div class="test-history-meta">
              <span>${statusLabel}</span>
              <span>🕒 ${timeStr}</span>
            </div>
            ${errHtml}
          </div>
        `;
      }).join('');
    }
  }

  // 更新本地資料檔案大小與統計
  const cacheStats = modelCache.getCacheStats();
  const statModelCache = document.getElementById('stat-model-cache');
  if (statModelCache) {
    statModelCache.innerText = `測試紀錄 ${cacheStats.testCount} 筆 / 快取 ${cacheStats.totalCachedModels} 個模型 (${formatBytes(cacheStats.sizeBytes)})`;
  }

  const statChatHistory = document.getElementById('stat-chat-history');
  if (statChatHistory) {
    const histSize = getFileSizeSafe(historyPath);
    statChatHistory.innerText = histSize > 0 ? `檔案大小：${formatBytes(histSize)}` : '目前無對話紀錄 (0 B)';
  }

  const statUsage = document.getElementById('stat-usage-data');
  if (statUsage) {
    const uData = loadUsageData();
    const uSize = getFileSizeSafe(usagePath);
    statUsage.innerText = `累計 ${uData.totalRequests || 0} 次請求 / ${Number(uData.totalTokens || 0).toLocaleString()} Tokens (${formatBytes(uSize)})`;
  }

  const statLogs = document.getElementById('stat-app-logs');
  if (statLogs) {
    const logPath = path.join(logDir, 'app.log');
    const logSize = getFileSizeSafe(logPath);
    statLogs.innerText = logSize > 0 ? `日誌大小：${formatBytes(logSize)}` : '目前無日誌檔案 (0 B)';
  }
}

document.getElementById('btn-refresh-data-stats')?.addEventListener('click', () => {
  updateDataManagementUI();
  const btn = document.getElementById('btn-refresh-data-stats');
  if (btn) {
    const orig = btn.innerText;
    btn.innerText = '✅ 已更新';
    setTimeout(() => { btn.innerText = orig; }, 900);
  }
});

document.getElementById('btn-clear-test-results')?.addEventListener('click', () => {
  if (!confirm('確定要清除所有模型的「連線測試紀錄」嗎？（不會影響您的 API Key 與設定）')) return;
  modelCache.clearTestResults();
  if (petState.settings && petState.settings.modelTestResults) {
    delete petState.settings.modelTestResults;
  }
  updateModelSelectOptionsLabels();
  updateModelInfoCard(getEffectiveModelId());
  updateDataManagementUI();
  alert('✅ 已清除所有連線測試紀錄！');
});

document.getElementById('btn-clear-model-cache')?.addEventListener('click', () => {
  if (!confirm('確定要清除本機快取的「模型清單」嗎？下次點擊「重新整理」會重新向 API 抓取最新清單。')) return;
  modelCache.clearModelsCache();
  populateDefaultModelsForProvider(getActiveProviderId(), getEffectiveModelId());
  updateModelSelectOptionsLabels();
  updateModelInfoCard(getEffectiveModelId());
  updateDataManagementUI();
  alert('✅ 已清除模型清單快取！');
});

document.getElementById('btn-clear-all-model-cache')?.addEventListener('click', () => {
  if (!confirm('確定要同時清除所有「模型清單快取」與「連線測試紀錄」嗎？')) return;
  modelCache.clearAllCache();
  if (petState.settings && petState.settings.modelTestResults) {
    delete petState.settings.modelTestResults;
  }
  populateDefaultModelsForProvider(getActiveProviderId(), getEffectiveModelId());
  updateModelSelectOptionsLabels();
  updateModelInfoCard(getEffectiveModelId());
  updateDataManagementUI();
  alert('✅ 已清空所有模型快取與測試紀錄！');
});

document.getElementById('btn-clear-chat-history')?.addEventListener('click', () => {
  if (!confirm('確定要永久清除所有「加密對話歷史紀錄」嗎？此操作無法復原。')) return;
  try {
    const encryptedEmpty = cryptoUtils.encryptData('[]');
    fs.writeFileSync(historyPath, encryptedEmpty, 'utf8');
    ipcRenderer.send('pet-state-changed');
    updateDataManagementUI();
    alert('✅ 已清除所有對話歷史紀錄！');
  } catch (err) {
    alert('❌ 清除對話紀錄失敗：' + (err.message || String(err)));
  }
});

document.getElementById('btn-reset-usage-data')?.addEventListener('click', () => {
  if (!confirm('確定要手動重置所有「AI 用量與配額統計」嗎？（提醒：此動作會將今日與累計統計歸零）')) return;
  resetUsageData();
  updateQuotaUI();
  updateDataManagementUI();
  alert('✅ 已手動重置 AI 用量統計！');
});

document.getElementById('btn-clear-app-logs')?.addEventListener('click', () => {
  if (!confirm('確定要清空本機應用程式執行日誌 (app.log) 嗎？')) return;
  try {
    const logPath = path.join(logDir, 'app.log');
    if (fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, '', 'utf8');
    }
    updateDataManagementUI();
    alert('✅ 已清空應用程式日誌！');
  } catch (err) {
    alert('❌ 清空日誌失敗：' + (err.message || String(err)));
  }
});

document.getElementById('btn-open-data-dir')?.addEventListener('click', () => {
  if (shell && typeof shell.openPath === 'function') {
    shell.openPath(dataDir);
  }
});

function updateQuotaUI() {
  const providerId = getActiveProviderId();
  const currentModel = getEffectiveModelId() || 'gemini-3.5-flash-lite';
  const summary = getUsageSummary(currentModel, providerId);
  const reset = summary.resetInfo;

  const modelTargetEl = document.getElementById('quota-model-target');
  if (modelTargetEl) {
    modelTargetEl.innerText = `【${currentModel}】今日請求`;
  }

  const reqText = document.getElementById('quota-req-text');
  const progressBar = document.getElementById('quota-progress-bar');
  const resetTime = document.getElementById('quota-reset-time');
  const countdown = document.getElementById('quota-reset-countdown');
  const todayTokens = document.getElementById('quota-today-tokens');
  const totalTokens = document.getElementById('quota-total-tokens');
  const badge = document.getElementById('quota-status-badge');

  if (reqText) {
    reqText.innerText = summary.isUnlimited
      ? `${summary.todayRequests} 次（本機無上限）`
      : `${summary.todayRequests} / ${summary.limitRPD} 次 (剩餘 ${summary.remainingRequests})`;
  }

  if (progressBar) {
    progressBar.style.width = summary.isUnlimited ? '0%' : `${summary.percentUsed}%`;
    progressBar.className = 'quota-progress-fill';
    if (!summary.isUnlimited) {
      if (summary.percentUsed >= 90) progressBar.classList.add('danger');
      else if (summary.percentUsed >= 70) progressBar.classList.add('warning');
    }
  }

  if (resetTime) {
    resetTime.innerText = `每日 ${reset.resetTimeStr}`;
  }

  if (countdown) {
    countdown.innerText = `倒數 ${reset.remainingHours} 小時 ${reset.remainingMinutes} 分`;
  }

  if (todayTokens) {
    todayTokens.innerText = Number(summary.todayTokens).toLocaleString();
  }

  if (totalTokens) {
    totalTokens.innerText = `累計 ${Number(summary.totalTokens).toLocaleString()}`;
  }

  if (badge) {
    if (summary.isUnlimited) {
      badge.className = 'quota-badge safe';
      badge.innerText = `本機離線 (${summary.minuteRequests} RPM)`;
    } else if (summary.isRateLimitClose) {
      badge.className = 'quota-badge warning';
      badge.innerText = `頻率高 (${summary.minuteRequests}/${summary.limitRPM} RPM)`;
    } else {
      badge.className = 'quota-badge safe';
      badge.innerText = `正常 (${summary.minuteRequests}/${summary.limitRPM} RPM)`;
    }
  }
}

document.getElementById('btn-refresh-quota')?.addEventListener('click', () => {
  updateQuotaUI();
  const btn = document.getElementById('btn-refresh-quota');
  if (btn) {
    const orig = btn.innerText;
    btn.innerText = '✅ 已更新';
    setTimeout(() => { btn.innerText = orig; }, 1000);
  }
});

document.getElementById('btn-open-aistudio')?.addEventListener('click', () => {
  const providerId = getActiveProviderId();
  if (providerId === 'gemini') {
    shell.openExternal('https://aistudio.google.com/app/plan_and_billing');
  } else {
    const preset = AIProviderFactory.getPreset(providerId);
    if (preset.keyUrl) shell.openExternal(preset.keyUrl);
  }
});

function updateLabels() {
  vals.bedX.innerText = els.bedX.value + 'px';
  vals.bedY.innerText = els.bedY.value + 'px';
  vals.bedScale.innerText = els.bedScale.value + 'px';
  vals.animSpeed.innerText = parseFloat(els.animSpeed.value).toFixed(1) + 'x';
  if (vals.chatWidth && els.chatWidth) vals.chatWidth.innerText = els.chatWidth.value + 'px';
  if (vals.chatHeight && els.chatHeight) vals.chatHeight.innerText = els.chatHeight.value + 'px';
}

function checkDirty() {
  const s = petState.settings;
  const current = getFormValues();
  const hasChanged = (
    current.bedX !== (s.bedX ?? defaultSettings.bedX) ||
    current.bedY !== (s.bedY ?? defaultSettings.bedY) ||
    current.bedScale !== (s.bedScale ?? defaultSettings.bedScale) ||
    current.bedZ !== (s.bedZ ?? defaultSettings.bedZ) ||
    current.animSpeed !== (s.animSpeed ?? defaultSettings.animSpeed) ||
    current.chatSizeMode !== (s.chatSizeMode ?? defaultSettings.chatSizeMode) ||
    (current.chatSizeMode === 'manual' && (
      current.chatWidth !== (s.chatWidth ?? defaultSettings.chatWidth) ||
      current.chatHeight !== (s.chatHeight ?? defaultSettings.chatHeight)
    )) ||
    current.aiProvider !== (s.aiProvider ?? defaultSettings.aiProvider) ||
    current.apiKey !== (s.apiKey ?? defaultSettings.apiKey) ||
    current.aiBaseUrl !== (s.aiBaseUrl ?? defaultSettings.aiBaseUrl) ||
    current.aiModel !== (s.aiModel ?? defaultSettings.aiModel) ||
    current.thinkingLevel !== (s.thinkingLevel ?? defaultSettings.thinkingLevel) ||
    current.aiScenario !== (s.aiScenario ?? defaultSettings.aiScenario) ||
    current.aiCustomScenario !== (s.aiCustomScenario ?? defaultSettings.aiCustomScenario) ||
    current.aiPersonality !== (s.aiPersonality ?? defaultSettings.aiPersonality) ||
    current.aiCustomPrompt !== (s.aiCustomPrompt ?? defaultSettings.aiCustomPrompt) ||
    current.contextTimeout !== (s.contextTimeout ?? defaultSettings.contextTimeout) ||
    current.summonShortcut !== (s.summonShortcut ?? defaultSettings.summonShortcut) ||
    current.enableClipboard !== (s.enableClipboard ?? defaultSettings.enableClipboard) ||
    current.enableClipboardSmartWatch !== (s.enableClipboardSmartWatch ?? defaultSettings.enableClipboardSmartWatch) ||
    current.enableAlarmStalking !== (s.enableAlarmStalking ?? defaultSettings.enableAlarmStalking) ||
    current.alarmStalkingDelay !== (s.alarmStalkingDelay ?? defaultSettings.alarmStalkingDelay) ||
    current.enableAlarmSound !== (s.enableAlarmSound ?? defaultSettings.enableAlarmSound)
  );
  setDirty(hasChanged);
}

function setDirty(dirty) {
  isDirty = dirty;
  const dirtyStatus = document.getElementById('dirty-status');
  if (dirtyStatus) {
    dirtyStatus.style.visibility = isDirty ? 'visible' : 'hidden';
  }
}

function getFormValues() {
  const providerId = getActiveProviderId();
  snapshotCurrentProviderInputs(providerId);
  return {
    bedX: parseInt(els.bedX.value),
    bedY: parseInt(els.bedY.value),
    bedScale: parseInt(els.bedScale.value),
    bedZ: parseInt(els.bedZ.value),
    animSpeed: parseFloat(els.animSpeed.value),
    chatSizeMode: els.chatSizeMode ? els.chatSizeMode.value : 'auto',
    chatWidth: els.chatWidth ? parseInt(els.chatWidth.value, 10) : defaultSettings.chatWidth,
    chatHeight: els.chatHeight ? parseInt(els.chatHeight.value, 10) : defaultSettings.chatHeight,
    aiProvider: providerId,
    apiKey: els.apiKey.value.trim(),
    aiBaseUrl: els.baseUrl ? els.baseUrl.value.trim() : '',
    aiModel: getEffectiveModelId(),
    providerConfigs: JSON.parse(JSON.stringify(workingProviderConfigs)),
    thinkingLevel: els.thinkingLevel ? els.thinkingLevel.value : 'medium',
    aiScenario: els.aiScenario ? els.aiScenario.value : 'general',
    aiCustomScenario: els.aiCustomScenario ? els.aiCustomScenario.value.trim() : '',
    aiPersonality: els.aiPersonality.value,
    aiCustomPrompt: els.aiCustomPrompt.value.trim(),
    contextTimeout: parseInt(els.contextTimeout.value, 10),
    summonShortcut: els.summonShortcut.value.trim(),
    enableClipboard: Boolean(els.enableClipboard.checked),
    enableClipboardSmartWatch: Boolean(els.enableClipboardSmartWatch.checked),
    enableAlarmStalking: Boolean(els.enableAlarmStalking.checked),
    alarmStalkingDelay: parseInt(els.alarmStalkingDelay.value, 10) || 15,
    enableAlarmSound: Boolean(els.enableAlarmSound.checked)
  };
}

// 即時預覽廣播（不寫入硬碟）
function previewBroadcast() {
  const values = getFormValues();
  ipcRenderer.send('settings-preview', values);
}

function saveSettings() {
  const formValues = getFormValues();
  petState.settings = {
    ...(petState.settings || {}),
    ...formValues
  };
  fs.writeFileSync(statePath, JSON.stringify(petState, null, 2));
  ipcRenderer.send('settings-changed', petState.settings);
  setDirty(false);
}

function revertSettings() {
  try {
    if (fs.existsSync(statePath)) {
      const savedState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      if (savedState.settings) {
        if (savedState.settings.summonShortcut) {
          savedState.settings.summonShortcut = savedState.settings.summonShortcut.replace(/CommandOrControl/g, 'Ctrl');
        }
        petState.settings = savedState.settings;
      }
    }
  } catch (e) {}
  initUI();
  ipcRenderer.send('settings-changed', petState.settings);
  setDirty(false);
}

const THINKING_LABEL_MAP = {
  low: 'Low (輕量快速，最多 3 輪)',
  medium: 'Medium (平衡模式，最多 5 輪)',
  high: 'High (深度推理，最多 10 輪)'
};

function updateCustomScenarioCount() {
  const countEl = document.getElementById('custom-scenario-count');
  if (countEl && els.aiCustomScenario) {
    countEl.innerText = `${els.aiCustomScenario.value.length} / 200 字`;
  }
}

function updateScenarioUI(scenarioId = 'general') {
  const preset = getScenarioPreset(scenarioId);
  if (els.aiScenario) els.aiScenario.value = preset.id;

  document.querySelectorAll('.scenario-card').forEach(card => {
    card.classList.toggle('active', card.dataset.scenario === preset.id);
  });

  const customGroup = document.getElementById('custom-scenario-group');
  if (customGroup) {
    customGroup.style.display = preset.id === 'custom' ? 'block' : 'none';
  }
  updateCustomScenarioCount();

  const titleEl = document.getElementById('scenario-detail-title');
  const tagsEl = document.getElementById('scenario-detail-tags');
  const descEl = document.getElementById('scenario-detail-desc');
  const styleEl = document.getElementById('scenario-detail-style');
  const clipEl = document.getElementById('scenario-detail-clipboard');
  const thinkEl = document.getElementById('scenario-detail-thinking');
  const applyThinkBtn = document.getElementById('btn-apply-scenario-thinking');

  if (titleEl) titleEl.innerText = `${preset.icon} ${preset.name}`;
  if (tagsEl) {
    tagsEl.innerHTML = (preset.tags || [])
      .map(tag => `<span class="scenario-tag">${escapeHtmlBasic(tag)}</span>`)
      .join('');
  }
  if (descEl) descEl.innerText = preset.shortDesc;
  if (styleEl) styleEl.innerText = preset.responseStyle;
  if (clipEl) clipEl.innerText = preset.clipboardFocus;
  if (thinkEl) {
    const rec = preset.recommendedThinking || 'medium';
    thinkEl.innerText = `🧠 推薦思考層級：${THINKING_LABEL_MAP[rec] || rec}`;
  }
  if (applyThinkBtn) {
    const currentThink = els.thinkingLevel ? els.thinkingLevel.value : 'medium';
    const isMatched = currentThink === (preset.recommendedThinking || 'medium');
    applyThinkBtn.innerText = isMatched ? '✅ 已套用' : '套用推薦層級';
    applyThinkBtn.disabled = isMatched;
  }
}

document.querySelectorAll('.scenario-card').forEach(card => {
  card.addEventListener('click', () => {
    const nextScenario = card.dataset.scenario || 'general';
    updateScenarioUI(nextScenario);
    checkDirty();
    previewBroadcast();
  });
});

document.getElementById('btn-apply-scenario-thinking')?.addEventListener('click', () => {
  const preset = getScenarioPreset(els.aiScenario ? els.aiScenario.value : 'general');
  if (els.thinkingLevel && preset.recommendedThinking) {
    els.thinkingLevel.value = preset.recommendedThinking;
    updateScenarioUI(preset.id);
    checkDirty();
    previewBroadcast();
  }
});

// 監聽變更
Object.keys(els).forEach(key => {
  if (key === 'summonShortcut' || key === 'aiProvider' || key === 'aiScenario' || !els[key]) {
    return; // 獨立處理
  }
  els[key].addEventListener('input', () => {
    if (key === 'aiPersonality') {
      document.getElementById('custom-personality-group').style.display = els.aiPersonality.value === 'custom' ? 'block' : 'none';
    }
    if (key === 'aiCustomScenario') {
      updateCustomScenarioCount();
    }
    if (key === 'thinkingLevel') {
      updateScenarioUI(els.aiScenario ? els.aiScenario.value : 'general');
    }
    if (key === 'chatWidth' || key === 'chatHeight') {
      if (els.chatSizeMode && els.chatSizeMode.value !== 'manual') {
        els.chatSizeMode.value = 'manual';
      }
      updateChatSizeInfoBanner();
    }
    if (key === 'chatSizeMode') {
      if (els.chatSizeMode.value === 'auto') {
        const display = getDetectedDisplaySize();
        const rec = getAdaptiveChatSize(display.width, display.height);
        if (els.chatWidth) els.chatWidth.value = rec.width;
        if (els.chatHeight) els.chatHeight.value = rec.height;
      }
      updateChatSizeInfoBanner();
    }
    if (key === 'customModel') {
      updateQuotaUI();
      updateModelInfoCard(getEffectiveModelId());
    }
    updateLabels();
    checkDirty();
    previewBroadcast(); // 即時預覽
  });
});

if (els.aiProvider) {
  els.aiProvider.addEventListener('change', () => {
    // 切換前先保存原服務商已填寫的金鑰、端點與模型
    snapshotCurrentProviderInputs(activeProviderId);
    const nextProviderId = els.aiProvider.value;
    applyProviderUI(nextProviderId, { loadSavedValues: true });
    if (testStatusEl) testStatusEl.style.display = 'none';
    updateModelSelectOptionsLabels();
    updateModelInfoCard(getEffectiveModelId());
    updateQuotaUI();
    checkDirty();
    previewBroadcast();
    if (modelCache.getCachedModels(nextProviderId).length === 0) {
      refreshModels(true);
    }
  });
}

els.enableClipboard.addEventListener('change', () => {
  checkDirty();
  previewBroadcast();
});

els.enableClipboardSmartWatch.addEventListener('change', () => {
  checkDirty();
  previewBroadcast();
});

els.enableAlarmStalking.addEventListener('change', () => {
  checkDirty();
  previewBroadcast();
});

els.enableAlarmSound.addEventListener('change', () => {
  checkDirty();
  previewBroadcast();
});

els.aiModel.addEventListener('change', () => {
  if (els.customModel && els.customModel.value.trim()) {
    els.customModel.value = '';
  }
  updateQuotaUI();
  updateModelInfoCard(getEffectiveModelId());
});

let prevShortcut = '';
els.summonShortcut.addEventListener('focus', () => {
  prevShortcut = els.summonShortcut.value;
  els.summonShortcut.value = '請按下快捷鍵...';
  els.summonShortcut.style.backgroundColor = '#e3f2fd';
  els.summonShortcut.style.color = '#1976d2';
});

els.summonShortcut.addEventListener('blur', () => {
  if (els.summonShortcut.value === '請按下快捷鍵...') {
    els.summonShortcut.value = prevShortcut;
  }
  els.summonShortcut.style.backgroundColor = '#f5f5f5';
  els.summonShortcut.style.color = '';
});

els.summonShortcut.addEventListener('keydown', (e) => {
  e.preventDefault();
  const key = e.key;
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
    return;
  }
  if (key === 'Backspace' || key === 'Escape') {
    els.summonShortcut.value = '';
  } else {
    const modifiers = [];
    if (e.ctrlKey || e.metaKey) modifiers.push('Ctrl');
    if (e.altKey) modifiers.push('Alt');
    if (e.shiftKey) modifiers.push('Shift');
    
    let electronKey = key.length === 1 ? key.toUpperCase() : key;
    if (electronKey === ' ') electronKey = 'Space';
    // Electron's globalShortcut formatting expects specific key names, but single chars work fine.
    
    if (modifiers.length > 0) {
      els.summonShortcut.value = modifiers.join('+') + '+' + electronKey;
    } else {
      els.summonShortcut.value = electronKey;
    }
  }
  updateLabels();
  checkDirty();
  previewBroadcast();
});

document.getElementById('btn-reset-shortcut').addEventListener('click', () => {
  els.summonShortcut.value = defaultSettings.summonShortcut;
  updateLabels();
  checkDirty();
  previewBroadcast();
});

// 3. 床鋪編輯模式開關
const btnToggleBedEdit = document.getElementById('btn-toggle-bed-edit');
const bedEditTip = document.getElementById('bed-edit-tip');

btnToggleBedEdit.addEventListener('click', () => {
  isBedEditing = !isBedEditing;
  updateBedEditUI();
  ipcRenderer.send('toggle-bed-edit', isBedEditing);
});

function updateBedEditUI() {
  const bedLockTip = document.getElementById('bed-lock-tip');
  const disabled = !isBedEditing;
  
  els.bedX.disabled = disabled;
  els.bedY.disabled = disabled;
  els.bedScale.disabled = disabled;
  els.bedZ.disabled = disabled;

  if (isBedEditing) {
    btnToggleBedEdit.innerText = '⏹️ 結束床鋪編輯模式';
    btnToggleBedEdit.classList.add('active');
    bedEditTip.style.display = 'block';
    if (bedLockTip) bedLockTip.style.display = 'none';
  } else {
    btnToggleBedEdit.innerText = '✏️ 開啟床鋪編輯模式 (小鳥坐床)';
    btnToggleBedEdit.classList.remove('active');
    bedEditTip.style.display = 'none';
    if (bedLockTip) bedLockTip.style.display = 'block';
  }
}

document.getElementById('btn-reset-chat-size')?.addEventListener('click', () => {
  const display = getDetectedDisplaySize();
  const rec = getAdaptiveChatSize(display.width, display.height);
  if (els.chatSizeMode) els.chatSizeMode.value = 'auto';
  if (els.chatWidth) els.chatWidth.value = rec.width;
  if (els.chatHeight) els.chatHeight.value = rec.height;
  updateChatSizeInfoBanner();
  updateLabels();
  checkDirty();
  previewBroadcast();
});

// 拖曳床鋪或桌面對話框縮放時收到的廣播
ipcRenderer.on('update-settings-ui', (event, data) => {
  if (data.bedX !== undefined) els.bedX.value = data.bedX;
  if (data.bedY !== undefined) els.bedY.value = data.bedY;
  if (data.bedScale !== undefined) els.bedScale.value = data.bedScale;
  if (data.chatSizeMode !== undefined && els.chatSizeMode) {
    els.chatSizeMode.value = data.chatSizeMode;
    petState.settings.chatSizeMode = data.chatSizeMode;
  }
  if (data.chatWidth !== undefined && els.chatWidth) {
    els.chatWidth.value = data.chatWidth;
    petState.settings.chatWidth = data.chatWidth;
  }
  if (data.chatHeight !== undefined && els.chatHeight) {
    els.chatHeight.value = data.chatHeight;
    petState.settings.chatHeight = data.chatHeight;
  }
  updateChatSizeInfoBanner();
  updateLabels();
  checkDirty();
});

ipcRenderer.on('display-metrics-changed', () => {
  if (els.chatSizeMode && els.chatSizeMode.value === 'auto') {
    const display = getDetectedDisplaySize();
    const rec = getAdaptiveChatSize(display.width, display.height);
    if (els.chatWidth) els.chatWidth.value = rec.width;
    if (els.chatHeight) els.chatHeight.value = rec.height;
  }
  updateChatSizeInfoBanner();
  updateLabels();
});

// 4. 按鈕行為
document.getElementById('btn-save-all').addEventListener('click', () => {
  saveSettings();
  alert('✅ 設定已成功儲存並套用！');
  if (pendingClose) {
    pendingClose = false;
    window.close();
  }
});

document.getElementById('btn-reset').addEventListener('click', () => {
  if (confirm('確定要將所有設定還原為預設值嗎？')) {
    petState.settings = { ...defaultSettings };
    initUI();
    saveSettings();
  }
});

// 5. 關於與外部連結
document.getElementById('link-github').addEventListener('click', (e) => {
  e.preventDefault();
  shell.openExternal('https://github.com/NCard/codex-pet');
});

document.getElementById('link-issues').addEventListener('click', (e) => {
  e.preventDefault();
  shell.openExternal('https://github.com/NCard/codex-pet/issues');
});

document.getElementById('btn-open-onboarding')?.addEventListener('click', () => {
  ipcRenderer.send('open-guide', 'onboarding');
});

document.getElementById('btn-open-features')?.addEventListener('click', () => {
  ipcRenderer.send('open-guide', 'features');
});

// 檢查更新
const btnCheckUpdate = document.getElementById('btn-check-update');
const updateMsg = document.getElementById('update-msg');

btnCheckUpdate.addEventListener('click', () => {
  updateMsg.style.display = 'block';
  btnCheckUpdate.disabled = true;
  btnCheckUpdate.innerText = '檢查中...';
  ipcRenderer.send('check-update-manual');
});

ipcRenderer.on('update-check-done', () => {
  updateMsg.style.display = 'none';
  btnCheckUpdate.disabled = false;
  btnCheckUpdate.innerText = '手動檢查更新';
});

// 6. 離開關閉確認 (Modal)
const confirmModal = document.getElementById('confirm-modal');
const btnModalSave = document.getElementById('btn-modal-save');
const btnModalDiscard = document.getElementById('btn-modal-discard');
const btnModalCancel = document.getElementById('btn-modal-cancel');

window.addEventListener('beforeunload', (e) => {
  if (isBedEditing) {
    ipcRenderer.send('toggle-bed-edit', false);
  }
  if (isDirty && !pendingClose) {
    e.returnValue = false; // 阻止預設關閉
    confirmModal.style.display = 'flex';
  }
});

btnModalSave.addEventListener('click', () => {
  saveSettings();
  confirmModal.style.display = 'none';
  pendingClose = true;
  window.close();
});

btnModalDiscard.addEventListener('click', () => {
  revertSettings();
  confirmModal.style.display = 'none';
  pendingClose = true;
  window.close();
});

btnModalCancel.addEventListener('click', () => {
  confirmModal.style.display = 'none';
});

initUI();
