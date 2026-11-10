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

function clampScreenBounds(targetX, targetY, kiwiRect, workArea) {
  const availLeft = workArea ? workArea.x : (window.screen.availLeft || 0);
  const availTop = workArea ? workArea.y : (window.screen.availTop || 0);
  const availWidth = workArea ? workArea.width : (window.screen.availWidth || (window.screen.width || 1920));
  const availHeight = workArea ? workArea.height : (window.screen.availHeight || (window.screen.height || 1080));

  // 計算奇異鳥在視窗內的中心偏移（預設約 160px 水平，450px 垂直）
  const offsetX = kiwiRect ? (kiwiRect.left + kiwiRect.width / 2) : 160;
  const offsetY = kiwiRect ? (kiwiRect.top + kiwiRect.height / 2) : 450;

  // 確保奇異鳥本體保留在工作區可視範圍內，邊緣保留 30px，允許貼近螢幕邊緣
  const minKiwiCenterX = availLeft + 30;
  const maxKiwiCenterX = availLeft + availWidth - 30;
  const minKiwiCenterY = availTop + 30;
  const maxKiwiCenterY = availTop + availHeight - 30;

  const minWindowX = minKiwiCenterX - offsetX;
  const maxWindowX = maxKiwiCenterX - offsetX;
  const minWindowY = minKiwiCenterY - offsetY;
  const maxWindowY = maxKiwiCenterY - offsetY;

  return {
    x: Math.max(minWindowX, Math.min(targetX, maxWindowX)),
    y: Math.max(minWindowY, Math.min(targetY, maxWindowY))
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

      const cursorData = ipcRenderer.sendSync('get-cursor-pos');
      const mouseX = (cursorData && typeof cursorData.x === 'number') ? cursorData.x : 0;
      const mouseY = (cursorData && typeof cursorData.y === 'number') ? cursorData.y : 0;
      const workArea = cursorData?.displayWorkArea || null;

      const currentPos = typeof getRealWindowPos === 'function' ? getRealWindowPos() : { x: 0, y: 0 };
      const scale = getResolutionScale();

      const kiwiRect = kiwi ? kiwi.getBoundingClientRect() : { left: 80, top: 380, width: 160, height: 160 };
      const kiwiCenterX = currentPos.x + kiwiRect.left + kiwiRect.width / 2;
      const kiwiCenterY = currentPos.y + kiwiRect.top + kiwiRect.height / 2;

      const dxToMouse = mouseX - kiwiCenterX;
      const dyToMouse = mouseY - kiwiCenterY;
      const distToMouse = Math.hypot(dxToMouse, dyToMouse);

      // 面向滑鼠游標
      const faceDirection = dxToMouse < 0 ? -1 : 1;
      if (kiwiWrapper) {
        kiwiWrapper.style.setProperty('--flip', faceDirection);
      }

      const safeRadius = 125 * scale;
      let targetKiwiCenterX = kiwiCenterX;
      let targetKiwiCenterY = kiwiCenterY;

      // 判斷是否應該在滑鼠周圍徘徊 (必須進入階段 3 且已經足夠靠近滑鼠)
      const canOrbit = (currentStage === 3) && (distToMouse <= safeRadius + 60);

      if (canOrbit) {
        // 階段 3 且已就位：圍繞滑鼠以安全橢圓半徑慢步踱步/徘徊
        orbitAngle += 0.028;
        const orbitRadiusX = 130 * scale;
        const orbitRadiusY = 65 * scale;

        targetKiwiCenterX = mouseX + Math.cos(orbitAngle) * orbitRadiusX;
        targetKiwiCenterY = mouseY + Math.sin(orbitAngle) * orbitRadiusY;
      } else {
        // 階段 2 或尚未到達滑鼠周圍：保持 safeRadius 朝滑鼠靠近
        if (distToMouse > safeRadius) {
          const angle = Math.atan2(dyToMouse, dxToMouse);
          targetKiwiCenterX = mouseX - Math.cos(angle) * safeRadius;
          targetKiwiCenterY = mouseY - Math.sin(angle) * safeRadius;
        } else {
          // 已在安全距離內
          targetKiwiCenterX = kiwiCenterX;
          targetKiwiCenterY = kiwiCenterY;
        }
      }

      // 計算視窗預期目標位置
      const aimWindowX = targetKiwiCenterX - (kiwiRect.left + kiwiRect.width / 2);
      const aimWindowY = targetKiwiCenterY - (kiwiRect.top + kiwiRect.height / 2);

      const moveDx = aimWindowX - currentPos.x;
      const moveDy = aimWindowY - currentPos.y;
      const distToAim = Math.hypot(moveDx, moveDy);

      let nextX = currentPos.x;
      let nextY = currentPos.y;

      if (distToAim > 2) {
        // 動態步進速度：依距離動態調節，遠距快步走 (4.2*scale)，近距輕柔踱步 (2.2*scale)
        let stepSpeed;
        if (distToAim > 400) {
          stepSpeed = 4.2 * scale;
        } else if (distToAim > 120) {
          stepSpeed = 3.2 * scale;
        } else {
          stepSpeed = 2.2 * scale;
        }

        const step = Math.min(distToAim, stepSpeed);
        nextX = currentPos.x + (moveDx / distToAim) * step;
        nextY = currentPos.y + (moveDy / distToAim) * step;

        if (kiwi && !kiwi.classList.contains('walking')) {
          kiwi.classList.add('walking');
        }
      } else {
        if (kiwi && currentStage === 2) {
          kiwi.classList.remove('walking');
        }
      }

      // 多螢幕與工作區邊界拘束保護
      const clamped = clampScreenBounds(nextX, nextY, kiwiRect, workArea);
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
