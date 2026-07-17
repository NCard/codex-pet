const kiwi = document.getElementById('kiwi-img');
const chatBubble = document.getElementById('chat-bubble');
const chatInput = document.getElementById('chat-input');
const customMenu = document.getElementById('custom-menu');
const menuSleep = document.getElementById('menu-sleep');
const menuClose = document.getElementById('menu-close');
const menuHistory = document.getElementById('menu-history');

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { ipcRenderer } = require('electron');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { GoogleGenAI } = require('@google/genai');

function saveChatHistory(role, message) {
  const historyPath = path.join(__dirname, '../chat_history.json');
  let history = [];
  try {
    if (fs.existsSync(historyPath)) {
      history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
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
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to write history:', e);
  }
}

// 初始化 Gemini API 客戶端
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 取得對話泡泡內部元素
const chatContent = document.getElementById('chat-content');
const chatClose = document.getElementById('chat-close');

// 點擊關閉按鈕隱藏泡泡
chatClose.addEventListener('click', () => {
  chatBubble.style.display = 'none';
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
  // 記錄游標在視窗內的相對位置
  mouseOffsetX = e.screenX - window.screenX;
  mouseOffsetY = e.screenY - window.screenY;
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
      const commands = ['/help', '/md5'];
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
        reply = 'Wiki Wiki 指令模式喵！<br><b>/help</b> : 顯示這個說明<br><b>/md5 [字串]</b> : 轉成 md5 32碼小寫（字串可用雙引號包起來）';
      } else if (cmd === '/md5') {
        // 如果前後有雙引號，則去除
        if (argStr.startsWith('"') && argStr.endsWith('"')) {
          argStr = argStr.substring(1, argStr.length - 1);
        }
        if (!argStr) {
          reply = '喵？沒有給我要轉換的字串喔！請用 /md5 "字串"';
        } else {
          const hash = crypto.createHash('md5').update(argStr).digest('hex');
          reply = `嗶嗶！Wiki Wiki 用力一啄！(•ө•)♡<br><code>${hash}</code><br>主人，轉換好囉，啾～`;
        }
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
menuSleep.addEventListener('click', () => {
  kiwi.classList.add('sleeping');
  idleTime = 60; // 假裝已經閒置很久
  customMenu.style.display = 'none';
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
  }
}
window.addEventListener('mousemove', resetIdle);
window.addEventListener('mousedown', resetIdle);
window.addEventListener('keydown', resetIdle);

// 閒置檢查計時器 (每秒執行)
setInterval(() => {
  idleTime++;
  // 如果 60 秒沒有互動，就睡覺
  if (idleTime > 60 && !isDragging && !isMoving) {
    kiwi.classList.add('sleeping');
  }
}, 1000);

// 每隔一段時間隨機走動
setInterval(() => {
  // 睡覺中或移動中就不走動
  if (isMoving || kiwi.classList.contains('sleeping')) return;

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
