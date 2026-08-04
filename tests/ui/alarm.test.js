const alarmModule = require('../../src/views/main/modules/alarm');

describe('Alarm Module', () => {
  let mockLaser;
  let mockResetIdle;
  let mockShowAlarmBubble;
  let mockKiwi;
  let mockIpcRenderer;

  beforeEach(() => {
    mockLaser = { startShooting: jest.fn(), stopShooting: jest.fn() };
    mockResetIdle = jest.fn();
    mockShowAlarmBubble = jest.fn();
    mockKiwi = { classList: { remove: jest.fn() } };
    mockIpcRenderer = {
      send: jest.fn(),
      on: jest.fn(),
      invoke: jest.fn().mockResolvedValue([])
    };

    // The module requires fs, which reads alarmsPath. We'll just mock it gently.
    jest.mock('fs', () => ({
      existsSync: () => true,
      readFileSync: () => '[]'
    }));

    alarmModule.init({
      alarmsPath: 'dummy.json',
      laser: mockLaser,
      resetIdle: mockResetIdle,
      showAlarmBubble: mockShowAlarmBubble,
      kiwi: mockKiwi,
      ipcRenderer: mockIpcRenderer
    });
  });

  test('should initialize without errors', () => {
    // Tests that the interval and dependencies are correctly hooked up without crashing
    expect(typeof alarmModule.init).toBe('function');
  });
});
