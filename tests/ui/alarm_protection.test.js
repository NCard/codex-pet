/**
 * @jest-environment jsdom
 */

const chatModule = require('../../src/views/main/modules/chat');
const clipboardWatcher = require('../../src/views/main/modules/clipboard_watcher');

describe('Alarm Protection & Interlock Unit Tests', () => {
  let dom;
  let chatBubble;
  let chatContent;
  let chatClose;
  let chatClear;
  let chatInput;
  let chatEscHint;
  let customMenu;
  let kiwi;
  let kiwiAccessory;
  let ipcRenderer;
  let chatInstance;

  beforeEach(() => {
    jest.useFakeTimers();

    document.body.innerHTML = `
      <div id="chat-container">
        <div id="clipboard-badge" style="display: none;">
          <span id="clipboard-badge-icon"></span>
          <span id="clipboard-badge-text"></span>
          <span id="clipboard-badge-close">✕</span>
        </div>
        <span id="chat-esc-hint" style="display: none;"></span>
        <div id="chat-bubble" style="display: none;">
          <button id="chat-close">✕</button>
          <button id="chat-clear">🧹</button>
          <div id="chat-content"></div>
        </div>
        <input id="chat-input" style="display: none;" />
      </div>
      <div id="custom-menu" style="display: none;"></div>
      <div id="kiwi"></div>
      <div id="kiwi-accessory" style="display: none;"></div>
    `;

    chatBubble = document.getElementById('chat-bubble');
    chatContent = document.getElementById('chat-content');
    chatClose = document.getElementById('chat-close');
    chatClear = document.getElementById('chat-clear');
    chatInput = document.getElementById('chat-input');
    chatEscHint = document.getElementById('chat-esc-hint');
    customMenu = document.getElementById('custom-menu');
    kiwi = document.getElementById('kiwi');
    kiwiAccessory = document.getElementById('kiwi-accessory');

    ipcRenderer = {
      send: jest.fn(),
      on: jest.fn(),
      invoke: jest.fn().mockResolvedValue([])
    };

    chatInstance = chatModule.init({
      chatBubble,
      chatContent,
      chatClose,
      chatClear,
      chatInput,
      chatEscHint,
      customMenu,
      kiwi,
      kiwiAccessory,
      namePrefix: 'Wiki: ',
      petState: { settings: {} },
      savePetState: jest.fn(),
      loadPetState: jest.fn(),
      applyOutfitPos: jest.fn(),
      getIsWorking: () => false,
      setIsWorking: jest.fn(),
      laser: { getIsLaserGameActive: () => false },
      getAI: () => null,
      getMcpClient: () => null,
      getGeminiTools: () => null,
      crypto: {},
      saveChatHistory: jest.fn(),
      clearChatHistory: jest.fn(),
      resetIdle: jest.fn(),
      ipcRenderer
    });
  });

  afterEach(() => {
    if (chatInstance) {
      chatInstance.dismissAlarm();
    }
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('showAlarmBubble should set isAlarmActive to true and show bubble', () => {
    expect(chatInstance.getIsAlarmActive()).toBe(false);

    chatInstance.showAlarmBubble({ message: '開會時間到囉！', snoozeInterval: 5 });

    expect(chatInstance.getIsAlarmActive()).toBe(true);
    expect(chatBubble.style.display).toBe('block');
    expect(chatContent.innerHTML).toContain('開會時間到囉！');
    expect(chatContent.innerHTML).toContain('btn-alarm-ok');
    expect(chatContent.innerHTML).toContain('btn-alarm-snooze');
  });

  test('openChat should not hide alarm bubble or clear content when alarm is active', () => {
    chatInstance.showAlarmBubble({ message: '喝水提醒', snoozeInterval: 5 });
    expect(chatInstance.getIsAlarmActive()).toBe(true);

    chatInstance.openChat();

    // Alarm remains active and visible
    expect(chatInstance.getIsAlarmActive()).toBe(true);
    expect(chatBubble.style.display).toBe('block');
    expect(chatContent.innerHTML).toContain('喝水提醒');
    expect(chatInput.style.display).toBe('none');
  });

  test('showTempBubble should not overwrite alarm bubble when alarm is active', () => {
    chatInstance.showAlarmBubble({ message: '重要鬧鐘', snoozeInterval: 5 });

    chatInstance.showTempBubble('閒置碎碎念訊息...', 3000);

    expect(chatContent.innerHTML).toContain('重要鬧鐘');
    expect(chatContent.innerHTML).not.toContain('閒置碎碎念訊息');
  });

  test('clicking OK button should dismiss alarm and invoke onDismiss callback', () => {
    const onDismiss = jest.fn();
    chatInstance.showAlarmBubble({ message: '日程到期' }, null, onDismiss);

    const btnOk = document.getElementById('btn-alarm-ok');
    expect(btnOk).not.toBeNull();
    btnOk.click();

    expect(chatInstance.getIsAlarmActive()).toBe(false);
    expect(chatBubble.style.display).toBe('none');
    expect(onDismiss).toHaveBeenCalledWith('ok');
  });

  test('clicking Snooze button should dismiss alarm, invoke onSnooze and onDismiss', () => {
    const onSnooze = jest.fn();
    const onDismiss = jest.fn();
    const alarmObj = { message: '日程到期', snoozeInterval: 10 };
    chatInstance.showAlarmBubble(alarmObj, onSnooze, onDismiss);

    const btnSnooze = document.getElementById('btn-alarm-snooze');
    expect(btnSnooze).not.toBeNull();
    btnSnooze.click();

    expect(chatInstance.getIsAlarmActive()).toBe(false);
    expect(chatBubble.style.display).toBe('none');
    expect(onSnooze).toHaveBeenCalledWith(alarmObj, 10);
    expect(onDismiss).toHaveBeenCalledWith('snooze');
  });

  test('pressing Escape should dismiss alarm and invoke onDismiss with escape', () => {
    const onDismiss = jest.fn();
    chatInstance.showAlarmBubble({ message: '鬧鐘測試' }, null, onDismiss);

    const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    window.dispatchEvent(escEvent);

    expect(chatInstance.getIsAlarmActive()).toBe(false);
    expect(chatBubble.style.display).toBe('none');
    expect(onDismiss).toHaveBeenCalledWith('escape');
  });

  test('clipboard watcher should suppress badges when alarm is active', () => {
    const badgeEl = document.getElementById('clipboard-badge');
    badgeEl.style.display = 'flex'; // simulate previous badge shown

    let isAlarm = true;
    const watcher = clipboardWatcher.init({
      badgeEl,
      badgeIconEl: document.getElementById('clipboard-badge-icon'),
      badgeTextEl: document.getElementById('clipboard-badge-text'),
      badgeCloseEl: document.getElementById('clipboard-badge-close'),
      getPetState: () => ({ settings: { enableClipboard: true, enableClipboardSmartWatch: true } }),
      sendMessage: jest.fn(),
      kiwi,
      getIsAlarmActive: () => isAlarm
    });

    // Initial check should hide badge if alarm is active
    expect(badgeEl.style.display).toBe('none');

    // If badge is somehow shown again, pollClipboard immediately hides it
    badgeEl.style.display = 'flex';
    watcher.pollClipboard();
    expect(badgeEl.style.display).toBe('none');

    if (watcher.destroy) watcher.destroy();
  });

  test('chat auto-hide should close idle chat window after configured seconds but never when disabled (0)', () => {
    const sharedState = { settings: { chatAutoHideSeconds: 0, chatAutoHidePauseOnHover: true } };
    const instance = chatModule.init({
      chatBubble, chatContent, chatClose, chatClear, chatInput, chatEscHint, customMenu,
      kiwi, kiwiAccessory, namePrefix: 'Wiki: ',
      petState: sharedState,
      savePetState: jest.fn(), loadPetState: jest.fn(), applyOutfitPos: jest.fn(),
      getIsWorking: () => false, setIsWorking: jest.fn(),
      laser: { getIsLaserGameActive: () => false },
      getAI: () => null, getMcpClient: () => null, getGeminiTools: () => null,
      crypto: {}, saveChatHistory: jest.fn(), clearChatHistory: jest.fn(), resetIdle: jest.fn(),
      ipcRenderer
    });

    instance.openChat();
    expect(chatInput.style.display).toBe('block');
    jest.advanceTimersByTime(60000);
    // Disabled (0) must remain open
    expect(chatInput.style.display).toBe('block');

    // Enable 15s auto-hide and refresh
    sharedState.settings.chatAutoHideSeconds = 15;
    instance.refreshAutoHideTimer();
    jest.advanceTimersByTime(14000);
    expect(chatInput.style.display).toBe('block');
    jest.advanceTimersByTime(1500);
    expect(chatInput.style.display).toBe('none');
    expect(chatBubble.style.display).toBe('none');
    expect(chatEscHint.style.display).toBe('none');
  });

  test('chat auto-hide should pause on hover and while user has draft text in input', () => {
    const container = document.getElementById('chat-container');
    const sharedState = { settings: { chatAutoHideSeconds: 10, chatAutoHidePauseOnHover: true } };
    const instance = chatModule.init({
      chatBubble, chatContent, chatClose, chatClear, chatInput, chatEscHint, customMenu,
      kiwi, kiwiAccessory, namePrefix: 'Wiki: ',
      petState: sharedState,
      savePetState: jest.fn(), loadPetState: jest.fn(), applyOutfitPos: jest.fn(),
      getIsWorking: () => false, setIsWorking: jest.fn(),
      laser: { getIsLaserGameActive: () => false },
      getAI: () => null, getMcpClient: () => null, getGeminiTools: () => null,
      crypto: {}, saveChatHistory: jest.fn(), clearChatHistory: jest.fn(), resetIdle: jest.fn(),
      ipcRenderer
    });

    instance.openChat();
    // Hover pauses countdown
    container.dispatchEvent(new MouseEvent('mouseenter'));
    jest.advanceTimersByTime(30000);
    expect(chatInput.style.display).toBe('block');

    // Draft text in input keeps chat open even after mouseleave
    chatInput.value = '正在輸入一半的句子';
    chatInput.dispatchEvent(new Event('input'));
    container.dispatchEvent(new MouseEvent('mouseleave'));
    jest.advanceTimersByTime(30000);
    expect(chatInput.style.display).toBe('block');

    // Clearing draft resumes countdown and hides after 10s
    chatInput.value = '';
    chatInput.dispatchEvent(new Event('input'));
    jest.advanceTimersByTime(10000);
    expect(chatInput.style.display).toBe('none');
  });

  test('chat auto-hide must NEVER hide active alarm bubbles, pomodoro reminders, or update progress', async () => {
    const ipcHandlers = {};
    const mockIpc = {
      send: jest.fn(),
      on: jest.fn((channel, cb) => { ipcHandlers[channel] = cb; }),
      invoke: jest.fn().mockResolvedValue([])
    };
    const sharedState = { settings: { chatAutoHideSeconds: 10, chatAutoHidePauseOnHover: false } };
    const instance = chatModule.init({
      chatBubble, chatContent, chatClose, chatClear, chatInput, chatEscHint, customMenu,
      kiwi, kiwiAccessory, namePrefix: 'Wiki: ',
      petState: sharedState,
      savePetState: jest.fn(), loadPetState: jest.fn(), applyOutfitPos: jest.fn(),
      getIsWorking: () => false, setIsWorking: jest.fn(),
      laser: { getIsLaserGameActive: () => false },
      getAI: () => ({ generateContent: jest.fn() }),
      getMcpClient: () => null, getGeminiTools: () => null,
      crypto: { randomUUID: () => 'uuid-1' },
      saveChatHistory: jest.fn(), clearChatHistory: jest.fn(), resetIdle: jest.fn(),
      ipcRenderer: mockIpc
    });

    // 1. Open chat (starts 10s timer), then alarm fires at 5s -> alarm must cancel timer & stay visible forever
    instance.openChat();
    jest.advanceTimersByTime(5000);
    instance.showAlarmBubble({ message: '重要會議鬧鐘！', snoozeInterval: 5 });
    jest.advanceTimersByTime(120000);
    expect(instance.getIsAlarmActive()).toBe(true);
    expect(chatBubble.style.display).toBe('block');
    expect(chatContent.innerHTML).toContain('重要會議鬧鐘！');
    instance.dismissAlarm('ok');

    // 2. Pomodoro reminder fires -> must stay visible even past 10s auto-hide
    await instance.sendMessage('/pomodoro 1');
    // The confirmation chat bubble hides after 10s
    jest.advanceTimersByTime(10000);
    expect(chatBubble.style.display).toBe('none');
    // At 60s, pomodoro completion alert appears
    jest.advanceTimersByTime(50000);
    expect(chatBubble.style.display).toBe('block');
    // Even after another 120s, pomodoro alert must NOT be auto-hidden!
    jest.advanceTimersByTime(120000);
    expect(chatBubble.style.display).toBe('block');

    // 3. System update progress must NOT be auto-hidden
    expect(typeof ipcHandlers['show-update-progress']).toBe('function');
    ipcHandlers['show-update-progress']({}, { percent: 45, speed: '2.1 MB/s' });
    jest.advanceTimersByTime(120000);
    expect(chatBubble.style.display).toBe('block');
    expect(chatContent.innerHTML).toContain('45%');
  });
});
