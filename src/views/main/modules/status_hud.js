/**
 * Wiki Wiki 底部 RPG 風格狀態條模組 (status_hud.js)
 * HP（飽食度，最低保留 1）、MP（心情值）、SP（剩餘 CPU 耐力 100 - CPU%），
 * 全部以純數值顯示（不加 % 符號），支援獨立開關數值顯示與 HP 見底極低機率自行覓食判定。
 */

const AUTO_SELF_FEED_CHANCE = 0.08; // HP 降至 1 後，每次衰減判定約 8% 極低機率偷吃點心
const AUTO_SELF_FEED_RESTORE = 25;

function clampPercent(value, fallback = 0, min = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(100, Math.round(num)));
}

/**
 * 判斷 HP <= 1 且嘗試繼續下降時，是否觸發極低機率自行吃飯
 */
function shouldAutoSelfFeed({
  hunger,
  hungerEnabled = true,
  action = 'idle',
  isWorking = false,
  isDragging = false,
  isAlarmActive = false,
  rng = Math.random
} = {}) {
  if (!hungerEnabled) return false;
  if (typeof hunger !== 'number' || hunger > 1) return false;
  if (action !== 'idle' && action !== 'moving') return false;
  if (isWorking || isDragging || isAlarmActive) return false;
  return rng() < AUTO_SELF_FEED_CHANCE;
}

function init({ hudEl, getPetState, getCpuUsage }) {
  if (!hudEl) {
    return {
      update: () => {}
    };
  }

  const hpRow = hudEl.querySelector('[data-bar="hp"]');
  const mpRow = hudEl.querySelector('[data-bar="mp"]');
  const spRow = hudEl.querySelector('[data-bar="sp"]');

  const hpFill = hudEl.querySelector('#hud-fill-hp');
  const mpFill = hudEl.querySelector('#hud-fill-mp');
  const spFill = hudEl.querySelector('#hud-fill-sp');

  const hpVal = hudEl.querySelector('#hud-val-hp');
  const mpVal = hudEl.querySelector('#hud-val-mp');
  const spVal = hudEl.querySelector('#hud-val-sp');

  function update() {
    const state = typeof getPetState === 'function' ? (getPetState() || {}) : {};
    const settings = state.settings || {};

    const showBars = settings.showStatusBars !== false;
    const showNumbers = settings.showStatusBarNumbers !== false;
    const hungerEnabled = settings.enableHungerSystem !== false;

    if (!showBars) {
      hudEl.style.display = 'none';
      return;
    }

    hudEl.style.display = 'flex';
    hudEl.classList.toggle('hide-numbers', !showNumbers);

    // HP 至少保留 1，不會掉到 0
    const hp = clampPercent(state.hunger, 100, 1);
    const mp = clampPercent(state.mood, 100, 0);
    const cpuUsage = clampPercent(typeof getCpuUsage === 'function' ? getCpuUsage() : 0, 0, 0);
    const sp = 100 - cpuUsage;

    if (hpRow) {
      hpRow.style.display = hungerEnabled ? 'flex' : 'none';
      hpRow.classList.toggle('is-warn', hp > 20 && hp <= 50);
      hpRow.classList.toggle('is-danger', hp <= 20);
    }
    if (hpFill) hpFill.style.width = `${hp}%`;
    if (hpVal) {
      hpVal.textContent = `${hp}`;
      hpVal.style.display = showNumbers ? '' : 'none';
    }

    if (mpRow) {
      mpRow.style.display = hungerEnabled ? 'flex' : 'none';
      mpRow.classList.toggle('is-low', mp <= 30);
    }
    if (mpFill) mpFill.style.width = `${mp}%`;
    if (mpVal) {
      mpVal.textContent = `${mp}`;
      mpVal.style.display = showNumbers ? '' : 'none';
    }

    if (spRow) {
      spRow.style.display = 'flex';
      spRow.classList.toggle('is-warn', sp >= 25 && sp < 50);
      spRow.classList.toggle('is-danger', sp < 25);
    }
    if (spFill) spFill.style.width = `${sp}%`;
    if (spVal) {
      spVal.textContent = `${sp}`;
      spVal.style.display = showNumbers ? '' : 'none';
    }
  }

  update();

  return { update };
}

module.exports = {
  init,
  clampPercent,
  shouldAutoSelfFeed,
  AUTO_SELF_FEED_CHANCE,
  AUTO_SELF_FEED_RESTORE
};
