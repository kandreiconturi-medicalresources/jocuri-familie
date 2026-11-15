// Sunete: efecte scurte (shared/engine/audio.js) + motor sintetizat cu WebAudio (tonul crește cu viteza).
import { audioCtx, defineSfx, isMuted } from '../../../shared/engine/audio.js';

const arp = (freqs, dur, wave, vol, gap) => freqs.map((f, n) => [f, f, dur, wave, vol, n * gap]);

export function initSfx() {
  defineSfx({
    beep: [[520, 520, 0.18, 'square', 0.08]],
    go: [[1040, 1040, 0.55, 'square', 0.09], [1560, 1560, 0.45, 'triangle', 0.07]],
    nitro: [[180, 900, 0.55, 'sawtooth', 0.06], [90, 450, 0.55, 'square', 0.04]],
    bump: [[160, 60, 0.16, 'triangle', 0.16]],
    lap: arp([660, 880, 1320], 0.12, 'triangle', 0.1, 0.08),
    finish: [...arp([523, 659, 784, 1047, 1319], 0.14, 'square', 0.05, 0.1), [1568, 1568, 0.6, 'triangle', 0.1, 0.55]],
    click: [[600, 800, 0.07, 'square', 0.05]],
    ready: arp([784, 988], 0.1, 'triangle', 0.09, 0.09),
  });
}

/** Motor: două oscilatoare printr-un filtru. `set(viteza 0..1, accelerezi, nitro, drift 0..1)` la fiecare cadru. */
export function createEngine() {
  const ctx = audioCtx();
  if (!ctx) return { set() {}, stop() {} };
  const out = ctx.createGain(); out.gain.value = 0;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; lp.Q.value = 2;
  const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
  const o2 = ctx.createOscillator(); o2.type = 'square';
  const o3 = ctx.createOscillator(); o3.type = 'sawtooth'; o3.frequency.value = 900;
  const sq = ctx.createGain(); sq.gain.value = 0;
  const g1 = ctx.createGain(), g2 = ctx.createGain(); g1.gain.value = 0.5; g2.gain.value = 0.25;
  o1.connect(g1); o2.connect(g2); g1.connect(lp); g2.connect(lp); lp.connect(out); o3.connect(sq); sq.connect(ctx.destination); out.connect(ctx.destination);
  [o1, o2, o3].forEach((o) => o.start());
  const T = (p, v) => p.setTargetAtTime(v, ctx.currentTime, 0.06);
  return {
    set(v, thr, boost, drift) {
      const f = 48 + v * 150 + (boost ? 30 : 0);
      T(o1.frequency, f); T(o2.frequency, f * 0.5);
      T(lp.frequency, 380 + v * 1300 + (thr ? 350 : 0));
      T(out.gain, isMuted() ? 0 : 0.028 + 0.02 * (thr ? 1 : 0) + (boost ? 0.012 : 0));
      T(sq.gain, isMuted() ? 0 : 0.006 * drift);
    },
    stop() { T(out.gain, 0); T(sq.gain, 0); setTimeout(() => { try { [o1, o2, o3].forEach((o) => o.stop()); } catch (e) { /* oprit */ } }, 400); },
  };
}
