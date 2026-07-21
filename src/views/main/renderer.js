require('../../utils/logger');
const kiwi = document.getElementById('kiwi-img');
const chatBubble = document.getElementById('chat-bubble');
const chatInput = document.getElementById('chat-input');
const customMenu = document.getElementById('custom-menu');
const menuSleep = document.getElementById('menu-sleep');
const menuClose = document.getElementById('menu-close');
const menuHistory = document.getElementById('menu-history');
const menuAlarm = document.getElementById('menu-alarm');
const menuTodo = document.getElementById('menu-todo');
const menuFeed = document.getElementById('menu-feed');
const menuPet = document.getElementById('menu-pet');
const menuOutfit = document.getElementById('menu-outfit');

const kiwiOutfit = document.getElementById('kiwi-outfit');
const outfits = ['', '🎩', '🕶️', '🎀', '👑'];

const path = require('path');
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

function saveChatHistory(role, message) {
  const historyPath = path.join(__dirname, '../../../data/chat_history.dat');
  let history = [];
  try {
    if (fs.existsSync(historyPath)) {
      const data = fs.readFileSync(historyPath, 'utf8');
      if (data.trim() !== '') {
        try {
          const decrypted = cryptoUtils.decryptData(data);
          history = JSON.parse(decrypted);
        } catch (e) {
          history = JSON.parse(data);
        }
      }
    }
  } catch (e) {
    console.error('Failed to read history:', e);
  }

  history.push({
    role,
    message,
    timestamp: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
  });

  try {
    const jsonStr = JSON.stringify(history, null, 2);
    const encryptedStr = cryptoUtils.encryptData(jsonStr);
    fs.writeFileSync(historyPath, encryptedStr, 'utf8');
  } catch (e) {
    console.error('Failed to save history:', e);
  }
}

function clearChatHistory() {
  const historyPath = path.join(__dirname, '../../../data/chat_history.dat');
  try {
    const encryptedStr = cryptoUtils.encryptData("[]");
    fs.writeFileSync(historyPath, encryptedStr, 'utf8');
  } catch (e) {
    console.error('Failed to clear history:', e);
  }
}

// 寵物狀態管理存儲機制
const statePath = path.join(__dirname, '../../../data/pet_state.json');
let petState = {
  hunger: 100,
  mood: 100,
  outfit: null,
  todos: []
};

function loadPetState() {
  try {
    if (fs.existsSync(statePath)) {
      const data = fs.readFileSync(statePath, 'utf8');
      petState = { ...petState, ...JSON.parse(data) };
    }
  } catch (e) {
    console.error('載入寵物狀態失敗:', e);
  }
}

function savePetState() {
  try {
    fs.writeFileSync(statePath, JSON.stringify(petState, null, 2), 'utf8');
  } catch (e) {
    console.error('儲存寵物狀態失敗:', e);
  }
}

// 啟動時載入狀態
loadPetState();
// 初始化待辦事項 UI
// (已經移至獨立視窗)
// 初始化裝扮
if (petState.outfit) {
  applyOutfitPos();
  kiwiOutfit.innerText = petState.outfit;
  kiwiOutfit.style.display = 'block';
}

// 番茄鐘狀態
let pomodoroTimer = null;
let isWorking = false;

// 初始化 Gemini API 客戶端
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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

let isDragging = false;
let mouseOffsetX, mouseOffsetY;
let dragStartX, dragStartY;

// 記錄滑鼠按下時的位置，準備拖曳
kiwi.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return; // 只回應左鍵
  isDragging = true;
  // 記錄游標在視窗內的相對位置 (避免使用 window.screenX，因在 RDP 或多螢幕時常有座標回報錯誤的 Bug)
  mouseOffsetX = e.clientX;
  mouseOffsetY = e.clientY;
  // 記錄初始座標用來判斷是點擊還是拖曳
  dragStartX = e.screenX;
  dragStartY = e.screenY;
  
  // 被抓起來時觸發驚嚇動作
  kiwi.classList.add('shock');
});

