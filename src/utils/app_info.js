/**
 * Wiki Wiki 自身版本、設定摘要與使用說明查詢引擎 (app_info.js)
 * 供 MCP Tool `get_app_info` 與 Agent 查詢真實版本、非機敏設定狀態、快捷鍵、指令與功能教學，
 * 避免 AI 臆測過時版本號或不存在的操作方式，並嚴格過濾所有 API Key 機敏資訊。
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  dataDir,
  petStatePath,
  alarmsPath,
  historyPath,
  usagePath,
  modelCachePath
} = require('./paths');
const { getScenarioPreset } = require('./scenarios');

const VALID_TOPICS = ['all', 'version', 'settings', 'usage', 'shortcuts', 'commands', 'features', 'paths'];

function loadPackageInfo(pkgPath) {
  const target = pkgPath || path.resolve(__dirname, '../../package.json');
  try {
    return JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch {
    return {
      name: 'wiki-wiki-desktop',
      productName: 'Wiki Wiki',
      version: 'unknown',
      description: 'Kiwi Desktop Pet'
    };
  }
}

function loadCurrentState(stateFilePath = petStatePath) {
  try {
    if (fs.existsSync(stateFilePath)) {
      return JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
    }
  } catch {
    // 狀態檔尚未建立或讀取失敗時回傳空物件
  }
  return {};
}

function formatVersionSection(pkg) {
  const repoUrl = typeof pkg.repository === 'string'
    ? pkg.repository
    : (pkg.repository && pkg.repository.url ? pkg.repository.url.replace(/^git\+/, '').replace(/\.git$/, '') : 'https://github.com/NCard/codex-pet');

  return [
    '【版本與應用程式資訊】',
    `- 應用程式名稱：${pkg.productName || 'Wiki Wiki'} (${pkg.name || 'wiki-wiki-desktop'})`,
    `- 目前版本：v${pkg.version || 'unknown'}`,
    `- 簡介：${pkg.description || '桌面陪伴 AI 奇異鳥小助手'}`,
    `- 專案網址：${repoUrl}`,
    `- 執行環境：Node ${process.version} / ${os.platform()} (${os.arch()})`
  ].join('\n');
}

function formatSettingsSection(state) {
  const s = (state && state.settings) || {};
  const provider = (s.aiProvider || 'gemini').toLowerCase();
  const model = s.aiModel || 'gemini-3.5-flash-lite';
  const scenario = getScenarioPreset(s.aiScenario || 'general');
  const personalityMap = {
    default: '預設親切模式',
    bard: '吟遊詩人模式',
    grumpy: '傲嬌模式',
    custom: '自訂性格模式'
  };
  const freqMap = {
    quiet: '安靜 (8~14 分鐘)',
    normal: '適中 (3~6 分鐘)',
    chatty: '話癆 (1~2 分鐘)'
  };
  const autoHide = Number(s.chatAutoHideSeconds) > 0 ? `${s.chatAutoHideSeconds} 秒` : '不自動消失（手動關閉）';
  const providerCfg = (s.providerConfigs && s.providerConfigs[provider]) || {};
  const hasKey = Boolean((s.apiKey && String(s.apiKey).trim()) || (providerCfg.apiKey && String(providerCfg.apiKey).trim()));

  return [
    '【目前啟用設定摘要（已自動遮罩所有金鑰）】',
    `- AI 服務商 / 模型：${provider} / ${model}（金鑰狀態：${hasKey ? '已設定' : '未設定或免金鑰'}）`,
    `- 思考層級：${s.thinkingLevel || 'medium'}｜上下文記憶：${s.contextTimeout ?? 5} 分鐘`,
    `- 使用情境：${scenario.icon} ${scenario.name}｜說話性格：${personalityMap[s.aiPersonality] || '預設親切模式'}`,
    `- 對話氣泡尺寸：${s.chatSizeMode === 'manual' ? `手動 (${s.chatWidth || 350}×${s.chatHeight || 250} px)` : '依螢幕解析度自動調整'}`,
    `- 對話窗自動消失：${autoHide}（滑鼠停留暫停：${s.chatAutoHidePauseOnHover !== false ? '開啟' : '關閉'}）`,
    `- 自言自語：${s.enableMonologue !== false ? `開啟（${freqMap[s.monologueFrequency] || freqMap.normal}）` : '關閉'}｜睡覺夢話：${s.monologueSleepDream !== false ? '開啟' : '關閉'}`,
    `- 角色外觀：大小 ${s.petScale || 180}px｜接地陰影：${s.enablePetShadow !== false ? '開啟' : '關閉'}｜表情動作幀：${s.enableSpriteAnim !== false ? '開啟' : '關閉'}`,
    `- 狀態條與生理機制：底部狀態條 ${s.showStatusBars !== false ? '顯示' : '隱藏'}（數值：${s.showStatusBarNumbers !== false ? '顯示' : '隱藏'}）｜飢餓與心情系統 ${s.enableHungerSystem !== false ? '開啟' : '關閉'}｜高 CPU 流汗反應 ${s.enableCpuSweat !== false ? '開啟' : '關閉'}`,
    `- 隱私權限：讀取剪貼簿 ${s.enableClipboard ? '已開啟' : '關閉'}｜剪貼簿主動感知 ${s.enableClipboardSmartWatch ? '已開啟' : '關閉'}`,
    `- 召喚快捷鍵：${(s.summonShortcut || 'Ctrl+Shift+K').replace(/CommandOrControl/g, 'Ctrl')}`
  ].join('\n');
}

function formatUsageSection() {
  return [
    '【基本使用方法】',
    '1. 開始對話：左鍵點擊奇異鳥開啟對話輸入框，輸入文字按 Enter 送出（Shift+Enter 換行）。',
    '2. 拖曳與互動：按住奇異鳥可拖曳到螢幕任何位置；右鍵點擊可開啟工具選單（待辦、鬧鐘、歷史紀錄、餵食、摸摸、睡覺、雷射筆、換裝衣櫥、設定中心、導覽與功能）。',
    '3. 調整對話框大小：可於設定中心「外觀互動 › 對話互動」選擇自動／手動滑桿，或直接拖曳桌面對話氣泡左上角的「⤢」手柄。',
    '4. 展開完整閱讀：回覆較長或含程式碼時，點擊氣泡右上角「🔍 展開」可在獨立檢閱視窗閱讀並查看 AI 思考步驟。',
    '5. 接續自言自語：點擊奇異鳥頭上飄出的迷你碎碎念泡泡，可直接打開對話框接續那個話題聊下去。',
    '6. 快速搜尋設定：打開「設定中心」後，於頂部搜尋列（或按 Ctrl+F）輸入關鍵字即可跨分頁即時查找並修改設定。',
    '7. 完整教學與導覽：右鍵選單點擊「📖 導覽與功能」，或至設定中心「關於導覽」可隨時重看新手指引與功能介紹。'
  ].join('\n');
}

function formatShortcutsSection(state) {
  const s = (state && state.settings) || {};
  const summon = (s.summonShortcut || 'Ctrl+Shift+K').replace(/CommandOrControl/g, 'Ctrl');
  return [
    '【快捷鍵一覽】',
    `- ${summon}：全域召喚奇異鳥瞬移至游標處（可於「設定中心 › 外觀互動 › 快捷與鬧鐘」自訂）`,
    '- Enter / Shift+Enter：送出對話 / 輸入框內換行',
    '- Tab：在輸入框以 `/` 開頭時自動補齊斜線指令',
    '- ESC：關閉對話氣泡、右鍵選單、雷射筆遊戲或暫時關閉響鈴中的鬧鐘',
    '- Ctrl+F（設定中心內）：快速聚焦設定搜尋列'
  ].join('\n');
}

function formatCommandsSection() {
  return [
    '【內建斜線指令（輸入框直接輸入）】',
    '- /help：顯示指令說明清單',
    '- /todo [事項]：快速新增一筆待辦事項',
    '- /pomodoro [分鐘]：啟動番茄鐘專注倒數（預設 25 分鐘）',
    '- /md5 [字串]：計算 MD5 雜湊並自動複製結果（未帶字串則讀取剪貼簿）',
    '- /base64 encode|decode [字串]：Base64 編碼或解碼',
    '- /uuid：產生隨機 UUID',
    '- /calc [算式]：快速計算數學算式',
    '- /quota（或 /usage）：查看今日 AI 用量、Token 消耗與每日重置倒數',
    '- /laser：開啟／關閉雷射筆追逐小遊戲',
    '- /clear：清除加密歷史對話紀錄'
  ].join('\n');
}

function formatFeaturesSection() {
  return [
    '【Wiki Wiki 核心功能特色】',
    '- 多供應商 AI 支援：支援 Google Gemini、Groq、OpenRouter、OpenAI、DeepSeek、Anthropic Claude、Ollama 本機離線與自訂相容端點，各家金鑰獨立保存。',
    '- 自主 Agent 工具：能透過自然語言幫主人記待辦、設鬧鐘、換飾品、查狀態、讀剪貼簿、精準算 Hash/Base64，以及查詢自身版本與說明。',
    '- 7 種使用情境 × 4 種性格：全能日常／程式開發／辦公效率／學習進修／靈感寫作／療癒陪伴／自訂情境，自由搭配親切／吟遊詩人／傲嬌／自訂語氣。',
    '- 智慧剪貼簿主動感知（選配）：離線正則偵測複製的報錯、程式碼、JSON 或英文段落並浮現提示，一鍵分析。',
    '- 鬧鐘與頑皮跟隨：支援週期與指定日期鬧鐘、鳥鳴音效，以及逾時未關時奇異鳥主動走向滑鼠撒嬌催促。',
    '- 日系繪本美術與動畫：13 張統一對齊水彩繪本精靈圖（含一體化針織毛絨窩睡姿、自然眨眼、邁步走路、啄食雙幀、AI 托喙思考、動態接地陰影）。',
    '- 豐富防重複自言自語：200+ 語料與 40 句不重複滑動視窗，涵蓋時段、星期、情境、待辦、飾品與睡覺夢話，支援點擊接話。'
  ].join('\n');
}

function formatPathsSection() {
  return [
    '【本機資料與快取位置】',
    `- 資料根目錄：${dataDir}`,
    `- 狀態與設定檔：${petStatePath}`,
    `- 鬧鐘排程檔：${alarmsPath}`,
    `- 加密對話紀錄：${historyPath}`,
    `- AI 用量配額統計：${usagePath}`,
    `- 模型清單與測試紀錄快取：${modelCachePath}`,
    '- 可於「設定中心 › AI 助手 › 資料快取」一鍵檢視大小、清除快取或開啟資料夾。'
  ].join('\n');
}

/**
 * 依指定主題組合 Wiki Wiki 應用程式資訊與使用說明
 * @param {string} topic - 'all' | 'version' | 'settings' | 'usage' | 'shortcuts' | 'commands' | 'features' | 'paths'
 * @param {object} [options] - 測試用可選路徑注入
 */
function getAppInfo(topic = 'all', options = {}) {
  const normalized = String(topic || 'all').toLowerCase().trim();
  const safeTopic = VALID_TOPICS.includes(normalized) ? normalized : 'all';

  const pkg = loadPackageInfo(options.pkgPath);
  const state = options.state !== undefined ? options.state : loadCurrentState(options.statePath);

  switch (safeTopic) {
    case 'version':
      return formatVersionSection(pkg);
    case 'settings':
      return formatSettingsSection(state);
    case 'usage':
      return formatUsageSection();
    case 'shortcuts':
      return formatShortcutsSection(state);
    case 'commands':
      return formatCommandsSection();
    case 'features':
      return formatFeaturesSection();
    case 'paths':
      return formatPathsSection();
    case 'all':
    default:
      return [
        formatVersionSection(pkg),
        '',
        formatSettingsSection(state),
        '',
        formatUsageSection(),
        '',
        formatShortcutsSection(state),
        '',
        formatCommandsSection(),
        '',
        formatFeaturesSection()
      ].join('\n');
  }
}

module.exports = {
  VALID_TOPICS,
  getAppInfo,
  loadPackageInfo
};
