/**
 * @jest-environment jsdom
 */

const statusHud = require('../../src/views/main/modules/status_hud');
const interaction = require('../../src/views/main/modules/interaction');

describe('Pet RPG Status HUD Unit Tests (HP / MP / SP)', () => {
  let hudEl;
  let petState;
  let cpuUsage;
  let hud;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="pet-status-hud" class="pet-status-hud">
        <div class="hud-bar-row hud-hp" data-bar="hp">
          <span class="hud-label">HP</span>
          <div class="hud-track"><div id="hud-fill-hp" class="hud-fill"></div></div>
          <span id="hud-val-hp" class="hud-val">100</span>
        </div>
        <div class="hud-bar-row hud-mp" data-bar="mp">
          <span class="hud-label">MP</span>
          <div class="hud-track"><div id="hud-fill-mp" class="hud-fill"></div></div>
          <span id="hud-val-mp" class="hud-val">100</span>
        </div>
        <div class="hud-bar-row hud-sp" data-bar="sp">
          <span class="hud-label">SP</span>
          <div class="hud-track"><div id="hud-fill-sp" class="hud-fill"></div></div>
          <span id="hud-val-sp" class="hud-val">100</span>
        </div>
      </div>
    `;

    hudEl = document.getElementById('pet-status-hud');
    petState = {
      hunger: 85,
      mood: 70,
      settings: {
        showStatusBars: true,
        enableHungerSystem: true,
        enableCpuSweat: true
      }
    };
    cpuUsage = 24;

    hud = statusHud.init({
      hudEl,
      getPetState: () => petState,
      getCpuUsage: () => cpuUsage
    });
  });

  test('renders HP, MP, and SP (100 - CPU) as plain numbers without % and updates threshold states', () => {
    expect(hudEl.style.display).toBe('flex');
    expect(document.getElementById('hud-fill-hp').style.width).toBe('85%');
    expect(document.getElementById('hud-val-hp').textContent).toBe('85');
    expect(document.getElementById('hud-fill-mp').style.width).toBe('70%');
    expect(document.getElementById('hud-val-mp').textContent).toBe('70');
    expect(document.getElementById('hud-fill-sp').style.width).toBe('76%');
    expect(document.getElementById('hud-val-sp').textContent).toBe('76');
    expect(hudEl.textContent).not.toContain('%');

    // HP floors at 1 (never 0) and high CPU drops SP into danger (< 25)
    petState.hunger = 0;
    petState.mood = 20;
    cpuUsage = 88;
    hud.update();

    expect(document.getElementById('hud-val-hp').textContent).toBe('1');
    expect(document.getElementById('hud-fill-hp').style.width).toBe('1%');
    expect(hudEl.querySelector('[data-bar="hp"]').classList.contains('is-danger')).toBe(true);
    expect(hudEl.querySelector('[data-bar="mp"]').classList.contains('is-low')).toBe(true);
    expect(document.getElementById('hud-val-sp').textContent).toBe('12');
    expect(document.getElementById('hud-fill-sp').style.width).toBe('12%');
    expect(hudEl.querySelector('[data-bar="sp"]').classList.contains('is-danger')).toBe(true);
  });

  test('hides HP/MP rows when enableHungerSystem is false and hides entire HUD when showStatusBars is false', () => {
    petState.settings.enableHungerSystem = false;
    hud.update();

    expect(hudEl.style.display).toBe('flex');
    expect(hudEl.querySelector('[data-bar="hp"]').style.display).toBe('none');
    expect(hudEl.querySelector('[data-bar="mp"]').style.display).toBe('none');
    expect(hudEl.querySelector('[data-bar="sp"]').style.display).toBe('flex');

    petState.settings.showStatusBars = false;
    hud.update();
    expect(hudEl.style.display).toBe('none');
  });

  test('toggles number visibility via showStatusBarNumbers setting', () => {
    petState.settings.showStatusBarNumbers = false;
    hud.update();

    expect(hudEl.classList.contains('hide-numbers')).toBe(true);
    expect(document.getElementById('hud-val-hp').style.display).toBe('none');
    expect(document.getElementById('hud-val-mp').style.display).toBe('none');
    expect(document.getElementById('hud-val-sp').style.display).toBe('none');

    petState.settings.showStatusBarNumbers = true;
    hud.update();

    expect(hudEl.classList.contains('hide-numbers')).toBe(false);
    expect(document.getElementById('hud-val-hp').style.display).toBe('');
  });

  test('shouldAutoSelfFeed triggers only when HP <= 1, idle/moving, uninterrupted, and rare roll succeeds', () => {
    expect(statusHud.shouldAutoSelfFeed({ hunger: 2, rng: () => 0.01 })).toBe(false);
    expect(statusHud.shouldAutoSelfFeed({ hunger: 1, hungerEnabled: false, rng: () => 0.01 })).toBe(false);
    expect(statusHud.shouldAutoSelfFeed({ hunger: 1, action: 'sleeping', rng: () => 0.01 })).toBe(false);
    expect(statusHud.shouldAutoSelfFeed({ hunger: 1, isAlarmActive: true, rng: () => 0.01 })).toBe(false);
    expect(statusHud.shouldAutoSelfFeed({ hunger: 1, rng: () => 0.5 })).toBe(false);
    expect(statusHud.shouldAutoSelfFeed({ hunger: 1, rng: () => 0.01 })).toBe(true);
    expect(statusHud.shouldAutoSelfFeed({ hunger: 0, rng: () => 0.01 })).toBe(true);
  });

  test('petting interaction recovers +15 MP immediately on every stroke (not only on completion)', () => {
    jest.useFakeTimers();
    document.body.innerHTML += `
      <div id="kiwi-wrapper"></div>
      <div id="kiwi-heart" style="display:none;"></div>
    `;
    const kiwi = document.getElementById('kiwi-wrapper');
    let currentAction = 'idle';
    const moodState = { hunger: 50, mood: 40, settings: { showStatusBars: true, enableHungerSystem: true } };
    const savePetState = jest.fn();
    const showTempBubble = jest.fn();

    interaction.init({
      kiwi,
      getCurrentAction: () => currentAction,
      setCurrentAction: (a) => { currentAction = a; },
      physics: { getIsDragging: () => false },
      getIsDraggingOutfit: () => false,
      getIsDraggingBed: () => false,
      petState: moodState,
      savePetState,
      showTempBubble
    });

    interaction.startPettingMode();

    const triggerStroke = () => {
      const ev = new MouseEvent('mousemove');
      Object.defineProperty(ev, 'movementX', { value: 320 });
      Object.defineProperty(ev, 'movementY', { value: 0 });
      kiwi.dispatchEvent(ev);
    };

    // Stroke 1: +15 immediately (40 -> 55), bubble not shown yet
    triggerStroke();
    expect(moodState.mood).toBe(55);
    expect(savePetState).toHaveBeenCalledTimes(1);
    expect(showTempBubble).not.toHaveBeenCalled();

    jest.advanceTimersByTime(850);

    // Stroke 2: +15 immediately (55 -> 70)
    triggerStroke();
    expect(moodState.mood).toBe(70);
    expect(savePetState).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(850);

    // Stroke 3: +15 immediately (70 -> 85), and completion dialogue fires after cooldown
    triggerStroke();
    expect(moodState.mood).toBe(85);
    expect(savePetState).toHaveBeenCalledTimes(3);

    jest.advanceTimersByTime(850);
    expect(showTempBubble).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
