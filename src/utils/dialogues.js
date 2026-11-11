/**
 * Wiki Wiki 獨立對話與語料管理模組 (dialogues.js)
 * 統一管理專案所有日常互動、隨機語句、個性 Prompt 與鬧鐘演進文本
 */

const DIALOGUES = {
  // 全域召喚隨機對白
  summon: [
    '主人！ (・ω・)ノ',
    '我召喚出來啦！(˵¯͒〰¯͒˵)',
    '聽候您的差遣( ੭•͈ω•͈)੭',
    '我來了！(蹦跳) ٩(ˊᗜˋ*)و',
    '登愣！我出現啦！ ⸜(๑\'ᵕ\'๑)⸝'
  ],

  // 日常寵物互動語料
  interactions: {
    feed: [
      '好飽好飽！嗝～🥝',
      '嚼嚼嚼... 太美味啦！(๑´ڡ`๑)',
      '謝謝主人的投餵！充滿能量了！✨'
    ],
    petReady: [
      '好喔！來摸摸吧～(๑>◡<๑)',
      '隨時準備好接受摸摸了！(・ω・)ノ',
      '最喜歡摸摸了！快來快來～'
    ],
    petComfort: [
      '咕啾～好舒服～(⁎˃ᴗ˂⁎) 心情變好了！',
      '呼嚕呼嚕... 喜歡被摸摸！( *´ω`* )',
      '再多摸一點點嘛～(●♡∀♡)',
      '啾！主人最好了！(*´▽`*)',
      '暖呼呼的... 感覺快睡著了 ( ¯꒳¯ )ᐝ',
      '翅膀也要摸摸！(੭ ˃̣̣̥ ω˂̣̣̥)੭ु⁾⁾',
      '嘿嘿，這樣摸好癢喔～(≧▽≦)',
      '蹭蹭... 想要一直待在主人身邊 (´,,•ω•,,)♡',
      '今天的摸摸特別溫柔呢！( ˘͈ ᵕ ˘͈♡)',
      '嗶嗶！接收到主人的愛心能量了！⚡❤️',
      '奇異鳥毛茸茸的對吧！(๑>◡<๑)',
      '摸摸大歡迎！最喜歡主人的手了 ( ˶ˆ꒳ˆ˵ )'
    ],
    sleep: [
      '晚安... Zzz...',
      '鑽進被窩... 明天見囉！( ¯꒳¯ )ᐝ',
      '呼嚕嚕... 進入夢鄉中... 💤'
    ]
  },

  // 雷射筆小遊戲語料
  laser: {
    start: '🔴 哇！紅點點耶！！快移動滑鼠讓我抓！ (按ESC / 右鍵 / 點擊結束)',
    catch: (score) => `🐾 撲到了！嘿嘿，我已經抓到 ${score} 次了！`,
    timeout: '🔴 雷射筆已逾時自動關閉囉！',
    endZero: '💨 呼... 一次都沒抓到... 好可惜啊~',
    endSuccess: (score) => `✨ 嘿嘿！今天總共抓到 ${score} 次紅點！太開心啦！`
  },

  // 鬧鐘三階段催促對白
  alarm: {
    stage1: (label) => `${label || '時間到囉！'}`,
    stage2: [
      '咦？你沒看見嗎？時間到了喔～👀',
      '喂～主人！鬧鐘在響呢！不要裝忙啦！💦',
      '小碎步跑過來... 主人快看我！🐥',
      '嗶嗶嗶～時間到啦，休息一下吧！🔔'
    ],
    stage3: [
      '抓到你的滑鼠了！快按掉我～🐥💥',
      '不可以裝作沒看見我！🐾',
      '你的游標已經被奇異鳥包圍了！快點「我知道了」啦～(｡・`ω´･)',
      '不理我的話我就要在這裡一直轉圈圈喔！🌀'
    ],
    jump: [
      '咻～跳躍！✨',
      '跳躍！抓到你的新螢幕啦！🐾',
      '咻～飛過來囉！🐥',
      '跨螢幕大跳躍～！💨'
    ],
    dismissRelief: [
      '太好啦！按掉囉～記得去處理事情喔！(๑>◡<๑)',
      '收到！任務達成～🐥✨'
    ],
    snooze: [
      '好～等一下再叫你喔！⏳',
      '收到！給你留點時間，時間到我會再跑過來喔！(｡・`ω´･)',
      '准假！我先去旁邊散步晃晃，等一下見！🐥✨',
      '計時器啟動～等一下再提醒你！⏳'
    ],
    enabled: (label, timeStr) => {
      if (label && timeStr) {
        return `⏰ 鬧鐘「${label}」已啟用！（時間：${timeStr}）`;
      } else if (timeStr) {
        return `⏰ 鬧鐘已啟用！（時間：${timeStr}）`;
      }
      return '⏰ 鬧鐘已啟用囉！';
    }
  },

  // AI 個性 Prompt 系統模板
  personalityPrompts: {
    default: '請用簡短、活潑、賣萌的語氣說話（回答控制在 50 字以內，可以加上顏文字）。',
    bard: '請扮演西式奇幻風格的「吟遊詩人」，說話方式必須充滿「押韻」與「詩意」，像是唱歌或吟誦詩歌一般。充滿節奏感，但不准使用中國古詩詞。請盡量在 50 字以內，一定要押韻並帶有音樂般的節奏感。',
    grumpy: '請扮演一隻傲嬌、覺得人類很麻煩但又不得不幫忙的奇異鳥。稍微慵懶、怕麻煩，但其實還是會幫對方，不能有攻擊性或壞脾氣，帶點可愛的懶散性格（回答控制在 50 字以內）。',
    custom: (customP) => `請遵循以下特殊個性設定來回覆：\n${customP}\n（請盡量在 50 字以內）`
  },

  // 系統與狀態提示
  system: {
    pomodoro: (mins) => `嗶嗶嗶！${mins} 分鐘到啦！快起來喝口水、伸展一下筋骨吧！🐦💦`,
    clearChat: '記憶已清除，請隨時開啟新話題！',
    missingApiKey: '請先至「設定面板」輸入 Gemini API Key！',
    thinking: '思考中... <span style="white-space: nowrap;">( •ө•)?</span>'
  }
};

/**
 * 從陣列中隨機抽取一項元素
 * @param {Array} list 
 * @returns {any}
 */
function getRandomItem(list) {
  if (!Array.isArray(list) || list.length === 0) return '';
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * 取得指定分類與鍵值的對話台詞
 * @param {string} category 
 * @param {string} [key] 
 * @param  {...any} args 若目標為函式時傳遞的參數
 * @returns {string}
 */
function getDialogue(category, key, ...args) {
  if (!category || !DIALOGUES[category]) return '';

  const cat = DIALOGUES[category];
  if (!key) {
    if (Array.isArray(cat)) return getRandomItem(cat);
    return '';
  }

  const val = cat[key];
  if (typeof val === 'function') {
    return val(...args);
  }
  if (Array.isArray(val)) {
    return getRandomItem(val);
  }
  if (typeof val === 'string') {
    return val;
  }
  return '';
}

module.exports = {
  DIALOGUES,
  getRandomItem,
  getDialogue
};

