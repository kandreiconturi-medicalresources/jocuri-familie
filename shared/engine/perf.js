// Calitate adaptivă: 0 (slab) | 1 | 2 (bun). Coboară repede la FPS mic, urcă greu.
import { store } from './save.js';

const LOW_FPS = 45, HIGH_FPS = 57;
const DOWN_MS = 3000, UP_MS = 20000;

function guess() {
  try {
    const small = Math.min(screen.width, screen.height) <= 640;
    const weak = (navigator.hardwareConcurrency || 4) <= 2;
    return small || weak ? 1 : 2;
  } catch (e) {
    return 1;
  }
}

export function createPerf(saved) {
  const valid = saved === 0 || saved === 1 || saved === 2;
  let q = valid ? saved : guess();
  let manual = valid;
  let frames = 0, elapsed = 0, lowMs = 0, goodMs = 0;
  const cbs = [];
  const change = (n) => {
    n = Math.max(0, Math.min(2, n));
    if (n === q) return;
    q = n;
    cbs.slice().forEach((cb) => { try { cb(q); } catch (e) { /* ignorat */ } });
  };
  return {
    tick(frameMs) {
      if (manual || !(frameMs > 0) || frameMs > 500) return; // ignoră pauzele lungi
      frames++; elapsed += frameMs;
      if (elapsed < 1000) return;
      const fps = (frames * 1000) / elapsed;
      lowMs = fps < LOW_FPS ? lowMs + elapsed : 0;
      goodMs = fps >= HIGH_FPS ? goodMs + elapsed : 0;
      if (lowMs >= DOWN_MS) { lowMs = 0; change(q - 1); }
      if (goodMs >= UP_MS) { goodMs = 0; change(q + 1); }
      frames = 0; elapsed = 0;
    },
    quality: () => q,
    onChange(cb) {
      cbs.push(cb);
      return () => { const i = cbs.indexOf(cb); if (i >= 0) cbs.splice(i, 1); };
    },
    set(n) {
      manual = true;
      change(n);
      store('perf').set('quality', q);
    },
    auto() { // revine la reglajul automat
      manual = false;
      store('perf').remove('quality');
    },
  };
}

export const perf = createPerf(store('perf').get('quality', null));
