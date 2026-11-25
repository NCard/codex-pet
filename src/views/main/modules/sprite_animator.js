/**
 * Wiki Wiki 統一精靈圖動畫狀態機 (sprite_animator.js)
 * 管理日系繪本感 13 張動作幀切換、自動眨眼、2 幀邁步走路、2 幀啄食、
 * AI 思考托喙、說話嘴型、一體化睡姿與動態接地陰影。
 */

const SPRITE_ASSETS = {
  idle: '../../../assets/images/kiwi.png',
  blink: '../../../assets/images/kiwi_blink.png',
  talk: '../../../assets/images/kiwi_talk.png',
  walk1: '../../../assets/images/kiwi_walk1.png',
  walk2: '../../../assets/images/kiwi_walk2.png',
  happy: '../../../assets/images/kiwi_happy.png',
  jump: '../../../assets/images/kiwi_jump.png',
  thinking: '../../../assets/images/kiwi_thinking.png',
  eating1: '../../../assets/images/kiwi_eating.png',
  eating2: '../../../assets/images/kiwi_eating2.png',
  dangling: '../../../assets/images/kiwi_dangling.png',
  tired: '../../../assets/images/kiwi_tired.png',
  sleep: '../../../assets/images/kiwi_sleep.png'
};

function preloadSprites() {
  if (typeof Image === 'undefined') return;
  Object.values(SPRITE_ASSETS).forEach((src) => {
    try {
      const img = new Image();
      img.src = src;
    } catch {
      // 測試環境略過預載
    }
  });
}

