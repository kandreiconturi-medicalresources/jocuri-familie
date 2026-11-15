// Sunet sintetizat cu WebAudio. Fără fișiere audio.
import { store } from './save.js';

let actx = null;
let muted = store('audio').get('muted', false);
const defs = {};

/** De apelat la primul gest al jucătorului (iOS cere asta). */
export function unlockAudio() {
  try {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) actx = new AC();
    }
    if (actx && actx.state === 'suspended') actx.resume();
  } catch (e) { /* fără sunet */ }
}

/** Un ton cu glisare de frecvență f1 -> f2. */
export function tone(f1, f2, dur, wave, vol, delay) {
  if (!actx) return;
  const t = actx.currentTime + (delay || 0);
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = wave || 'square';
  o.frequency.setValueAtTime(f1, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  g.gain.setValueAtTime(vol || 0.07, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g); g.connect(actx.destination);
  o.start(t); o.stop(t + dur + 0.03);
}

/** Înregistrează efecte: { nume: [[f1,f2,dur,wave,vol,delay], ...] }. */
export function defineSfx(map) { Object.assign(defs, map); }

export function sfx(name) {
  if (muted || !actx || !defs[name]) return;
  try { defs[name].forEach((a) => tone(a[0], a[1], a[2], a[3], a[4], a[5])); } catch (e) { /* ignorat */ }
}

export function setMuted(b) {
  muted = !!b;
  store('audio').set('muted', muted);
}
export const isMuted = () => muted;

// Arpegiu: note succesive, una la fiecare `gap` secunde
const arp = (freqs, dur, wave, vol, gap, ratio = 1) =>
  freqs.map((f, n) => [f, f * ratio, dur, wave, vol, n * gap]);

/** Efectele din jocul original (Bobo și Mimi). */
export const BOBO_SFX = {
  jump: [[320, 640, 0.14, 'square', 0.045]],
  fruit: [[990, 990, 0.06, 'square', 0.045], [1480, 1480, 0.12, 'square', 0.045, 0.06]],
  stomp: [[420, 90, 0.16, 'triangle', 0.18]],
  bump: [[160, 90, 0.09, 'triangle', 0.18]],
  break: [[220, 60, 0.16, 'sawtooth', 0.07], [140, 50, 0.12, 'triangle', 0.15, 0.03]],
  shoot: [[900, 1500, 0.09, 'square', 0.035]],
  grow: arp([392, 523, 659, 784, 1047], 0.09, 'square', 0.045, 0.06, 1.02),
  bubble: [[400, 1300, 0.3, 'sine', 0.12]],
  pop: [[900, 200, 0.2, 'sine', 0.12]],
  heart: arp([523, 659, 784, 1047], 0.1, 'square', 0.045, 0.07),
  hurt: [[520, 160, 0.3, 'sawtooth', 0.05]],
  die: [[620, 70, 0.55, 'square', 0.05]],
  splash: [[260, 60, 0.35, 'triangle', 0.16], [900, 300, 0.2, 'sine', 0.05, 0.03]],
  check: arp([660, 880, 1320], 0.14, 'triangle', 0.12, 0.09),
  win: [...arp([523, 587, 659, 784, 880, 1047, 1319], 0.16, 'square', 0.045, 0.1),
    [1568, 1568, 0.5, 'triangle', 0.1, 0.7]],
};
