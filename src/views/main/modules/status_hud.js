/**
 * Wiki Wiki 底部 RPG 風格狀態條模組 (status_hud.js)
 * 顯示 HP（飽食度）、MP（心情值）、CPU（主機負載），並依設定動態開關與變色。
 */

function clampPercent(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function init({ hudEl, getPetState, getCpuUsage }) {
  if (!hudEl) {
    return {
      update: () => {}
    };
  }

  const hpRow = hudEl.querySelector('[data-bar="hp"]');
  const mpRow = hudEl.querySelector('[data-bar="mp"]');
  const cpuRow = hudEl.querySelector('[data-bar="cpu"]');

  const hpFill = hudEl.querySelector('#hud-fill-hp');
  const mpFill = hudEl.querySelector('#hud-fill-mp');
  const cpuFill = hudEl.querySelector('#hud-fill-cpu');

  const hpVal = hudEl.querySelector('#hud-val-hp');
  const mpVal = hudEl.querySelector('#hud-val-mp');
  const cpuVal = hudEl.querySelector('#hud-val-cpu');

  function update() {
    const state = typeof getPetState === 'function' ? (getPetState() || {}) : {};
    const settings = state.settings || {};

    const showBars = settings.showStatusBars !== false;
    const hungerEnabled = settings.enableHungerSystem !== false;

    if (!showBars) {
      hudEl.style.display = 'none';
      return;
    }

    hudEl.style.display = 'flex';

    const hunger = clampPercent(state.hunger, 100);
    const mood = clampPercent(state.mood, 100);
    const cpu = clampPercent(typeof getCpuUsage === 'function' ? getCpuUsage() : 0, 0);

    if (hpRow) {
      hpRow.style.display = hungerEnabled ? 'flex' : 'none';
      hpRow.classList.toggle('is-warn', hunger > 20 && hunger <= 50);
      hpRow.classList.toggle('is-danger', hunger <= 20);
    }
    if (hpFill) hpFill.style.width = `${hunger}%`;
    if (hpVal) hpVal.textContent = `${hunger}`;

    if (mpRow) {
      mpRow.style.display = hungerEnabled ? 'flex' : 'none';
      mpRow.classList.toggle('is-low', mood <= 30);
    }
    if (mpFill) mpFill.style.width = `${mood}%`;
    if (mpVal) mpVal.textContent = `${mood}`;

    if (cpuRow) {
      cpuRow.style.display = 'flex';
      cpuRow.classList.toggle('is-warn', cpu > 50 && cpu <= 75);
      cpuRow.classList.toggle('is-danger', cpu > 75);
    }
    if (cpuFill) cpuFill.style.width = `${cpu}%`;
    if (cpuVal) cpuVal.textContent = `${cpu}%`;
  }

  update();

  return { update };
}

module.exports = {
  init,
  clampPercent
};
