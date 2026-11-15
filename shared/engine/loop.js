// Buclă cu pas fix: fizica la `hz`, randarea la cadrul ecranului.
import { perf } from './perf.js';

/** Logică pură: adaugă timpul cadrului și scoate pașii fixi de rulat.
 *  Dacă rămânem prea în urmă (peste maxSteps), restul se aruncă. */
export function stepAccumulator(acc, frameDt, step, maxSteps = 5) {
  acc += frameDt;
  let steps = 0;
  while (acc >= step && steps < maxSteps) { acc -= step; steps++; }
  if (acc >= step) acc = 0;
  return { acc, steps, alpha: acc / step };
}

export function startLoop({ update, render, hz = 60 }) {
  const step = 1 / hz;
  let acc = 0, last = 0, raf = 0;
  let manual = false, auto = false, stopped = false;

  const running = () => !manual && !auto && !stopped;
  const frame = (now) => {
    raf = 0;
    if (!running()) return;
    raf = requestAnimationFrame(frame);
    const ms = last ? now - last : 1000 * step;
    last = now;
    perf.tick(ms);
    const r = stepAccumulator(acc, Math.min(ms / 1000, 0.25), step, 5);
    acc = r.acc;
    for (let i = 0; i < r.steps; i++) update(step);
    if (render) render(r.alpha);
  };
  const go = () => {
    if (!raf && running()) { last = 0; raf = requestAnimationFrame(frame); }
  };
  const halt = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  // Pauză automată când tab-ul e ascuns
  const onVis = () => {
    if (document.hidden) { auto = true; halt(); } else { auto = false; go(); }
  };
  document.addEventListener('visibilitychange', onVis);
  go();

  return {
    stop() {
      stopped = true; halt();
      document.removeEventListener('visibilitychange', onVis);
    },
    pause() { manual = true; halt(); },
    resume() { manual = false; go(); },
    get paused() { return manual || auto; },
  };
}
