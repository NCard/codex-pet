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
  if (text.length < 3 || text.length > 5000) return null;

  // 忽略純網址 (URL)
  if (/^https?:\/\/[^\s]+$/i.test(text)) return null;

  // 1. 程式報錯 / Stack Trace 偵測
  const errorRegex = /(?:Error(?:\:|\b)|Exception(?:\:|\b)|at\s+[\w\d_.$<>]+\s+\(|Traceback\s+\(most\s+recent|SyntaxError|TypeError|ReferenceError|RangeError|NullPointerException|FATAL(?:\:|\b)|UnhandledPromiseRejection|failed\s+with\s+exit\s+code|npm\s+ERR\!|Cannot\s+find\s+module|\[ERROR\]|build\s+failed|compilation\s+failed|fatal(?:\:|\b))/i;
  if (errorRegex.test(text)) {
    return {
      icon: '🐞',
      label: '發現報錯！點我看解析',
      prompt: `請用繁體中文簡明扼要地分析以下程式報錯的原因，並提供 1~2 個具體的修復建議：\n\`\`\`\n${text.slice(0, 2000)}\n\`\`\``
    };
  }

  // 2. 程式代碼片段與終端機指令偵測 (優先於英文/一般文字，防止代碼被誤判為翻譯)
  const codeRegex = /(?:console\.(?:log|error|warn|debug|info)|function\s*\w*\(|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|class\s+\w+|import\s+.*from|export\s+(?:default\s+)?|require\(['"]|def\s+\w+\(|print\(|public\s+(?:static\s+)?void|System\.out\.print|SELECT\s+.*FROM|INSERT\s+INTO|UPDATE\s+.*SET|<\/?(?:div|span|button|template|script|p|a|input|form|h[1-6]|ul|li)[\s>/]|(?:if|for|while|switch)\s*\(.*?\)\s*\{|=>\s*\{?|^(?:npm|yarn|pnpm|npx|git|docker|kubectl|pip|cargo)\s+[a-z]+)/im;
  if (codeRegex.test(text)) {
    return {
      icon: '💻',
      label: '發現代碼！點我看說明',
      prompt: `請幫我簡明扼要地解讀以下程式碼或指令的主要功能與邏輯：\n\`\`\`\n${text.slice(0, 2000)}\n\`\`\``
    };
  }

  // 3. JSON 數據與結構化資料偵測
  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
    try {
      JSON.parse(text);
      return {
        icon: '💡',
        label: '發現 JSON！點擊整理說明',
        prompt: `請幫我整理並美化以下 JSON 數據，並簡短說明其資料結構：\n\`\`\`json\n${text.slice(0, 2000)}\n\`\`\``
      };
    } catch (_) {
      // 容錯支援非嚴格 JSON (如 JS 物件字面量 { name: 'Wiki' })
      if (text.length >= 8 && (text.includes(':') || text.includes(','))) {
        return {
          icon: '💡',
          label: '發現資料結構！點擊整理',
          prompt: `請幫我整理並美化以下資料結構，並簡短說明內容：\n\`\`\`\n${text.slice(0, 2000)}\n\`\`\``
        };
      }
    }
  }

  // 4. 英文單字查詢偵測 (長度 3 ~ 35 字元純英文字彙，點擊查單字)
  if (/^[a-zA-Z\-']{3,35}$/.test(text)) {
    return {
      icon: '📖',
      label: '發現英文單字！點擊查釋義',
      prompt: `請幫我查詢英文單字 "${text}" 的繁體中文釋義、詞性、KK音標與 1~2 個實用生活例句。`
    };
  }

  // 5. 英文句子與段落翻譯偵測
  if (text.length >= 8 && text.length <= 1500) {
    const latinMatches = text.match(/[a-zA-Z]/g) || [];
    const latinRatio = latinMatches.length / text.length;
    if (latinRatio > 0.55 && text.includes(' ')) {
      return {
        icon: '📖',
        label: '發現英文！點擊翻譯成中文',
        prompt: `請幫我將以下英文內容流暢地翻譯成繁體中文：\n\n"${text.slice(0, 1000)}"`
      };
    }
  }

  // 6. 中文或一般文字段落 (中文高資訊密度，>= 4 字元即視為有意義語意)
  if (text.length >= 4 && text.length <= 1500) {
    return {
      icon: '✨',
      label: '處理剪貼簿？點擊發問',
      prompt: `針對以下內容，請問有什麼我可以協助您的？\n\n"${text.slice(0, 1000)}"`
    };
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
