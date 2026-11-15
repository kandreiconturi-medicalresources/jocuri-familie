// Sunete sintetizate pentru Bum-Bum Arena (shared/engine/audio.js).
import { defineSfx } from '../../../shared/engine/audio.js';

const arp = (freqs, dur, wave, vol, gap) => freqs.map((f, n) => [f, f * 1.02, dur, wave, vol, n * gap]);

export function initSfx() {
  defineSfx({
    place: [[320, 180, 0.09, 'square', 0.06], [200, 160, 0.08, 'triangle', 0.1, 0.05]],
    explode: [[170, 38, 0.5, 'sawtooth', 0.16], [90, 28, 0.6, 'triangle', 0.22, 0.02], [700, 120, 0.18, 'square', 0.05]],
    crate: [[300, 80, 0.14, 'square', 0.06], [180, 60, 0.12, 'triangle', 0.1, 0.03]],
    pickup: arp([660, 880, 1320], 0.1, 'square', 0.05, 0.06),
    shield: [[500, 1300, 0.28, 'sine', 0.13], [1300, 600, 0.2, 'triangle', 0.06, 0.1]],
    hit: [[520, 70, 0.5, 'sawtooth', 0.09]],
    out: [[420, 60, 0.7, 'square', 0.05, 0.1]],
    tele: [[300, 1200, 0.25, 'sine', 0.1], [1200, 300, 0.2, 'sine', 0.06, 0.1]],
    block: [[120, 60, 0.18, 'triangle', 0.14]],
    beep: [[660, 660, 0.1, 'square', 0.05]],
    go: [[990, 1320, 0.25, 'square', 0.06]],
    round: arp([523, 659, 784, 1047], 0.14, 'square', 0.05, 0.09),
    match: [...arp([523, 587, 659, 784, 880, 1047, 1319], 0.16, 'square', 0.05, 0.1), [1568, 1568, 0.5, 'triangle', 0.1, 0.75]],
    lava: [[110, 70, 0.3, 'sawtooth', 0.06]],
  });
}
