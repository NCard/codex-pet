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

// Dependencies
let ipcRenderer, kiwi, laserDot, customMenu, showTempBubble, getRealWindowPos, physics;
let setCurrentAction, getCurrentAction, setWindowPos;

function init(deps) {
  ipcRenderer = deps.ipcRenderer;
  kiwi = deps.kiwi;
  laserDot = deps.laserDot;
  customMenu = deps.customMenu;
  showTempBubble = deps.showTempBubble;
  getRealWindowPos = deps.getRealWindowPos;
  physics = deps.physics;
  setCurrentAction = deps.setCurrentAction;
  getCurrentAction = deps.getCurrentAction;
  setWindowPos = deps.setWindowPos;

  // Bind shortcuts
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
}

function resetLaserTimeout() {
  clearTimeout(laserTimeoutTimer);
  if (!isLaserGameActive) return;
  laserTimeoutTimer = setTimeout(() => {
    if (isLaserGameActive) {
      toggleLaserGame(false);
      showTempBubble('🔴 雷射筆已逾時自動關閉囉！');
    }
  }, 30000);
}

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
    const globalMouse = ipcRenderer.sendSync('get-cursor-pos');
    if (globalMouse && typeof globalMouse.x === 'number' && typeof globalMouse.y === 'number') {
      
      if (globalMouse.x !== lastGlobalMouseX || globalMouse.y !== lastGlobalMouseY) {
        lastGlobalMouseX = globalMouse.x;
        lastGlobalMouseY = globalMouse.y;
        resetLaserTimeout();
      }

      const currentPos = getRealWindowPos();
      const now = Date.now();
      const currentAction = getCurrentAction();

      if (currentAction !== 'sleeping' && currentAction !== 'grabbed' && !physics.getIsDragging()) {
        
        // 1. Opening dialog phase
        if (isGameJustStarted) {
          const distFromStart = Math.hypot(globalMouse.x - openingMouseX, globalMouse.y - openingMouseY);
          const thresholdLeave = 70 * scale;
          
          if (distFromStart < thresholdLeave) {
            startMoveTime = 0;
          } else {
            if (!startMoveTime) startMoveTime = now;
            if (now - startMoveTime >= 3000) {
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

          const kiwiRect = kiwi.getBoundingClientRect();
          const kiwiCenterX = currentPos.x + kiwiRect.left + kiwiRect.width / 2;
          const direction = (globalMouse.x - kiwiCenterX) < 0 ? -1 : 1;
          document.getElementById('kiwi-wrapper').style.setProperty('--flip', direction);
          kiwi.classList.remove('kiwi-chasing', 'walking');

          laserAnimFrame = requestAnimationFrame(updateLaserPhysicsLoop);
          return;
        }

        // 2. Cooldown phase
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

        if (isJumpingBeforeRechase) {
          laserAnimFrame = requestAnimationFrame(updateLaserPhysicsLoop);
          return;
        }

        // 4. Chasing phase
        const kiwiRect = kiwi.getBoundingClientRect();
        const kiwiCenterX = currentPos.x + kiwiRect.left + kiwiRect.width / 2;
        const kiwiCenterY = currentPos.y + kiwiRect.top + kiwiRect.height / 2;

        const dx = globalMouse.x - kiwiCenterX;
        const dy = globalMouse.y - kiwiCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const direction = dx < 0 ? -1 : 1;
        document.getElementById('kiwi-wrapper').style.setProperty('--flip', direction);

        const pounceDist = 55 * scale;
        if (distance < pounceDist && now - lastPounceTime > 800) {
          lastPounceTime = now;
          laserScore++;

          isWaitingMouseLeave = true;
          pouncedMouseX = globalMouse.x;
          pouncedMouseY = globalMouse.y;

          kiwi.classList.remove('kiwi-chasing', 'walking');
          kiwi.classList.add('kiwi-pouncing');

          showTempBubble(`🐾 撲到了！嘿嘿，我已經抓到 ${laserScore} 次了！`);

          setTimeout(() => {
            kiwi.classList.remove('kiwi-pouncing');
          }, 450);
        } else if (distance >= pounceDist && !kiwi.classList.contains('kiwi-pouncing')) {
          kiwi.classList.add('kiwi-chasing', 'walking');
          setCurrentAction('chasing');

          const kiwiCenterOffsetX = kiwiRect.left + kiwiRect.width / 2;
          const kiwiCenterOffsetY = kiwiRect.top + kiwiRect.height / 2;

          const targetX = globalMouse.x - kiwiCenterOffsetX;
          const targetY = globalMouse.y - kiwiCenterOffsetY;

          let diffX = (targetX - currentPos.x) * 0.04;
          let diffY = (targetY - currentPos.y) * 0.04;

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
            setWindowPos(smoothX, smoothY);
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

  if (customMenu) customMenu.style.display = 'none';

  if (isLaserGameActive) {
    laserScore = 0;
    setCurrentAction('laser');
    kiwi.classList.remove('walking');

    isGameJustStarted = true;
    startMoveTime = 0;
    isWaitingMouseLeave = false;
    isJumpingBeforeRechase = false;

    const globalMouse = ipcRenderer.sendSync('get-cursor-pos');
    openingMouseX = globalMouse ? globalMouse.x : 0;
    openingMouseY = globalMouse ? globalMouse.y : 0;

    if (laserDot) laserDot.style.display = 'none';
    ipcRenderer.send('toggle-laser-overlay', true);
    showTempBubble('🔴 哇！紅點點耶！！快移動滑鼠讓我抓！ (按ESC / 右鍵 / 點擊結束)');
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
    setCurrentAction('idle');

    const kiwiImg = document.getElementById('kiwi-img');

    if (laserScore === 0) {
      if (kiwiImg && getCurrentAction() !== 'sleeping') {
        kiwiImg.src = '../../../assets/images/kiwi_tired.png';
        setTimeout(() => {
          if (getCurrentAction() !== 'sleeping') kiwiImg.src = '../../../assets/images/kiwi.png';
        }, 3000);
      }
      showTempBubble('💨 呼... 一次都沒抓到... 好可惜啊~');
    } else {
      kiwi.classList.add('jumping');
      setTimeout(() => { kiwi.classList.remove('jumping'); }, 600);
      showTempBubble(`✨ 嘿嘿！今天總共抓到 ${laserScore} 次紅點！太開心啦！`);
    }
  }
}

function getIsLaserGameActive() {
  return isLaserGameActive;
}

module.exports = {
  init,
  toggleLaserGame,
  getIsLaserGameActive
};
