const kiwi = document.getElementById('kiwi-img');
const chatBubble = document.getElementById('chat-bubble');
const chatInput = document.getElementById('chat-input');
const customMenu = document.getElementById('custom-menu');
const menuSleep = document.getElementById('menu-sleep');
const menuClose = document.getElementById('menu-close');
const menuHistory = document.getElementById('menu-history');

const path = require('path');
const fs = require('fs');
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

// 對話框自動隱藏計時器
let chatTimeout;

function startChatTimeout() {
  clearTimeout(chatTimeout);
  chatTimeout = setTimeout(() => {
    chatBubble.style.display = 'none';
  }, 8000);
}

// 滑鼠游標進入泡泡範圍時，取消計時 (不消失)
chatBubble.addEventListener('mouseenter', () => {
  clearTimeout(chatTimeout);
});

// 滑鼠游標離開泡泡範圍時，重新開始 8 秒倒數
chatBubble.addEventListener('mouseleave', () => {
  startChatTimeout();
});

// 輸入框自動隱藏計時器
let inputTimeout;

function startInputTimeout() {
  clearTimeout(inputTimeout);
  inputTimeout = setTimeout(() => {
    chatInput.style.display = 'none';
  }, 5000);
}

chatInput.addEventListener('mouseenter', () => {
  clearTimeout(inputTimeout);
});

chatInput.addEventListener('mouseleave', () => {
  if (chatInput.style.display === 'block') {
    startInputTimeout();
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
  
  // 啟動 5 秒不理他就自動關閉的計時器
  startInputTimeout();
});

// 監聽輸入框的 Enter 鍵事件，呼叫 Gemini
chatInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    const text = chatInput.value.trim();
    if (!text) return;
    
    // 取消輸入框的自動隱藏計時
    clearTimeout(inputTimeout);
    
    // 隱藏輸入框，顯示思考中
    chatInput.style.display = 'none';
    chatInput.value = '';
    chatBubble.style.display = 'block';
    chatBubble.innerHTML = `${namePrefix}思考中... 🤔`;
    
    // 儲存使用者對話
    saveChatHistory('user', text);
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: `你現在是一隻生活在電腦桌面上的可愛奇異鳥小助手，你的名字叫做「Wiki Wiki」，請用簡短、活潑、賣萌的語氣回答問題（因為畫面很小，回答請盡量在 50 字以內，可以加上顏文字）。使用者說：${text}`
      });
      // 避免 AI 回答包含 HTML 標籤破壞畫面
      const safeText = response.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      chatBubble.innerHTML = `${namePrefix}${safeText}`;
      
      // 儲存奇異鳥回答
      saveChatHistory('kiwi', response.text);
      
      // 收到回答後開心地跳躍
      kiwi.classList.add('jumping');
      setTimeout(() => { kiwi.classList.remove('jumping'); }, 500);
    } catch (err) {
      console.error(err);
      // 判斷是否為額度用盡的錯誤 (429)
      if (err.status === 429 || (err.message && err.message.includes('429'))) {
        chatBubble.innerHTML = `${namePrefix}嗚嗚，主人的 API 額度好像用完了 😭 沒飯吃了，快去申請新的鑰匙餵我！`;
      } else {
        chatBubble.innerHTML = `${namePrefix}咕啾？我的小腦袋打結了，網路連線好像怪怪的 😵‍💫`;
      }
    }
    
    // 收尾動作：啟動 8 秒自動隱藏倒數
    startChatTimeout();
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
