require('../../utils/logger');
window.onerror = function(message, source, lineno, colno, error) {
  console.error('[Renderer Global Error]:', message, 'at', lineno + ':' + colno, error);
};
window.addEventListener('unhandledrejection', function(event) {
  console.error('[Renderer UnhandledRejection]:', event.reason);
});
const kiwi = document.getElementById('kiwi-sprite-wrapper');
const chatBubble = document.getElementById('chat-bubble');
const chatInput = document.getElementById('chat-input');
const chatEscHint = document.getElementById('chat-esc-hint');
const customMenu = document.getElementById('custom-menu');
const menuSleep = document.getElementById('menu-sleep');
const menuClose = document.getElementById('menu-close');
const menuHistory = document.getElementById('menu-history');
const menuAlarm = document.getElementById('menu-alarm');
const menuTodo = document.getElementById('menu-todo');
const menuFeed = document.getElementById('menu-feed');
const menuPet = document.getElementById('menu-pet');
const menuLaser = document.getElementById('menu-laser');
const menuOutfit = document.getElementById('menu-outfit');
const menuSettings = document.getElementById('menu-settings');
const laserDot = document.getElementById('laser-dot');

const kiwiOutfit = document.getElementById('kiwi-outfit');
const kiwiBed = document.getElementById('kiwi-bed');
const outfits = ['', '🎩', '🕶️', '🎀', '👑', '🌸', '🎓', '🎃', '🎉', '🥽'];
const defaultOutfitConfigs = {
  '🎩': { x: 62, y: -31, scale: 60 },
  '🕶️': { x: 76, y: 17, scale: 51 },
  '🎀': { x: 79, y: 75, scale: 40 },
  '👑': { x: 59, y: -38, scale: 60 },
  '🌸': { x: 80, y: -18, scale: 20 },
  '🎓': { x: 60, y: -34, scale: 60 },
  '🎃': { x: 60, y: -32, scale: 44 },
  '🎉': { x: 60, y: -35, scale: 55 },
  '🥽': { x: 76, y: 15, scale: 45 }
};

let isOutfitEditMode = false;

const path = require('path');
const { petStatePath: statePath, historyPath, alarmsPath } = require('../../utils/paths');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const { ipcRenderer } = require('electron');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { GoogleGenAI } = require('@google/genai');
const cryptoUtils = require('../../utils/crypto_utils');
const { spawn } = require('child_process');
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");

// 載入設定檔套用 CSS 變數
function applySettings(settings) {
  if (!settings) return;
  const root = document.documentElement;
  if (settings.bedX !== undefined) root.style.setProperty('--bed-x', `${settings.bedX}px`);
  if (settings.bedY !== undefined) root.style.setProperty('--bed-y', `${settings.bedY}px`);
  if (settings.bedScale !== undefined) root.style.setProperty('--bed-scale', `${settings.bedScale}px`);
  if (settings.bedZ !== undefined) root.style.setProperty('--bed-z', settings.bedZ);
  if (settings.animSpeed !== undefined) root.style.setProperty('--anim-speed', settings.animSpeed);
}

// 初始化 MCP Client
let mcpClient = null;
let mcpToolsList = [];
let geminiTools = [];

async function initMCP() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(__dirname, '../../mcp/mcp-server.js')],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  });
  
  mcpClient = new Client({ name: "wiki-wiki-client", version: "1.0.0" }, { capabilities: {} });
  await mcpClient.connect(transport);
  
  const toolsRes = await mcpClient.listTools();
  mcpToolsList = toolsRes.tools;
  
  if (mcpToolsList.length > 0) {
    geminiTools = [{
      functionDeclarations: mcpToolsList.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.inputSchema
      }))
    }];
  }
  console.log("MCP Client initialized, tools:", mcpToolsList.map(t => t.name));
}

initMCP().catch(console.error);

const stateManager = require('./state.js');
let petState = stateManager.petState;

// 啟動時載入狀態
stateManager.loadPetState();

// 為了相容原本直接呼叫這幾個函式的地方，建立 alias
const loadPetState = () => stateManager.loadPetState();
const savePetState = () => stateManager.savePetState();
const saveChatHistory = (role, message) => stateManager.saveChatHistory(role, message);
const clearChatHistory = () => stateManager.clearChatHistory();
applySettings(petState.settings);
// 初始化待辦事項 UI
// (已經移至獨立視窗)
const outfitContainer = document.getElementById('outfit-container');
// 初始化裝扮
if (petState.outfits && petState.outfits.length > 0) {
  applyOutfitPos();
}

// 番茄鐘狀態
let pomodoroTimer = null;
let isWorking = false;

// 初始化 Gemini API 客戶端
let ai = null;

function initAI() {
  const apiKey = (petState.settings && petState.settings.apiKey) ? petState.settings.apiKey : process.env.GEMINI_API_KEY;
  if (apiKey) {
    ai = new GoogleGenAI({ apiKey: apiKey });
  } else {
    ai = null;
  }
}
initAI();
const kiwiAccessory = document.getElementById('kiwi-accessory');

// 取得對話泡泡內部元素
const chatContent = document.getElementById('chat-content');
const chatClose = document.getElementById('chat-close');

// 點擊關閉按鈕隱藏泡泡
chatClose.addEventListener('click', () => {
  chatBubble.style.display = 'none';
});

// 按下 ESC 也可以隱藏各種浮動面板 (全域監聽)
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (customMenu.style.display !== 'none') {
      customMenu.style.display = 'none';
    } else if (chatBubble.style.display === 'block') {
      chatBubble.style.display = 'none';
    }
  }
});

// 設定名稱前綴的 HTML
const namePrefix = '<span style="color: #c97a2e; font-weight: 900;">Wiki Wiki：</span>';

let bubbleTimeout = null;
function showTempBubble(text, duration = 5000) {
  if (isAlarmActive) return; // 不要覆蓋提醒氣泡
  chatBubble.style.display = 'block';
  chatContent.innerHTML = `${namePrefix}${text}`;
  
  if (bubbleTimeout) clearTimeout(bubbleTimeout);
  bubbleTimeout = setTimeout(() => {
    chatBubble.style.display = 'none';
  }, duration);
}

ipcRenderer.on('summon-pet', () => {
  chatBubble.style.display = 'block';
  chatInput.focus();
});

ipcRenderer.on('show-update-progress', (event, { percent, speed, text }) => {
  if (isAlarmActive) return;
  chatBubble.style.display = 'block';
  if (bubbleTimeout) clearTimeout(bubbleTimeout);
  
  if (text) {
    chatContent.innerHTML = text;
  } else {
    chatContent.innerHTML = `📥 正在下載更新... <b>${percent}%</b><br><span style="font-size:11px; color:#555;">(${speed})</span>`;
  }
});

let isAlarmActive = false;
let snoozedAlarms = [];

function showAlarmBubble(alarm) {
  isAlarmActive = true;
  chatBubble.style.display = 'block';
  if (bubbleTimeout) clearTimeout(bubbleTimeout);
  
  const snoozeMins = alarm.snoozeInterval || 5;
  
  chatContent.innerHTML = `
    ${namePrefix}⏰ 提醒：<br>
    <div style="margin: 5px 0; word-break: break-all;">${alarm.message}</div>
    <div style="display: flex; gap: 5px; margin-top: 8px;">
      <button id="btn-alarm-ok" style="flex:1; padding: 4px; border: none; background: #4caf50; color: white; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">我知道了</button>
      <button id="btn-alarm-snooze" style="flex:1; padding: 4px; border: none; background: #ff9800; color: white; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">貪睡 ${snoozeMins}分</button>
    </div>
  `;
  
  document.getElementById('btn-alarm-ok').onclick = () => {
    isAlarmActive = false;
    chatBubble.style.display = 'none';
  };
  
  document.getElementById('btn-alarm-snooze').onclick = () => {
    isAlarmActive = false;
    chatBubble.style.display = 'none';
    const triggerTime = Date.now() + snoozeMins * 60000;
    snoozedAlarms.push({ ...alarm, triggerTime });
  };
}

