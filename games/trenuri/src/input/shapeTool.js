// Unealta „Forme de șină” (🧩): stație de încrucișare, traversare, linie dublă, triunghi (Y), ocolire de gară, puse dintr-un clic.
// Previzualizare verde/roșie pe plăci, 🚦 unde vin semnale, costul în mesaj; R sau 🔄 rotește, ↔ oglindește. Comanda: buildShape.
import { SHAPES, shapePlan } from '../sim/index.js';
import { viewer } from '../sim/viewer.js';
import { lei } from '../ui/hud.js';

const GREEN = '#5bd66f', RED = '#ff5a6a', GOLD = '#ffd23f';
const ERR = { cladire: 'Aici e o casă.', proprietar: 'Aici e șina altcuiva.', panta: 'Dealul e prea abrupt pentru formă.', apa: 'Prea multă apă sub formă.', harta: 'Forma iese din hartă.', insula: 'Insula asta e a altei companii.' };

export function createShapeTool(c) {
  const o = { kind: 0, rot: 0, flip: false };
  let hov = null, lastKey = '';
  const S = () => c.S();
  const cmdAt = (t) => ({ type: 'buildShape', kind: o.kind, x: t.x, y: t.y, rot: o.rot, flip: o.flip });
  const ghost = () => c.ghost && c.ghost();
  const icons = (list) => { const g = ghost(); if (g) g.icons(list); };

  function paint() {
    if (!hov) { c.ov().clear(); icons([]); return; }
    const p = shapePlan(S(), cmdAt(hov), viewer.co), good = p.ok && c.canAfford(p.cost), col = good ? GREEN : RED;
    c.ov().set(p.tiles.filter(([x, y]) => x >= 0 && y >= 0 && x < S().w && y < S().h).map(([x, y]) => ({ x, y, color: x === hov.x && y === hov.y ? GOLD : col })));
    icons(p.sigs.slice(0, 10).map((g) => ({ x: g.x, y: g.y, icon: '🚦', text: 'Semnal de bloc' })));
    const key = `${hov.x},${hov.y},${o.kind},${o.rot},${o.flip},${p.ok},${p.cost}`;
    if (key === lastKey) return;
    lastKey = key;
    const sh = SHAPES[o.kind];
    if (!p.ok) c.hud().hint(`${sh.icon} ${ERR[p.err] || 'Aici nu încape forma.'} Mut-o sau rotește-o (R).`, true, 2500);
    else c.hud().hint(`${sh.icon} ${sh.name} · ${lei(p.cost)}${good ? '' : ' — nu ai destui bani'} · R rotește · atinge ca s-o pui`, !good, 2500);
  }
  function turn() { o.rot = (o.rot + 1) & 3; lastKey = ''; paint(); }
  const onKey = (e) => {
    if (c.tool() !== 'shape' || (e.target && e.target.tagName === 'INPUT') || e.ctrlKey || e.metaKey) return;
    if (e.key === 'r' || e.key === 'R') { turn(); e.preventDefault(); } else if (e.key === 'f' || e.key === 'F') { o.flip = !o.flip; lastKey = ''; paint(); }
  };
  if (typeof addEventListener === 'function') addEventListener('keydown', onKey);

  return {
    reset() { hov = null; lastKey = ''; icons([]); },
    paint,
    hover(t) { if (t) { hov = t; paint(); } },
    tap(t) {
      hov = t;
      const p = shapePlan(S(), cmdAt(t), viewer.co);
      if (!p.ok) { paint(); return; }
      const r = c.exec(cmdAt(t));
      if (r.ok) c.hud().hint(`${SHAPES[o.kind].icon} ${SHAPES[o.kind].name} gata · ${lei(r.cost)}. Trenurile aleg singure linia liberă (🔀).`, false, 5000);
      lastKey = ''; paint();
    },
    bar() {
      return [
        ...SHAPES.map((sh, k) => ({ label: `${sh.icon} ${sh.name}`, small: sh.text, on: o.kind === k, fn: () => { o.kind = k; lastKey = ''; c.bar(); paint(); } })),
        { label: '🔄 Rotește', small: 'sau tasta R', fn: turn },
        { label: '↔ Oglindă', small: o.flip ? 'oglindită ✅' : 'sau tasta F', on: o.flip, fn: () => { o.flip = !o.flip; lastKey = ''; c.bar(); paint(); } },
      ];
    },
  };
}
