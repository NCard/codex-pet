const kiwi = document.getElementById('kiwi-img');
const chatBubble = document.getElementById('chat-bubble');

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
});

// 點擊奇異鳥顯示對話框
kiwi.addEventListener('click', (e) => {
  // 如果移動距離超過 5 像素，判定為拖曳，不顯示對話框
  if (Math.abs(e.screenX - dragStartX) > 5 || Math.abs(e.screenY - dragStartY) > 5) return;

  chatBubble.style.display = 'block';
  chatBubble.innerText = "你好！我會使用 Gemini 幫你解決問題喔！";
  
  // 3秒後隱藏
  setTimeout(() => {
    chatBubble.style.display = 'none';
  }, 3000);
});

// 右鍵點擊奇異鳥，關閉應用程式
kiwi.addEventListener('contextmenu', (e) => {
  e.preventDefault(); // 阻止預設右鍵選單
  window.close();     // 關閉視窗
});

// 簡單的隨機移動邏輯 (在桌面範圍內隨機移動視窗)
// 這裡展示如何透過 renderer 控制 window 的位置
let x = window.screenX;
let y = window.screenY;

let isMoving = false;

// 每隔一段時間隨機走動
setInterval(() => {
  if (isMoving) return;

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
    
    // 防止跑出螢幕外
    targetX = Math.max(0, Math.min(targetX, screen.availWidth - 250));
    targetY = Math.max(0, Math.min(targetY, screen.availHeight - 250));

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
