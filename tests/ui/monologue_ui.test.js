/**
 * @jest-environment jsdom
 */

const monologueModule = require('../../src/views/main/modules/monologue');

describe('Monologue UI & Interlock Tests', () => {
  let bubbleEl;
  let textEl;
  let closeEl;
  let chatBubble;
  let chatInput;
  let customMenu;
  let clipboardBadge;
  let petState;
  let currentAction;
  let isAlarmActive;
  let isWorking;
  let isDragging;
  let isLaserActive;
  let onClickContinueChat;
  let controller;

  beforeEach(() => {
    jest.useFakeTimers();

    document.body.innerHTML = `
      <div id="chat-container">
        <div id="clipboard-badge" style="display: none;"></div>
        <div id="monologue-bubble" style="display: none;">
          <span class="monologue-icon">💭</span>
          <span id="monologue-text"></span>
          <span id="monologue-close">✕</span>
        </div>
        <div id="chat-bubble" style="display: none;"></div>
        <textarea id="chat-input" style="display: none;"></textarea>
      </div>
      <div id="custom-menu" style="display: none;"></div>
    `;

    bubbleEl = document.getElementById('monologue-bubble');
    textEl = document.getElementById('monologue-text');
    closeEl = document.getElementById('monologue-close');
    chatBubble = document.getElementById('chat-bubble');
    chatInput = document.getElementById('chat-input');
    customMenu = document.getElementById('custom-menu');
    clipboardBadge = document.getElementById('clipboard-badge');

    petState = {
      hunger: 90,
      mood: 90,
      todos: [{ id: '1', text: '檢查報告', done: false }],
      outfits: ['🕶️'],
      settings: {
        enableMonologue: true,
        monologueFrequency: 'normal',
        monologueSleepDream: true,
        monologueUseAI: false,
        aiPersonality: 'default',
        aiScenario: 'developer'
      }
    };
    currentAction = 'idle';
    isAlarmActive = false;
    isWorking = false;
    isDragging = false;
    isLaserActive = false;
    onClickContinueChat = jest.fn();

    controller = monologueModule.init({
      bubbleEl,
      textEl,
      closeEl,
      chatBubble,
      chatInput,
      customMenu,
      clipboardBadge,
      getPetState: () => petState,
      getCurrentAction: () => currentAction,
      getCpuUsage: () => 25,
      getIsAlarmActive: () => isAlarmActive,
      getIsWorking: () => isWorking,
      getIsDragging: () => isDragging,
      getIsLaserActive: () => isLaserActive,
      getAI: () => null,
      onClickContinueChat
    });
  });

  afterEach(() => {
    if (controller) controller.destroy();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('triggerNow should display monologue bubble and auto-hide after display duration', async () => {
    const res = await controller.triggerNow();
    expect(res).not.toBeNull();
    expect(bubbleEl.style.display).toBe('flex');
    expect(textEl.innerText).toBe(res.text);

    // Hover pauses auto-hide
    bubbleEl.dispatchEvent(new MouseEvent('mouseenter'));
    jest.advanceTimersByTime(10000);
    expect(bubbleEl.style.display).toBe('flex');

    // Mouseleave resumes auto-hide
    bubbleEl.dispatchEvent(new MouseEvent('mouseleave'));
    jest.advanceTimersByTime(6000);
    expect(bubbleEl.style.display).toBe('none');
  });

  test('monologue must NEVER interrupt alarms, pomodoro, open chat, clipboard badge, or disabled setting', async () => {
    isAlarmActive = true;
    expect(await controller.triggerNow()).toBeNull();
    expect(bubbleEl.style.display).toBe('none');
    isAlarmActive = false;

    isWorking = true;
    expect(await controller.triggerNow()).toBeNull();
    isWorking = false;

    chatBubble.style.display = 'block';
    expect(await controller.triggerNow()).toBeNull();
    chatBubble.style.display = 'none';

    clipboardBadge.style.display = 'flex';
    expect(await controller.triggerNow()).toBeNull();
    clipboardBadge.style.display = 'none';

    petState.settings.enableMonologue = false;
    expect(await controller.triggerNow()).toBeNull();
  });

  test('sleep dream setting should control dream mode display during sleep', async () => {
    currentAction = 'sleeping';
    petState.settings.monologueSleepDream = false;
    expect(await controller.triggerNow()).toBeNull();

    petState.settings.monologueSleepDream = true;
    const res = await controller.triggerNow();
    expect(res).not.toBeNull();
    expect(res.isDream).toBe(true);
    expect(bubbleEl.classList.contains('dream-mode')).toBe(true);
  });

  test('clicking monologue bubble should hide it and invoke onClickContinueChat with the spoken text', async () => {
    const res = await controller.triggerNow();
    expect(bubbleEl.style.display).toBe('flex');

    bubbleEl.click();
    expect(bubbleEl.style.display).toBe('none');
    expect(onClickContinueChat).toHaveBeenCalledWith(res.text);
  });

  test('clicking close button should hide monologue without opening chat', async () => {
    await controller.triggerNow();
    expect(bubbleEl.style.display).toBe('flex');

    closeEl.click();
    expect(bubbleEl.style.display).toBe('none');
    expect(onClickContinueChat).not.toHaveBeenCalled();
  });
});
