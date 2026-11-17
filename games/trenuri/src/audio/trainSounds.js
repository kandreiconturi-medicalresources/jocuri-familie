// Sunete de tren sintetizate (WebAudio): corn/fluier la plecare, clinchet la sosire, zgomot de roți și motor pentru cele mai apropiate trenuri.
// Lanț: voci -> trece-jos -> compresor -> master. Nimic înainte de primul gest (audioCtx e null) și nimic pe pauză / tab ascuns.
import { audioCtx, isMuted } from '../../../../shared/engine/audio.js';
import { MODELS } from '../sim/consts.js';
import { kindOf, pickLoud, createLimiter, inView, weightOf, speedRatio } from './trainMix.js';

const VOICES = 3, AHEAD = 0.12;
const cfg = { on: true, vol: 0.6 };
const horn = createLimiter(4), chime = createLimiter(1.5);
const last = new Map();
let env = null, voices = [], noise = null, hidden = false;

const level = (active) => (active ? cfg.vol * 0.55 : 0);
export function configureTrainSounds(o) {
  Object.assign(cfg, o);
  if (env) env.master.gain.setTargetAtTime(level(cfg.on && !isMuted() && !hidden), env.ctx.currentTime, 0.1);
}
export function resetTrainSounds() { last.clear(); horn.reset(); chime.reset(); }
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; configureTrainSounds({}); });
}

function build(ctx) {
  const master = ctx.createGain(), comp = ctx.createDynamicsCompressor(), lp = ctx.createBiquadFilter();
  master.gain.value = 0;
  comp.threshold.value = -24; comp.knee.value = 20; comp.ratio.value = 8; comp.attack.value = 0.01; comp.release.value = 0.25;
  lp.type = 'lowpass'; lp.frequency.value = 4200; lp.Q.value = 0.5;
  lp.connect(comp); comp.connect(master); master.connect(ctx.destination);
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noise = buf;
  voices = [];
  for (let i = 0; i < VOICES; i++) {
    const g = ctx.createGain(), osc = ctx.createOscillator(), og = ctx.createGain(), f = ctx.createBiquadFilter();
    g.gain.value = 0; og.gain.value = 0; f.type = 'lowpass'; f.frequency.value = 300;
    osc.type = 'sine'; osc.frequency.value = 80;
    osc.connect(f); f.connect(og); og.connect(g); g.connect(lp); osc.start();
    voices.push({ g, osc, og, f, id: null, kind: '', free: 0, nextClack: 0, nextChuff: 0 });
  }
  env = { ctx, master, lp };
  configureTrainSounds({});
}

/** Un val scurt de zgomot filtrat (clinchet de roată sau pufăit de abur). */
function burst(v, t, freq, q, len, vol, type) {
  const ctx = env.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0005, t + len);
  s.connect(f); f.connect(g); g.connect(v.g); s.start(t, Math.random() * 0.5, len + 0.05);
}

// [undă, frecvență de bază, volum]
const HUM = { steam: ['sine', 52, 0], diesel: ['sawtooth', 48, 0.5], electric: ['sine', 150, 0.35], fast: ['sine', 210, 0.3] };

function setVoice(v, id, kind, t) {
  v.id = id;
  if (v.kind !== kind) { v.kind = kind; v.osc.type = HUM[kind][0]; v.f.frequency.setValueAtTime(kind === 'diesel' ? 220 : 500, t); }
  v.nextClack = v.nextChuff = t + Math.random() * 0.2;
}

