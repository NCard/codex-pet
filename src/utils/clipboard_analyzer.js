/**
 * 智慧剪貼簿意圖解析引擎 (Clipboard Intent Analyzer)
 * 具備語法特徵提取、CLI 指令偵測、檔案路徑識別、停用詞自然語言消歧與結構化資料分析
 */

// 常見命令列執行指令集合
const CLI_COMMAND_PREFIX_REGEX = /^(?:python3?|node|deno|bun|ts-node|npm|pnpm|yarn|npx|git|docker|kubectl|pip3?|cargo|rustc|go|mvn|gradle|dotnet|gcc|g\+\+|clang|bash|sh|zsh|powershell|pwsh|cmd|curl|wget|pytest|uvicorn|gunicorn|pipx|poetry|brew|apt|yum|winget|choco)\b/i;

// 常用腳本與程式副檔名
const CODE_FILE_EXTENSIONS = /\.(?:py|js|ts|jsx|tsx|json|html|css|scss|md|log|txt|xml|yaml|yml|csv|sql|sh|bat|ps1|c|cpp|h|hpp|rs|go|java|kt|rb|php|toml|ini|env)$/i;

// 常見自然語言英文停用詞 (Stop words - 用於消歧自然語言英文段落 vs 程式碼/路徑/雜湊)
const ENGLISH_STOP_WORDS_REGEX = /\b(?:the|is|are|was|were|to|of|in|on|at|for|and|with|that|this|it|you|we|can|will|have|has|be|do|from|or|by|but|not|what|how|why|when|where|should|would|could|about|which|their|there)\b/i;

/**
 * 檢查是否為錯誤報錯訊息或 Stack Trace
 */
