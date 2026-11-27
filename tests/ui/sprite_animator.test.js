/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const spriteAnimator = require('../../src/views/main/modules/sprite_animator');

describe('Sprite Animator & Japanese Picture-Book Assets UI Tests', () => {
  let kiwiImg;
  let kiwiWrapper;
  let kiwiShadow;
  let currentAction;
  let petState;
  let cpuUsage;
  let isAlarmActive;
  let isDragging;
  let isDialogueActive;
  let tiredChanges;
  let controller;

  beforeEach(() => {
    jest.useFakeTimers();

    document.body.innerHTML = `
      <div id="kiwi-sprite-wrapper">
        <img id="kiwi-img" src="../../../assets/images/kiwi.png" />
      </div>
      <div id="kiwi-shadow" class="kiwi-shadow shadow-idle"></div>
    `;

    kiwiImg = document.getElementById('kiwi-img');
    kiwiWrapper = document.getElementById('kiwi-sprite-wrapper');
    kiwiShadow = document.getElementById('kiwi-shadow');

    currentAction = 'idle';
    petState = {
      hunger: 90,
      mood: 90,
      settings: {
        petScale: 180,
        enablePetShadow: true,
        enableSpriteAnim: true
      }
    };
    cpuUsage = 10;
    isAlarmActive = false;
    isDragging = false;
    isDialogueActive = false;
    tiredChanges = [];

    controller = spriteAnimator.init({
      kiwiImg,
      kiwiWrapper,
      kiwiShadow,
      getCurrentAction: () => currentAction,
      getPetState: () => petState,
      getCpuUsage: () => cpuUsage,
      getIsAlarmActive: () => isAlarmActive,
      getIsDragging: () => isDragging,
      getIsDialogueActive: () => isDialogueActive,
      onTiredStateChange: (val) => tiredChanges.push(val)
    });
  });

  afterEach(() => {
    if (controller) controller.destroy();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('all 13 sprite asset files referenced by SPRITE_ASSETS must exist on disk', () => {
    const imagesDir = path.resolve(__dirname, '../../assets/images');
    Object.values(spriteAnimator.SPRITE_ASSETS).forEach((relPath) => {
      const fileName = path.basename(relPath);
      expect(fs.existsSync(path.join(imagesDir, fileName))).toBe(true);
    });
  });

  test('should resolve priority states and update ground shadow dynamically', () => {
    expect(controller.getCurrentSpriteKey()).toBe('idle');
    expect(kiwiShadow.classList.contains('shadow-idle')).toBe(true);

    // Thinking
    controller.setThinking(true);
    expect(controller.getCurrentSpriteKey()).toBe('thinking');

    // Integrated sleeping overrides thinking and widens shadow
    currentAction = 'sleeping';
    controller.tick(true);
    expect(controller.getCurrentSpriteKey()).toBe('sleep');
    expect(kiwiShadow.classList.contains('shadow-sleeping')).toBe(true);

    // Dragging / dangling has highest runtime priority and fades shadow
    isDragging = true;
    controller.tick(true);
    expect(controller.getCurrentSpriteKey()).toBe('dangling');
    expect(kiwiShadow.classList.contains('shadow-dangling')).toBe(true);

    // Clear back to idle -> tired when CPU high
    isDragging = false;
    currentAction = 'idle';
    controller.setThinking(false);
    cpuUsage = 85;
    controller.tick(true);
    expect(controller.getCurrentSpriteKey()).toBe('tired');
  });

  test('should cycle multi-frame animations for walking, eating, talking, and auto-blink', () => {
    // Walking cycles through idle / walk1 / walk2
    currentAction = 'moving';
    const walkKeys = new Set();
    for (let i = 0; i < 6; i++) {
      jest.advanceTimersByTime(180);
      walkKeys.add(controller.getCurrentSpriteKey());
    }
    expect(walkKeys.has('walk1')).toBe(true);
    expect(walkKeys.has('walk2')).toBe(true);

    // Eating alternates eating1 & eating2
    currentAction = 'eating';
    const eatKeys = new Set();
    for (let i = 0; i < 4; i++) {
      jest.advanceTimersByTime(400);
      eatKeys.add(controller.getCurrentSpriteKey());
    }
    expect(eatKeys.has('eating1')).toBe(true);
    expect(eatKeys.has('eating2')).toBe(true);

    // Speak burst alternates talk & idle
    currentAction = 'idle';
    controller.triggerSpeakBurst(800);
    expect(['talk', 'idle']).toContain(controller.getCurrentSpriteKey());
    jest.advanceTimersByTime(220);
    const secondTalkKey = controller.getCurrentSpriteKey();
    expect(['talk', 'idle']).toContain(secondTalkKey);

    // Auto-blink triggers during idle within 6 seconds
    jest.advanceTimersByTime(1000);
    let sawBlink = false;
    for (let i = 0; i < 80; i++) {
      jest.advanceTimersByTime(100);
      if (controller.getCurrentSpriteKey() === 'blink') {
        sawBlink = true;
        break;
      }
    }
    expect(sawBlink).toBe(true);
  });

  test('should support pose preview and shadow toggle', () => {
    controller.triggerPosePreview('sleep', 2000);
    expect(controller.getCurrentSpriteKey()).toBe('sleep');
    expect(kiwiShadow.classList.contains('shadow-sleeping')).toBe(true);

    jest.advanceTimersByTime(2100);
    expect(controller.getCurrentSpriteKey()).toBe('idle');

    petState.settings.enablePetShadow = false;
    controller.tick(true);
    expect(kiwiShadow.style.display).toBe('none');
  });

  test('sustained high CPU sweats intermittently instead of continuously and syncs .kiwi-tired class', () => {
    cpuUsage = 90;
    controller.tick(true);

    // Starts brief sweat pulse
    expect(controller.getCurrentState()).toBe('tired');
    expect(controller.getCurrentSpriteKey()).toBe('tired');
    expect(kiwiImg.classList.contains('kiwi-tired')).toBe(true);
    expect(tiredChanges).toEqual([true]);

    // After sweat duration (~6s), cools down back to cute idle even though CPU is still 90%
    jest.advanceTimersByTime(spriteAnimator.CPU_SWEAT_DURATION_MS + 200);
    expect(controller.getCurrentState()).toBe('idle');
    expect(['idle', 'blink']).toContain(controller.getCurrentSpriteKey());
    expect(kiwiImg.classList.contains('kiwi-tired')).toBe(false);
    expect(tiredChanges).toEqual([true, false]);

    // Stays calm during cooldown (e.g. 30s later)
    jest.advanceTimersByTime(30000);
    expect(controller.getCurrentState()).toBe('idle');

    // Only triggers next brief pulse after full cooldown elapses
    jest.advanceTimersByTime(spriteAnimator.CPU_SWEAT_COOLDOWN_MS - 30000 + 200);
    expect(controller.getCurrentState()).toBe('tired');
    expect(kiwiImg.classList.contains('kiwi-tired')).toBe(true);
  });

  test('never switches to sweating while dialogue/monologue bubble is visible or during post-dialogue grace period', () => {
    cpuUsage = 95;
    isDialogueActive = true;
    controller.triggerSpeakBurst(1200);

    expect(controller.getCurrentState()).toBe('talking');
    expect(kiwiImg.classList.contains('kiwi-tired')).toBe(false);

    // After talking burst finishes, bubble is STILL visible -> must stay idle, NEVER sweat!
    jest.advanceTimersByTime(5000);
    expect(controller.getCurrentState()).toBe('idle');
    expect(kiwiImg.classList.contains('kiwi-tired')).toBe(false);
    expect(tiredChanges).toEqual([]);

    // Bubble closes -> still protected during grace period
    isDialogueActive = false;
    jest.advanceTimersByTime(2000);
    expect(controller.getCurrentState()).toBe('idle');
    expect(kiwiImg.classList.contains('kiwi-tired')).toBe(false);

    // After grace period ends -> allowed to pulse high-CPU sweat again
    jest.advanceTimersByTime(spriteAnimator.POST_DIALOGUE_GRACE_MS);
    expect(controller.getCurrentState()).toBe('tired');
    expect(kiwiImg.classList.contains('kiwi-tired')).toBe(true);
  });
});