const physics = require('./physics');

const physicsCtx = {
  get kiwi() { return kiwi; },
  get kiwiAccessory() { return kiwiAccessory; },
  get chatInput() { return chatInput; },
  get chatEscHint() { return typeof chatEscHint !== 'undefined' ? chatEscHint : null; },
  get chatBubble() { return chatBubble; },
  getCurrentAction: () => currentAction,
  setCurrentAction: (val) => { currentAction = val; },
  setPos: (newX, newY) => { x = newX; y = newY; },
  getPetState: () => petState
};

physics.initDragging(physicsCtx);


// 全域監聽 ESC 鍵關閉對話
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (chatInput.style.display !== 'none' || chatBubble.style.display !== 'none') {
      chatInput.style.display = 'none';
      if(typeof chatEscHint !== 'undefined') chatEscHint.style.display = 'none';
      chatBubble.style.display = 'none';
      chatInput.value = '';
    }
  }
});

// 監聽輸入框的 Enter 鍵事件，呼叫 Gemini
chatInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Tab') {
    const text = chatInput.value;
    if (text.startsWith('/')) {
      e.preventDefault(); // 防止失去焦點
      const commands = ['/help', '/laser', '/md5', '/base64', '/uuid', '/calc', '/pomodoro', '/todo', '/clear'];
      const match = commands.find(c => c.startsWith(text));
      if (match) {
        chatInput.value = match + ' ';
      }
    }
    return;
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault(); // 防止 textarea 換行
    const text = chatInput.value.trim();
    if (!text) return;
    
    // 防呆：如果沒有設定 API Key
    if (!ai) {
      chatInput.value = '';
      chatInput.style.display = 'none';
      if(typeof chatEscHint !== 'undefined') chatEscHint.style.display = 'none';
      chatBubble.innerHTML = `${namePrefix}請先至「設定面板」輸入 Gemini API Key！`;
      chatBubble.style.display = 'block';
      setTimeout(() => { chatBubble.style.display = 'none'; }, 3000);
      return;
    }
    
    // 停用並隱藏輸入框，顯示思考中
    chatInput.style.display = 'none';
      if(typeof chatEscHint !== 'undefined') chatEscHint.style.display = 'none';
    chatInput.disabled = true;
    chatInput.value = '';
    chatBubble.style.display = 'block';
    chatContent.innerHTML = `${namePrefix}思考中... <span style="white-space: nowrap;">( •ө•)?</span>`;
    
    // 儲存使用者對話
    saveChatHistory('user', text);
    
    // 指令模式判斷
    if (text.startsWith('/')) {
      const parts = text.split(' ');
      const cmd = parts[0];
      let argStr = parts.slice(1).join(' ').trim();
      
      let reply = '';
      if (cmd === '/help') {
        reply = 'Wiki Wiki 指令模式喵！<br>' +
                '<b>/help</b> : 顯示這個說明<br>' +
                '<b>/laser</b> : 開啟/關閉雷射筆追逐遊戲 🔴<br>' +
                '<b>/md5 [字串]</b> : 轉成 md5 32碼<br>' +
                '<b>/base64 [encode/decode] [字串]</b> : base64 轉換<br>' +
                '<b>/uuid</b> : 產生隨機 UUID<br>' +
                '<b>/calc [算式]</b> : 幫你算數學 (例如 1+1)<br>' +
                '<b>/pomodoro [分鐘]</b> : 啟動番茄鐘 (預設25分)<br>' +
                '<b>/todo [事項]</b> : 新增待辦事項<br>' +
                '<b>/clear</b> : 清除歷史對話紀錄';
      } else if (cmd === '/laser') {
        toggleLaserGame();
        chatInput.disabled = false;
        return;
      } else if (cmd === '/md5') {
        // 如果前後有雙引號，則去除
        if (argStr.startsWith('"') && argStr.endsWith('"')) {
          argStr = argStr.substring(1, argStr.length - 1);
        }
        if (!argStr) {
          reply = '喵？沒有給我要轉換的字串喔！請用 /md5 "字串"';
        } else {
          const hash = crypto.createHash('md5').update(argStr).digest('hex');
          reply = `嗶嗶！Wiki Wiki 用力一啄！(•ө•)♡<br><code>${hash}</code>`;
        }
      } else if (cmd === '/base64') {
        const subCmd = argStr.split(' ')[0];
        const textToConvert = argStr.substring(subCmd.length).trim();
        if (subCmd === 'encode') {
          reply = `Base64 編碼：<br><code>${Buffer.from(textToConvert).toString('base64')}</code>`;
        } else if (subCmd === 'decode') {
          reply = `Base64 解碼：<br><code>${Buffer.from(textToConvert, 'base64').toString('utf8')}</code>`;
        } else {
          reply = '喵？請輸入 `/base64 encode 字串` 或 `/base64 decode 字串`';
        }
      } else if (cmd === '/uuid') {
        reply = `送你一個熱騰騰的 UUID：<br><code>${crypto.randomUUID()}</code>`;
      } else if (cmd === '/calc') {
        try {
          // 簡易安全替換，避免注入
          const safeMath = argStr.replace(/[^0-9+\-*/().]/g, '');
          const result = new Function(`return ${safeMath}`)();
          reply = `Wiki Wiki 算出來了！<br><code>${argStr} = ${result}</code>`;
        } catch (e) {
          reply = '數學太難了，Wiki Wiki 腦袋打結惹 😵‍💫';
        }
      } else if (cmd === '/pomodoro') {
        let mins = parseInt(argStr) || 25;
        reply = `番茄鐘啟動！Wiki Wiki 會陪你專注 ${mins} 分鐘！加油！(๑•̀ㅂ•́)و✧`;
        
        isWorking = true;
        kiwiAccessory.innerText = '⏳';
        kiwiAccessory.style.display = 'block';
        clearTimeout(pomodoroTimer);
        
        pomodoroTimer = setTimeout(() => {
          isWorking = false;
          kiwiAccessory.style.display = 'none';
          chatBubble.style.display = 'block';
          chatContent.innerHTML = `${namePrefix}嗶嗶嗶！${mins} 分鐘到啦！快起來喝口水、伸展一下筋骨吧！🐦💦`;
        }, mins * 60 * 1000);
      } else if (cmd === '/todo') {
        if (!argStr) {
          reply = '喵？請告訴我要記下什麼待辦事項喔！例如 `/todo 買牛奶`';
        } else {
          petState.todos.push({ id: crypto.randomUUID(), text: argStr, done: false, reminderTime: null, snoozeInterval: 5 });
          savePetState();
          reply = `記下來啦！✍️<br>「${argStr}」<br>已經加到待辦清單囉！(你可以右鍵打開「待辦事項」管理喔)`;
        }
      } else if (cmd === '/clear') {
        clearChatHistory();
        reply = '咻！💨 已經幫你把歷史紀錄清得乾乾淨淨啦！';
      } else {
        reply = '這是什麼奇怪的指令呀？Wiki Wiki 聽不懂 (歪頭)<br>試試看 /help 吧！';
      }
      
      chatContent.innerHTML = `${namePrefix}${reply}`;
      saveChatHistory('kiwi', reply);
      
      chatInput.style.display = 'block';
      if(typeof chatEscHint !== 'undefined') chatEscHint.style.display = 'block';
      chatInput.disabled = false;
      chatInput.placeholder = '對話... (Shift+Enter 換行)';
      chatInput.focus();
      
      kiwi.classList.add('jumping');
      setTimeout(() => { kiwi.classList.remove('jumping'); }, 500);
      return;
    }
    
    try {
      const p = petState.settings.aiPersonality || 'default';
      const customP = petState.settings.aiCustomPrompt || '';
      let personaText = "請用簡短、活潑、賣萌的語氣回答問題（回答請盡量在 50 字以內，可以加上顏文字）。";
      if (p === 'bard') {
        personaText = "請扮演西方奇幻風格的吟遊詩人。你的說話方式必須充滿「押韻」與「詩意」，像是在唱歌或朗誦詩歌一樣，充滿音樂感與節奏感，但不要使用中國古詩詞（回答請盡量在 50 字以內，一定要押韻或帶有音樂般的節奏）。";
      } else if (p === 'grumpy') {
        personaText = "請扮演一隻傲嬌、覺得人類很麻煩但又不得不幫忙的奇異鳥。語氣稍微慵懶、嫌麻煩，但其實內心還是關心對方的，不要有攻擊性或真的生氣，有點像傲嬌或懶散的性格（回答請盡量在 50 字以內）。";
      } else if (p === 'custom' && customP) {
        personaText = `請遵循以下特別個性設定來回答問題：「${customP}」（回答請盡量在 50 字以內）。`;
      }

      let contents = [
        { role: 'user', parts: [{ text: `你現在是一隻生活在電腦桌面上的可愛奇異鳥助手，名字叫做「Wiki Wiki」。
${personaText}
【重要指示】：若使用者要求設定、更換服裝，或「查詢目前有哪些鬧鐘/待辦事項」，你必須優先呼叫系統提供的工具 (Tools)。在工具回傳結果之前，請勿輸出任何回覆文字！絕對不能發明假造的工具名稱。
使用者說：${text}` }] }
      ];
      
      let response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents,
        config: { tools: geminiTools.length > 0 ? geminiTools : undefined }
      });
      
      if (response.functionCalls && response.functionCalls.length > 0) {
        const functionResponses = [];
        for (const call of response.functionCalls) {
           console.log("Calling tool:", call.name, call.args);
            try {
              const result = await mcpClient.callTool({ name: call.name, arguments: call.args });
              const textResult = result.content ? result.content.map(c => c.text).join('\n') : "成功";
              
              const fnResp = {
                name: call.name,
                response: { result: textResult }
              };
              if (call.id) fnResp.id = call.id;
              
              functionResponses.push({
                functionResponse: fnResp
              });
             
             // 即時反映本地狀態更新
             if (call.name === 'add_todo' || call.name === 'change_outfit') {
                loadPetState();
                 if (call.name === 'change_outfit') {
                   if (petState.outfit) applyOutfitPos();
                 }
                ipcRenderer.send('pet-state-changed');
             }
             if (call.name === 'add_alarm') {
                ipcRenderer.send('alarms-changed');
             }
           } catch (e) {
             console.error("Tool execution error:", e);
             functionResponses.push({
               functionResponse: {
                 name: call.name,
                 response: { error: e.message }
               }
             });
           }
        }
        
        contents.push(response.candidates[0].content);
        contents.push({ role: 'user', parts: functionResponses });
        
        response = await ai.models.generateContent({
           model: 'gemini-3.5-flash',
           contents,
           config: { tools: geminiTools.length > 0 ? geminiTools : undefined }
        });
      }

      // 避免 AI 回答包含 HTML 標籤破壞畫面
      const safeText = (response.text || "").replace(/</g, '&lt;').replace(/>/g, '&gt;');
      chatContent.innerHTML = `${namePrefix}${safeText}`;
      
      // 儲存奇異鳥回答
      saveChatHistory('kiwi', response.text || "");
      
      // 重新啟用輸入框
      chatInput.style.display = 'block';
      if(typeof chatEscHint !== 'undefined') chatEscHint.style.display = 'block';
      chatInput.disabled = false;
      chatInput.placeholder = '對話... (Shift+Enter 換行)';
      chatInput.focus();
      
      // 收到回答後開心地跳躍
      kiwi.classList.add('jumping');
      setTimeout(() => { kiwi.classList.remove('jumping'); }, 500);
    } catch (err) {
      console.error(err);
      // 判斷是否為額度用盡的錯誤 (429 / RESOURCE_EXHAUSTED) 或 伺服器忙碌 (503)
      if (err.status === 429 || err.status === 'RESOURCE_EXHAUSTED' || (err.message && (err.message.includes('429') || err.message.includes('quota')))) {
        chatContent.innerHTML = `${namePrefix}嗚嗚，主人的 API 額度好像用完了 😭 沒飯吃了，快去申請新的鑰匙餵我！`;
      } else if (err.status === 503 || err.status === 'UNAVAILABLE' || (err.message && err.message.includes('503'))) {
        chatContent.innerHTML = `${namePrefix}Google 伺服器現在大塞車，請等一下再跟我說話喔！ 😵‍💫`;
      } else {
        chatContent.innerHTML = `${namePrefix}咕啾？我的小腦袋打結了，網路連線好像怪怪的 😵‍💫`;
      }
      chatInput.style.display = 'block';
      if(typeof chatEscHint !== 'undefined') chatEscHint.style.display = 'block';
      chatInput.disabled = false;
      chatInput.placeholder = '對話... (Shift+Enter 換行)';
      chatInput.focus();
    }
  }
});

