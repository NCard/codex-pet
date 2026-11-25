const { ipcRenderer, shell, clipboard } = require('electron');
const fs = require('fs');
const { petStatePath } = require('../../utils/paths');
const { AIProviderFactory } = require('../../services/ai_provider');
const { getScenarioPreset } = require('../../utils/scenarios');
const modelCache = require('../../utils/model_cache');

const TOTAL_STEPS = 4;
let currentStep = 1;
let selectedScenario = 'general';
let petState = { settings: {} };

// 讀取版本號
try {
  const pkg = require('../../../package.json');
  const subEl = document.getElementById('guide-version-sub');
  if (subEl && pkg?.version) {
    subEl.innerText = `v${pkg.version} • 你的桌面 AI 效率與療癒夥伴 🥝`;
  }
} catch (_) {}

// 讀取現存設定
function loadCurrentState() {
  try {
    if (fs.existsSync(petStatePath)) {
      petState = JSON.parse(fs.readFileSync(petStatePath, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load petState in guide:', e);
  }
  if (!petState || typeof petState !== 'object') petState = {};
  if (!petState.settings || typeof petState.settings !== 'object') petState.settings = {};
}

const providerSelect = document.getElementById('guide-provider');
const apiKeyInput = document.getElementById('guide-apikey');
const baseUrlRow = document.getElementById('guide-baseurl-row');
const baseUrlInput = document.getElementById('guide-baseurl');
const modelInput = document.getElementById('guide-model');
const providerDescEl = document.getElementById('guide-provider-desc');
const apiKeyLabelEl = document.getElementById('guide-label-apikey');
const btnGetKey = document.getElementById('guide-btn-get-key');
const btnQuickTest = document.getElementById('guide-btn-test');
const testResultEl = document.getElementById('guide-test-result');
const clipboardCheckbox = document.getElementById('guide-enable-clipboard');

function switchMode(mode) {
  const targetMode = mode === 'features' ? 'features' : 'onboarding';
  document.querySelectorAll('.mode-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === targetMode);
  });
  document.getElementById('panel-onboarding')?.classList.toggle('active', targetMode === 'onboarding');
  document.getElementById('panel-features')?.classList.toggle('active', targetMode === 'features');
}

function syncProviderFields(providerId, { loadFromSaved = false } = {}) {
  const preset = AIProviderFactory.getPreset(providerId);
  if (providerDescEl) providerDescEl.innerText = preset.description;
  if (apiKeyLabelEl) {
    apiKeyLabelEl.innerText = preset.requiresApiKey
      ? `${preset.name.split(' ')[0]} API Key`
      : `${preset.name.split(' ')[0]} API Key (選填)`;
  }
  if (apiKeyInput) {
    apiKeyInput.placeholder = preset.keyPlaceholder || '請填寫 API Key...';
  }
  if (baseUrlRow) {
    baseUrlRow.style.display = preset.allowCustomBaseUrl ? 'flex' : 'none';
  }
  if (btnGetKey) {
    btnGetKey.style.display = preset.keyUrl ? 'inline-block' : 'none';
  }

  const savedCfg = petState.settings?.providerConfigs?.[preset.id] || {};
  if (loadFromSaved) {
    if (apiKeyInput) {
      apiKeyInput.value = savedCfg.apiKey || (preset.id === (petState.settings.aiProvider || 'gemini') ? (petState.settings.apiKey || '') : '');
    }
    if (baseUrlInput) {
      baseUrlInput.value = savedCfg.baseUrl || preset.baseUrl || '';
    }
    if (modelInput) {
      modelInput.value = savedCfg.model || (preset.id === (petState.settings.aiProvider || 'gemini') ? (petState.settings.aiModel || preset.defaultModel) : preset.defaultModel) || '';
    }
  } else {
    if (apiKeyInput) apiKeyInput.value = savedCfg.apiKey || '';
    if (baseUrlInput) baseUrlInput.value = savedCfg.baseUrl || preset.baseUrl || '';
    if (modelInput) modelInput.value = savedCfg.model || preset.defaultModel || '';
  }

  if (testResultEl) testResultEl.style.display = 'none';
}

function updateScenarioCards(scenarioId) {
  const preset = getScenarioPreset(scenarioId);
  selectedScenario = preset.id;
  document.querySelectorAll('.guide-scenario-card').forEach(card => {
    card.classList.toggle('active', card.dataset.scenario === selectedScenario);
  });
}

function updateSummaryChips() {
  const chipsEl = document.getElementById('guide-summary-chips');
  if (!chipsEl) return;
  const providerId = providerSelect ? providerSelect.value : 'gemini';
  const preset = AIProviderFactory.getPreset(providerId);
  const scenarioPreset = getScenarioPreset(selectedScenario);
  const modelVal = (modelInput?.value || '').trim() || preset.defaultModel || '未指定';
  const hasKey = Boolean(apiKeyInput?.value.trim()) || !preset.requiresApiKey;
  const clipEnabled = Boolean(clipboardCheckbox?.checked);

  chipsEl.innerHTML = [
    `🤖 ${preset.name.split(' ')[0]}（${modelVal}）`,
    hasKey ? '🔑 已就緒' : '⏳ 金鑰稍後補填',
    `${scenarioPreset.icon} ${scenarioPreset.name}模式`,
    clipEnabled ? '💡 智慧剪貼簿：已開啟' : '🛡️ 智慧剪貼簿：關閉（隱私預設）'
  ].map(text => `<span class="summary-chip">${text}</span>`).join('');
}

function goToStep(stepNum) {
  currentStep = Math.max(1, Math.min(TOTAL_STEPS, stepNum));

  document.querySelectorAll('.step-pane').forEach(pane => {
    pane.classList.toggle('active', parseInt(pane.dataset.step, 10) === currentStep);
  });

  document.querySelectorAll('.step-pill').forEach(pill => {
    const num = parseInt(pill.dataset.step, 10);
    pill.classList.toggle('active', num === currentStep);
    pill.classList.toggle('done', num < currentStep);
  });

  const btnPrev = document.getElementById('btn-step-prev');
  const btnNext = document.getElementById('btn-step-next');
  const btnFinish = document.getElementById('btn-step-finish');

  if (btnPrev) btnPrev.style.display = currentStep > 1 ? 'inline-block' : 'none';
  if (btnNext) btnNext.style.display = currentStep < TOTAL_STEPS ? 'inline-block' : 'none';
  if (btnFinish) btnFinish.style.display = currentStep === TOTAL_STEPS ? 'inline-block' : 'none';

  if (currentStep === TOTAL_STEPS) {
    updateSummaryChips();
  }
}

function markOnboardingCompleted({ saveWizardSettings = false } = {}) {
  loadCurrentState();
  petState.onboardingCompleted = true;

  if (saveWizardSettings) {
    const providerId = providerSelect ? providerSelect.value : 'gemini';
    const preset = AIProviderFactory.getPreset(providerId);
    const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
    const baseUrl = baseUrlInput ? baseUrlInput.value.trim() : (preset.baseUrl || '');
    const model = (modelInput ? modelInput.value.trim() : '') || preset.defaultModel || 'gemini-3.5-flash-lite';
    const scenarioPreset = getScenarioPreset(selectedScenario);

    if (!petState.settings.providerConfigs || typeof petState.settings.providerConfigs !== 'object') {
      petState.settings.providerConfigs = {};
    }
    petState.settings.providerConfigs[providerId] = {
      ...(petState.settings.providerConfigs[providerId] || {}),
      apiKey,
      baseUrl,
      model
    };

    petState.settings.aiProvider = providerId;
    petState.settings.apiKey = apiKey;
    petState.settings.aiBaseUrl = baseUrl;
    petState.settings.aiModel = model;
    petState.settings.aiScenario = scenarioPreset.id;
    petState.settings.thinkingLevel = petState.settings.thinkingLevel || scenarioPreset.recommendedThinking || 'medium';

    if (clipboardCheckbox && clipboardCheckbox.checked) {
      petState.settings.enableClipboard = true;
      petState.settings.enableClipboardSmartWatch = true;
    }
  }

  try {
    fs.writeFileSync(petStatePath, JSON.stringify(petState, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save onboarding state:', e);
  }

  ipcRenderer.send('settings-changed', petState.settings);
  ipcRenderer.send('onboarding-completed', { saved: saveWizardSettings });
}

// 初始化畫面與事件綁定
loadCurrentState();

const initProvider = (petState.settings.aiProvider || 'gemini').toLowerCase();
if (providerSelect) providerSelect.value = initProvider;
syncProviderFields(initProvider, { loadFromSaved: true });

updateScenarioCards(petState.settings.aiScenario || 'general');
if (clipboardCheckbox) {
  clipboardCheckbox.checked = Boolean(petState.settings.enableClipboard && petState.settings.enableClipboardSmartWatch);
}

// 依據 URL 查詢參數切換初始模式 (?mode=features 或 ?mode=onboarding)
const urlParams = new URLSearchParams(window.location.search);
const initialMode = urlParams.get('mode') || 'onboarding';
switchMode(initialMode);
goToStep(1);

// 頂部模式分頁切換
document.querySelectorAll('.mode-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchMode(btn.dataset.mode));
});

// 監聽主程序動態切換模式（例如視窗已開啟時點擊另一個入口）
ipcRenderer.on('switch-guide-mode', (_event, mode) => {
  switchMode(mode);
  if (mode === 'onboarding') goToStep(1);
});

// 步驟列點擊
document.querySelectorAll('.step-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    goToStep(parseInt(pill.dataset.step, 10));
  });
});

