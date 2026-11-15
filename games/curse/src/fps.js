// Indicator FPS ascuns (tasta F3): FPS, calitate, apeluri de desenare și triunghiuri.
import { perf } from '../../../shared/engine/perf.js';

export function createFps(el) {
  let on = false, acc = 0, n = 0, worst = 0;
  return {
    toggle() { on = !on; el.classList.toggle('hidden', !on); },
    frame(dt, stage) {
      if (!on) return;
      acc += dt; n++; worst = Math.max(worst, dt);
      if (acc < 0.5) return;
      const i = stage.info();
      el.textContent = Math.round(n / acc) + ' FPS · min ' + Math.round(1 / worst) + ' · q' + perf.quality() + ' · ' + i.calls + ' draw · ' + Math.round(i.triangles / 1000) + 'k tri';
      acc = 0; n = 0; worst = 0;
    },
  };
}
