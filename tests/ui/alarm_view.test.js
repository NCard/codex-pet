/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

describe('Alarm View UI Enhancements Unit Tests', () => {
  let mockIpcRenderer;
  let mockAlarmsData = [];

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetModules();

    document.body.innerHTML = `
      <div class="header">
        <button id="btn-open-add" class="add-header-btn">新增</button>
      </div>
      <div id="alarm-list"></div>
    `;

    mockIpcRenderer = {
      send: jest.fn(),
      on: jest.fn()
    };

    window.focus = jest.fn();

    jest.mock('electron', () => ({
      ipcRenderer: mockIpcRenderer
    }));

    mockAlarmsData = [
      {
        id: 'alarm-1',
        type: 'weekly',
        time: '18:30',
        days: [1, 2, 3, 4, 5],
        message: '下班打卡',
        enabled: true,
        snoozeInterval: 5
      },
      {
        id: 'alarm-past',
        type: 'date',
        date: '2020-01-01',
        time: '08:00',
        days: [],
        message: '過去的鬧鐘',
        enabled: false,
        snoozeInterval: 5
      }
    ];

    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockImplementation((p) => {
      if (p.includes('alarms.json')) {
        return JSON.stringify(mockAlarmsData);
      }
      return JSON.stringify({ todos: [] });
    });
    jest.spyOn(fs, 'writeFileSync').mockImplementation((p, data) => {
      if (p.includes('alarms.json')) {
        mockAlarmsData = JSON.parse(data);
      }
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('Requirement 1 & 2: Toggle switches are rendered, and toggling on emits alarm-enabled-notify', () => {
    require('../../src/views/alarm/alarm');

    const switches = document.querySelectorAll('.alarm-actions .switch');
    expect(switches.length).toBe(2);

    // alarms are sorted by time: '08:00' (alarm-past, enabled: false) is index 0, '18:30' (alarm-1, enabled: true) is index 1
    const pastSwitchInput = switches[0].querySelector('input[type="checkbox"]');
    expect(pastSwitchInput.checked).toBe(false);

    const activeSwitchInput = switches[1].querySelector('input[type="checkbox"]');
    expect(activeSwitchInput.checked).toBe(true);

    // Toggle the disabled alarm on
    pastSwitchInput.checked = true;
    pastSwitchInput.dispatchEvent(new Event('change'));

    // Should notify that alarm is enabled
    expect(mockIpcRenderer.send).toHaveBeenCalledWith(
      'alarm-enabled-notify',
      expect.objectContaining({
        id: 'alarm-past'
      })
    );
  });

  test('Requirement 3: Unified Combobox merges input and dropdown without showing both at once', () => {
    require('../../src/views/alarm/alarm');

    const btnAdd = document.getElementById('btn-open-add');
    btnAdd.click();

    const timeInput = document.querySelector('.inline-time-input');
    const hourSelect = document.querySelector('.inline-hour-select');
    const minSelect = document.querySelector('.inline-minute-select');
    const popover = document.querySelector('.time-dropdown-popover');
    const btnDropdown = document.querySelector('.btn-time-dropdown');

    expect(timeInput).not.toBeNull();
    expect(hourSelect).not.toBeNull();
    expect(minSelect).not.toBeNull();
    expect(btnDropdown).not.toBeNull();

    // Dropdown popover is initially closed, showing only the unified input field
    expect(popover.style.display).toBe('none');

    // Clicking the dropdown button toggles the popover open
    btnDropdown.click();
    expect(popover.style.display).toBe('flex');

    // Type a future time (e.g. 23:45)
    timeInput.value = '23:45';
    timeInput.dispatchEvent(new Event('input'));
    timeInput.dispatchEvent(new Event('blur'));

    expect(hourSelect.value).toBe('23');
    expect(minSelect.value).toBe('45');
    expect(timeInput.value).toBe('23:45');

    // Changing select updates manual input
    hourSelect.value = '22';
    hourSelect.dispatchEvent(new Event('change'));
    minSelect.value = '15';
    minSelect.dispatchEvent(new Event('change'));

    expect(timeInput.value).toBe('22:15');

    // Quick time button updates input and closes popover
    const quickBtn15 = document.querySelector('.btn-quick-time[data-offset="15"]');
    quickBtn15.click();
    expect(popover.style.display).toBe('none');
    expect(timeInput.value).toMatch(/^\d{2}:\d{2}$/);
  });

  test('Requirement 4: Past times cannot be selected for specific date and editing past alarm defaults to current time', () => {
    require('../../src/views/alarm/alarm');

    // Click edit on the past alarm (index 0 is alarm-past, 08:00)
    const editBtns = document.querySelectorAll('.btn-edit');
    expect(editBtns.length).toBe(2);
    editBtns[0].click(); // alarm-past (date was 2020-01-01, 08:00)

    const dateInput = document.querySelector('.inline-date-input');
    const hourSelect = document.querySelector('.inline-hour-select');
    const minSelect = document.querySelector('.inline-minute-select');
    const timeInput = document.querySelector('.inline-time-input');

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    const currentH = now.getHours().toString().padStart(2, '0');
    const currentM = now.getMinutes().toString().padStart(2, '0');

    // Automatically defaulted to today and current time instead of 2020-01-01 08:00
    expect(dateInput.value).toBe(todayStr);
    expect(dateInput.min).toBe(todayStr);
    expect(hourSelect.value).toBe(currentH);
    expect(minSelect.value).toBe(currentM);
    expect(timeInput.value).toBe(`${currentH}:${currentM}`);

    // Past hours on today should be disabled
    const currentHInt = parseInt(currentH, 10);
    if (currentHInt > 0) {
      const pastHourOption = hourSelect.querySelector(`option[value="${(currentHInt - 1).toString().padStart(2, '0')}"]`);
      expect(pastHourOption.disabled).toBe(true);
    }
  });

  test('Creating a new enabled alarm triggers notifyAlarmEnabled', () => {
    require('../../src/views/alarm/alarm');

    const btnAdd = document.getElementById('btn-open-add');
    btnAdd.click();

    const msgInput = document.querySelector('.inline-msg-input');
    msgInput.value = '喝水提醒';

    const timeInput = document.querySelector('.inline-time-input');
    timeInput.value = '23:59';
    timeInput.dispatchEvent(new Event('blur'));

    const btnConfirm = document.querySelector('.btn-confirm');
    btnConfirm.click();

    expect(mockIpcRenderer.send).toHaveBeenCalledWith(
      'alarm-enabled-notify',
      expect.objectContaining({
        message: '喝水提醒',
        time: '23:59'
      })
    );
  });

  test('iOS Alarm Wheel Picker: renders 5-cycle infinite loop, central selection lens, and bidirectional sync', () => {
    require('../../src/views/alarm/alarm');

    const btnAdd = document.getElementById('btn-open-add');
    btnAdd.click();

    const btnDropdown = document.querySelector('.btn-time-dropdown');
    btnDropdown.click();

    const hourScroll = document.querySelector('.wheel-hour-scroll');
    const minScroll = document.querySelector('.wheel-min-scroll');
    const lens = document.querySelector('.ios-wheel-lens');

    expect(hourScroll).not.toBeNull();
    expect(minScroll).not.toBeNull();
    expect(lens).not.toBeNull();

    const hourItems = hourScroll.querySelectorAll('.ios-wheel-item');
    const minItems = minScroll.querySelectorAll('.wheel-min-scroll .ios-wheel-item');

    // 5 cycles: 24 * 5 = 120 hour items, 60 * 5 = 300 minute items
    expect(hourItems.length).toBe(120);
    expect(minItems.length).toBe(300);

    // Clicking an hour item in the list smooth scrolls and snaps that hour to center
    const targetHourItem = hourItems[48 + 18]; // Hour 18 in Middle Cycle 2
    expect(targetHourItem.dataset.val).toBe('18');
    targetHourItem.click();

    const hourSelect = document.querySelector('.inline-hour-select');
    const timeInput = document.querySelector('.inline-time-input');
    expect(hourSelect.value).toBe('18');
    expect(timeInput.value.startsWith('18:')).toBe(true);

    // Clicking a minute item in the list updates minute
    const targetMinItem = minItems[120 + 45]; // Minute 45 in Middle Cycle 2
    expect(targetMinItem.dataset.val).toBe('45');
    targetMinItem.click();

    const minSelect = document.querySelector('.inline-minute-select');
    expect(minSelect.value).toBe('45');
    expect(timeInput.value).toBe('18:45');
  });

  test('Alarm type radios follow order [once, weekly, date], share the same name, and switch cleanly back and forth', () => {
    require('../../src/views/alarm/alarm');

    document.getElementById('btn-open-add').click();

    const radios = Array.from(document.querySelectorAll('.inline-type-radio'));
    expect(radios.map(r => r.value)).toEqual(['once', 'weekly', 'date']);

    // All radios must share the same non-empty name attribute so clicking another unchecks the previous one
    const sharedName = radios[0].getAttribute('name');
    expect(sharedName).toBeTruthy();
    expect(radios.every(r => r.getAttribute('name') === sharedName)).toBe(true);

    const [onceRadio, weeklyRadio, dateRadio] = radios;
    const onceGroup = document.querySelector('.inline-once-group');
    const weeklyGroup = document.querySelector('.inline-weekly-group');
    const dateGroup = document.querySelector('.inline-date-group');

    // Default is once
    expect(onceRadio.checked).toBe(true);
    expect(weeklyRadio.checked).toBe(false);
    expect(dateRadio.checked).toBe(false);
    expect(onceGroup.style.display).toBe('block');
    expect(weeklyGroup.style.display).toBe('none');
    expect(dateGroup.style.display).toBe('none');

    // Switch to weekly
    weeklyRadio.click();
    expect(onceRadio.checked).toBe(false);
    expect(weeklyRadio.checked).toBe(true);
    expect(dateRadio.checked).toBe(false);
    expect(onceGroup.style.display).toBe('none');
    expect(weeklyGroup.style.display).toBe('block');
    expect(dateGroup.style.display).toBe('none');

    // Switch to date
    dateRadio.click();
    expect(onceRadio.checked).toBe(false);
    expect(weeklyRadio.checked).toBe(false);
    expect(dateRadio.checked).toBe(true);
    expect(onceGroup.style.display).toBe('none');
    expect(weeklyGroup.style.display).toBe('none');
    expect(dateGroup.style.display).toBe('block');

    // Switch back to weekly, then back to once
    weeklyRadio.click();
    expect(weeklyRadio.checked).toBe(true);
    expect(dateRadio.checked).toBe(false);
    expect(weeklyGroup.style.display).toBe('block');
    expect(dateGroup.style.display).toBe('none');

    onceRadio.click();
    expect(onceRadio.checked).toBe(true);
    expect(weeklyRadio.checked).toBe(false);
    expect(onceGroup.style.display).toBe('block');
    expect(weeklyGroup.style.display).toBe('none');
  });

  test('Creating a once alarm saves type=once and renders once label', () => {
    require('../../src/views/alarm/alarm');

    document.getElementById('btn-open-add').click();

    const msgInput = document.querySelector('.inline-msg-input');
    msgInput.value = '只提醒這一次';

    const timeInput = document.querySelector('.inline-time-input');
    timeInput.value = '23:50';
    timeInput.dispatchEvent(new Event('blur'));

    document.querySelector('.btn-confirm').click();

    const saved = mockAlarmsData.find(a => a.message === '只提醒這一次');
    expect(saved).toBeDefined();
    expect(saved.type).toBe('once');
    expect(saved.time).toBe('23:50');
    expect(saved.targetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(document.getElementById('alarm-list').textContent).toContain('⚡ 一次性');
  });

  test('Multi-date selection allows adding, deduplicating, removing dates and persists sorted dates array', () => {
    require('../../src/views/alarm/alarm');

    document.getElementById('btn-open-add').click();

    const dateRadio = document.querySelector('.inline-type-radio[value="date"]');
    dateRadio.click();

    const dateInput = document.querySelector('.inline-date-input');
    const btnAddDate = document.querySelector('.btn-add-date');

    // Add 3 future dates out of order + 1 duplicate
    dateInput.value = '2099-12-10';
    dateInput.dispatchEvent(new Event('change'));
    dateInput.value = '2099-12-02';
    dateInput.dispatchEvent(new Event('change'));
    dateInput.value = '2099-12-05';
    btnAddDate.click();
    dateInput.value = '2099-12-05';
    dateInput.dispatchEvent(new Event('change')); // duplicate ignored

    let chips = Array.from(document.querySelectorAll('.date-tag-chip'));
    expect(chips.map(c => c.dataset.date)).toEqual(['2099-12-02', '2099-12-05', '2099-12-10']);

    // Remove middle date
    const removeBtn = document.querySelector('.date-tag-remove[data-date="2099-12-05"]');
    removeBtn.click();

    chips = Array.from(document.querySelectorAll('.date-tag-chip'));
    expect(chips.map(c => c.dataset.date)).toEqual(['2099-12-02', '2099-12-10']);

    const msgInput = document.querySelector('.inline-msg-input');
    msgInput.value = '多日會議提醒';
    const timeInput = document.querySelector('.inline-time-input');
    timeInput.value = '09:30';
    timeInput.dispatchEvent(new Event('blur'));

    document.querySelector('.btn-confirm').click();

    const saved = mockAlarmsData.find(a => a.message === '多日會議提醒');
    expect(saved).toBeDefined();
    expect(saved.type).toBe('date');
    expect(saved.dates).toEqual(['2099-12-02', '2099-12-10']);
    expect(saved.date).toBe('2099-12-02');
    expect(mockIpcRenderer.send).toHaveBeenCalledWith(
      'alarm-enabled-notify',
      expect.objectContaining({
        type: 'date',
        dates: ['2099-12-02', '2099-12-10'],
        message: '多日會議提醒'
      })
    );
  });
});
