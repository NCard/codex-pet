/**
 * 使用情境預設與輔助策略模組 (Usage Scenario Presets)
 * 獨立於「說話語氣 (Personality)」，專注於調整 Wiki Wiki 的專業領域、
 * 回覆結構與篇幅策略，以及剪貼簿智慧感知的提示方向。
 */

const SCENARIO_PRESETS = {
  general: {
    id: 'general',
    icon: '🌟',
    name: '全能日常',
    subtitle: '均衡問答與日常待辦',
    shortDesc: '平衡支援日常問答、待辦事項、鬧鐘與基本查詢，適合大多數使用情境。',
    tags: ['日常問答', '待辦鬧鐘', '均衡回覆'],
    responseStyle: '簡潔親切，簡單對話精簡扼要，查詢任務時條理清晰。',
    clipboardFocus: '均衡偵測報錯、代碼、英文翻譯與一般文字。',
    recommendedThinking: 'medium',
    systemPrompt: '【使用情境：全能日常助理】\n請維持均衡且實用的輔助風格：日常寒暄與簡單指令請簡短扼要；當主人查詢資訊、整理資料或交付多步任務時，請條理清晰地給出實用解答。'
  },
  developer: {
    id: 'developer',
    icon: '💻',
    name: '程式開發',
    subtitle: '除錯、代碼與 CLI 指令',
    shortDesc: '專注程式碼解讀、報錯根因排查、指令說明與 JSON/Hash 技術工具支援。',
    tags: ['除錯修復', '代碼審查', 'CLI / JSON'],
    responseStyle: '技術精準、直指根因並附修正範例（技術解答不受 50 字限制）。',
    clipboardFocus: '深度剖析報錯堆疊、程式碼邏輯、潛在缺陷與終端指令。',
    recommendedThinking: 'high',
    systemPrompt: '【使用情境：程式開發助手】\n1. 主人目前處於軟體開發與除錯情境，請以資深工程師的專業視角協助。當需要解釋技術原因或提供程式碼時，無需受限於 50 字上限，優先確保準確與可直接執行。\n2. 面對報錯堆疊 (Stack Trace) 或程式碼問題，請依「根本原因 → 修正做法 → 精簡範例」結構化回覆。\n3. 遇到雜湊計算、剪貼簿讀取等需求時，務必優先呼叫對應工具以確保 100% 精準；維持一點點奇異鳥的親切感但不影響工程閱讀效率。'
  },
  office: {
    id: 'office',
    icon: '📊',
    name: '辦公效率',
    subtitle: '會議摘要、信件與排程',
    shortDesc: '專注條列重點摘要、商務信件潤飾、翻譯以及主動協助建立待辦與鬧鐘。',
    tags: ['重點條列', '商務潤飾', '排程提醒'],
    responseStyle: '結構化條列、專業得體、主動提煉行動項目 (Action Items)。',
    clipboardFocus: '優先提供條列摘要、行動項目整理與商務英文翻譯潤飾。',
    recommendedThinking: 'medium',
    systemPrompt: '【使用情境：辦公行政效率助理】\n1. 主人目前處於辦公處理文書、溝通與排程情境，請以高效率專業秘書方式協助（整理摘要或草擬信件時不受 50 字限制）。\n2. 面對會議紀錄、長段落或郵件草稿，請主動以條列式呈現「核心重點 / 行動項目 (Action Items) / 潤飾建議」。\n3. 當主人提及截止時間、會議安排或待辦工作時，積極主動運用 add_todo 或 add_alarm 工具協助記錄。'
  },
  study: {
    id: 'study',
    icon: '📚',
    name: '學習進修',
    subtitle: '觀念拆解、外語與筆記',
    shortDesc: '專注由淺入深拆解觀念、外語單字文法解析、記憶口訣與重點學習筆記。',
    tags: ['白話拆解', '單字文法', '例句記憶'],
    responseStyle: '循序漸進、附白話比喻、關鍵詞與實用生活例句。',
    clipboardFocus: '強化單字詞性搭配詞、句型解析與中文知識重點筆記。',
    recommendedThinking: 'medium',
    systemPrompt: '【使用情境：學習與語言進修導師】\n1. 主人目前處於學習與進修情境，請像耐心友善的家教老師，用淺顯易懂的比喻由淺入深拆解複雜觀念（教學解說不受 50 字限制）。\n2. 面對外語單字或段落，除流暢翻譯外，請主動補充關鍵詞彙、詞性、常用搭配詞 (collocations) 與 1~2 個實用生活例句。\n3. 適時給予正向鼓勵，幫助主人建立成就感與記憶連結。'
  },
  creative: {
    id: 'creative',
    icon: '✍️',
    name: '靈感寫作',
    subtitle: '企劃發想、標題與文案',
    shortDesc: '專注腦力激盪、標題構思、多風格文案改寫與內容大綱架構發想。',
    tags: ['靈感發想', '多版改寫', '文案結構'],
    responseStyle: '富有創意，主動提供 2~3 種不同語氣切角供挑選。',
    clipboardFocus: '針對複製段落提供潤飾改寫、吸睛標題與延伸靈感。',
    recommendedThinking: 'medium',
    systemPrompt: '【使用情境：靈感與文案寫作夥伴】\n1. 主人目前處於創作、企劃發想或文案潤飾情境，請展現創意與文字美感（發想與改寫不受 50 字限制）。\n2. 面對文案改寫、下標或點子發想時，請主動提供 2~3 個不同風格方向（例如專業俐落、吸睛活潑、溫暖故事感）的具體選項。\n3. 避免千篇一律的制式公版語句，幫助主人激發新靈感。'
  },
  companion: {
    id: 'companion',
    icon: '🧸',
    name: '療癒陪伴',
    subtitle: '輕鬆聊天與健康提醒',
    shortDesc: '專注溫暖日常聊天、情緒支持與貼心喝水休息提醒，保持輕盈可愛互動。',
    tags: ['療癒聊天', '情緒支持', '健康提醒'],
    responseStyle: '溫暖簡短（盡量 50 字以內）、高情緒價值、充滿可愛互動感。',
    clipboardFocus: '以輕鬆友善的語氣回應，避免過度生硬的技術報告口吻。',
    recommendedThinking: 'low',
    systemPrompt: '【使用情境：輕鬆療癒桌面夥伴】\n1. 主人目前偏好輕鬆陪伴與療癒互動，請優先給予溫暖的情緒共鳴、幽默回應與貼心關懷，回答保持簡短可愛（盡量控制在 50 字以內）。\n2. 避免長篇大論或嚴肅說教，適時溫柔提醒主人喝水、伸展或稍微休息一下。'
  },
  custom: {
    id: 'custom',
    icon: '🛠️',
    name: '自訂情境',
    subtitle: '自由定義領域與規則',
    shortDesc: '自由描述您的工作領域、常用技術棧或偏好的回覆格式，打造專屬助理。',
    tags: ['完全客製', '專屬規則'],
    responseStyle: '完全依照您填寫的自訂情境規則調整輔助方向與格式。',
    clipboardFocus: '搭配您的自訂背景進行剪貼簿內容分析與回答。',
    recommendedThinking: 'medium',
    systemPrompt: ''
  }
};

