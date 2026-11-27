/**
 * @jest-environment jsdom
 */

const statusHud = require('../../src/views/main/modules/status_hud');

describe('Pet RPG Status HUD Unit Tests', () => {
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
        <div class="hud-bar-row hud-cpu" data-bar="cpu">
          <span class="hud-label">CPU</span>
          <div class="hud-track"><div id="hud-fill-cpu" class="hud-fill"></div></div>
          <span id="hud-val-cpu" class="hud-val">0%</span>
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

  test('renders HP, MP, and CPU bar widths, labels, and threshold classes accurately', () => {
    expect(hudEl.style.display).toBe('flex');
    expect(document.getElementById('hud-fill-hp').style.width).toBe('85%');
    expect(document.getElementById('hud-val-hp').textContent).toBe('85');
    expect(document.getElementById('hud-fill-mp').style.width).toBe('70%');
    expect(document.getElementById('hud-val-mp').textContent).toBe('70');
    expect(document.getElementById('hud-fill-cpu').style.width).toBe('24%');
    expect(document.getElementById('hud-val-cpu').textContent).toBe('24%');

    // Low hunger & high CPU trigger danger classes
    petState.hunger = 15;
    petState.mood = 20;
    cpuUsage = 88;
    hud.update();

    expect(hudEl.querySelector('[data-bar="hp"]').classList.contains('is-danger')).toBe(true);
    expect(hudEl.querySelector('[data-bar="mp"]').classList.contains('is-low')).toBe(true);
    expect(hudEl.querySelector('[data-bar="cpu"]').classList.contains('is-danger')).toBe(true);
    expect(document.getElementById('hud-val-cpu').textContent).toBe('88%');
  });

  test('hides HP/MP rows when enableHungerSystem is false and hides entire HUD when showStatusBars is false', () => {
    petState.settings.enableHungerSystem = false;
    hud.update();

    expect(hudEl.style.display).toBe('flex');
    expect(hudEl.querySelector('[data-bar="hp"]').style.display).toBe('none');
    expect(hudEl.querySelector('[data-bar="mp"]').style.display).toBe('none');
    expect(hudEl.querySelector('[data-bar="cpu"]').style.display).toBe('flex');

    petState.settings.showStatusBars = false;
    hud.update();
    expect(hudEl.style.display).toBe('none');
  });
});
