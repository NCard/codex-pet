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

  test('clampScreenBounds bounds target coordinates within display', () => {
    const clamped = stalkerModule.clampScreenBounds(99999, -5000);
    expect(clamped.x).toBeLessThan(99999);
    expect(clamped.y).toBeGreaterThan(-5000);
  });
});
