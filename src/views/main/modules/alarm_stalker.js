/**
 * Wiki Wiki 鬧鐘超時頑皮跟隨與滑鼠周圍徘徊控制器 (alarm_stalker.js)
 * 實現三階段階梯式狀態機：原地提醒 -> 起步尋找 -> 游標周遭安全半徑徘徊
 */

const { getDialogue } = require('../../../utils/dialogues');
const { playAlarmChirp, playReliefChirp } = require('../../../utils/audio');

let deps = {};
let stalkerLoopTimer = null;
let stageTimer = null;
let hopIntervalTimer = null;
let currentStage = 1; // 1: 原地, 2: 起步尋找, 3: 徘徊催促
let orbitAngle = 0;
let isStalkingActive = false;

function init(dependencies) {
  deps = dependencies;
}

function getResolutionScale() {
  if (typeof deps.getResolutionScale === 'function') {
    return deps.getResolutionScale();
  }
  try {
    const width = (window.screen && window.screen.width) ? window.screen.width : 1920;
    return Math.max(0.75, Math.min(width / 1920, 2.5));
  } catch {
    return 1.0;
  }
}

function clampScreenBounds(targetX, targetY) {
  const availTop = window.screen.availTop || 0;
  const availLeft = window.screen.availLeft || 0;
  const availWidth = window.screen.availWidth || (window.screen.width || 1920);
  const availHeight = window.screen.availHeight || (window.screen.height || 1080);

  // 視窗自身留邊寬容度
  const minX = availLeft - 20;
  const minY = availTop - 150;
  const maxX = availLeft + availWidth - 230;
  const maxY = availTop + availHeight - 320;

  return {
    x: Math.max(minX, Math.min(targetX, maxX)),
    y: Math.max(minY, Math.min(targetY, maxY))
  };
}

function startStalking(_alarm) {
  stopStalking('reset');

  isStalkingActive = true;
  currentStage = 1;
  orbitAngle = Math.random() * Math.PI * 2;

  const {
    kiwi,
    kiwiAccessory,
    getPetState,
    setCurrentAction,
    updateAlarmDialogue
  } = deps;

  const state = typeof getPetState === 'function' ? getPetState() : {};
  const settings = state?.settings || {};

  // 1. 播放輕脆鳥鳴提示音
  if (settings.enableAlarmSound !== false) {
    playAlarmChirp(0.25);
  }

  // 頭頂配件切換為鬧鐘圖示
  if (kiwiAccessory) {
    kiwiAccessory.innerText = '⏰';
    kiwiAccessory.style.display = 'block';
  }

  // 原地輕跳引起注意
  if (kiwi) {
    kiwi.classList.add('jumping');
    setTimeout(() => { if (kiwi) kiwi.classList.remove('jumping'); }, 500);
  }

  // 每 7 秒原地小跳提示
  hopIntervalTimer = setInterval(() => {
    if (!isStalkingActive) return;
    if (kiwi && currentStage === 1) {
      kiwi.classList.add('jumping');
      setTimeout(() => { if (kiwi) kiwi.classList.remove('jumping'); }, 500);
      if (settings.enableAlarmSound !== false) {
        playAlarmChirp(0.18);
      }
    }
  }, 7000);

  // 判斷是否啟動「頑皮跟隨」
  const enableStalking = settings.enableAlarmStalking !== false;
  if (!enableStalking) {
    return; // 維持原地提醒
  }

  const delaySec = parseInt(settings.alarmStalkingDelay, 10) || 15;
  const stage2DelayMs = delaySec * 1000;

  stageTimer = setTimeout(() => {
    if (!isStalkingActive) return;
    enterStage2();
  }, stage2DelayMs);

  function enterStage2() {
    currentStage = 2;
    if (setCurrentAction) setCurrentAction('moving');
    if (kiwi) kiwi.classList.add('walking');
    if (kiwiAccessory) kiwiAccessory.innerText = '💦';

    // 更新氣泡文字
    const stage2Text = getDialogue('alarm', 'stage2');
    if (typeof updateAlarmDialogue === 'function' && stage2Text) {
      updateAlarmDialogue(stage2Text);
    }

    if (settings.enableAlarmSound !== false) {
      playAlarmChirp(0.2);
    }

    startPhysicsLoop();

    // 計時進入階段 3
    stageTimer = setTimeout(() => {
      if (!isStalkingActive) return;
      enterStage3();
    }, 20000);
  }

  function enterStage3() {
    currentStage = 3;
    if (kiwiAccessory) kiwiAccessory.innerText = '❗';

    // 更新氣泡文字
    const stage3Text = getDialogue('alarm', 'stage3');
    if (typeof updateAlarmDialogue === 'function' && stage3Text) {
      updateAlarmDialogue(stage3Text);
    }

    if (settings.enableAlarmSound !== false) {
      playAlarmChirp(0.25);
    }
  }
}

