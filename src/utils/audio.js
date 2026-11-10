/**
 * 輕量化原生 Web Audio 合成器 (audio.js)
 * 零外部音效檔依賴，採用振盪器 (OscillatorNode) 合成清脆愉悅的鳥鳴與提醒聲
 */

function playAlarmChirp(volume = 0.25) {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // 愉悅清脆的雙音階 (880Hz -> 1320Hz -> 1760Hz)
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.22);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.32);

    setTimeout(() => {
      try { ctx.close(); } catch {}
    }, 500);
  } catch {}
}

function playReliefChirp(volume = 0.2) {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // 柔和放鬆的滑音 (1320Hz -> 880Hz)
    osc.frequency.setValueAtTime(1320, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);

    setTimeout(() => {
      try { ctx.close(); } catch {}
    }, 500);
  } catch {}
}

module.exports = {
  playAlarmChirp,
  playReliefChirp
};
