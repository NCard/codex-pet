/**
 * @jest-environment jsdom
 */

const stalkerModule = require('../../src/views/main/modules/alarm_stalker');

describe('Alarm Stalker 3-Stage State Machine Unit Tests', () => {
  let kiwi;
  let kiwiAccessory;
  let ipcRenderer;
  let mockGetPos;
  let mockSetPos;
  let mockUpdateDialogue;
  let petState;

  beforeEach(() => {
    jest.useFakeTimers();

    document.body.innerHTML = `
      <div id="kiwi-wrapper">
        <div id="kiwi"></div>
        <div id="kiwi-accessory" style="display: none;"></div>
      </div>
    `;

    kiwi = document.getElementById('kiwi');
    kiwiAccessory = document.getElementById('kiwi-accessory');

    mockGetPos = jest.fn().mockReturnValue({ x: 200, y: 200 });
    mockSetPos = jest.fn();
    mockUpdateDialogue = jest.fn();
    petState = {
      settings: {
        enableAlarmStalking: true,
        alarmStalkingDelay: 15,
        enableAlarmSound: false // mute in tests
      }
    };

    ipcRenderer = {
      send: jest.fn(),
      sendSync: jest.fn().mockReturnValue({ x: 400, y: 300 })
    };

    stalkerModule.init({
      kiwi,
      kiwiAccessory,
      ipcRenderer,
      getRealWindowPos: mockGetPos,
      setWindowPos: mockSetPos,
      getPetState: () => petState,
      getCurrentAction: () => 'idle',
      setCurrentAction: jest.fn(),
      getResolutionScale: () => 1.0,
      getIsWorking: () => false,
      updateAlarmDialogue: mockUpdateDialogue
    });
  });

  afterEach(() => {
    stalkerModule.stopStalking('reset');
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('startStalking starts at Stage 1 with ⏰ accessory', () => {
    expect(stalkerModule.getIsStalkingActive()).toBe(false);

    stalkerModule.startStalking({ message: '會議' });

    expect(stalkerModule.getIsStalkingActive()).toBe(true);
    expect(stalkerModule.getCurrentStage()).toBe(1);
    expect(kiwiAccessory.innerText).toBe('⏰');
    expect(kiwiAccessory.style.display).toBe('block');
  });

  test('escalates to Stage 2 after alarmStalkingDelay with walking and sweat accessory', () => {
    stalkerModule.startStalking({ message: '站立提醒' });

    expect(stalkerModule.getCurrentStage()).toBe(1);

    // Fast-forward past stage 1 delay (15s)
    jest.advanceTimersByTime(15000);

    expect(stalkerModule.getCurrentStage()).toBe(2);
    expect(kiwi.classList.contains('walking')).toBe(true);
    expect(kiwiAccessory.innerText).toBe('💦');
    expect(mockUpdateDialogue).toHaveBeenCalled();
  });

  test('escalates to Stage 3 after 20 seconds in Stage 2 with exclamation accessory', () => {
    stalkerModule.startStalking({ message: '喝水' });

    // Fast-forward 15s to Stage 2, then 20s to Stage 3
    jest.advanceTimersByTime(15000);
    expect(stalkerModule.getCurrentStage()).toBe(2);

    jest.advanceTimersByTime(20000);
    expect(stalkerModule.getCurrentStage()).toBe(3);
    expect(kiwiAccessory.innerText).toBe('❗');
    expect(mockUpdateDialogue).toHaveBeenCalledTimes(2);
  });

  test('stays at Stage 1 when enableAlarmStalking is false', () => {
    petState.settings.enableAlarmStalking = false;

    stalkerModule.startStalking({ message: '靜態鬧鐘' });

    jest.advanceTimersByTime(35000);

    expect(stalkerModule.getCurrentStage()).toBe(1);
    expect(kiwi.classList.contains('walking')).toBe(false);
    expect(kiwiAccessory.innerText).toBe('⏰');
  });

  test('stopStalking with ok or snooze shows heart ❤️ and resets walking state', () => {
    stalkerModule.startStalking({ message: '測試' });
    jest.advanceTimersByTime(15000);
    expect(stalkerModule.getCurrentStage()).toBe(2);

    stalkerModule.stopStalking('ok');

    expect(stalkerModule.getIsStalkingActive()).toBe(false);
    expect(kiwi.classList.contains('walking')).toBe(false);
    expect(kiwiAccessory.innerText).toBe('❤️');
  });

  test('stopStalking with ok triggers walking after relief jump', () => {
    const mockTriggerWalk = jest.fn();
    stalkerModule.init({
      kiwi,
      kiwiAccessory,
      ipcRenderer,
      getRealWindowPos: () => ({ x: 100, y: 100 }),
      setWindowPos: jest.fn(),
      getPetState: () => ({ settings: { enableAlarmSound: true } }),
      getCurrentAction: () => 'idle',
      setCurrentAction: jest.fn(),
      getResolutionScale: () => 1,
      getIsWorking: () => false,
      updateAlarmDialogue: jest.fn(),
      triggerWalk: mockTriggerWalk
    });

    stalkerModule.stopStalking('ok');
    expect(mockTriggerWalk).not.toHaveBeenCalled();

    jest.advanceTimersByTime(500);
    expect(mockTriggerWalk).toHaveBeenCalled();
  });

  test('stopStalking with snooze shows hourglass ⏳, shows dialogue, and triggers walking', () => {
    const mockTriggerWalk = jest.fn();
    const mockShowTempBubble = jest.fn();

    stalkerModule.init({
      kiwi,
      kiwiAccessory,
      ipcRenderer,
      getRealWindowPos: () => ({ x: 500, y: 500 }),
      setWindowPos: jest.fn(),
      getPetState: () => ({ settings: { enableAlarmSound: true } }),
      getCurrentAction: () => 'idle',
      setCurrentAction: jest.fn(),
      getResolutionScale: () => 1,
      getIsWorking: () => false,
      updateAlarmDialogue: jest.fn(),
      triggerWalk: mockTriggerWalk,
      showTempBubble: mockShowTempBubble
    });

    stalkerModule.stopStalking('snooze');

    expect(stalkerModule.getIsStalkingActive()).toBe(false);
    expect(kiwiAccessory.innerText).toBe('⏳');
    expect(mockShowTempBubble).toHaveBeenCalled();
    expect(mockTriggerWalk).not.toHaveBeenCalled();

    jest.advanceTimersByTime(500);
    expect(mockTriggerWalk).toHaveBeenCalled();
  });

  test('clampScreenBounds bounds target coordinates within display and workArea', () => {
    const clamped = stalkerModule.clampScreenBounds(99999, -5000);
    expect(clamped.x).toBeLessThan(99999);
    expect(clamped.y).toBeGreaterThan(-5000);

    // Multi-monitor workArea test (e.g. secondary monitor at x: 1920)
    const secondScreenClamped = stalkerModule.clampScreenBounds(2500, 300, null, { x: 1920, y: 0, width: 1920, height: 1080 });
    expect(secondScreenClamped.x).toBe(2500);
  });

  test('pauses walking when mouse cursor is near Kiwi or inside window area to make buttons easy to click', () => {
    // Return cursor right next to window (210, 220) where window is at (200, 200)
    ipcRenderer.sendSync.mockReturnValue({ x: 210, y: 220 });

    stalkerModule.startStalking({ message: '會議' });
    jest.advanceTimersByTime(15000); // Stage 2 starts
    expect(stalkerModule.getCurrentStage()).toBe(2);

    // Let animation frame step run
    jest.advanceTimersByTime(50);

    // Walking should be stopped because cursor is inside window click region
    expect(kiwi.classList.contains('walking')).toBe(false);
  });

  test('executes instant jump and shouts jump dialogue when cursor moves to a different screen', () => {
    // Return cursor on Right monitor (id: 2), while window is on Middle monitor (id: 1)
    ipcRenderer.sendSync.mockReturnValue({
      x: 2500,
      y: 400,
      cursorDisplayId: 2,
      windowDisplayId: 1,
      displayWorkArea: { x: 1920, y: 0, width: 1920, height: 1080 }
    });

    stalkerModule.startStalking({ message: '站立提醒' });
    jest.advanceTimersByTime(15000); // Stage 2 starts

    // Step physics loop
    jest.advanceTimersByTime(50);

    // Verify window-move is called with coordinates inside the new screen
    expect(ipcRenderer.send).toHaveBeenCalledWith('window-move', expect.any(Number), expect.any(Number));
    const lastMoveCall = ipcRenderer.send.mock.calls.find(c => c[0] === 'window-move');
    expect(lastMoveCall[1]).toBeGreaterThanOrEqual(1920 - 160);

    // Verify updateAlarmDialogue is called with jump phrase
    expect(mockUpdateDialogue).toHaveBeenCalled();
  });
});