function init({
  kiwiImg,
  kiwiWrapper,
  kiwiShadow,
  getCurrentAction,
  getPetState,
  getCpuUsage,
  getIsAlarmActive,
  getIsDragging
}) {
  preloadSprites();

  let currentSpriteKey = 'idle';
  let currentVisualState = 'idle';
  let isThinking = false;
  let talkUntil = 0;
  let previewPose = null;
  let previewTimer = null;

  let isBlinking = false;
  let blinkScheduleTimer = null;
  let blinkEndTimer = null;
  let walkStepIndex = 0;
  let eatFrameIndex = 0;
  let happyFrameIndex = 0;
  let talkFrameIndex = 0;
  let lastFrameTick = 0;
  let isDestroyed = false;

  const WALK_CYCLE = ['idle', 'walk1', 'walk2', 'walk1'];

  function getSettings() {
    const s = typeof getPetState === 'function' ? getPetState() : {};
    return s?.settings || {};
  }

  function isSpriteAnimEnabled() {
    return getSettings().enableSpriteAnim !== false;
  }

  function applySprite(key) {
    if (!kiwiImg || !SPRITE_ASSETS[key]) return;
    if (currentSpriteKey === key) return;
    currentSpriteKey = key;
    kiwiImg.src = SPRITE_ASSETS[key];
  }

  function applyShadowState(visualState) {
    if (!kiwiShadow) return;
    const enabled = getSettings().enablePetShadow !== false;
    kiwiShadow.style.display = enabled ? 'block' : 'none';
    if (!enabled) return;

    kiwiShadow.classList.remove('shadow-idle', 'shadow-walking', 'shadow-jumping', 'shadow-dangling', 'shadow-sleeping');
    if (visualState === 'dangling') {
      kiwiShadow.classList.add('shadow-dangling');
    } else if (visualState === 'sleep') {
      kiwiShadow.classList.add('shadow-sleeping');
    } else if (visualState === 'jump' || visualState === 'happy') {
      kiwiShadow.classList.add('shadow-jumping');
    } else if (visualState === 'walking') {
      kiwiShadow.classList.add('shadow-walking');
    } else {
      kiwiShadow.classList.add('shadow-idle');
    }
  }

  function resolveVisualState() {
    if (previewPose && SPRITE_ASSETS[previewPose]) {
      return previewPose;
    }

    const action = typeof getCurrentAction === 'function' ? getCurrentAction() : 'idle';
    const dragging = typeof getIsDragging === 'function' && getIsDragging();
    if (action === 'grabbed' || dragging) return 'dangling';
    if (action === 'sleeping' || (kiwiWrapper && kiwiWrapper.classList.contains('sleeping'))) return 'sleep';
    if (action === 'eating') return 'eating';
    if (action === 'petting' || (kiwiWrapper && kiwiWrapper.classList.contains('kiwi-petting'))) return 'happy';
    if (kiwiWrapper && kiwiWrapper.classList.contains('jumping')) return 'jump';
    if (isThinking) return 'thinking';

    const alarmActive = typeof getIsAlarmActive === 'function' && getIsAlarmActive();
    if (alarmActive) return 'talking';
    if (Date.now() < talkUntil) return 'talking';

    if (
      action === 'moving' ||
      (kiwiWrapper && (kiwiWrapper.classList.contains('walking') || kiwiWrapper.classList.contains('kiwi-chasing')))
    ) {
      return 'walking';
    }

    const state = typeof getPetState === 'function' ? getPetState() : {};
    const hunger = typeof state.hunger === 'number' ? state.hunger : 100;
    const cpu = typeof getCpuUsage === 'function' ? getCpuUsage() : 0;
    if (hunger <= 20 || cpu > 70) return 'tired';

    return 'idle';
  }

  function tick(force = false) {
    if (isDestroyed) return;
    const now = Date.now();
    const state = resolveVisualState();
    const stateChanged = state !== currentVisualState;
    currentVisualState = state;
    applyShadowState(state);

    if (previewPose && SPRITE_ASSETS[previewPose]) {
      applySprite(previewPose);
      return;
    }

    const animOn = isSpriteAnimEnabled();

    if (state === 'dangling') {
      applySprite('dangling');
      return;
    }
    if (state === 'sleep') {
      applySprite('sleep');
      return;
    }
    if (state === 'thinking') {
      applySprite('thinking');
      return;
    }
    if (state === 'jump') {
      applySprite('jump');
      return;
    }
    if (state === 'tired') {
      applySprite('tired');
      return;
    }
    if (state === 'eating') {
      if (!animOn) {
        applySprite('eating1');
        return;
      }
      if (stateChanged || force || now - lastFrameTick >= 360) {
        lastFrameTick = now;
        eatFrameIndex = (eatFrameIndex + 1) % 2;
        applySprite(eatFrameIndex === 0 ? 'eating1' : 'eating2');
      }
      return;
    }
    if (state === 'happy') {
      if (!animOn) {
        applySprite('happy');
        return;
      }
      if (stateChanged || force || now - lastFrameTick >= 280) {
        lastFrameTick = now;
        happyFrameIndex = (happyFrameIndex + 1) % 2;
        applySprite(happyFrameIndex === 0 ? 'happy' : 'jump');
      }
      return;
    }
    if (state === 'talking') {
      if (!animOn) {
        applySprite('talk');
        return;
      }
      if (stateChanged || force || now - lastFrameTick >= 180) {
        lastFrameTick = now;
        talkFrameIndex = (talkFrameIndex + 1) % 2;
        applySprite(talkFrameIndex === 0 ? 'talk' : 'idle');
      }
      return;
    }
    if (state === 'walking') {
      if (!animOn) {
        applySprite('walk1');
        return;
      }
      if (stateChanged || force || now - lastFrameTick >= 145) {
        lastFrameTick = now;
        walkStepIndex = (walkStepIndex + 1) % WALK_CYCLE.length;
        applySprite(WALK_CYCLE[walkStepIndex]);
      }
      return;
    }

    // Idle 待機：支援定時自然眨眼
    applySprite(animOn && isBlinking ? 'blink' : 'idle');
  }

  function scheduleNextBlink() {
    if (blinkScheduleTimer) clearTimeout(blinkScheduleTimer);
    if (isDestroyed) return;
    const delay = 3000 + Math.round(Math.random() * 2800);
    blinkScheduleTimer = setTimeout(() => {
      if (isDestroyed) return;
      if (currentVisualState === 'idle' && isSpriteAnimEnabled()) {
        isBlinking = true;
        tick(true);
        if (blinkEndTimer) clearTimeout(blinkEndTimer);
        blinkEndTimer = setTimeout(() => {
          isBlinking = false;
          tick(true);
        }, 150);
      }
      scheduleNextBlink();
    }, delay);
  }

  function setThinking(val) {
    isThinking = Boolean(val);
    tick(true);
  }

  function triggerSpeakBurst(durationMs = 1100) {
    talkUntil = Math.max(talkUntil, Date.now() + durationMs);
    tick(true);
  }

  function triggerPosePreview(poseKey, durationMs = 3200) {
    if (previewTimer) {
      clearTimeout(previewTimer);
      previewTimer = null;
    }
    if (!poseKey || poseKey === 'clear' || !SPRITE_ASSETS[poseKey]) {
      previewPose = null;
      tick(true);
      return;
    }
    previewPose = poseKey;
    tick(true);
    if (durationMs > 0) {
      previewTimer = setTimeout(() => {
        previewPose = null;
        previewTimer = null;
        tick(true);
      }, durationMs);
    }
  }

  // 每 90ms 輕量同步一次狀態機（零 DOM 重排，僅在圖片 key 變化時更新 src）
  const loopInterval = setInterval(() => tick(false), 90);
  scheduleNextBlink();
  tick(true);

  return {
    tick,
    setThinking,
    triggerSpeakBurst,
    triggerPosePreview,
    getCurrentState: () => currentVisualState,
    getCurrentSpriteKey: () => currentSpriteKey,
    destroy: () => {
      isDestroyed = true;
      clearInterval(loopInterval);
      if (blinkScheduleTimer) clearTimeout(blinkScheduleTimer);
      if (blinkEndTimer) clearTimeout(blinkEndTimer);
      if (previewTimer) clearTimeout(previewTimer);
    }
  };
}

module.exports = {
  SPRITE_ASSETS,
  init
};