// 右鍵點擊奇異鳥，顯示自訂右鍵選單
kiwi.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  
  // 先顯示選單，才能取得實際寬高
  customMenu.style.display = 'flex';
  
  let menuWidth = customMenu.offsetWidth;
  let menuHeight = customMenu.offsetHeight;
  
  let left = e.clientX + 10;
  let top = e.clientY - 10;
  
  // 防止選單超出 250x250 的視窗邊界而被切掉
  if (left + menuWidth > 250) {
    left = e.clientX - menuWidth - 10;
  }
  if (top + menuHeight > 250) {
    top = e.clientY - menuHeight - 10;
  }
  
  // 終極防線：確保絕對不會掉出左邊和上面的邊界 (小於 0)
  if (left < 5) left = 5;
  if (top < 5) top = 5;
  
  customMenu.style.left = left + 'px';
  customMenu.style.top = top + 'px';
});

// 點擊其他地方關閉選單
window.addEventListener('click', (e) => {
  if (e.target.className !== 'menu-item') {
    customMenu.style.display = 'none';
  }
});

// 綁定選單功能
menuTodo.addEventListener('click', () => {
  customMenu.style.display = 'none';
  ipcRenderer.send('open-todo');
});

menuFeed.addEventListener('click', () => {
  if (currentAction !== 'idle' && currentAction !== 'moving') return; // 只有閒置或走動時可以餵食
  
  customMenu.style.display = 'none';
  petState.hunger = Math.min(100, petState.hunger + 30);
  savePetState();
  
  currentAction = 'eating'; // 進入吃飯狀態
  
  const character = document.getElementById('kiwi-character');
  const food = document.getElementById('kiwi-food');
  
  character.classList.add('kiwi-pecking');
  food.style.display = 'block';
  
  setTimeout(() => {
    character.classList.remove('kiwi-pecking');
    food.style.display = 'none';
    showTempBubble('好飽好飽！嗝～🥝');
    kiwi.classList.add('jumping');
    setTimeout(() => { 
      kiwi.classList.remove('jumping'); 
      if (currentAction === 'eating') currentAction = 'idle'; // 恢復閒置
    }, 500);
  }, 2000);
});

