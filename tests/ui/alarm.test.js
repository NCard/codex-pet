const fs = require('fs');
const alarmModule = require('../../src/views/main/modules/alarm');

describe('Alarm Module', () => {
  let mockLaser;
  let mockResetIdle;
  let mockShowAlarmBubble;
  let mockKiwi;
  let mockIpcRenderer;
  let storedAlarms;

  beforeEach(() => {
    jest.useFakeTimers();
    storedAlarms = [];

    mockLaser = {
      getIsLaserGameActive: jest.fn(() => false),
      toggleLaserGame: jest.fn(),
      startShooting: jest.fn(),
      stopShooting: jest.fn()
    };
    mockResetIdle = jest.fn();
    mockShowAlarmBubble = jest.fn();
    mockKiwi = { classList: { add: jest.fn(), remove: jest.fn() } };
    mockIpcRenderer = {
      send: jest.fn(),
      on: jest.fn(),
      invoke: jest.fn().mockResolvedValue([])
    };

    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => JSON.stringify(storedAlarms));
    jest.spyOn(fs, 'writeFileSync').mockImplementation((_p, content) => {
      storedAlarms = JSON.parse(content);
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function initModule() {
    alarmModule.init({
      alarmsPath: 'dummy.json',
      laser: mockLaser,
      resetIdle: mockResetIdle,
      showAlarmBubble: mockShowAlarmBubble,
      kiwi: mockKiwi,
      ipcRenderer: mockIpcRenderer
    });
  }

  test('should initialize without errors', () => {
    initModule();
    expect(typeof alarmModule.init).toBe('function');
  });

  test('once alarm triggers once at target date/time and automatically disables itself', () => {
    jest.setSystemTime(new Date(2026, 10, 27, 9, 30, 0)); // 2026-11-27 09:30 local
    storedAlarms = [
      {
        id: 'once-1',
        type: 'once',
        targetDate: '2026-11-27',
        time: '09:30',
        message: '一次性喝水',
        enabled: true
      },
      {
        id: 'once-future',
        type: 'once',
        targetDate: '2026-11-28',
        time: '09:30',
        message: '明天一次性提醒',
        enabled: true
      }
    ];

    initModule();
    jest.advanceTimersByTime(5000);

    expect(mockShowAlarmBubble).toHaveBeenCalledTimes(1);
    expect(mockShowAlarmBubble.mock.calls[0][0].id).toBe('once-1');
    expect(storedAlarms.find(a => a.id === 'once-1').enabled).toBe(false);
    expect(storedAlarms.find(a => a.id === 'once-future').enabled).toBe(true);
    expect(mockIpcRenderer.send).toHaveBeenCalledWith('reload-data');
  });

  test('multi-date alarm stays enabled while future dates remain and disables after final date triggers', () => {
    jest.setSystemTime(new Date(2026, 10, 27, 14, 0, 0)); // 2026-11-27 14:00 local
    storedAlarms = [
      {
        id: 'multi-1',
        type: 'date',
        date: '2026-11-27',
        dates: ['2026-11-27', '2026-11-29'],
        time: '14:00',
        message: '兩天會議',
        enabled: true
      }
    ];

    initModule();
    jest.advanceTimersByTime(5000);

    // First date triggered, but 2026-11-29 is still ahead -> remains enabled
    expect(mockShowAlarmBubble).toHaveBeenCalledTimes(1);
    expect(storedAlarms[0].enabled).toBe(true);

    // Advance clock to the final date 2026-11-29 14:00
    jest.setSystemTime(new Date(2026, 10, 29, 14, 0, 0));
    jest.advanceTimersByTime(5000);

    expect(mockShowAlarmBubble).toHaveBeenCalledTimes(2);
    expect(storedAlarms[0].enabled).toBe(false);
    expect(mockIpcRenderer.send).toHaveBeenCalledWith('reload-data');
  });
});
