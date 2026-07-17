const kiwi = document.getElementById('kiwi-img');
const chatBubble = document.getElementById('chat-bubble');
const chatInput = document.getElementById('chat-input');
const customMenu = document.getElementById('custom-menu');
const menuSleep = document.getElementById('menu-sleep');
const menuClose = document.getElementById('menu-close');
const menuHistory = document.getElementById('menu-history');
const menuTodo = document.getElementById('menu-todo');
const menuFeed = document.getElementById('menu-feed');
const menuPet = document.getElementById('menu-pet');
const menuOutfit = document.getElementById('menu-outfit');

// 待辦事項面板元素
const todoPanel = document.getElementById('todo-panel');
const todoList = document.getElementById('todo-list');
const todoClose = document.getElementById('todo-close');

const kiwiOutfit = document.getElementById('kiwi-outfit');
const outfits = ['', '🎩', '🕶️', '🎀', '👑'];

function renderTodos() {
  todoList.innerHTML = '';
  petState.todos.forEach((todo, index) => {
    const li = document.createElement('li');
    li.textContent = todo.text;
    if (todo.done) li.classList.add('completed');
    li.addEventListener('click', () => {
      todo.done = !todo.done;
      savePetState();
      renderTodos();
    });
    todoList.appendChild(li);
  });
}

// 啟動時渲染待辦事項
// (會放在 loadPetState() 之後呼叫，見下方)

todoClose.addEventListener('click', () => {
  todoPanel.style.display = 'none';
});

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const { ipcRenderer } = require('electron');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { GoogleGenAI } = require('@google/genai');
const cryptoUtils = require('./crypto_utils');

function saveChatHistory(role, message) {
  const historyPath = path.join(__dirname, '../chat_history.json');
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
  const historyPath = path.join(__dirname, '../chat_history.json');
  try {
    const encryptedStr = cryptoUtils.encryptData("[]");
    fs.writeFileSync(historyPath, encryptedStr, 'utf8');
  } catch (e) {
    console.error('Failed to clear history:', e);
  }
}

// 寵物狀態管理存儲機制
const statePath = path.join(__dirname, '../pet_state.json');
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
renderTodos();
// 初始化裝扮
if (petState.outfit) {
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
    } else if (todoPanel.style.display === 'block') {
      todoPanel.style.display = 'none';
    }
  }
});

// 設定名稱前綴的 HTML
const namePrefix = '<span style="color: #c97a2e; font-weight: 900;">Wiki Wiki：</span>';

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
    chatInput.value = '';
    return;
  }

  if (e.key === 'Enter') {
    const text = chatInput.value.trim();
    if (!text) return;
    
    // 隱藏輸入框，顯示思考中
    chatInput.style.display = 'none';
    chatInput.value = '';
    chatBubble.style.display = 'block';
    chatContent.innerHTML = `${namePrefix}思考中... 🤔`;
    
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
          petState.todos.push({ text: argStr, done: false });
          savePetState();
          renderTodos();
          reply = `記下來啦！✍️<br>「${argStr}」<br>已經加到待辦清單囉！`;
        }
      } else if (cmd === '/clear') {
        clearChatHistory();
        reply = '咻！💨 已經幫你把歷史紀錄清得乾乾淨淨啦！';
      } else {
        reply = '這是什麼奇怪的指令呀？Wiki Wiki 聽不懂 (歪頭)<br>試試看 /help 吧！';
      }
      
      chatContent.innerHTML = `${namePrefix}${reply}`;
      saveChatHistory('kiwi', reply);
      
      kiwi.classList.add('jumping');
      setTimeout(() => { kiwi.classList.remove('jumping'); }, 500);
      return;
    }
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: `你現在是一隻生活在電腦桌面上的可愛奇異鳥小助手，你的名字叫做「Wiki Wiki」，請用簡短、活潑、賣萌的語氣回答問題（因為畫面很小，回答請盡量在 50 字以內，可以加上顏文字）。使用者說：${text}`
      });
      // 避免 AI 回答包含 HTML 標籤破壞畫面
      const safeText = response.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      chatContent.innerHTML = `${namePrefix}${safeText}`;
      
      // 儲存奇異鳥回答
      saveChatHistory('kiwi', response.text);
      
      // 收到回答後開心地跳躍
      kiwi.classList.add('jumping');
      setTimeout(() => { kiwi.classList.remove('jumping'); }, 500);
    } catch (err) {
      console.error(err);
      // 判斷是否為額度用盡的錯誤 (429)
      if (err.status === 429 || (err.message && err.message.includes('429'))) {
        chatContent.innerHTML = `${namePrefix}嗚嗚，主人的 API 額度好像用完了 😭 沒飯吃了，快去申請新的鑰匙餵我！`;
      } else {
        chatContent.innerHTML = `${namePrefix}咕啾？我的小腦袋打結了，網路連線好像怪怪的 😵‍💫`;
      }
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
  todoPanel.style.display = todoPanel.style.display === 'none' ? 'block' : 'none';
});