function isStackTrace(text) {
  const errorRegex = /(?:Error(?:\:|\b)|Exception(?:\:|\b)|at\s+[\w\d_.$<>]+\s+\(|Traceback\s+\(most\s+recent|SyntaxError|TypeError|ReferenceError|RangeError|NullPointerException|FATAL(?:\:|\b)|UnhandledPromiseRejection|failed\s+with\s+exit\s+code|npm\s+ERR\!|Cannot\s+find\s+module|\[ERROR\]|build\s+failed|compilation\s+failed|fatal(?:\:|\b))/i;
  return errorRegex.test(text);
}

/**
 * 檢查是否為終端機指令 (CLI Command / Script Execution)
 */
function isCliCommand(text) {
  const trimmed = text.trim();
  // 單行且開頭符合常見 CLI 指令
  if (!trimmed.includes('\n') && CLI_COMMAND_PREFIX_REGEX.test(trimmed)) {
    return true;
  }
  // 執行本機腳本指令，例如: ./run.sh, .\start.bat, python.exe ...
  if (/^(?:\.\/|\.\\|[\w\-.]+\.(?:exe|bat|cmd|ps1|sh))\s+/i.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * 檢查是否為本機檔案或系統路徑
 */
function isFilePath(text) {
  const trimmed = text.trim();
  if (trimmed.includes('\n')) return false;

  // Windows 完整路徑: C:\Users\..., D:\code\...
  const isWindowsPath = /^[a-zA-Z]:\\(?:[^<>:"|?*\r\n]+[\\/])*[^<>:"|?*\r\n]*$/i.test(trimmed);
  // Unix 絕對路徑或 Home 路徑: /usr/local/..., ~/project/...
  const isUnixPath = /^(?:\/|~\/|\.\.?\/)(?:[a-zA-Z0-9_.\-]+[\\/])*[a-zA-Z0-9_.\-]+$/i.test(trimmed);

  if (isWindowsPath || isUnixPath) {
    return true;
  }

  // 單純的程式碼檔案路徑 (例如 src/views/main.js 或 package.json)
  if (CODE_FILE_EXTENSIONS.test(trimmed) && (trimmed.includes('/') || trimmed.includes('\\'))) {
    return true;
  }

  return false;
}

/**
 * 檢查是否為程式代碼片段 (Source Code Snippet)
 */
function isCodeSnippet(text) {
  const codeRegex = /(?:console\.(?:log|error|warn|debug|info)|function\s*\w*\(|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|class\s+\w+|import\s+.*from|export\s+(?:default\s+)?|require\(['"]|def\s+\w+\(|print\(|public\s+(?:static\s+)?void|System\.out\.print|SELECT\s+.*FROM|INSERT\s+INTO|UPDATE\s+.*SET|<\/?(?:div|span|button|template|script|p|a|input|form|h[1-6]|ul|li)[\s>/]|(?:if|for|while|switch)\s*\(.*?\)\s*\{|=>\s*\{?)/im;
  if (codeRegex.test(text)) {
    return true;
  }

  // 多行程式碼特徵 (包含花括號、分號結尾、縮排)
  if (text.includes('\n')) {
    const hasBraces = text.includes('{') && text.includes('}');
    const hasSemicolon = /;\s*$/m.test(text);
    const hasArrows = text.includes('=>') || text.includes('->');
    if ((hasBraces && hasSemicolon) || (hasBraces && hasArrows)) {
      return true;
    }
  }

  return false;
}

/**
 * 檢查是否為結構化資料 (JSON, JS Object, YAML)
 */
function isStructuredData(text) {
  const trimmed = text.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return { type: 'json' };
    } catch {
      // 容錯支援非嚴格 JSON (如 JS 物件字面量 { name: 'Wiki' })
      if (trimmed.length >= 8 && (trimmed.includes(':') || trimmed.includes(','))) {
        return { type: 'object' };
      }
    }
  }
  return false;
}

/**
 * 檢查是否為自然語言英文段落 (過濾掉路徑、雜湊與指令誤判)
 */
function isNaturalEnglish(text) {
  const trimmed = text.trim();
  if (trimmed.length < 8 || trimmed.length > 2500) return false;

  // 若包含路徑分隔符 (Windows 斜線 \ 或多重路徑)，直接排除為英文段落
  if (trimmed.includes('\\') || trimmed.includes(':\\')) return false;

  // 必須包含空白字元以區分單字
  if (!trimmed.includes(' ')) return false;

  const latinMatches = trimmed.match(/[a-zA-Z]/g) || [];
  const latinRatio = latinMatches.length / trimmed.length;

  // 字母比例需高於 55% 且必須包含常見的自然語言英文停用詞 (Stop words)
  if (latinRatio > 0.55 && ENGLISH_STOP_WORDS_REGEX.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * 檢查是否為單一英文生字
 */
function isEnglishWord(text) {
  const trimmed = text.trim();
  // 長度 3 ~ 35 字元之純英文字彙
  return /^[a-zA-Z\-']{3,35}$/.test(trimmed);
}

/**
 * 主要意圖分析入口函式
 * @param {string} rawText 剪貼簿原始文字
 * @returns {Object|null} 意圖結構物件，包含 icon, label, prompt, category
 */
function analyzeClipboardText(rawText) {
  const text = (rawText || '').trim();
  if (text.length < 3 || text.length > 6000) return null;

  // 忽略純網址 (URL)
  if (/^https?:\/\/[^\s]+$/i.test(text)) return null;

  // 1. 程式報錯 / Stack Trace 偵測 (最優先，協助除錯)
  if (isStackTrace(text)) {
    return {
      category: 'ERROR',
      icon: '🐞',
      label: '發現報錯！點我看解析',
      prompt: `請用繁體中文簡明扼要地分析以下程式報錯的原因，並提供 1~2 個具體的修復建議：\n\`\`\`\n${text.slice(0, 2500)}\n\`\`\``
    };
  }

  // 2. 終端機指令與腳本執行 (CLI Command / Script)
  if (isCliCommand(text)) {
    const cmdNameMatch = text.match(/^([a-zA-Z0-9_\-.]+)/);
    const cmdName = cmdNameMatch ? cmdNameMatch[1] : '指令';
    return {
      category: 'CLI_COMMAND',
      icon: '💻',
      label: `發現 ${cmdName} 指令！點擊說明`,
      prompt: `請幫我簡明扼要地解讀以下指令與執行參數的作用、運作邏輯及可能的注意事項：\n\`\`\`bash\n${text.slice(0, 2000)}\n\`\`\``
    };
  }

  // 3. 檔案與系統路徑 (File Path)
  if (isFilePath(text)) {
    return {
      category: 'FILE_PATH',
      icon: '📁',
      label: '發現檔案路徑！點擊檢視',
      prompt: `這是一個檔案或系統路徑：\n\`${text}\`\n請問您需要我針對這個檔案或路徑提供什麼協助？（例如說明檔案用途、編寫對應腳本或尋找相關配置）`
    };
  }

  // 4. 程式碼片段偵測 (Source Code Snippet)
  if (isCodeSnippet(text)) {
    return {
      category: 'CODE_SNIPPET',
      icon: '💻',
      label: '發現代碼！點我看解讀',
      prompt: `請幫我簡明扼要地解讀以下程式碼的主要功能與邏輯：\n\`\`\`\n${text.slice(0, 2500)}\n\`\`\``
    };
  }

  // 5. 結構化資料偵測 (JSON / Object)
  const structInfo = isStructuredData(text);
  if (structInfo) {
    return {
      category: 'STRUCTURED_DATA',
      icon: '💡',
      label: structInfo.type === 'json' ? '發現 JSON！點擊整理說明' : '發現資料結構！點擊整理',
      prompt: `請幫我整理並美化以下資料結構，並簡短說明其資料型態與內容：\n\`\`\`json\n${text.slice(0, 2500)}\n\`\`\``
    };
  }

  // 6. 單一英文單字查詢 (長度 3 ~ 35 字元純英文字彙)
  if (isEnglishWord(text)) {
    return {
      category: 'ENGLISH_WORD',
      icon: '📖',
      label: '發現英文單字！點擊查釋義',
      prompt: `請幫我查詢英文單字 "${text}" 的繁體中文釋義、詞性、KK音標與 1~2 個實用生活例句。`
    };
  }

  // 7. 自然語言英文段落翻譯 (過濾掉路徑、指令與代碼雜湊)
  if (isNaturalEnglish(text)) {
    return {
      category: 'ENGLISH_TEXT',
      icon: '📖',
      label: '發現英文！點擊翻譯成中文',
      prompt: `請幫我將以下英文內容流暢地翻譯成繁體中文：\n\n"${text.slice(0, 1500)}"`
    };
  }

  // 8. 中文或一般自然語言短語 (中文高資訊密度，>= 4 字元即具備語意)
  if (text.length >= 4 && text.length <= 1500) {
    return {
      category: 'GENERAL_TEXT',
      icon: '✨',
      label: '處理剪貼簿？點擊發問',
      prompt: `針對以下內容，請問有什麼我可以協助您的？\n\n"${text.slice(0, 1200)}"`
    };
  }

  return null;
}

module.exports = {
  analyzeClipboardText,
  detectClipboardIntent: analyzeClipboardText, // 向下相容
  isStackTrace,
  isCliCommand,
  isFilePath,
  isCodeSnippet,
  isStructuredData,
  isNaturalEnglish,
  isEnglishWord
};