// 拖曳視窗
window.addEventListener('mousemove', (e) => {
  if (isDragging) {
    x = e.screenX - mouseOffsetX;
    y = e.screenY - mouseOffsetY;
    window.moveTo(x, y);
  }
});

// 放開滑鼠結束拖曳
window.addEventListener('mouseup', () => {
  isDragging = false;
  kiwi.classList.remove('shock'); // 恢復正常
});

// 點擊奇異鳥顯示輸入框
kiwi.addEventListener('click', (e) => {
  // 如果移動距離超過 5 像素，判定為拖曳，不顯示對話框
  if (Math.abs(e.screenX - dragStartX) > 5 || Math.abs(e.screenY - dragStartY) > 5) return;

  // 點擊時開心地跳躍
  kiwi.classList.add('jumping');
  setTimeout(() => { kiwi.classList.remove('jumping'); }, 500);

  // 顯示輸入框並自動 Focus
  chatInput.style.display = 'block';
  chatBubble.style.display = 'none';
  chatInput.focus();
});

// 監聽輸入框的 Enter 鍵事件，呼叫 Gemini
chatInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Tab') {
    const text = chatInput.value;
    if (text.startsWith('/')) {
      e.preventDefault(); // 防止失去焦點
      const commands = ['/help', '/md5', '/base64', '/uuid', '/calc', '/pomodoro', '/todo', '/clear'];
      const match = commands.find(c => c.startsWith(text));
      if (match) {
        chatInput.value = match + ' ';
      }
    }
    return;
  }

  if (e.key === 'Escape') {
    chatInput.style.display = 'none';
    chatBubble.style.display = 'none';
    chatInput.value = '';
    return;
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault(); // 防止 textarea 換行
    const text = chatInput.value.trim();
    if (!text) return;
    
    // 停用輸入框，顯示思考中
    chatInput.disabled = true;
    chatInput.placeholder = '思考中...';
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
                '<b>/md5 [字串]</b> : 轉成 md5 32碼<br>' +
                '<b>/base64 [encode/decode] [字串]</b> : base64 轉換<br>' +
                '<b>/uuid</b> : 產生隨機 UUID<br>' +
                '<b>/calc [算式]</b> : 幫你算數學 (例如 1+1)<br>' +
                '<b>/pomodoro [分鐘]</b> : 啟動番茄鐘 (預設25分)<br>' +
                '<b>/todo [事項]</b> : 新增待辦事項<br>' +
                '<b>/clear</b> : 清除歷史對話紀錄';
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
      
      chatInput.disabled = false;
      chatInput.placeholder = '對話... (Shift+Enter 換行)';
      chatInput.focus();
      
      kiwi.classList.add('jumping');
      setTimeout(() => { kiwi.classList.remove('jumping'); }, 500);
      return;
    }
    
    try {
      let contents = [
        { role: 'user', parts: [{ text: `你現在是一隻生活在電腦桌面上的可愛奇異鳥小助手，你的名字叫做「Wiki Wiki」。
請用簡短、活潑、賣萌的語氣回答問題（回答請盡量在 50 字以內，可以加上顏文字）。
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
                   kiwiOutfit.innerText = petState.outfit;
                   kiwiOutfit.style.display = petState.outfit ? 'block' : 'none';
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
      chatInput.disabled = false;
      chatInput.placeholder = '對話... (Shift+Enter 換行)';
      chatInput.focus();
      
      // 收到回答後開心地跳躍
      kiwi.classList.add('jumping');
      setTimeout(() => { kiwi.classList.remove('jumping'); }, 500);
    } catch (err) {
      console.error(err);
      // 判斷是否為額度用盡的錯誤 (429 / RESOURCE_EXHAUSTED)
      if (err.status === 429 || err.status === 'RESOURCE_EXHAUSTED' || (err.message && (err.message.includes('429') || err.message.includes('quota')))) {
        chatContent.innerHTML = `${namePrefix}嗚嗚，主人的 API 額度好像用完了 😭 沒飯吃了，快去申請新的鑰匙餵我！`;
      } else {
        chatContent.innerHTML = `${namePrefix}咕啾？我的小腦袋打結了，網路連線好像怪怪的 😵‍💫`;
      }
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
  customMenu.style.display = 'none';
  petState.hunger = Math.min(100, petState.hunger + 30);
  savePetState();
  showTempBubble('好飽好飽！嗝～🍎');
  kiwi.classList.add('jumping');
  setTimeout(() => { kiwi.classList.remove('jumping'); }, 500);
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

let isOutfitEditMode = false;

menuOutfit.addEventListener('click', () => {
  customMenu.style.display = 'none';
  ipcRenderer.send('open-outfit');
  isOutfitEditMode = true;
  kiwiOutfit.style.pointerEvents = 'auto';
  kiwiOutfit.style.cursor = 'grab';
});

ipcRenderer.on('outfit-closed', () => {
  isOutfitEditMode = false;
  kiwiOutfit.style.pointerEvents = 'none';
  kiwiOutfit.style.cursor = 'default';
});

ipcRenderer.on('update-outfit', (event, newOutfit) => {
  petState.outfit = newOutfit;
  savePetState();
  if (petState.outfit) {
    kiwiOutfit.innerText = petState.outfit;
    kiwiOutfit.style.display = 'block';
    applyOutfitPos();
  } else {
    kiwiOutfit.style.display = 'none';
  }
  kiwi.classList.add('jumping');
  setTimeout(() => { kiwi.classList.remove('jumping'); }, 500);
});

ipcRenderer.on('update-outfit-pos', (event, { x, y, scale }) => {
  if (!petState.outfitConfigs) petState.outfitConfigs = {};
  if (!petState.outfitConfigs[petState.outfit]) {
    petState.outfitConfigs[petState.outfit] = { x: 45, y: -10, scale: 60 };
  }
  if (x !== undefined) petState.outfitConfigs[petState.outfit].x = x;
  if (y !== undefined) petState.outfitConfigs[petState.outfit].y = y;
  if (scale !== undefined) petState.outfitConfigs[petState.outfit].scale = scale;
  
  savePetState();
  applyOutfitPos();
});

function applyOutfitPos() {
  if (!petState.outfit) return;
  const config = (petState.outfitConfigs && petState.outfitConfigs[petState.outfit]) 
                 || { x: 45, y: -10, scale: 60 };
  kiwiOutfit.style.left = `${config.x}px`;
  kiwiOutfit.style.top = `${config.y}px`;
  kiwiOutfit.style.fontSize = `${config.scale}px`;
  kiwiOutfit.style.transform = `none`;
}

// 裝扮拖曳邏輯
let isDraggingOutfit = false;
let outfitDragStartX = 0;
let outfitDragStartY = 0;
let outfitStartLeft = 0;
let outfitStartTop = 0;

kiwiOutfit.addEventListener('mousedown', (e) => {
  if (!isOutfitEditMode) return;
  isDraggingOutfit = true;
  outfitDragStartX = e.clientX;
  outfitDragStartY = e.clientY;
  kiwiOutfit.style.cursor = 'grabbing';
  
  const rect = kiwiOutfit.parentElement.getBoundingClientRect();
  const outfitRect = kiwiOutfit.getBoundingClientRect();
  outfitStartLeft = outfitRect.left - rect.left;
  outfitStartTop = outfitRect.top - rect.top;
  
  e.preventDefault();
});

window.addEventListener('mousemove', (e) => {
  // 加入翻轉參數來修正拖曳方向
  const flip = parseInt(document.getElementById('kiwi-wrapper').style.getPropertyValue('--flip')) || 1;

  if (isDraggingOutfit) {
    const dx = (e.clientX - outfitDragStartX) * flip;
    const dy = (e.clientY - outfitDragStartY);
    let newLeft = outfitStartLeft + dx;
    let newTop = outfitStartTop + dy;
    
    kiwiOutfit.style.left = `${newLeft}px`;
    kiwiOutfit.style.top = `${newTop}px`;
    kiwiOutfit.style.transform = `none`;
    
    ipcRenderer.send('outfit-pos-updated', { x: newLeft, y: newTop });
  }
});

window.addEventListener('mouseup', (e) => {
  if (isDraggingOutfit) {
    isDraggingOutfit = false;
    kiwiOutfit.style.cursor = 'grab';
    
    const currentLeft = parseInt(kiwiOutfit.style.left || 0);
    const currentTop = parseInt(kiwiOutfit.style.top || 0);
    const currentScale = parseInt(kiwiOutfit.style.fontSize || 60);
    
    if (!petState.outfitConfigs) petState.outfitConfigs = {};
    if (!petState.outfitConfigs[petState.outfit]) petState.outfitConfigs[petState.outfit] = {};
    
    petState.outfitConfigs[petState.outfit].x = currentLeft;
    petState.outfitConfigs[petState.outfit].y = currentTop;
    petState.outfitConfigs[petState.outfit].scale = currentScale;
    savePetState();
  }
});

kiwiOutfit.addEventListener('wheel', (e) => {
  if (!isOutfitEditMode) return;
  e.preventDefault();
  let currentScale = parseInt(kiwiOutfit.style.fontSize || 60);
  if (e.deltaY < 0) {
    currentScale += 2;
  } else {
    currentScale -= 2;
  }
  if (currentScale < 10) currentScale = 10;
  if (currentScale > 150) currentScale = 150;
  
  kiwiOutfit.style.fontSize = `${currentScale}px`;
  
  if (!petState.outfitConfigs) petState.outfitConfigs = {};
  if (!petState.outfitConfigs[petState.outfit]) petState.outfitConfigs[petState.outfit] = {};
  petState.outfitConfigs[petState.outfit].scale = currentScale;
  savePetState();
  
  ipcRenderer.send('outfit-pos-updated', { scale: currentScale });
});

menuSleep.addEventListener('click', () => {
  customMenu.style.display = 'none';
  kiwi.classList.add('sleeping');
  const zzz = document.getElementById('kiwi-zzz');
  if (zzz) zzz.style.display = 'block';
  document.getElementById('kiwi-img').src = '../../../assets/images/kiwi_sleep.png';
  document.getElementById('kiwi-bed').style.display = 'block';
  
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
  window.close();
});

// 簡單的隨機移動邏輯 (在桌面範圍內隨機移動視窗)
// 這裡展示如何透過 renderer 控制 window 的位置
let x = window.screenX;
let y = window.screenY;

let isMoving = false;
let idleTime = 0; // 閒置計時器
let ignoreWakeup = false;

// 重置閒置狀態
function resetIdle() {
  idleTime = 0;
  if (ignoreWakeup) return;

  if (kiwi.classList.contains('sleeping')) {
    kiwi.classList.remove('sleeping');
    const zzz = document.getElementById('kiwi-zzz');
    if (zzz) zzz.style.display = 'none';
    document.getElementById('kiwi-img').src = '../../../assets/images/kiwi.png';
    document.getElementById('kiwi-bed').style.display = 'none';
  }
}
window.addEventListener('mousemove', resetIdle);
window.addEventListener('mousedown', resetIdle);
window.addEventListener('keydown', resetIdle);

// 閒置檢查計時器 (每秒執行)
setInterval(() => {
  idleTime++;
  // 如果 60 秒沒有互動，就睡覺
  if (idleTime > 60 && !kiwi.classList.contains('sleeping') && !isWorking && !isDragging && !isMoving) {
    kiwi.classList.add('sleeping');
    const zzz = document.getElementById('kiwi-zzz');
    if (zzz) zzz.style.display = 'block';
    document.getElementById('kiwi-img').src = '../../../assets/images/kiwi_sleep.png';
    document.getElementById('kiwi-bed').style.display = 'block';
  }
}, 1000);

let lastTriggeredAlarm = '';

function triggerAlarm(alarm, alarmKey) {
  if (lastTriggeredAlarm !== alarmKey) {
    lastTriggeredAlarm = alarmKey;
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

  const alarmsPath = path.join(__dirname, '../../../data/alarms.json');
  if (fs.existsSync(alarmsPath)) {
    try {
      const data = fs.readFileSync(alarmsPath, 'utf8');
      const alarms = JSON.parse(data);
      const now = new Date();
      const currentHHMM = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
      
      alarms.forEach(alarm => {
        if (alarm.enabled && alarm.time === currentHHMM) {
          const alarmKey = alarm.id + '-' + now.toDateString() + '-' + currentHHMM;
          triggerAlarm(alarm, alarmKey);
        }
      });
    } catch (e) {
      console.error('Failed to parse alarms:', e);
    }
  }

  // 檢查待辦事項提醒
  const currentHHMM = new Date().getHours().toString().padStart(2, '0') + ':' + new Date().getMinutes().toString().padStart(2, '0');
  petState.todos.forEach(todo => {
    if (!todo.done && todo.reminderTime === currentHHMM) {
      const alarmKey = 'todo-' + todo.id + '-' + new Date().toDateString() + '-' + currentHHMM;
      triggerAlarm({
        id: todo.id,
        message: '📋 待辦提醒：' + todo.text,
        snoozeInterval: todo.snoozeInterval || 5
      }, alarmKey);
    }
  });
}, 5000);

// 每隔一段時間隨機走動
setInterval(() => {
  // 睡覺中、移動中、專注中、或是有對話框/輸入框時，暫停走動
  if (isMoving || kiwi.classList.contains('sleeping') || isWorking) return;
  if (chatBubble.style.display === 'block' || chatInput.style.display === 'block') return;

  // 40% 機率決定走動
  if (Math.random() < 0.4) {
    isMoving = true;
    
    // 拖曳後視窗位置會改變，必須在每次移動前重新抓取當前真實位置
    x = window.screenX;
    y = window.screenY;
    
    // 5% 機率進行遠距離散步
    let rangeX = 300;
    let rangeY = 100;
    if (Math.random() < 0.05) {
      rangeX = 1500;
      rangeY = 500;
    }
    
    // 決定移動距離
    const moveX = (Math.random() - 0.5) * rangeX;
    const moveY = (Math.random() - 0.5) * rangeY;
    
    let targetX = x + moveX;
    let targetY = y + moveY;
    
    // 取得當前視窗所在螢幕的邊界 (支援多螢幕)
    const minX = window.screen.availLeft || 0;
    const minY = window.screen.availTop || 0;
    const maxX = minX + window.screen.availWidth - 250;
    const maxY = minY + window.screen.availHeight - 250;
    
    // 防止跑出當前螢幕外
    targetX = Math.max(minX, Math.min(targetX, maxX));
    targetY = Math.max(minY, Math.min(targetY, maxY));

    // 翻轉圖片方向 (利用 CSS 變數)
    // 註：如果圖片預設朝左，而往左走卻翻轉了，請將 1 與 -1 互換！
    const direction = (targetX < x) ? -1 : 1; 
    document.getElementById('kiwi-wrapper').style.setProperty('--flip', direction);

    // 加上走路動畫 class (身體晃動)
    kiwi.classList.add('walking');

    // 計算實際移動距離與步數，保持移動速度大約一致 (約每 16ms 移動 2.5 像素)
    const dx = targetX - x;
    const dy = targetY - y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(10, Math.round(distance / 2.5));
    
    let currentStep = 0;
    
    const stepX = dx / steps;
    const stepY = dy / steps;

    const moveInterval = setInterval(() => {
      x += stepX;
      y += stepY;
      window.moveTo(Math.round(x), Math.round(y)); // 更新視窗位置
      currentStep++;

      // 到達目的地時停止
      if (currentStep >= steps) {
        clearInterval(moveInterval);
        x = targetX;
        y = targetY;
        kiwi.classList.remove('walking');
        isMoving = false;
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

  if (usage > 70) {
    if (!isWorking && kiwiAccessory.style.display === 'none') {
      kiwiAccessory.innerText = '💦';
      kiwiAccessory.style.display = 'block';
    }
  } else {
    if (!isWorking && kiwiAccessory.innerText === '💦') {
      kiwiAccessory.style.display = 'none';
    }
  }
  
  // 定期自動存檔
  if (Math.random() < 0.2) savePetState();
}, 10000);
