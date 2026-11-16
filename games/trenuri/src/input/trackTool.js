// Unealta Șină: construcție pe segmente (atingere sau tragere punct cu punct), previzualizare, „Gata”, „Anulează ultimul”,
// ramificații din șina existentă (macaz) și opțiunea „nu refolosi șina” pentru linie dublă.
import { planTrack, pathCost, switches } from '../sim/index.js';
import { T_PRESENT } from '../sim/consts.js';
import { viewer } from '../sim/viewer.js';
import { lei } from '../ui/hud.js';

const GREEN = '#5bd66f', RED = '#ff5a6a', GOLD = '#ffd23f', BLUE = '#8fd3ff', CYAN = '#3ee6e0';

export function createTrackTool(c) {
  let pts = [], segs = [], pending = null, anchor = null, noReuse = false, lvl = false, lastHover = null, sw = null;
  const S = () => c.S();
  const onTrack = (t) => !!(S().track[t.y * S().w + t.x] & T_PRESENT);
  const from = () => (pts.length ? pts[pts.length - 1] : anchor);
  const same = (a, b) => a && b && a.x === b.x && a.y === b.y;
  const plan = (a, b) => (a && b && !same(a, b) ? planTrack(S(), [a.x, a.y], [b.x, b.y], viewer.co, noReuse || lvl ? { reuse: !noReuse, level: lvl } : null) : null);
  /** Nivelările propuse de segmente (⛰️), fără dubluri: [[x,y,h]]. */
  const levels = () => { const m = new Map(); for (const s of segs) for (const q of s.level || []) m.set(q[1] * S().w + q[0], q); return [...m.values()]; };
  function fullPath() {
    const out = [];
    for (const s of segs) for (let k = out.length ? 1 : 0; k < s.path.length; k++) out.push(s.path[k]);
    return out;
  }
  const total = () => { const p = fullPath(); if (p.length < 2) return 0; const r = pathCost(S(), p, viewer.co); return r.ok ? r.cost : segs.reduce((n, s) => n + s.cost, 0); };

  function paint() {
    if (c.tool() !== 'track') return;
    const m = new Map(), put = (x, y, color) => m.set(y * S().w + x, { x, y, color });
    if (!pts.length && !segs.length && !pending) { if (!sw) sw = switches(S()); for (const [x, y] of sw) put(x, y, CYAN); }
    const ok = c.canAfford(total());
    for (const s of segs) for (const [x, y] of s.path) put(x, y, ok ? GREEN : RED);
    if (pending) for (const [x, y] of pending.path) put(x, y, BLUE);
    for (const p of pts) put(p.x, p.y, GOLD);
    if (anchor && !pts.length) put(anchor.x, anchor.y, GOLD);
    c.ov().set([...m.values()]);
  }
  function refresh() { paint(); c.bar(); }
  function reset() { pts = []; segs = []; pending = null; anchor = null; lastHover = null; sw = null; refresh(); }
  function add(t) {
    const a = from();
    if (!t || same(a, t)) return;
    const p = plan(a, t);
    if (!p) { c.hud().hint('Acolo nu se poate trage șină. Încearcă un alt punct.', true); pending = null; refresh(); return; }
    if (!pts.length) pts.push(a);
    segs.push(p); pts.push(t); pending = null;
    c.hud().hint('Punct adăugat. Atinge următorul sau apasă „Gata”.', false, 3500);
    refresh();
  }
  function tap(t) {
    if (!t) return;
    if (!pts.length) {
      pts = [t]; anchor = null;
      c.hud().hint(onTrack(t) ? '🔀 Pornești din șina existentă: aici apare un macaz (ramificație). Atinge următorul punct.' : 'Bun! Atinge punctul următor. Cu mai multe atingeri faci curbe și ocolișuri.', false, 5000);
      refresh();
    } else add(t);
  }
  function build() {
    if (!segs.length) { c.hud().hint('Pune cel puțin două puncte.', true); return; }
    const lv = levels(), r = c.exec(lv.length ? { type: 'buildTrack', path: fullPath(), level: lv } : { type: 'buildTrack', path: fullPath() });
    if (r.ok) c.hud().hint('Șina e gata! Pune gări la capete.', false, 4000);
    reset();
  }
  function undo() {
    if (segs.length) { segs.pop(); pts.pop(); if (pts.length === 1) pts = []; } else pts = [];
    pending = null; refresh();
  }
  const preview = (t) => {
    if (!t || (lastHover && t.x === lastHover.x && t.y === lastHover.y)) return;
    lastHover = t; pending = plan(from(), t); paint();
  };

  return {
    tap, reset, paint, refresh, build, undo,
    isActive: () => pts.length > 0,
    dragStart(t) { if (!pts.length) anchor = t; pending = null; lastHover = null; },
    dragMove: preview,
    dragEnd(t, moved) {
      const end = t || lastHover;
      pending = null; lastHover = null;
      if (!moved) { const a = anchor; anchor = null; tap(a && !pts.length ? a : end); return; }
      if (end) add(end);
      anchor = null; refresh();
    },
    /** Gest întrerupt (două degete, ieșire din ecran): se pierde doar segmentul în curs, punctele puse rămân. */
    dragCancel() { pending = null; lastHover = null; if (!pts.length) anchor = null; refresh(); },
    hover(t) { if (pts.length) preview(t); },
    key(k) {
      if (k === 'Escape') { reset(); return true; }
      if (k === 'Enter' && segs.length) { build(); return true; }
      if (k === 'Backspace') { undo(); return true; }
      return false;
    },
    /** Butoanele de sub unealtă. */
    bar() {
      const items = [], cost = total(), ok = c.canAfford(cost);
      if (segs.length) {
        items.push({ label: ok ? '✅ Gata, construiește' : '💸 Prea scump', small: lei(cost), cls: ok ? 'go' : 'no', fn: () => (ok ? build() : c.hud().hint(c.errText('bani'), true)) });
        items.push({ label: '↩ Anulează ultimul', fn: undo });
      }
      if (pts.length) items.push({ label: '✖ Anulează tot', cls: 'no', fn: reset });
      items.push({ label: noReuse ? '👯 Nu refolosi șina: DA' : '👯 Nu refolosi șina', small: 'pentru linie dublă', on: noReuse, fn: () => { noReuse = !noReuse; pending = null; segs = []; pts = []; refresh(); } });
      items.push({ label: lvl ? '⛰️ Cu nivelare: DA' : '⛰️ Cu nivelare', small: 'trece peste dealuri', on: lvl, fn: () => { lvl = !lvl; pending = null; segs = []; pts = []; refresh(); } });
      if (!pts.length) items.push({ label: '🛤️🛤️ Șină paralelă', fn: () => c.switchTool('parallel') });
      return items;
    },
  };
}
