let deps = {};
let wanderingTimer = null;
let isSnoozing = false;

function init(dependencies) {
  deps = dependencies;
  startWanderingLoop();
}

function setSnoozing(val) {
  isSnoozing = !!val;
}

function getIsSnoozing() {
  return isSnoozing;
}

function performWalk(options = {}) {
  try {
    const { laser, getCurrentAction, setCurrentAction, kiwi, getIsWorking, chatBubble, chatInput, getRealWindowPos, getResolutionScale, ipcRenderer, setWindowPos } = deps;

    if (laser && typeof laser.getIsLaserGameActive === 'function' && laser.getIsLaserGameActive()) return false;
    if (kiwi && kiwi.classList.contains('sleeping')) return false;
    if (typeof getIsWorking === 'function' && getIsWorking()) return false;

    // 非強制走動時，如果正在說話、正在輸入或處於稍後提醒安靜待命期間則暫緩
    if (!options.force) {
      if (isSnoozing) return false;
      if (typeof getCurrentAction === 'function' && getCurrentAction() !== 'idle') return false;
      if (chatBubble && chatBubble.style.display === 'block') return false;
      if (chatInput && chatInput.style.display === 'block') return false;
    }

    const currentPos = typeof getRealWindowPos === 'function' ? getRealWindowPos() : { x: 0, y: 0 };
    let x = currentPos.x;
    let y = currentPos.y;

    const scale = typeof getResolutionScale === 'function' ? getResolutionScale() : 1;
    let targetX, targetY;

    const screenAvailTop = (typeof window !== 'undefined' && window.screen && window.screen.availTop) || 0;
    const screenAvailLeft = (typeof window !== 'undefined' && window.screen && window.screen.availLeft) || 0;
    const screenAvailWidth = (typeof window !== 'undefined' && window.screen && window.screen.availWidth) || 1920;
    const screenAvailHeight = (typeof window !== 'undefined' && window.screen && window.screen.availHeight) || 1080;

    const minX = screenAvailLeft - 20;
    const minY = screenAvailTop - 330;
    const maxX = screenAvailLeft + screenAvailWidth - 230;
    const maxY = screenAvailTop + screenAvailHeight - 520;

    if (options.targetX !== undefined && options.targetY !== undefined) {
      targetX = options.targetX;
      targetY = options.targetY;
    } else {
      let rangeX = (options.rangeX || 300) * scale;
      let rangeY = (options.rangeY || 100) * scale;

      let moveX, moveY;
      if (options.guaranteedDistance) {
        // 保證有一段清晰明顯的走動位移 (至少 120px ~ 250px)
        const signX = Math.random() < 0.5 ? -1 : 1;
        moveX = signX * (120 + Math.random() * 150) * scale;
        moveY = (Math.random() - 0.5) * 60 * scale;
      } else {
        if (Math.random() < 0.05) {
          rangeX = 1500 * scale;
          rangeY = 500 * scale;
        }
        moveX = (Math.random() - 0.5) * rangeX;
        moveY = (Math.random() - 0.5) * rangeY;
      }

      targetX = x + moveX;
      targetY = y + moveY;
    }

    targetX = Math.max(minX, Math.min(targetX, maxX));
    targetY = Math.max(minY, Math.min(targetY, maxY));

    // 如果貼在邊界導致目標距離過小且不是特定指定座標，往另一側走
    if (options.targetX === undefined && Math.abs(targetX - x) < 30 * scale) {
      targetX = (x - minX > maxX - x) ? x - 150 * scale : x + 150 * scale;
      targetX = Math.max(minX, Math.min(targetX, maxX));
    }

    const direction = (targetX < x) ? -1 : 1;
    const kiwiWrapper = typeof document !== 'undefined' ? document.getElementById('kiwi-wrapper') : null;
    if (kiwiWrapper) {
      kiwiWrapper.style.setProperty('--flip', direction);
    }

    if (kiwi) {
      kiwi.classList.remove('jumping');
      kiwi.classList.add('walking');
    }
    if (setCurrentAction) setCurrentAction('moving');

    const dx = targetX - x;
    const dy = targetY - y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const stepSpeed = (options.speed || 2.5) * scale;
    const steps = Math.max(10, Math.round(distance / stepSpeed));

    let currentStep = 0;
    const stepX = dx / steps;
    const stepY = dy / steps;

    const moveInterval = setInterval(() => {
      if (typeof getCurrentAction === 'function' && getCurrentAction() !== 'moving') {
        clearInterval(moveInterval);
        if (kiwi) kiwi.classList.remove('walking');
        return;
      }

      x += stepX;
      y += stepY;
      if (ipcRenderer && typeof ipcRenderer.send === 'function') {
        ipcRenderer.send('window-move', Math.round(x), Math.round(y));
      }
      if (typeof setWindowPos === 'function') {
        setWindowPos(x, y);
      }
      currentStep++;

      if (currentStep >= steps) {
        clearInterval(moveInterval);
        x = targetX;
        y = targetY;
        if (typeof setWindowPos === 'function') setWindowPos(x, y);
        if (kiwi) kiwi.classList.remove('walking');
        if (typeof getCurrentAction === 'function' && getCurrentAction() === 'moving') {
          if (setCurrentAction) setCurrentAction('idle');
        }
        if (typeof options.onComplete === 'function') options.onComplete();
      }
    }, 16);

    return true;
  } catch(e) {
    console.error('Error in performWalk:', e);
    return false;
  }
}

function triggerWalk(options = {}) {
  isSnoozing = false; // 正常行走時解除稍後狀態
  return performWalk({ force: true, guaranteedDistance: true, ...options });
}

function walkToCorner(options = {}) {
  const { getRealWindowPos } = deps;
  const currentPos = typeof getRealWindowPos === 'function' ? getRealWindowPos() : { x: 0, y: 0 };

  const screenAvailTop = (typeof window !== 'undefined' && window.screen && window.screen.availTop) || 0;
  const screenAvailLeft = (typeof window !== 'undefined' && window.screen && window.screen.availLeft) || 0;
  const screenAvailWidth = (typeof window !== 'undefined' && window.screen && window.screen.availWidth) || 1920;
  const screenAvailHeight = (typeof window !== 'undefined' && window.screen && window.screen.availHeight) || 1080;

  const minX = screenAvailLeft - 20;
  const maxX = screenAvailLeft + screenAvailWidth - 230;
  const maxY = screenAvailTop + screenAvailHeight - 520;

  // 決定最靠近的底部角落 (左下角或右下角)
  const midX = (minX + maxX) / 2;
  const cornerX = (currentPos.x > midX) ? maxX : minX;
  const cornerY = maxY;

  isSnoozing = true;
  return performWalk({
    force: true,
    targetX: cornerX,
    targetY: cornerY,
    speed: 3.0, // 稍微輕快俐落地走向角落
    ...options
  });
}

function startWanderingLoop() {
  if (wanderingTimer) clearInterval(wanderingTimer);

  wanderingTimer = setInterval(() => {
    try {
      const { getCurrentAction } = deps;
      if (typeof getCurrentAction === 'function' && getCurrentAction() !== 'idle') return;

      if (Math.random() < 0.4) {
        performWalk();
      }
    } catch(e) {
      require('fs').writeFileSync('err_wandering.log', e.stack);
    }
  }, 3000);
}

module.exports = {
  init,
  triggerWalk,
  walkToCorner,
  setSnoozing,
  getIsSnoozing
};