menuPet.addEventListener('click', () => {
  customMenu.style.display = 'none';
  petState.mood = Math.min(100, petState.mood + 20);
  savePetState();
  showTempBubble('咕啾～好舒服～(⁎˃ᴗ˂⁎) 心情變好了！');
  // 顯示愛心特效
  kiwiAccessory.innerText = '❤️';
  kiwiAccessory.style.display = 'block';
  setTimeout(() => { if(!isWorking) kiwiAccessory.style.display = 'none'; }, 2000);
  kiwi.classList.add('jumping');
setTimeout(() => { kiwi.classList.remove('jumping'); }, 500);
});

menuOutfit.addEventListener('click', () => {
  customMenu.style.display = 'none';
  ipcRenderer.send('open-outfit');
  isOutfitEditMode = true;
  if (outfitContainer) {
    Array.from(outfitContainer.children).forEach(child => {
      child.style.pointerEvents = 'auto';
      child.style.cursor = 'grab';
    });
  }
  kiwi.style.animation = 'none'; // 換裝模式暫停呼吸動畫，避免座標跳動
});

let isSettingsEditMode = false;
let isDraggingBed = false;
let bedDragStartX = 0;
let bedDragStartY = 0;
let bedStartMarginLeft = 0;
let bedStartMarginBottom = 0;

menuSettings.addEventListener('click', () => {
  customMenu.style.display = 'none';
  ipcRenderer.send('open-settings');
});

ipcRenderer.on('toggle-bed-edit', (event, isEditing) => {
  if (isEditing) {
    isSettingsEditMode = true;
    kiwi.classList.add('sleeping');
    document.getElementById('kiwi-img').src = '../../../assets/images/kiwi_sleep.png';
    kiwi.style.pointerEvents = 'none';
    kiwiBed.style.display = 'block';
    kiwiBed.style.pointerEvents = 'auto';
    kiwiBed.style.cursor = 'grab';
  } else {
    isSettingsEditMode = false;
    kiwiBed.style.pointerEvents = 'none';
    kiwiBed.style.cursor = 'default';
    kiwi.style.pointerEvents = 'auto';
    if (currentAction !== 'sleeping') {
      kiwiBed.style.display = 'none';
      kiwi.classList.remove('sleeping');
      document.getElementById('kiwi-img').src = '../../../assets/images/kiwi.png';
    }
  }
});

ipcRenderer.on('settings-closed', () => {
  isSettingsEditMode = false;
  kiwiBed.style.pointerEvents = 'none';
  kiwiBed.style.cursor = 'default';
  kiwi.style.pointerEvents = 'auto';
  
  if (currentAction !== 'sleeping') {
    kiwiBed.style.display = 'none';
    kiwi.classList.remove('sleeping');
    document.getElementById('kiwi-img').src = '../../../assets/images/kiwi.png';
  }
});

ipcRenderer.on('outfit-closed', () => {
  isOutfitEditMode = false;
  if (outfitContainer) {
    Array.from(outfitContainer.children).forEach(child => {
      child.style.pointerEvents = 'none';
      child.style.cursor = 'default';
    });
  }
  kiwi.style.animation = ''; // 恢復呼吸動畫
});
// 監聽設定更新
ipcRenderer.on('update-settings', (event, newSettings) => {
  petState.settings = newSettings;
  applySettings(newSettings);
  savePetState();
  initAI();
});

ipcRenderer.on('preview-settings', (event, newSettings) => {
  petState.settings = newSettings;
  applySettings(newSettings);
  initAI();
});

ipcRenderer.on('update-outfit', (event, newOutfits) => {
  petState.outfits = newOutfits || [];
  savePetState();
  applyOutfitPos();
  kiwi.classList.add('jumping');
  setTimeout(() => { kiwi.classList.remove('jumping'); }, 500);
});

ipcRenderer.on('update-outfit-pos', (event, { outfit, x, y, scale }) => {
  if (!petState.outfitConfigs) petState.outfitConfigs = {};
  if (!petState.outfitConfigs[outfit]) {
    petState.outfitConfigs[outfit] = defaultOutfitConfigs[outfit] || { x: 45, y: -10, scale: 60 };
  }
  if (x !== undefined) petState.outfitConfigs[outfit].x = x;
  if (y !== undefined) petState.outfitConfigs[outfit].y = y;
  if (scale !== undefined) petState.outfitConfigs[outfit].scale = scale;
  
  savePetState();
  applyOutfitPos();
});

let activeDraggingOutfit = null;
let activeDraggingElement = null;

let isDraggingOutfit = false;
let outfitDragStartX = 0;
let outfitDragStartY = 0;
let outfitStartLeft = 0;
let outfitStartTop = 0;

function applyOutfitPos() {
  if (!outfitContainer) return;
  outfitContainer.innerHTML = '';
  if (!petState.outfits) petState.outfits = [];
  
  petState.outfits.forEach(outfit => {
    const config = (petState.outfitConfigs && petState.outfitConfigs[outfit]) 
                   || defaultOutfitConfigs[outfit] 
                   || { x: 45, y: -10, scale: 60 };
    
    const div = document.createElement('div');
    div.innerText = outfit;
    div.style.position = 'absolute';
    div.style.left = `${config.x}px`;
    div.style.top = `${config.y}px`;
    div.style.fontSize = `${config.scale}px`;
    div.style.pointerEvents = isOutfitEditMode ? 'auto' : 'none';
    div.style.cursor = isOutfitEditMode ? 'grab' : 'default';
    div.style.zIndex = '5';
    
    div.addEventListener('mousedown', (e) => {
      if (!isOutfitEditMode) return;
      isDraggingOutfit = true;
      activeDraggingOutfit = outfit;
      activeDraggingElement = div;
      
      outfitDragStartX = e.clientX;
      outfitDragStartY = e.clientY;
      div.style.cursor = 'grabbing';
      
      const rect = outfitContainer.getBoundingClientRect();
      const outfitRect = div.getBoundingClientRect();
      outfitStartLeft = outfitRect.left - rect.left;
      outfitStartTop = outfitRect.top - rect.top;
      
      e.preventDefault();
      e.stopPropagation();
    });
    
    div.addEventListener('wheel', (e) => {
      if (!isOutfitEditMode) return;
      e.preventDefault();
      let currentScale = parseInt(div.style.fontSize || 60);
      if (e.deltaY < 0) {
        currentScale += 2;
      } else {
        currentScale -= 2;
      }
      if (currentScale < 10) currentScale = 10;
      if (currentScale > 150) currentScale = 150;
      
      div.style.fontSize = `${currentScale}px`;
      
      if (!petState.outfitConfigs) petState.outfitConfigs = {};
      if (!petState.outfitConfigs[outfit]) petState.outfitConfigs[outfit] = {};
      petState.outfitConfigs[outfit].scale = currentScale;
      savePetState();
      
      ipcRenderer.send('outfit-pos-updated', { outfit, scale: currentScale });
    });
    
    outfitContainer.appendChild(div);
  });
}

