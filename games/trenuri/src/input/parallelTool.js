// Unealta „Șină paralelă”: alegi începutul și sfârșitul unei porțiuni de șină, iar jocul o dublează la o placă distanță (linie dublă cu macazuri).
import { parallelPlan, trackSection } from '../sim/index.js';
import { T_PRESENT } from '../sim/consts.js';
import { viewer } from '../sim/viewer.js';
import { lei } from '../ui/hud.js';

const GREEN = '#5bd66f', RED = '#ff5a6a', GOLD = '#ffd23f', BLUE = '#8fd3ff';

export function createParallelTool(c) {
  let a = null, sec = null, side = 1, plan = null;
  const S = () => c.S();
  /** Placa de șină de la atingere sau una vecină (degetul nu nimerește exact). */
  function snap(t) {
    let best = null, bd = 9;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = t.x + dx, y = t.y + dy;
      if (x < 0 || y < 0 || x >= S().w || y >= S().h || !(S().track[y * S().w + x] & T_PRESENT)) continue;
      const d = Math.abs(dx) + Math.abs(dy);
      if (d < bd) { bd = d; best = { x, y }; }
    }
    return best;
  }
  function compute() {
    plan = parallelPlan(S(), sec, side, viewer.co);
    if (!plan) { side = -side; plan = parallelPlan(S(), sec, side, viewer.co); }
    if (!plan) c.hud().hint('Nu e loc pentru o a doua șină aici (clădiri, apă sau pantă).', true);
  }
  function paint() {
    if (c.tool() !== 'parallel') return;
    const m = new Map(), put = (x, y, color) => m.set(y * S().w + x, { x, y, color });
    if (sec) for (const [x, y] of sec) put(x, y, BLUE);
    if (plan) { const ok = c.canAfford(plan.cost); for (const [x, y] of plan.path) put(x, y, ok ? GREEN : RED); }
    if (a) put(a.x, a.y, GOLD);
    c.ov().set([...m.values()]);
  }
  function refresh() { paint(); c.bar(); }
  function reset() { a = null; sec = null; plan = null; refresh(); }
  function build() {
    if (!plan) return;
    const r = c.exec({ type: 'buildTrack', path: plan.path });
    if (r.ok) c.hud().hint('Linie dublă gata! Trenurile aleg linia liberă.', false, 4500);
    reset();
  }
  return {
    reset, paint, refresh, build,
    tap(t) {
      const p = t && snap(t);
      if (!p) { c.hud().hint('Atinge o șină existentă.', true); return; }
      if (!a || sec) { a = p; sec = null; plan = null; c.hud().hint('Acum atinge unde se termină porțiunea de dublat.', false, 5000); refresh(); return; }
      sec = trackSection(S(), [a.x, a.y], [p.x, p.y]);
      if (!sec || sec.length < 4) { c.hud().hint('Alege două puncte mai depărtate, pe șine legate între ele.', true); sec = null; a = p; refresh(); return; }
      compute(); refresh();
    },
    bar() {
      if (!plan) return [{ label: a ? 'Atinge sfârșitul porțiunii' : 'Atinge începutul porțiunii', fn: () => {} }, { label: '↩ Șină normală', fn: () => c.switchTool('track') }];
      const ok = c.canAfford(plan.cost);
      return [
        { label: ok ? '✅ Construiește' : '💸 Prea scump', small: lei(plan.cost), cls: ok ? 'go' : 'no', fn: () => (ok ? build() : c.hud().hint(c.errText('bani'), true)) },
        { label: '↔ Cealaltă parte', fn: () => { side = -side; compute(); refresh(); } },
        { label: '✖ Anulează', cls: 'no', fn: reset },
      ];
    },
  };
}
