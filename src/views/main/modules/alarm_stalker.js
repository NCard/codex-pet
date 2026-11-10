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
let isStalkingActive = false;

// 漫步與點擊保護狀態
let wanderTarget = null;
let pauseUntil = 0;
let isUserHovering = false;
let wanderAngle = 0;
let lastJumpTime = 0;

function bindHoverListeners() {
  try {
    const bubble = document.getElementById('chat-bubble');
    const kiwiEl = deps.kiwi || document.getElementById('kiwi') || document.getElementById('kiwi-img');

    if (bubble && !bubble.__stalkerHoverBound) {
      bubble.__stalkerHoverBound = true;
      bubble.addEventListener('mouseenter', () => { isUserHovering = true; });
      bubble.addEventListener('mouseleave', () => { isUserHovering = false; });
    }
    if (kiwiEl && !kiwiEl.__stalkerHoverBound) {
      kiwiEl.__stalkerHoverBound = true;
      kiwiEl.addEventListener('mouseenter', () => { isUserHovering = true; });
      kiwiEl.addEventListener('mouseleave', () => { isUserHovering = false; });
    }
  } catch {}
}

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
  wanderAngle = Math.random() * Math.PI * 2;
  wanderTarget = null;
  pauseUntil = 0;
  isUserHovering = false;
  lastJumpTime = 0;
  bindHoverListeners();

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
    kiwiAccessory,
    ipcRenderer,
    getRealWindowPos,
    setWindowPos,
    getCurrentAction,
    updateAlarmDialogue
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
      const cursorDisplayId = cursorData?.cursorDisplayId;
      const windowDisplayId = cursorData?.windowDisplayId;

      const currentPos = typeof getRealWindowPos === 'function' ? getRealWindowPos() : { x: 0, y: 0 };
      const scale = getResolutionScale();

      const kiwiRect = kiwi ? kiwi.getBoundingClientRect() : { left: 80, top: 380, width: 160, height: 160 };
      const kiwiCenterX = currentPos.x + kiwiRect.left + kiwiRect.width / 2;
      const kiwiCenterY = currentPos.y + kiwiRect.top + kiwiRect.height / 2;

      const dxToMouse = mouseX - kiwiCenterX;
      const dyToMouse = mouseY - kiwiCenterY;
      const distToMouse = Math.hypot(dxToMouse, dyToMouse);

      // 面向滑鼠游標 (小幅防抖)
      if (Math.abs(dxToMouse) > 10 && kiwiWrapper) {
        const faceDirection = dxToMouse < 0 ? -1 : 1;
        kiwiWrapper.style.setProperty('--flip', faceDirection);
      }

      const now = performance.now();

      // =========================================================================
      // 跨螢幕瞬間跳躍 (Multi-Monitor Teleport & Jump)
      // 當使用者游標跨至不同螢幕時，奇異鳥瞬間跳躍至該螢幕並喊出「跳躍！」
      // =========================================================================
      if (
        cursorDisplayId != null &&
        windowDisplayId != null &&
        cursorDisplayId !== windowDisplayId &&
        workArea &&
        now - lastJumpTime > 600
      ) {
        lastJumpTime = now;

        const offsetX = kiwiRect ? (kiwiRect.left + kiwiRect.width / 2) : 160;
        const offsetY = kiwiRect ? (kiwiRect.top + kiwiRect.height / 2) : 450;

        const screenMidX = workArea.x + workArea.width / 2;
        const landOffsetX = (mouseX > screenMidX ? -180 : 180) * scale;
        const landKiwiX = mouseX + landOffsetX;
        const landKiwiY = mouseY;

        const clampedLand = clampScreenBounds(landKiwiX - offsetX, landKiwiY - offsetY, kiwiRect, workArea);
        const jumpX = Math.round(clampedLand.x);
        const jumpY = Math.round(clampedLand.y);

        ipcRenderer.send('window-move', jumpX, jumpY);
        if (typeof setWindowPos === 'function') {
          setWindowPos(jumpX, jumpY);
        }

        if (kiwi) {
          kiwi.classList.remove('walking');
          kiwi.classList.add('jumping');
          setTimeout(() => { if (kiwi) kiwi.classList.remove('jumping'); }, 600);
        }

        const jumpPhrase = getDialogue('alarm', 'jump');
        if (typeof updateAlarmDialogue === 'function' && jumpPhrase) {
          updateAlarmDialogue(jumpPhrase);
        }

        if (kiwiAccessory) {
          const prevAccessory = kiwiAccessory.innerText;
          kiwiAccessory.innerText = '✨';
          setTimeout(() => {
            if (isStalkingActive && kiwiAccessory) {
              kiwiAccessory.innerText = prevAccessory || (currentStage === 3 ? '❗' : '💦');
            }
          }, 1200);
        }

        const state = typeof deps.getPetState === 'function' ? deps.getPetState() : {};
        if (state?.settings?.enableAlarmSound !== false) {
          playAlarmChirp(0.22);
        }

        pauseUntil = now + 1500;
        wanderTarget = null;
        stalkerLoopTimer = requestAnimationFrame(step);
        return;
      }

      // =========================================================================
      // 點擊防護區 (Click Zone & Hover Protection)
      // 使用者靠近氣泡、按鈕或本體時立即完全靜止，消除追逐滑鼠導致按鈕逃跑的現象
      // =========================================================================
      const isMouseInWindowArea = (
        mouseX >= currentPos.x - 15 &&
        mouseX <= currentPos.x + 335 &&
        mouseY >= currentPos.y - 15 &&
        mouseY <= currentPos.y + 480
      );
      const isMouseNearKiwi = distToMouse < 140 * scale;

      if (isUserHovering || isMouseInWindowArea || isMouseNearKiwi) {
        if (kiwi && kiwi.classList.contains('walking')) {
          kiwi.classList.remove('walking');
        }
        pauseUntil = Math.max(pauseUntil, now + 1500);
        stalkerLoopTimer = requestAnimationFrame(step);
        return;
      }

      // =========================================================================
      // 停留歇息判斷 (Natural Pause)
      // 讓奇異鳥在游標附近走動後會短暫停下觀看，而不是每幀緊貼不放
      // =========================================================================
      if (now < pauseUntil) {
        // 若使用者滑鼠大幅移開 (> 320px)，解除歇息開始輕步跟上
        if (distToMouse > 320 * scale) {
          pauseUntil = 0;
        } else {
          if (kiwi && kiwi.classList.contains('walking')) {
            kiwi.classList.remove('walking');
          }
          stalkerLoopTimer = requestAnimationFrame(step);
          return;
        }
      }

      let targetKiwiCenterX = kiwiCenterX;
      let targetKiwiCenterY = kiwiCenterY;

      const approachRadius = 180 * scale;
      const inVicinity = distToMouse <= 280 * scale;

      if (currentStage === 3 && inVicinity) {
        // 階段 3 且已在游標附近：在周遭自然漫步，挑選附近隨機點短走後歇息
        if (!wanderTarget || Math.hypot(wanderTarget.x - kiwiCenterX, wanderTarget.y - kiwiCenterY) < 20) {
          if (kiwi && kiwi.classList.contains('walking')) {
            kiwi.classList.remove('walking');
          }
          pauseUntil = now + 1800 + Math.random() * 1200; // 歇息 1.8 ~ 3.0 秒
          wanderAngle += (Math.PI / 4) + Math.random() * (Math.PI / 3);
          const rx = (160 + Math.random() * 50) * scale;
          const ry = (85 + Math.random() * 45) * scale;
          wanderTarget = {
            x: mouseX + Math.cos(wanderAngle) * rx,
            y: mouseY + Math.sin(wanderAngle) * ry
          };
          stalkerLoopTimer = requestAnimationFrame(step);
          return;
        }
        targetKiwiCenterX = wanderTarget.x;
        targetKiwiCenterY = wanderTarget.y;
      } else {
        // 階段 2 或距離較遠：保持 approachRadius 朝游標周遭平緩靠近
        wanderTarget = null;
        if (distToMouse > approachRadius + 20) {
          const angle = Math.atan2(dyToMouse, dxToMouse);
          targetKiwiCenterX = mouseX - Math.cos(angle) * approachRadius;
          targetKiwiCenterY = mouseY - Math.sin(angle) * approachRadius;
        } else {
          // 已進入靠近範圍：停下歇息
          if (kiwi && kiwi.classList.contains('walking')) {
            kiwi.classList.remove('walking');
          }
          pauseUntil = now + 1800 + Math.random() * 1000;
          stalkerLoopTimer = requestAnimationFrame(step);
          return;
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

      if (distToAim > 3) {
        // 移動速度：貼近原本走路的節奏 (遠處靠近 1.8*scale，附近漫步 1.2*scale)，絕不狂奔
        const stepSpeed = (distToAim > 200 * scale ? 1.8 : 1.2) * scale;
        const step = Math.min(distToAim, stepSpeed);
        nextX = currentPos.x + (moveDx / distToAim) * step;
        nextY = currentPos.y + (moveDy / distToAim) * step;

        if (kiwi && !kiwi.classList.contains('walking')) {
          kiwi.classList.add('walking');
        }
      } else {
        if (kiwi && kiwi.classList.contains('walking')) {
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
  wanderTarget = null;
  pauseUntil = 0;
  isUserHovering = false;
  lastJumpTime = 0;

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