kiwiBed.addEventListener('mousedown', (e) => {
  if (!isSettingsEditMode) return;
  isDraggingBed = true;
  bedDragStartX = e.clientX;
  bedDragStartY = e.clientY;
  kiwiBed.style.cursor = 'grabbing';
  
  if (!petState.settings) petState.settings = {};
  bedStartMarginLeft = petState.settings.bedX ?? -4;
  bedStartMarginBottom = petState.settings.bedY ?? -15;
  
  e.preventDefault();
  e.stopPropagation();
});

window.addEventListener('mousemove', (e) => {
  // 加入翻轉參數來修正拖曳方向
  const flip = parseInt(document.getElementById('kiwi-wrapper').style.getPropertyValue('--flip')) || 1;

  if (isDraggingOutfit && activeDraggingElement) {
    const dx = (e.clientX - outfitDragStartX) * flip;
    const dy = (e.clientY - outfitDragStartY);
    let newLeft = outfitStartLeft + dx;
    let newTop = outfitStartTop + dy;
    
    activeDraggingElement.style.left = `${newLeft}px`;
    activeDraggingElement.style.top = `${newTop}px`;
    ipcRenderer.send('outfit-pos-updated', { outfit: activeDraggingOutfit, x: newLeft, y: newTop });
  } else if (isDraggingBed) {
    const flip = parseInt(document.getElementById('kiwi-wrapper').style.getPropertyValue('--flip')) || 1;
    const dx = (e.clientX - bedDragStartX) * flip;
    const dy = (e.clientY - bedDragStartY);
    const newBedX = bedStartMarginLeft + dx;
    const newBedY = bedStartMarginBottom - dy; // margin-bottom direction
    
    petState.settings.bedX = newBedX;
    petState.settings.bedY = newBedY;
    
    applySettings(petState.settings);
    ipcRenderer.send('settings-dragged', { bedX: newBedX, bedY: newBedY });
  }
});

window.addEventListener('mouseup', (e) => {
  if (isDraggingOutfit && activeDraggingElement) {
    isDraggingOutfit = false;
    activeDraggingElement.style.cursor = 'grab';
    
    const currentLeft = parseInt(activeDraggingElement.style.left || 0);
    const currentTop = parseInt(activeDraggingElement.style.top || 0);
    const currentScale = parseInt(activeDraggingElement.style.fontSize || 60);
    
    if (!petState.outfitConfigs) petState.outfitConfigs = {};
    if (!petState.outfitConfigs[activeDraggingOutfit]) petState.outfitConfigs[activeDraggingOutfit] = {};
    
    petState.outfitConfigs[activeDraggingOutfit].x = currentLeft;
    petState.outfitConfigs[activeDraggingOutfit].y = currentTop;
    petState.outfitConfigs[activeDraggingOutfit].scale = currentScale;
    savePetState();
    
    activeDraggingElement = null;
    activeDraggingOutfit = null;
  } else if (isDraggingBed) {
    isDraggingBed = false;
    kiwiBed.style.cursor = 'grab';
    savePetState();
  }
});

// Note: outfit wheel event is now bound directly to the active element in applyOutfitPos

kiwiBed.addEventListener('wheel', (e) => {
  if (!isSettingsEditMode) return;
  e.preventDefault();
  
  if (!petState.settings) petState.settings = {};
  let currentScale = petState.settings.bedScale ?? 170;
  
  if (e.deltaY < 0) {
    currentScale += 5;
  } else {
    currentScale -= 5;
  }
  if (currentScale < 50) currentScale = 50;
  if (currentScale > 300) currentScale = 300;
  
  petState.settings.bedScale = currentScale;
  applySettings(petState.settings);
  savePetState();
  
  ipcRenderer.send('settings-dragged', { bedScale: currentScale });
});

menuSleep.addEventListener('click', () => {
  customMenu.style.display = 'none';
  currentAction = 'sleeping';
  kiwi.classList.add('sleeping');
  const zzz = document.getElementById('kiwi-zzz');
  if (zzz) zzz.style.display = 'block';
  document.getElementById('kiwi-img').src = '../../../assets/images/kiwi_sleep.png';
  document.getElementById('kiwi-bed').style.display = 'block';
  if (typeof outfitContainer !== 'undefined' && outfitContainer) outfitContainer.style.display = 'none';
  
  showTempBubble('晚安... Zzz...');

  // 延遲解除忽略喚醒，避免點擊選單後滑鼠微動立刻喚醒
  ignoreWakeup = true;
  setTimeout(() => { ignoreWakeup = false; }, 1000);
});

menuHistory.addEventListener('click', () => {
  customMenu.style.display = 'none';
  ipcRenderer.send('open-history');
});

menuAlarm.addEventListener('click', () => {
  customMenu.style.display = 'none';
  ipcRenderer.send('open-alarm');
});

menuClose.addEventListener('click', () => {
  customMenu.style.display = 'none';
  ipcRenderer.send('request-close-confirm');
});

const menuCancel = document.getElementById('menu-cancel');
if (menuCancel) {
  menuCancel.addEventListener('click', () => {
    customMenu.style.display = 'none';
  });
}

// --- 雷射筆追逐小遊戲 (Laser Pointer Chase Game - 全螢幕全域 60fps 平滑追逐) ---
let isLaserGameActive = false;
let laserTimeoutTimer = null;
let laserAnimFrame = null;
let laserScore = 0;
let lastPounceTime = 0;
let lastGlobalMouseX = 0;
let lastGlobalMouseY = 0;

let isGameJustStarted = false;
let openingMouseX = 0;
let openingMouseY = 0;
let startMoveTime = 0;

let isWaitingMouseLeave = false;
let pouncedMouseX = 0;
let pouncedMouseY = 0;
let isJumpingBeforeRechase = false;

function resetLaserTimeout() {
  clearTimeout(laserTimeoutTimer);
  if (!isLaserGameActive) return;
  // 滑鼠連續 30 秒無移動時自動結束雷射遊戲 (防止干擾工作)
  laserTimeoutTimer = setTimeout(() => {
    if (isLaserGameActive) {
      toggleLaserGame(false);
      showTempBubble('🔴 雷射筆已逾時自動關閉囉！');
    }
  }, 30000);
}

// 計算螢幕解析度縮放比例 (基於 Full HD 1920x1080 基準，讓 2K/4K 螢幕的移動速度與距離比例保持一致)
function getResolutionScale() {
  try {
    const currentWidth = (window.screen && window.screen.width) ? window.screen.width : 1920;
    const scale = currentWidth / 1920;
    return Math.max(0.75, Math.min(scale, 3.0));
  } catch(e) {
    return 1.0;
  }
}

