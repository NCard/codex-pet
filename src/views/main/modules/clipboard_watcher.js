const { clipboard } = require('electron');

let lastSeenText = '';
let lastHandledText = '';
let hideTimer = null;
let currentPrompt = '';

try {
  const initial = clipboard.readText();
  if (initial) lastSeenText = initial.trim();
} catch (_) {}

function detectClipboardIntent(rawText) {
  const text = (rawText || '').trim();
  if (text.length < 5 || text.length > 5000) return null;

  // 1. 程式報錯 / Stack Trace 偵測
  const errorRegex = /(?:Error(?:\:|\b)|Exception(?:\:|\b)|at\s+[\w\d_.$<>]+\s+\(|Traceback\s+\(most\s+recent|SyntaxError|TypeError|ReferenceError|RangeError|NullPointerException|FATAL(?:\:|\b)|UnhandledPromiseRejection|failed\s+with\s+exit\s+code|npm\s+ERR\!|Cannot\s+find\s+module|\[ERROR\]|build\s+failed|compilation\s+failed|fatal(?:\:|\b))/i;
  if (errorRegex.test(text)) {
    return {
      icon: '🐞',
      label: '發現報錯！點我看解析',
      prompt: `請用繁體中文簡明扼要地分析以下程式報錯的原因，並提供 1~2 個具體的修復建議：\n\`\`\`\n${text.slice(0, 2000)}\n\`\`\``
    };
  }

  // 2. JSON 數據偵測
  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
    try {
      JSON.parse(text);
      return {
        icon: '💡',
        label: '發現 JSON！點擊整理說明',
        prompt: `請幫我整理並美化以下 JSON 數據，並簡短說明其資料結構：\n\`\`\`json\n${text.slice(0, 2000)}\n\`\`\``
      };
    } catch (_) {}
  }

  // 3. 程式代碼片段偵測
  const codeRegex = /(?:function\s+\w+|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|class\s+\w+|import\s+.*from|def\s+\w+\(|public\s+static\s+void|SELECT\s+.*FROM|<\/?(?:div|span|button|template|script)[\s>])/i;
  if (codeRegex.test(text)) {
    return {
      icon: '💻',
      label: '發現代碼！點我看說明',
      prompt: `請幫我簡明扼要地解讀以下程式碼的主要邏輯與功能：\n\`\`\`\n${text.slice(0, 2000)}\n\`\`\``
    };
  }

  // 4. 英文段落翻譯偵測
  if (text.length >= 15 && text.length <= 1500 && text.includes(' ')) {
    const isUrl = /^https?:\/\//i.test(text);
    if (!isUrl) {
      const latinMatches = text.match(/[a-zA-Z]/g) || [];
      const latinRatio = latinMatches.length / text.length;
      if (latinRatio > 0.55) {
        return {
          icon: '📖',
          label: '發現英文！點擊翻譯成中文',
          prompt: `請幫我將以下英文內容流暢地翻譯成繁體中文：\n\n"${text.slice(0, 1000)}"`
        };
      }
    }
  }

  // 5. 一般文字（有意義長度段落）
  if (text.length >= 12 && text.length <= 1500) {
    const isUrl = /^https?:\/\//i.test(text);
    if (!isUrl) {
      return {
        icon: '✨',
        label: '處理剪貼簿？點擊發問',
        prompt: `針對以下內容，請問有什麼我可以協助您的？\n\n"${text.slice(0, 1000)}"`
      };
    }
  }

  return null;
}

function init({
  badgeEl,
  badgeIconEl,
  badgeTextEl,
  badgeCloseEl,
  getPetState,
  sendMessage,
  kiwi
}) {
  if (!badgeEl) return;

  function hideBadge() {
    badgeEl.style.display = 'none';
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
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

  // 每 1.2 秒安全輪詢剪貼簿變化（本機零 Token）
  const pollInterval = setInterval(() => {
    try {
      const state = typeof getPetState === 'function' ? getPetState() : {};
      const settings = state?.settings || {};

      // 嚴格權限檢查：必須同時允許剪貼簿存取與主動感知開關
      if (!settings.enableClipboard || !settings.enableClipboardSmartWatch) {
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
  }, 1200);

  return {
    hideBadge,
    destroy: () => clearInterval(pollInterval)
  };
}

module.exports = { init, detectClipboardIntent };