function startPhysicsLoop() {
  if (stalkerLoopTimer) cancelAnimationFrame(stalkerLoopTimer);

  const {
    kiwi,
    ipcRenderer,
    getRealWindowPos,
    setWindowPos,
    getCurrentAction
  } = deps;

  const kiwiWrapper = document.getElementById('kiwi-wrapper');

  function step() {
    if (!isStalkingActive || (currentStage !== 2 && currentStage !== 3)) {
      return;
    }

    try {
      if (typeof getCurrentAction === 'function') {
        const action = getCurrentAction();
        if (action === 'grabbed' || action === 'sleeping') {
          stalkerLoopTimer = requestAnimationFrame(step);
          return;
        }
      }

      const globalMouse = ipcRenderer.sendSync('get-cursor-pos');
      const currentPos = typeof getRealWindowPos === 'function' ? getRealWindowPos() : { x: 0, y: 0 };
      const scale = getResolutionScale();

      const kiwiRect = kiwi ? kiwi.getBoundingClientRect() : { left: 50, top: 50, width: 80, height: 80 };
      const kiwiCenterX = currentPos.x + kiwiRect.left + kiwiRect.width / 2;
      const kiwiCenterY = currentPos.y + kiwiRect.top + kiwiRect.height / 2;

      let targetX = currentPos.x;
      let targetY = currentPos.y;

      // 面向滑鼠游標
      const faceDirection = (globalMouse.x - kiwiCenterX) < 0 ? -1 : 1;
      if (kiwiWrapper) {
        kiwiWrapper.style.setProperty('--flip', faceDirection);
      }

      if (currentStage === 2) {
        // 階段 2：以安全距離 (120px) 緩慢朝滑鼠推進
        const dx = globalMouse.x - kiwiCenterX;
        const dy = globalMouse.y - kiwiCenterY;
        const dist = Math.hypot(dx, dy);
        const safeRadius = 120 * scale;

        if (dist > safeRadius) {
          // 移動至滑鼠外圍
          const angle = Math.atan2(dy, dx);
          const aimX = globalMouse.x - Math.cos(angle) * safeRadius - (kiwiRect.left + kiwiRect.width / 2);
          const aimY = globalMouse.y - Math.sin(angle) * safeRadius - (kiwiRect.top + kiwiRect.height / 2);

          const stepSpeed = 1.8 * scale;
          const moveDx = (aimX - currentPos.x) * 0.05;
          const moveDy = (aimY - currentPos.y) * 0.05;

          const moveDist = Math.hypot(moveDx, moveDy);
          const cappedDx = moveDist > stepSpeed ? (moveDx / moveDist) * stepSpeed : moveDx;
          const cappedDy = moveDist > stepSpeed ? (moveDy / moveDist) * stepSpeed : moveDy;

          targetX = currentPos.x + cappedDx;
          targetY = currentPos.y + cappedDy;
        }
      } else if (currentStage === 3) {
        // 階段 3：圍繞滑鼠以安全橢圓半徑慢步踱步/徘徊
        orbitAngle += 0.03;
        const orbitRadiusX = 130 * scale;
        const orbitRadiusY = 75 * scale;

        const desiredCenterX = globalMouse.x + Math.cos(orbitAngle) * orbitRadiusX;
        const desiredCenterY = globalMouse.y + Math.sin(orbitAngle) * orbitRadiusY;

        const aimX = desiredCenterX - (kiwiRect.left + kiwiRect.width / 2);
        const aimY = desiredCenterY - (kiwiRect.top + kiwiRect.height / 2);

        const stepSpeed = 2.2 * scale;
        const moveDx = (aimX - currentPos.x) * 0.06;
        const moveDy = (aimY - currentPos.y) * 0.06;

        const moveDist = Math.hypot(moveDx, moveDy);
        const cappedDx = moveDist > stepSpeed ? (moveDx / moveDist) * stepSpeed : moveDx;
        const cappedDy = moveDist > stepSpeed ? (moveDy / moveDist) * stepSpeed : moveDy;

        targetX = currentPos.x + cappedDx;
        targetY = currentPos.y + cappedDy;
      }

      // 邊界拘束保護
      const clamped = clampScreenBounds(targetX, targetY);
      const roundedX = Math.round(clamped.x);
      const roundedY = Math.round(clamped.y);

      if (roundedX !== currentPos.x || roundedY !== currentPos.y) {
        ipcRenderer.send('window-move', roundedX, roundedY);
        if (typeof setWindowPos === 'function') {
          setWindowPos(roundedX, roundedY);
        }
      }
    } catch {}

    stalkerLoopTimer = requestAnimationFrame(step);
  }

  stalkerLoopTimer = requestAnimationFrame(step);
}

function stopStalking(reason = 'ok') {
  isStalkingActive = false;
  currentStage = 1;

  if (stalkerLoopTimer) {
    cancelAnimationFrame(stalkerLoopTimer);
    stalkerLoopTimer = null;
  }
  if (stageTimer) {
    clearTimeout(stageTimer);
    stageTimer = null;
  }
  if (hopIntervalTimer) {
    clearInterval(hopIntervalTimer);
    hopIntervalTimer = null;
  }

  const { kiwi, kiwiAccessory, setCurrentAction, getIsWorking } = deps;

  if (kiwi) {
    kiwi.classList.remove('walking');
  }

  if (setCurrentAction) {
    setCurrentAction('idle');
  }

  // 解除回饋：跳躍與愛心
  if (reason === 'ok' || reason === 'snooze') {
    if (kiwi) {
      kiwi.classList.add('jumping');
      setTimeout(() => { if (kiwi) kiwi.classList.remove('jumping'); }, 600);
    }
    if (kiwiAccessory) {
      kiwiAccessory.innerText = '❤️';
      kiwiAccessory.style.display = 'block';
      setTimeout(() => {
        const isWorking = typeof getIsWorking === 'function' && getIsWorking();
        if (!isWorking && kiwiAccessory) {
          kiwiAccessory.style.display = 'none';
        }
      }, 1800);
    }
    playReliefChirp(0.2);
  } else {
    if (kiwiAccessory) {
      const isWorking = typeof getIsWorking === 'function' && getIsWorking();
      if (!isWorking) kiwiAccessory.style.display = 'none';
    }
  }
}

function getIsStalkingActive() {
  return isStalkingActive;
}

function getCurrentStage() {
  return currentStage;
}

module.exports = {
  init,
  startStalking,
  stopStalking,
  getIsStalkingActive,
  getCurrentStage,
  clampScreenBounds
};