function updateLaserPhysicsLoop() {
  if (!isLaserGameActive) return;

  try {
    const scale = getResolutionScale();

    // 抓取全螢幕全域滑鼠座標 (跨螢幕、超越單一 Electron 視窗範圍)
    const globalMouse = ipcRenderer.sendSync('get-cursor-pos');
    if (globalMouse && typeof globalMouse.x === 'number' && typeof globalMouse.y === 'number') {
      
      if (globalMouse.x !== lastGlobalMouseX || globalMouse.y !== lastGlobalMouseY) {
        lastGlobalMouseX = globalMouse.x;
        lastGlobalMouseY = globalMouse.y;
        resetLaserTimeout();
      }

      const currentPos = getRealWindowPos();
      const now = Date.now();

      if (currentAction !== 'sleeping' && currentAction !== 'grabbed' && !isDragging) {
        
        // 1. 🛡️ 開場對話階段 (isGameJustStarted)
        // 剛開啟時絕對不觸發抓取與移動，讓使用者看清對話。直到滑鼠拉開 70px (隨解析度縮放) 且滿 3 秒後才跳躍出發！
        if (isGameJustStarted) {
          const distFromStart = Math.hypot(globalMouse.x - openingMouseX, globalMouse.y - openingMouseY);
          const thresholdLeave = 70 * scale;
          
          if (distFromStart < thresholdLeave) {
            // 滑鼠尚未拉開，重置計時器，在原地面向滑鼠
            startMoveTime = 0;
          } else {
            // 滑鼠已拉開 70px，開始計算 3 秒倒數
            if (!startMoveTime) startMoveTime = now;

            if (now - startMoveTime >= 3000) {
              // 滿 3 秒囉！跳一下冒愛心，正式開啟遊戲！
              isGameJustStarted = false;
              startMoveTime = 0;
              isJumpingBeforeRechase = true;

              kiwi.classList.add('jumping');
              const heart = document.getElementById('kiwi-heart');
              if (heart) {
                heart.style.display = 'block';
                heart.style.animation = 'none';
                heart.offsetHeight;
                heart.style.animation = 'floatHeart 1s ease-out forwards';
                setTimeout(() => { heart.style.display = 'none'; }, 1000);
              }

              setTimeout(() => {
                kiwi.classList.remove('jumping');
                isJumpingBeforeRechase = false;
              }, 500);
            }
          }

          // 原地面向滑鼠
          const kiwiRect = kiwi.getBoundingClientRect();
          const kiwiCenterX = currentPos.x + kiwiRect.left + kiwiRect.width / 2;
          const direction = (globalMouse.x - kiwiCenterX) < 0 ? -1 : 1;
          document.getElementById('kiwi-wrapper').style.setProperty('--flip', direction);
          kiwi.classList.remove('kiwi-chasing', 'walking');

          laserAnimFrame = requestAnimationFrame(updateLaserPhysicsLoop);
          return;
        }

        // 2. 🎯 撲倒抓到後的休息階段 (isWaitingMouseLeave)
        // 抓到後停在原地，當滑鼠拉開 > 70px (隨解析度縮放) 時立即跳躍冒愛心重新追擊
        if (isWaitingMouseLeave) {
          const mouseDistFromPounce = Math.hypot(globalMouse.x - pouncedMouseX, globalMouse.y - pouncedMouseY);
          const thresholdLeave = 70 * scale;
          if (mouseDistFromPounce < thresholdLeave) {
            kiwi.classList.remove('kiwi-chasing', 'walking');
            laserAnimFrame = requestAnimationFrame(updateLaserPhysicsLoop);
            return;
          } else {
            isWaitingMouseLeave = false;
            isJumpingBeforeRechase = true;

            kiwi.classList.add('jumping');
            const heart = document.getElementById('kiwi-heart');
            if (heart) {
              heart.style.display = 'block';
              heart.style.animation = 'none';
              heart.offsetHeight;
              heart.style.animation = 'floatHeart 1s ease-out forwards';
              setTimeout(() => { heart.style.display = 'none'; }, 1000);
            }

            setTimeout(() => {
              kiwi.classList.remove('jumping');
              isJumpingBeforeRechase = false;
            }, 500);
          }
        }

        // 3. 若正處於重新出發的跳躍動畫中，先暫停移動
        if (isJumpingBeforeRechase) {
          laserAnimFrame = requestAnimationFrame(updateLaserPhysicsLoop);
          return;
        }

        // 4. 正常追逐與抓取判定
        const kiwiRect = kiwi.getBoundingClientRect();
        const kiwiCenterX = currentPos.x + kiwiRect.left + kiwiRect.width / 2;
        const kiwiCenterY = currentPos.y + kiwiRect.top + kiwiRect.height / 2;

        const dx = globalMouse.x - kiwiCenterX;
        const dy = globalMouse.y - kiwiCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // 翻轉面向雷射點
        const direction = dx < 0 ? -1 : 1;
        document.getElementById('kiwi-wrapper').style.setProperty('--flip', direction);

        // 觸發撲倒抓取判定 (隨解析度縮放，基準距離 55px 且冷卻 > 800ms)
        const pounceDist = 55 * scale;
        if (distance < pounceDist && now - lastPounceTime > 800) {
          lastPounceTime = now;
          laserScore++;

          // 標記抓到狀態，紀錄當前抓取座標
          isWaitingMouseLeave = true;
          pouncedMouseX = globalMouse.x;
          pouncedMouseY = globalMouse.y;

          kiwi.classList.remove('kiwi-chasing', 'walking');
          kiwi.classList.add('kiwi-pouncing');

          showTempBubble(`🎯 抓到了！嘿嘿，我已經抓到 ${laserScore} 次囉！`);

          setTimeout(() => {
            kiwi.classList.remove('kiwi-pouncing');
          }, 450);
        } else if (distance >= pounceDist && !kiwi.classList.contains('kiwi-pouncing')) {
          // 60fps 平滑萌寵小跑 (搖擺搖晃腳步動畫 + 線性插值平滑移動)
          kiwi.classList.add('kiwi-chasing', 'walking');
          currentAction = 'chasing';

          // 正確計算奇異鳥身體中心的視窗偏移量 (將奇異鳥頭/嘴巴精確對準雷射紅點)
          const kiwiCenterOffsetX = kiwiRect.left + kiwiRect.width / 2;
          const kiwiCenterOffsetY = kiwiRect.top + kiwiRect.height / 2;

          const targetX = globalMouse.x - kiwiCenterOffsetX;
          const targetY = globalMouse.y - kiwiCenterOffsetY;

          let diffX = (targetX - currentPos.x) * 0.04;
          let diffY = (targetY - currentPos.y) * 0.04;

          // 限速保護 (基於 Full HD 4.5px * scale)，讓 2K/4K 螢幕呈現等比例輕快小跑
          const maxSpeed = 4.5 * scale;
          const moveDist = Math.sqrt(diffX * diffX + diffY * diffY);
          if (moveDist > maxSpeed) {
            diffX = (diffX / moveDist) * maxSpeed;
            diffY = (diffY / moveDist) * maxSpeed;
          }

          const smoothX = Math.round(currentPos.x + diffX);
          const smoothY = Math.round(currentPos.y + diffY);

          if (smoothX !== currentPos.x || smoothY !== currentPos.y) {
            ipcRenderer.send('window-move', smoothX, smoothY);
            x = smoothX;
            y = smoothY;
          }
        } else if (distance < pounceDist) {
          kiwi.classList.remove('kiwi-chasing', 'walking');
        }
      }
    }
  } catch(e) {}

  laserAnimFrame = requestAnimationFrame(updateLaserPhysicsLoop);
}

