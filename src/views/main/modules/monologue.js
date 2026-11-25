const {
  MonologuePicker,
  getNextDelayMs,
  buildAIMonologuePrompt
} = require('../../../utils/monologue');
const { recordUsage, getUsageSummary } = require('../../../utils/usage_tracker');

/**
 * Wiki Wiki 自言自語互動模組 (modules/monologue.js)
 * 管理獨立迷你碎碎念泡泡、智慧隨機排程、防干擾互鎖與點擊接話功能。
 */
function init({
  bubbleEl,
  textEl,
  closeEl,
  chatBubble,
  chatInput,
  customMenu,
  clipboardBadge,
  getPetState,
  getCurrentAction,
  getCpuUsage,
  getIsAlarmActive,
  getIsWorking,
  getIsDragging,
  getIsLaserActive,
  getAI,
  onClickContinueChat
}) {
  const picker = new MonologuePicker({ historyLimit: 40 });
  let scheduleTimer = null;
  let hideTimer = null;
  let isHoveringBubble = false;
  let currentMonologueText = '';
  let spokenCount = 0;
  let isDestroyed = false;

  const DISPLAY_DURATION_MS = 5800;

  function getSettings() {
    const state = typeof getPetState === 'function' ? getPetState() : {};
    return state?.settings || {};
  }

  function isVisible(el) {
    return Boolean(el && el.style && el.style.display && el.style.display !== 'none');
  }

  function clearHideTimer() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function clearScheduleTimer() {
    if (scheduleTimer) {
      clearTimeout(scheduleTimer);
      scheduleTimer = null;
    }
  }

  function hide() {
    clearHideTimer();
    currentMonologueText = '';
    if (bubbleEl) {
      bubbleEl.style.display = 'none';
      bubbleEl.classList.remove('dream-mode', 'visible');
    }
  }

  function canShowMonologue({ ignoreEnabled = false } = {}) {
    if (isDestroyed || !bubbleEl) return false;
    const settings = getSettings();
    if (!ignoreEnabled && settings.enableMonologue === false) return false;

    // 嚴格互鎖：不干擾鬧鐘、番茄鐘、對話、雷射筆、拖曳、右鍵選單或剪貼簿提示
    if (typeof getIsAlarmActive === 'function' && getIsAlarmActive()) return false;
    if (typeof getIsWorking === 'function' && getIsWorking()) return false;
    if (typeof getIsLaserActive === 'function' && getIsLaserActive()) return false;
    if (typeof getIsDragging === 'function' && getIsDragging()) return false;
    if (isVisible(chatBubble) || isVisible(chatInput)) return false;
    if (isVisible(customMenu) || isVisible(clipboardBadge)) return false;

    const action = typeof getCurrentAction === 'function' ? getCurrentAction() : 'idle';
    if (action === 'grabbed' || action === 'eating') return false;
    if (action === 'sleeping' && settings.monologueSleepDream === false) return false;

    return true;
  }

  function scheduleHide() {
    clearHideTimer();
    if (isHoveringBubble) return;
    hideTimer = setTimeout(() => {
      if (!isHoveringBubble) {
        hide();
      }
    }, DISPLAY_DURATION_MS);
  }

  function buildContext() {
    const state = typeof getPetState === 'function' ? getPetState() : {};
    const settings = state?.settings || {};
    const action = typeof getCurrentAction === 'function' ? getCurrentAction() : 'idle';
    return {
      now: new Date(),
      personality: settings.aiPersonality || 'default',
      customPrompt: settings.aiCustomPrompt || '',
      scenario: settings.aiScenario || 'general',
      isSleeping: action === 'sleeping',
      hunger: typeof state.hunger === 'number' ? state.hunger : 100,
      mood: typeof state.mood === 'number' ? state.mood : 100,
      cpuUsage: typeof getCpuUsage === 'function' ? getCpuUsage() : 0,
      todos: Array.isArray(state.todos) ? state.todos : [],
      outfits: Array.isArray(state.outfits) ? state.outfits : [],
      recentTexts: picker.getRecentTexts(5)
    };
  }

  async function tryGenerateAISpark(context) {
    const settings = getSettings();
    if (!settings.monologueUseAI || context.isSleeping) return null;

    const activeAI = typeof getAI === 'function' ? getAI() : null;
    if (!activeAI || typeof activeAI.generateContent !== 'function') return null;

    // 頻率保護：預設每 4 次才用 AI 靈感 1 次（自訂個性時每 2 次 1 次），避免消耗免費額度
    const isCustomPersonality = context.personality === 'custom' && Boolean(context.customPrompt);
    const interval = isCustomPersonality ? 2 : 4;
    if ((spokenCount + 1) % interval !== 0) return null;

    const activeModel = settings.aiModel || 'gemini-3.5-flash-lite';
    const providerId = (settings.aiProvider || 'gemini').toLowerCase();
    try {
      const summary = getUsageSummary(activeModel, providerId);
      if (summary && (summary.isRateLimitClose || (!summary.isUnlimited && summary.remainingRequests <= 5))) {
        return null;
      }
    } catch {
      // 略過用量檢查錯誤
    }

    const prompt = buildAIMonologuePrompt(context);
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
      const resp = await Promise.race([
        activeAI.generateContent({
          model: activeModel,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: { maxOutputTokens: 80 }
        }),
        timeoutPromise
      ]);

      if (resp && resp.usageMetadata) {
        recordUsage({
          model: activeModel,
          promptTokens: resp.usageMetadata.promptTokenCount || 0,
          candidateTokens: resp.usageMetadata.candidatesTokenCount || 0,
          totalTokens: resp.usageMetadata.totalTokenCount || 0
        });
      }

      const rawText = (resp && resp.text ? String(resp.text) : '')
        .replace(/^["'「『]+|["'」』]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (rawText && rawText.length >= 4 && rawText.length <= 60) {
        picker.recordSpoken(rawText, 'ai-spark');
        return { text: rawText, category: 'ai-spark', isDream: false };
      }
    } catch {
      // AI 失敗或超時時靜默回退至豐富本機語料庫
    }
    return null;
  }

  function renderBubble(text, isDream = false) {
    if (!bubbleEl || !textEl) return;
    currentMonologueText = text;
    textEl.innerText = text;
    bubbleEl.classList.toggle('dream-mode', Boolean(isDream));
    bubbleEl.style.display = 'flex';
    bubbleEl.classList.add('visible');
    scheduleHide();
  }

  async function triggerNow({ force = false } = {}) {
    if (!canShowMonologue({ ignoreEnabled: force })) {
      return null;
    }

    const context = buildContext();
    let result = await tryGenerateAISpark(context);
    if (!result) {
      result = picker.pick(context);
    }

    // 二次確認等待 AI 期間沒有突然開啟對話或響鬧鐘
    if (!canShowMonologue({ ignoreEnabled: force })) {
      return null;
    }

    spokenCount += 1;
    renderBubble(result.text, result.isDream);
    return result;
  }

  function scheduleNext() {
    clearScheduleTimer();
    if (isDestroyed) return;
    const settings = getSettings();
    if (settings.enableMonologue === false) return;

    const freq = settings.monologueFrequency || 'normal';
    const delayMs = getNextDelayMs(freq);
    scheduleTimer = setTimeout(async () => {
      scheduleTimer = null;
      if (isDestroyed) return;
      await triggerNow({ force: false });
      scheduleNext();
    }, delayMs);
  }

  function refreshSchedule() {
    const settings = getSettings();
    if (settings.enableMonologue === false) {
      hide();
      clearScheduleTimer();
    } else {
      scheduleNext();
    }
  }

  // 互動事件：懸停暫停淡出、點關閉鈕隱藏、點泡泡本體直接接話開聊
  if (bubbleEl) {
    bubbleEl.addEventListener('mouseenter', () => {
      isHoveringBubble = true;
      clearHideTimer();
    });
    bubbleEl.addEventListener('mouseleave', () => {
      isHoveringBubble = false;
      if (isVisible(bubbleEl)) {
        scheduleHide();
      }
    });
    bubbleEl.addEventListener('click', (e) => {
      if (closeEl && (e.target === closeEl || closeEl.contains(e.target))) {
        return;
      }
      const seedText = currentMonologueText;
      hide();
      if (seedText && typeof onClickContinueChat === 'function') {
        onClickContinueChat(seedText);
      }
    });
  }

  if (closeEl) {
    closeEl.addEventListener('click', (e) => {
      e.stopPropagation();
      hide();
    });
  }

  scheduleNext();

  return {
    triggerNow,
    hide,
    refreshSchedule,
    canShowMonologue,
    getPicker: () => picker,
    destroy: () => {
      isDestroyed = true;
      clearScheduleTimer();
      clearHideTimer();
    }
  };
}

module.exports = { init };