menuFeed.addEventListener('click', () => {
  customMenu.style.display = 'none';
  petState.hunger = Math.min(100, petState.hunger + 30);
  savePetState();
  chatBubble.style.display = 'block';
  chatContent.innerHTML = `${namePrefix}嚼嚼嚼... 好好吃！🍎 飽足感 UP！`;
  kiwi.classList.add('jumping');
  setTimeout(() => { kiwi.classList.remove('jumping'); }, 500);
});

menuPet.addEventListener('click', () => {
  customMenu.style.display = 'none';
  petState.mood = Math.min(100, petState.mood + 20);
  savePetState();
  chatBubble.style.display = 'block';
  chatContent.innerHTML = `${namePrefix}咕啾～好舒服～(⁎˃ᴗ˂⁎) 心情變好了！`;
  // 顯示愛心特效
  kiwiAccessory.innerText = '❤️';
  kiwiAccessory.style.display = 'block';
  setTimeout(() => { if(!isWorking) kiwiAccessory.style.display = 'none'; }, 2000);
  kiwi.classList.add('jumping');
  setTimeout(() => { kiwi.classList.remove('jumping'); }, 500);
});

menuOutfit.addEventListener('click', () => {
  customMenu.style.display = 'none';
  let currentIndex = outfits.indexOf(petState.outfit || '');
  currentIndex = (currentIndex + 1) % outfits.length;
  petState.outfit = outfits[currentIndex];
  savePetState();
  
  if (petState.outfit) {
    kiwiOutfit.innerText = petState.outfit;
    kiwiOutfit.style.display = 'block';
  } else {
    kiwiOutfit.style.display = 'none';
  }
  
  kiwi.classList.add('jumping');
  setTimeout(() => { kiwi.classList.remove('jumping'); }, 500);
});

menuSleep.addEventListener('click', () => {
  customMenu.style.display = 'none';
  kiwi.classList.add('sleeping');
  const zzz = document.getElementById('kiwi-zzz');
  if (zzz) zzz.style.display = 'block';
  document.getElementById('kiwi-img').src = '../assets/images/kiwi_sleep.png';
  chatBubble.style.display = 'block';
  chatContent.innerHTML = `${namePrefix}晚安... Zzz...`;
});

menuHistory.addEventListener('click', () => {
  customMenu.style.display = 'none';
  ipcRenderer.send('open-history');
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

// 重置閒置狀態
function resetIdle() {
  idleTime = 0;
  if (kiwi.classList.contains('sleeping')) {
    kiwi.classList.remove('sleeping');
    const zzz = document.getElementById('kiwi-zzz');
    if (zzz) zzz.style.display = 'none';
    document.getElementById('kiwi-img').src = '../assets/images/kiwi.png';
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
    document.getElementById('kiwi-img').src = '../assets/images/kiwi_sleep.png';
  }
}, 1000);

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
    
    // 決定移動距離 (可以走稍微遠一點點)
    const moveX = (Math.random() - 0.5) * 300;
    const moveY = (Math.random() - 0.5) * 100;
    
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
    kiwi.style.setProperty('--flip', direction);

    // 加上走路動畫 class (身體晃動)
    kiwi.classList.add('walking');

    // 平滑移動邏輯：將距離切分成多個小步 (類似 60 fps 動畫)
    const steps = 60; 
    let currentStep = 0;
    
    const stepX = (targetX - x) / steps;
    const stepY = (targetY - y) / steps;

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
