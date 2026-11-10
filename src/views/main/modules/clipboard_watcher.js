const { clipboard } = require('electron');
const { detectClipboardIntent } = require('../../../utils/clipboard_analyzer');

let lastSeenText = '';
let lastHandledText = '';
let hideTimer = null;
let currentPrompt = '';

try {
  const initial = clipboard.readText();
  if (initial) lastSeenText = initial.trim();
} catch (_) {}

function init({
  badgeEl,
  badgeIconEl,
  badgeTextEl,
  badgeCloseEl,
  getPetState,
  sendMessage,
  kiwi,
  getIsAlarmActive
}) {
  if (!badgeEl) return;

  function hideBadge() {
    badgeEl.style.display = 'none';
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  // 若初始化時鬧鐘已在進行中，確保不顯示
  if (typeof getIsAlarmActive === 'function' && getIsAlarmActive()) {
    hideBadge();
  }

  function showBadge(icon, label, prompt) {
    currentPrompt = prompt;
    if (badgeIconEl) badgeIconEl.innerText = icon;
    if (badgeTextEl) badgeTextEl.innerText = label;
    badgeEl.style.display = 'flex';

    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      hideBadge();
    }, 9000);
  }

  // 點擊關閉按鈕忽略
  if (badgeCloseEl) {
    badgeCloseEl.addEventListener('click', (e) => {
      e.stopPropagation();
      lastHandledText = lastSeenText;
      hideBadge();
    });
  }

  // 點擊提示 Badge 觸發 Agent 處理
  badgeEl.addEventListener('click', () => {
    const promptToSend = currentPrompt;
    lastHandledText = lastSeenText;
    hideBadge();

    if (kiwi) {
      kiwi.classList.add('jumping');
      setTimeout(() => { kiwi.classList.remove('jumping'); }, 500);
    }

    if (typeof sendMessage === 'function' && promptToSend) {
      sendMessage(promptToSend);
    }
  });

  function pollClipboard() {
    try {
      const state = typeof getPetState === 'function' ? getPetState() : {};
      const settings = state?.settings || {};

      // 嚴格權限檢查：必須同時允許剪貼簿存取與主動感知開關
      if (!settings.enableClipboard || !settings.enableClipboardSmartWatch) {
        if (badgeEl.style.display !== 'none') hideBadge();
        return;
      }

      // 鬧鐘響起催促期間暫停顯示剪貼簿提示，避免推擠或覆蓋鬧鐘
      if (typeof getIsAlarmActive === 'function' && getIsAlarmActive()) {
        if (badgeEl.style.display !== 'none') hideBadge();
        return;
      }

      const raw = clipboard.readText();
      const text = raw ? raw.trim() : '';

      if (!text || text === lastSeenText || text === lastHandledText) {
        return;
      }
      lastSeenText = text;

      const intent = detectClipboardIntent(text);
      if (intent) {
        showBadge(intent.icon, intent.label, intent.prompt);
      } else {
        if (badgeEl.style.display !== 'none') hideBadge();
      }
    } catch (_) {
      // 容錯防護，避免剪貼簿存取例外中斷流程
    }
  }

  // 每 1.2 秒安全輪詢剪貼簿變化（本機零 Token）
  const pollInterval = setInterval(pollClipboard, 1200);

  return {
    hideBadge,
    pollClipboard,
    destroy: () => clearInterval(pollInterval)
  };
}

module.exports = { init, detectClipboardIntent };
