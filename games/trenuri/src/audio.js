// Sunetele jocului, sintetizate cu shared/engine/audio.js (WebAudio, fără fișiere). Fundal ambiental discret, oprit implicit.
import { sfx, defineSfx, unlockAudio, audioCtx, isMuted } from '../../../shared/engine/audio.js';

const arp = (notes, dur, wave, vol, gap) => notes.map((f, n) => [f, f, dur, wave, vol, n * gap]);

defineSfx({
  build: [[300, 500, 0.08, 'square', 0.12], [500, 700, 0.1, 'square', 0.12, 0.08]],
  nope: [[220, 140, 0.18, 'sawtooth', 0.12]],
  cash: [[988, 988, 0.07, 'square', 0.06], [1319, 1319, 0.28, 'square', 0.06, 0.07]], // moneda
  whistle: [[620, 600, 0.45, 'triangle', 0.1], [780, 740, 0.45, 'triangle', 0.08], [620, 480, 0.3, 'triangle', 0.08, 0.45]], // fluier la plecare
  bell: [[1568, 1568, 0.4, 'sine', 0.09], [2093, 2093, 0.4, 'sine', 0.06, 0.14]], // clopoțel la gară
  ding: [[1760, 1760, 0.45, 'sine', 0.1]], // ziarul
  fanfare: [...arp([523, 659, 784, 1047], 0.18, 'square', 0.05, 0.13), [1047, 1047, 0.7, 'triangle', 0.1, 0.55], [784, 784, 0.7, 'triangle', 0.08, 0.55], [1319, 1319, 0.7, 'triangle', 0.08, 0.55]],
});
export { sfx };

let amb = null, ambWanted = false;
function stopAmbient() {
  if (!amb) return;
  const { ctx, g, nodes } = amb, t = ctx.currentTime;
  g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 1);
  setTimeout(() => nodes.forEach((n) => { try { n.stop(); } catch (e) { /* oprit */ } }), 1100);
  amb = null;
}
function startAmbient() {
  const ctx = audioCtx();
  if (amb || !ctx || isMuted()) return;
  const g = ctx.createGain(); g.gain.value = 0; g.connect(ctx.destination);
  g.gain.linearRampToValueAtTime(0.016, ctx.currentTime + 3);
  const nodes = [];
  for (const f of [110, 164.8, 220.4]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(g); o.start(); nodes.push(o); }
  const lfo = ctx.createOscillator(), depth = ctx.createGain(); // „respirație” lentă
  lfo.frequency.value = 0.12; depth.gain.value = 0.006; lfo.connect(depth); depth.connect(g.gain); lfo.start(); nodes.push(lfo);
  amb = { ctx, g, nodes };
}
/** Pornește/oprește fundalul. Dacă audio nu e încă deblocat (primul gest), pornește la `unlock()`. */
export function setAmbient(on) { ambWanted = !!on; if (on) startAmbient(); else stopAmbient(); }
export function unlock() { unlockAudio(); if (ambWanted) startAmbient(); }

const last = new Map();
let lastAt = -9;
/** Fluier la plecare, clopoțel la sosire (după schimbarea stării trenului); cel mult un sunet la 0,6 s. */
export function trainSounds(s, clock) {
  for (const t of s.trains) {
    const p = last.get(t.id);
    last.set(t.id, t.state);
    if (p === undefined || p === t.state || clock - lastAt < 0.6) continue;
    if (t.state === 1) { sfx('whistle'); lastAt = clock; } else if (t.state === 2 && p === 1) { sfx('bell'); lastAt = clock; }
  }
}
export const resetSounds = () => last.clear();