function toggleLaserGame(enable) {
  if (typeof enable === 'boolean') {
    isLaserGameActive = enable;
  } else {
    isLaserGameActive = !isLaserGameActive;
  }

  customMenu.style.display = 'none';

  if (isLaserGameActive) {
    laserScore = 0;
    currentAction = 'laser';
    kiwi.classList.remove('walking');

    // 初始化開場狀態
    isGameJustStarted = true;
    startMoveTime = 0;
    isWaitingMouseLeave = false;
    isJumpingBeforeRechase = false;

    const globalMouse = ipcRenderer.sendSync('get-cursor-pos');
    openingMouseX = globalMouse ? globalMouse.x : 0;
    openingMouseY = globalMouse ? globalMouse.y : 0;

    if (laserDot) laserDot.style.display = 'none';
    ipcRenderer.send('toggle-laser-overlay', true);
    showTempBubble('🔴 哇！是紅點耶！！快動動滑鼠讓我抓！ (按 ESC / 右鍵 / 雙擊結束)');
    resetLaserTimeout();
    if (laserAnimFrame) cancelAnimationFrame(laserAnimFrame);
    laserAnimFrame = requestAnimationFrame(updateLaserPhysicsLoop);
  } else {
    if (laserDot) laserDot.style.display = 'none';
    ipcRenderer.send('toggle-laser-overlay', false);
    clearTimeout(laserTimeoutTimer);
    if (laserAnimFrame) {
      cancelAnimationFrame(laserAnimFrame);
      laserAnimFrame = null;
    }
    kiwi.classList.remove('kiwi-chasing', 'kiwi-pouncing', 'walking', 'jumping');
    currentAction = 'idle';

    const kiwiImg = document.getElementById('kiwi-img');

    if (laserScore === 0) {
      // 0 次結束：哭哭難過
      if (kiwiImg && currentAction !== 'sleeping') {
        kiwiImg.src = '../../../assets/images/kiwi_tired.png';
        setTimeout(() => {
          if (currentAction !== 'sleeping') kiwiImg.src = '../../../assets/images/kiwi.png';
        }, 3000);
      }
      showTempBubble('😭 嗚嗚... 一次都沒抓到紅點... 好可惜喔！');
    } else {
      // 1 次以上結束：開心蹦跳
      kiwi.classList.add('jumping');
      setTimeout(() => { kiwi.classList.remove('jumping'); }, 600);
      showTempBubble(`🎉 嘿嘿！今天成功抓到了 ${laserScore} 次紅點！太開心啦！`);
    }
  }
}

if (menuLaser) {
  menuLaser.addEventListener('click', () => {
    toggleLaserGame();
  });
}

// 快捷退出機制：ESC 鍵、右鍵點擊、雙擊滑鼠
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isLaserGameActive) {
    toggleLaserGame(false);
  }
});

window.addEventListener('contextmenu', (e) => {
  if (isLaserGameActive) {
    e.preventDefault();
    toggleLaserGame(false);
  }
});

window.addEventListener('dblclick', () => {
  if (isLaserGameActive) {
    toggleLaserGame(false);
  }
});

// 簡單的隨機移動邏輯 (在桌面範圍內隨機移動視窗)
// 這裡展示如何透過 renderer 控制 window 的位置
function getRealWindowPos() {
  try {
    const pos = ipcRenderer.sendSync('get-window-pos');
    if (pos && typeof pos.x === 'number' && !isNaN(pos.x) && typeof pos.y === 'number' && !isNaN(pos.y)) {
      return { x: Math.round(pos.x), y: Math.round(pos.y) };
    }
  } catch(e) {}
  const sx = Math.round(Number(window.screenX)) || 0;
  const sy = Math.round(Number(window.screenY)) || 0;
  return { x: sx, y: sy };
}

const initialPos = getRealWindowPos();
let x = initialPos.x;
let y = initialPos.y;

let currentAction = 'idle'; // 'idle', 'moving', 'eating', 'sleeping'
let idleTime = 0; // 閒置計時器
let ignoreWakeup = false;

// 重置閒置狀態
function resetIdle() {
  idleTime = 0;
  if (ignoreWakeup || isSettingsEditMode) return;

  if (currentAction === 'sleeping' || kiwi.classList.contains('sleeping')) {
    kiwi.classList.remove('sleeping');
    currentAction = 'idle'; // 醒來後恢復閒置
    const zzz = document.getElementById('kiwi-zzz');
    if (zzz) zzz.style.display = 'none';
    document.getElementById('kiwi-img').src = '../../../assets/images/kiwi.png';
    document.getElementById('kiwi-bed').style.display = 'none';
    if (typeof outfitContainer !== 'undefined' && outfitContainer) outfitContainer.style.display = 'block';
  }
}
window.addEventListener('mousemove', resetIdle);
window.addEventListener('mousedown', resetIdle);
window.addEventListener('keydown', resetIdle);

// 閒置檢查計時器 (每秒執行)
setInterval(() => {
  idleTime++;
  // 如果 60 秒沒有互動，就睡覺
  if (idleTime > 60 && currentAction === 'idle' && !kiwi.classList.contains('sleeping') && !isWorking && !isDragging) {
    currentAction = 'sleeping'; // 進入睡覺狀態
    kiwi.classList.add('sleeping');
    const zzz = document.getElementById('kiwi-zzz');
    if (zzz) zzz.style.display = 'block';
    document.getElementById('kiwi-img').src = '../../../assets/images/kiwi_sleep.png';
    document.getElementById('kiwi-bed').style.display = 'block';
    if (typeof outfitContainer !== 'undefined' && outfitContainer) outfitContainer.style.display = 'none';
  }
}, 1000);

let triggeredAlarms = {};

function triggerAlarm(alarm, alarmKey) {
  if (!triggeredAlarms[alarmKey]) {
    triggeredAlarms[alarmKey] = true;
    if (isLaserGameActive) {
      toggleLaserGame(false);
    }
    resetIdle();
    showAlarmBubble(alarm);
    kiwi.classList.add('jumping');
    setTimeout(() => { kiwi.classList.remove('jumping'); }, 500);
  }
}

setInterval(() => {
  const nowMs = Date.now();
  // 檢查貪睡清單
  for (let i = snoozedAlarms.length - 1; i >= 0; i--) {
    const sAlarm = snoozedAlarms[i];
    if (nowMs >= sAlarm.triggerTime) {
      snoozedAlarms.splice(i, 1);
      triggerAlarm(sAlarm, sAlarm.id + '-snooze-' + nowMs);
    }
  }

  if (fs.existsSync(alarmsPath)) {
    try {
      const data = fs.readFileSync(alarmsPath, 'utf8');
      const alarms = JSON.parse(data);
      const now = new Date();
      alarms.forEach(alarm => {
        if (!alarm.enabled) return;
        
        const currentHHMM = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        if (alarm.time !== currentHHMM) return;
        
        let shouldTrigger = false;
        if (alarm.type === 'date') {
          const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
          if (alarm.date === todayStr) {
            shouldTrigger = true;
          }
        } else {
          // weekly or legacy
          const currentDay = now.getDay();
          if (!alarm.days || alarm.days.includes(currentDay)) {
            shouldTrigger = true;
          }
        }
        
        if (shouldTrigger) {
          const alarmKey = alarm.id + '-' + now.toDateString() + '-' + currentHHMM;
          triggerAlarm(alarm, alarmKey);
          
          if (alarm.type === 'date') {
            alarm.enabled = false;
            try {
              fs.writeFileSync(alarmsPath, JSON.stringify(alarms, null, 2), 'utf8');
              ipcRenderer.send('reload-data'); // Optional: tell other windows to reload if they are listening
            } catch(e) {}
          }
        }
      });
    } catch (e) {
      console.error('Failed to parse alarms:', e);
    }
  }
}, 5000);