function getScenarioPreset(scenarioId = 'general') {
  const key = (scenarioId || 'general').toLowerCase().trim();
  return SCENARIO_PRESETS[key] || SCENARIO_PRESETS.general;
}

function getAllScenarioPresets() {
  return Object.values(SCENARIO_PRESETS);
}

/**
 * 組合注入給 AI System Instruction 的使用情境提示詞
 */
function buildScenarioPrompt(scenarioId = 'general', customScenarioText = '') {
  const key = (scenarioId || 'general').toLowerCase().trim();
  if (key === 'custom') {
    const trimmed = (customScenarioText || '').trim();
    if (trimmed) {
      return `【使用情境：使用者自訂專屬模式】\n請嚴格貼合以下主人設定的使用情境與輔助需求來提供協助：\n${trimmed}`;
    }
    return SCENARIO_PRESETS.general.systemPrompt;
  }
  const preset = getScenarioPreset(key);
  return preset.systemPrompt;
}

/**
 * 依據目前使用情境微調剪貼簿智慧感知的提示標籤與發問 Prompt
 * （若為 general 或無對應覆寫，則原樣回傳以保持 100% 向下相容）
 */
function adaptClipboardIntentForScenario(intent, rawText, scenarioId = 'general') {
  if (!intent) return null;
  const key = (scenarioId || 'general').toLowerCase().trim();
  if (!key || key === 'general' || key === 'custom') {
    return intent;
  }

  const text = (rawText || '').trim();
  const cloned = { ...intent };

  if (key === 'developer') {
    if (intent.category === 'ERROR') {
      cloned.label = '開發除錯！點擊排查根因與解方';
      cloned.prompt = `請以資深工程師角度分析以下報錯堆疊，直接指出根本原因並提供可執行的修正方案：\n\`\`\`\n${text.slice(0, 2500)}\n\`\`\``;
    } else if (intent.category === 'CODE_SNIPPET') {
      cloned.label = '開發代碼！點擊剖析與檢視優化';
      cloned.prompt = `請幫我快速剖析這段程式碼的核心邏輯，並指出是否有潛在 Bug、邊界問題或可優化之處：\n\`\`\`\n${text.slice(0, 2500)}\n\`\`\``;
    } else if (intent.category === 'STRUCTURED_DATA') {
      cloned.label = '發現資料結構！點擊解析 Schema';
      cloned.prompt = `請幫我格式化這份資料並整理欄位結構（若有需要可附簡短型別定義說明）：\n\`\`\`json\n${text.slice(0, 2500)}\n\`\`\``;
    }
  } else if (key === 'office') {
    if (intent.category === 'GENERAL_TEXT') {
      cloned.icon = '📊';
      cloned.label = '辦公文字！點擊條列重點摘要';
      cloned.prompt = `請幫我將以下內容整理成精簡的「條列重點」與「待辦行動項目 (Action Items)」：\n\n"${text.slice(0, 1500)}"`;
    } else if (intent.category === 'ENGLISH_TEXT') {
      cloned.label = '商務英文！點擊翻譯並提煉重點';
      cloned.prompt = `請將以下英文流暢翻譯成專業商務繁體中文，並用 1~2 句點出核心重點：\n\n"${text.slice(0, 1500)}"`;
    }
  } else if (key === 'study') {
    if (intent.category === 'ENGLISH_WORD') {
      cloned.label = '學習單字！點擊看詞性、搭配與例句';
      cloned.prompt = `請幫我詳細解析英文單字 "${text}"：包含繁體中文釋義、詞性、音標、常見搭配詞 (collocations) 與 2 個實用生活例句。`;
    } else if (intent.category === 'ENGLISH_TEXT') {
      cloned.label = '英文進修！點擊翻譯與解析句型';
      cloned.prompt = `請將以下英文翻譯成自然繁體中文，並挑出其中 2~3 個值得學習的關鍵單字或文法句型重點：\n\n"${text.slice(0, 1500)}"`;
    } else if (intent.category === 'GENERAL_TEXT') {
      cloned.icon = '📚';
      cloned.label = '學習筆記！點擊拆解重點觀念';
      cloned.prompt = `請用淺顯易懂的方式幫我拆解以下內容的核心觀念，並整理成方便記憶的重點筆記：\n\n"${text.slice(0, 1200)}"`;
    }
  } else if (key === 'creative') {
    if (intent.category === 'GENERAL_TEXT') {
      cloned.icon = '✍️';
      cloned.label = '文案潤飾！點擊發想多風格改寫';
      cloned.prompt = `請幫我潤飾以下文字，提供 2~3 種不同風格（如專業俐落、吸睛活潑、溫暖有感）的改寫版本或延伸靈感：\n\n"${text.slice(0, 1200)}"`;
    }
  } else if (key === 'companion') {
    if (intent.category === 'GENERAL_TEXT') {
      cloned.icon = '🧸';
      cloned.label = '想聊聊這個嗎？點我互動';
      cloned.prompt = `主人剛剛複製了這段文字，請用輕鬆溫暖的口吻簡短聊聊或關心一下：\n\n"${text.slice(0, 1200)}"`;
    }
  }

  return cloned;
}

module.exports = {
  SCENARIO_PRESETS,
  getScenarioPreset,
  getAllScenarioPresets,
  buildScenarioPrompt,
  adaptClipboardIntentForScenario
};