function updateVoices(s, e, t) {
  const items = [];
  for (const tr of s.trains) {
    if (tr.state !== 1) continue; // doar trenurile în mers
    const p = e.pos(tr.id);
    if (p) items.push({ id: tr.id, x: p.x, z: p.z });
  }
  const top = pickLoud(items, e.cam, VOICES), want = new Map(top.map((o) => [o.id, o.w]));
  for (const v of voices) if (v.id !== null && !want.has(v.id)) { v.id = null; v.free = t + 0.6; } // dispare lin
  for (const o of top) {
    if (voices.some((v) => v.id === o.id)) continue;
    const v = voices.find((q) => q.id === null && q.free <= t), tr = s.trains.find((z) => z.id === o.id);
    if (v && tr) setVoice(v, o.id, kindOf(MODELS[tr.model]), t);
  }
  for (const v of voices) {
    const w = v.id === null ? 0 : want.get(v.id), tr = v.id === null ? null : s.trains.find((z) => z.id === v.id);
    v.g.gain.setTargetAtTime(w * 0.9, t, 0.25);
    if (!tr) { v.og.gain.setTargetAtTime(0, t, 0.2); continue; }
    if (w <= 0.03) continue;
    const m = MODELS[tr.model], r = speedRatio(tr, m), hum = HUM[v.kind];
    v.og.gain.setTargetAtTime(hum[2] * (0.4 + 0.6 * r), t, 0.2);
    v.osc.frequency.setTargetAtTime(hum[1] * (0.85 + 0.4 * r), t, 0.3);
    const gap = 0.55 - 0.3 * r; // roți: perechi „clinc-clanc”
    if (v.nextClack < t) v.nextClack = t;
    while (v.nextClack < t + AHEAD) {
      burst(v, v.nextClack, 900, 1.2, 0.07, 0.5, 'bandpass'); burst(v, v.nextClack + 0.09, 750, 1.2, 0.07, 0.4, 'bandpass');
      v.nextClack += gap;
    }
    if (v.kind === 'steam') { // pufăit, mai des cu viteza
      const cg = 0.42 - 0.26 * r;
      if (v.nextChuff < t) v.nextChuff = t;
      while (v.nextChuff < t + AHEAD) { burst(v, v.nextChuff, 380, 0.7, 0.14, 0.9, 'lowpass'); v.nextChuff += cg; }
    }
  }
}

function tone(t, f, dur, wave, vol, to) {
  const o = env.ctx.createOscillator(), g = env.ctx.createGain();
  o.type = wave; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.08, dur / 3)); g.gain.setTargetAtTime(0.0001, t + dur * 0.6, dur * 0.18);
  o.connect(g); g.connect(to); o.start(t); o.stop(t + dur + 0.3);
}
function blow(kind, vol) {
  const ctx = env.ctx, t = ctx.currentTime + 0.02, g = ctx.createGain(), f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 1400; g.gain.value = vol; g.connect(f); f.connect(env.lp);
  if (kind === 'steam') { tone(t, 520, 0.9, 'sine', 0.5, g); tone(t, 664, 0.9, 'sine', 0.4, g); tone(t, 1040, 0.9, 'sine', 0.06, g); }
  else if (kind === 'diesel') { tone(t, 311, 0.8, 'triangle', 0.5, g); tone(t, 392, 0.8, 'triangle', 0.4, g); }
  else if (kind === 'fast') { [988, 1319, 1568].forEach((q, i) => tone(t + i * 0.16, q, 0.5, 'sine', 0.3, g)); }
  else { [784, 988].forEach((q, i) => tone(t + i * 0.22, q, 0.6, 'sine', 0.35, g)); }
}
function station(vol) {
  const t = env.ctx.currentTime + 0.02, g = env.ctx.createGain();
  g.gain.value = vol; g.connect(env.lp);
  tone(t, 1047, 0.7, 'sine', 0.3, g); tone(t + 0.18, 1319, 0.9, 'sine', 0.25, g);
}

/**
 * Apelat în fiecare cadru. `e`: { cam: {x,z,dist}, pos(id) -> {x,z}|null, paused }.
 * Fără `e` sau fără audio deblocat (primul gest) nu face nimic.
 */
export function trainSounds(s, clock, e) {
  const ctx = audioCtx();
  if (!ctx || !e) return;
  if (!env) build(ctx);
  const active = cfg.on && !isMuted() && !hidden && !e.paused;
  const g = env.master.gain, target = level(active);
  if (Math.abs(g.value - target) > 0.002) g.setTargetAtTime(target, ctx.currentTime, 0.15);
  if (!active) { for (const t of s.trains) last.set(t.id, t.state); return; }
  const now = ctx.currentTime;
  for (const t of s.trains) {
    const p = last.get(t.id);
    last.set(t.id, t.state);
    if (p === undefined || p === t.state) continue;
    const pos = e.pos(t.id);
    if (!pos || !inView(pos.x, pos.z, e.cam)) continue;
    const near = 0.35 + 0.65 * Math.min(1, weightOf(pos.x, pos.z, e.cam) * 3);
    if (p === 2 && t.state === 1 && horn.allow(now)) blow(kindOf(MODELS[t.model]), near);
    else if (p === 1 && t.state === 2 && chime.allow(now)) station(near);
  }
  updateVoices(s, e, now);
}