// 每隔一段時間隨機走動
setInterval(() => {
  // 只有在 idle 狀態且未開啟雷射筆時才能決定是否走動
  if (isLaserGameActive || currentAction !== 'idle' || kiwi.classList.contains('sleeping') || isWorking) return;
  if (chatBubble.style.display === 'block' || chatInput.style.display === 'block') return;

  // 40% 機率決定走動
  if (Math.random() < 0.4) {
    currentAction = 'moving';
    
    // 拖曳後視窗位置會改變，必須在每次移動前重新抓取當前真實位置
    const currentPos = getRealWindowPos();
    x = currentPos.x;
    y = currentPos.y;
    
    const scale = getResolutionScale();

    // 5% 機率進行遠距離散步 (隨螢幕解析度動態縮放)
    let rangeX = 300 * scale;
    let rangeY = 100 * scale;
    if (Math.random() < 0.05) {
      rangeX = 1500 * scale;
      rangeY = 500 * scale;
    }
    
    // 決定移動距離
    const moveX = (Math.random() - 0.5) * rangeX;
    const moveY = (Math.random() - 0.5) * rangeY;
    
    let targetX = x + moveX;
    let targetY = y + moveY;
    
    // 取得當前視窗所在螢幕的邊界 (支援多螢幕)
    // 因視窗總高度為 550px，奇異鳥位於視窗底部 (上方約有 330px 的對話框區域)
    // 當奇異鳥靠在螢幕頂端時，視窗 Y 座標約為 -330px，因此 minY 必須允許負值，否則會觸發向下瞬移 Bug
    const screenAvailTop = window.screen.availTop || 0;
    const screenAvailLeft = window.screen.availLeft || 0;
    
    const minX = screenAvailLeft - 20;
    const minY = screenAvailTop - 330; 
    const maxX = screenAvailLeft + window.screen.availWidth - 230;
    const maxY = screenAvailTop + window.screen.availHeight - 520;
    
    // 防止跑出當前螢幕外
    targetX = Math.max(minX, Math.min(targetX, maxX));
    targetY = Math.max(minY, Math.min(targetY, maxY));

    // 翻轉圖片方向 (利用 CSS 變數)
    // 註：如果圖片預設朝左，而往左走卻翻轉了，請將 1 與 -1 互換！
    const direction = (targetX < x) ? -1 : 1; 
    document.getElementById('kiwi-wrapper').style.setProperty('--flip', direction);

    // 加上走路動畫 class (身體晃動)
    kiwi.classList.add('walking');

    // 計算實際移動距離與步數，保持視覺移動速度一致 (基於 Full HD 2.5px * scale)
    const dx = targetX - x;
    const dy = targetY - y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const stepSpeed = 2.5 * scale;
    const steps = Math.max(10, Math.round(distance / stepSpeed));
    
    let currentStep = 0;
    
    const stepX = dx / steps;
    const stepY = dy / steps;

    const moveInterval = setInterval(() => {
      // 如果走到一半狀態改變了 (例如被強制餵食)，中斷移動
      if (currentAction !== 'moving') {
        clearInterval(moveInterval);
        kiwi.classList.remove('walking');
        return;
      }

      x += stepX;
      y += stepY;
      ipcRenderer.send('window-move', Math.round(x), Math.round(y)); // 更新視窗位置
      currentStep++;

      // 到達目的地時停止
      if (currentStep >= steps) {
        clearInterval(moveInterval);
        x = targetX;
        y = targetY;
        kiwi.classList.remove('walking');
        if (currentAction === 'moving') currentAction = 'idle'; // 恢復閒置
      }
    }, 16); // 每 16 毫秒走一步，約 60fps
  }
}, 3000);

// CPU 監控與狀態隨時間遞減
let lastCpu = os.cpus();
setInterval(() => {
  const currentCpu = os.cpus();
  let idle = 0, total = 0;
  for (let i = 0; i < currentCpu.length; i++) {
    for (let type in currentCpu[i].times) {
      total += currentCpu[i].times[type] - lastCpu[i].times[type];
      if (type === 'idle') idle += currentCpu[i].times[type] - lastCpu[i].times[type];
    }
  }
  const usage = total === 0 ? 0 : 100 - ~~(100 * idle / total);
  lastCpu = currentCpu;

  // 隨時間降低飢餓與心情 (不會小於 0)
  petState.hunger = Math.max(0, petState.hunger - 1);
  petState.mood = Math.max(0, petState.mood - 1);

  const isExcludedState = currentAction === 'sleeping' || kiwi.classList.contains('sleeping') || currentAction === 'grabbed' || isDragging;

  if (usage > 70) {
    if (!isWorking && kiwiAccessory.style.display === 'none' && !isExcludedState) {
      kiwiAccessory.innerText = '💦';
      kiwiAccessory.style.display = 'block';
    }
    if (!isExcludedState) {
      const img = document.getElementById('kiwi-img');
      if (!img.src.includes('kiwi_tired.png')) {
        img.src = '../../../assets/images/kiwi_tired.png';
      }
      img.classList.add('kiwi-tired');
    }
  } else {
    if (!isWorking && kiwiAccessory.innerText === '💦') {
      kiwiAccessory.style.display = 'none';
    }
    if (!isExcludedState) {
      const img = document.getElementById('kiwi-img');
      if (!img.src.includes('kiwi_sleep.png') && img.src.includes('kiwi_tired.png')) {
        img.src = '../../../assets/images/kiwi.png';
      }
      img.classList.remove('kiwi-tired');
    }
  }
  
  // 定期自動存檔
  if (Math.random() < 0.2) savePetState();
}, 10000);

// 強制切換一次穿透狀態，打破 Electron 內部快取，修復 Windows 熱重載失效的 Bug
ipcRenderer.send('set-ignore-mouse-events', false);
setTimeout(() => {
  ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
}, 100);

// --- 滑鼠撫摸反應 (Mouse Petting) ---
let petScore = 0;
let lastPetTime = 0;
let pettingTimeout = null;
let isPetting = false;

kiwi.addEventListener('mousemove', (e) => {
  if (currentAction === 'sleeping' || isDragging || isDraggingOutfit || isDraggingBed) return;
  
  const now = Date.now();
  if (now - lastPetTime > 500) {
    petScore = 0;
  }
  // 累加滑鼠移動距離
  petScore += Math.abs(e.movementX) + Math.abs(e.movementY);
  lastPetTime = now;
  
  // 累積移動超過 2000 像素才算作撫摸
  if (petScore > 2000 && !isPetting) {
    isPetting = true;
    const oldAction = currentAction;
    currentAction = 'petting';
    kiwi.classList.remove('kiwi-pecking');
    kiwi.classList.add('kiwi-petting');
    
    const heart = document.getElementById('kiwi-heart');
    heart.style.display = 'block';
    heart.style.animation = 'none';
    heart.offsetHeight; // trigger reflow
    heart.style.animation = 'floatHeart 1s ease-out forwards';
    
    if (pettingTimeout) clearTimeout(pettingTimeout);
    pettingTimeout = setTimeout(() => {
      isPetting = false;
      petScore = 0;
      kiwi.classList.remove('kiwi-petting');
      heart.style.display = 'none';
      if (currentAction === 'petting') currentAction = oldAction === 'eating' ? 'idle' : oldAction; 
    }, 1500);
  }
});

// 滑鼠穿透判定邏輯 (優化：快取狀態避免重複 IPC 造成拖曳抖動與延遲)
let lastIgnoreState = null;

window.addEventListener('mousemove', (event) => {
  if (isDragging || isDraggingOutfit || isDraggingBed) {
    if (lastIgnoreState !== false) {
      lastIgnoreState = false;
      ipcRenderer.send('set-ignore-mouse-events', false);
    }
    return;
  }

  const isInteractive = !!event.target.closest('.chat-bubble, #chat-input, #custom-menu, #kiwi-sprite-wrapper, #kiwi-bed, #chat-close');
  const ignore = !isInteractive;
  
  if (lastIgnoreState !== ignore) {
    lastIgnoreState = ignore;
    ipcRenderer.send('set-ignore-mouse-events', ignore, { forward: true });
  }
});