document.getElementById('btn-step-prev')?.addEventListener('click', () => goToStep(currentStep - 1));
document.getElementById('btn-step-next')?.addEventListener('click', () => goToStep(currentStep + 1));

document.getElementById('btn-step-skip')?.addEventListener('click', () => {
  markOnboardingCompleted({ saveWizardSettings: false });
  window.close();
});

document.getElementById('btn-step-finish')?.addEventListener('click', () => {
  markOnboardingCompleted({ saveWizardSettings: true });
  window.close();
});

document.getElementById('guide-btn-go-features')?.addEventListener('click', () => {
  markOnboardingCompleted({ saveWizardSettings: true });
  switchMode('features');
});

// Provider 切換
providerSelect?.addEventListener('change', () => {
  syncProviderFields(providerSelect.value, { loadFromSaved: false });
});

btnGetKey?.addEventListener('click', () => {
  const preset = AIProviderFactory.getPreset(providerSelect?.value || 'gemini');
  if (preset.keyUrl) shell.openExternal(preset.keyUrl);
});

// 快速連線測試
btnQuickTest?.addEventListener('click', async () => {
  const providerId = providerSelect ? providerSelect.value : 'gemini';
  const preset = AIProviderFactory.getPreset(providerId);
  const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
  const baseUrl = (baseUrlInput ? baseUrlInput.value.trim() : '') || preset.baseUrl || '';
  const model = (modelInput ? modelInput.value.trim() : '') || preset.defaultModel || '';

  if (preset.requiresApiKey && !apiKey) {
    alert(`請先填寫 ${preset.name} 的 API Key 才能測試連線！`);
    return;
  }
  if (!model) {
    alert('請先填寫要測試的模型 ID！');
    return;
  }

  btnQuickTest.disabled = true;
  btnQuickTest.innerText = '測試中...';
  if (testResultEl) {
    testResultEl.style.display = 'block';
    testResultEl.style.background = '#f1f5f9';
    testResultEl.style.color = '#475569';
    testResultEl.innerText = `正在測試 ${model} 連線與工具支援...`;
  }

  try {
    const provider = AIProviderFactory.create(providerId, apiKey, model, { baseUrl });
    const result = await provider.testModelAvailability(model, 10000);
    if (result.success) {
      testResultEl.style.background = '#dcfce7';
      testResultEl.style.color = '#15803d';
      testResultEl.innerText = `✅ 連線成功 (${result.latencyMs}ms)！模型已就緒並支援工具呼叫。`;
    } else {
      testResultEl.style.background = '#fee2e2';
      testResultEl.style.color = '#b91c1c';
      testResultEl.innerText = `❌ 測試失敗：${result.error}`;
    }
    modelCache.saveTestResult(providerId, model, {
      success: Boolean(result.success),
      supportsTools: Boolean(result.supportsTools),
      latencyMs: result.latencyMs,
      error: result.error || null,
      testedAt: Date.now()
    });
  } catch (err) {
    if (testResultEl) {
      testResultEl.style.background = '#fee2e2';
      testResultEl.style.color = '#b91c1c';
      testResultEl.innerText = `❌ 測試失敗：${err.message || String(err)}`;
    }
  } finally {
    btnQuickTest.disabled = false;
    btnQuickTest.innerText = '🧪 快速測試';
  }
});

// 情境卡片選擇
document.querySelectorAll('.guide-scenario-card').forEach(card => {
  card.addEventListener('click', () => {
    updateScenarioCards(card.dataset.scenario);
  });
});

// 範例對話點擊複製
document.querySelectorAll('.try-item').forEach(item => {
  item.addEventListener('click', () => {
    const text = item.dataset.prompt || '';
    if (text && clipboard) {
      clipboard.writeText(text);
      const origBg = item.style.background;
      item.style.background = '#dcfce7';
      setTimeout(() => { item.style.background = origBg; }, 600);
    }
  });
});

// 功能介紹頁底部按鈕
document.getElementById('btn-features-open-settings')?.addEventListener('click', () => {
  ipcRenderer.send('open-settings');
});

document.getElementById('btn-features-restart-onboarding')?.addEventListener('click', () => {
  switchMode('onboarding');
  goToStep(1);
});

document.getElementById('btn-features-close')?.addEventListener('click', () => {
  window.close();
});
