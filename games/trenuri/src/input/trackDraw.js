// Desen liber al șinei (și „punct cu punct”): urma mâinii → plăci netezite → plan (pod, nivelare, tunel, defrișare, ocolire)
// → previzualizare fantomă. Totul se recalculează cel mult o dată pe cadru (`flush`, chemat din pointer.js la rAF).
import { planTrace, K_ICON, K_NAME } from '../sim/tracePlan.js';
import { smoothTrace, cutCorners, extend, pushTile, straight, line } from '../sim/trace.js';
import { snapTarget } from './snap.js';
import { viewer } from '../sim/viewer.js';
import { switches } from '../sim/index.js';
import { lei } from '../ui/hud.js';

const CYAN = '#3ee6e0', MAXRAW = 1400;
const ERR = { ocolire: 'Nu găsesc cum să ocolesc obstacolul.', drum: 'Trage mai departe: traseul e prea scurt.', panta: 'Dealul e prea mare pentru nivelare.' };

export function createTrackDraw(c, { points = false } = {}) {
  let raw = [], idx = new Map(), active = false, pend = false, dirty = false, plan = null, cache = {}, sw = null;
  let anchorLen = 0, anchorMode = 0, hov = null, startSnap = null, lastLabel = 0, label = null, shown = '';
  const S = () => c.S(), gh = () => (c.ghost ? c.ghost() : null), by = () => viewer.co;
  const last = () => raw[raw.length - 1];

  function ensureLabel() {
    if (label) return label;
    label = document.createElement('div');
    label.style.cssText = 'position:fixed;left:50%;top:104px;transform:translateX(-50%);z-index:36;padding:6px 12px;border-radius:12px;background:rgba(20,28,40,.88);color:#fff;font:600 14px/1.3 system-ui,sans-serif;pointer-events:none;max-width:92vw;text-align:center;display:none';
    document.body.append(label);
    return label;
  }
  function showLabel(force) {
    const now = performance.now(), el = ensureLabel();
    if (!plan || raw.length < 2) { el.style.display = 'none'; shown = ''; return; }
    if (!force && now - lastLabel < 90) return;
    lastLabel = now;
    const p = plan.parts, bits = [['șină', p.rail], ['poduri', p.bridge], ['nivelare', p.level], ['tunel', p.tunnel], ['defrișare', p.clear]].filter((b) => b[1] > 0).map((b) => `${b[0]} ${lei(b[1])}`);
    const txt = plan.ok ? `💰 ${lei(plan.cost)}${bits.length > 1 ? ' · ' + bits.join(' · ') : ''}` : `⛔ ${ERR[plan.err] || c.errText(plan.err) || 'Nu se poate aici.'}`;
    if (txt !== shown) { el.textContent = txt; shown = txt; }
    el.style.background = plan.ok && !c.canAfford(plan.cost) ? 'rgba(160,30,40,.92)' : 'rgba(20,28,40,.88)';
    el.style.display = '';
  }

  /** Urma curentă (cu captul lipit de ținta magnetică, în „punct cu punct” și cu segmentul de probă) → plăci netezite. */
  function tilesNow() {
    let r = raw;
    if (points && hov && raw.length && !active) r = raw.concat(line(last(), [hov.x, hov.y]));
    const sn = r.length > 1 ? snapTarget(S(), { x: r[r.length - 1][0], y: r[r.length - 1][1] }, by(), 2) : null;
    if (sn && (sn.x !== r[r.length - 1][0] || sn.y !== r[r.length - 1][1])) r = r.concat(line(r[r.length - 1], [sn.x, sn.y]));
    const g = gh();
    if (g) { g.ring(0, startSnap); g.ring(1, sn && r.length > 1 ? sn : null); }
    return points ? cutCorners(dedupe(r)) : smoothTrace(r, S().w);
  }
  function dedupe(r) { const t = [], m = new Map(); for (const q of r) pushTile(t, m, S().w, q); return t; }

  function flush(force = false) {
    if (!dirty && !force) return;
    dirty = false;
    const g = gh();
    if (raw.length < 2) { plan = null; if (g) { g.set([], [], false); g.icons([]); } showLabel(true); return; }
    const tiles = tilesNow();
    plan = planTrace(S(), tiles, by(), cache);
    if (g) {
      g.set(plan.tiles, plan.kind, plan.ok && !c.canAfford(plan.cost));
      g.icons(plan.runs.filter((r) => r.kind).map((r) => { const t = plan.tiles[(r.a + r.b) >> 1]; return { x: t[0], y: t[1], icon: K_ICON[r.kind], text: K_NAME[r.kind] }; }));
    }
    showLabel(force);
  }
  function reset() {
    raw = []; idx = new Map(); active = pend = dirty = false; plan = null; cache = {}; anchorMode = 0; hov = null; startSnap = null;
    const g = gh();
    if (g) g.clear();
    if (label) label.style.display = 'none';
  }
  function begin(t) {
    const sn = snapTarget(S(), t, by(), 2), q = sn || t;
    raw = [[q.x, q.y]]; idx = new Map([[q.y * S().w + q.x, 0]]); startSnap = sn;
    cache = {}; plan = null; pend = false;
  }
  function grow(t) { // în „desen liber” cu Shift/Ctrl: linie dreaptă de la ancoră
    if (raw.length >= MAXRAW) return;
    const w = S().w;
    if (anchorMode) {
      while (raw.length > anchorLen) { const q = raw.pop(); if (idx.get(q[1] * w + q[0]) === raw.length) idx.delete(q[1] * w + q[0]); }
      for (const q of straight(raw[anchorLen - 1], [t.x, t.y], anchorMode === 2)) pushTile(raw, idx, w, q);
    } else extend(raw, idx, w, [t.x, t.y]);
    dirty = true;
  }

  const api = {
    reset, flush, paint() {
      if (c.tool() !== 'track') return;
      if (raw.length) c.ov().clear(); else { if (!sw) sw = switches(S()); c.ov().set(sw.map(([x, y]) => ({ x, y, color: CYAN }))); }
      dirty = true; flush(true);
    },
    isActive: () => raw.length > 0,
    /** Din meniul de clic dreapta: traseul începe pe t; următoarea tragere (sau atingere, la „punct cu punct”) îl continuă. */
    startAt(t) { reset(); begin(t); pend = true; dirty = true; c.hud().hint(points ? 'Începutul e pus. Atinge punctele următoare.' : 'Începutul e pus aici. Trage din el ca să desenezi șina.', false, 5000); c.bar(); },
    pending: () => pend && !!plan,
    dragStart(t) {
      const l = raw.length ? last() : null;
      if (pend && l && Math.max(Math.abs(l[0] - t.x), Math.abs(l[1] - t.y)) <= 2) { pend = false; grow(t); } else { reset(); begin(t); }
      active = true; pend = false; anchorMode = 0; dirty = true; c.bar();
    },
    dragMove(t, mods = {}) {
      if (!active || !t) return;
      const m = mods.shift ? 1 : mods.ctrl ? 2 : 0;
      if (m && !anchorMode) anchorLen = raw.length;
      anchorMode = m;
      grow(t);
    },
    dragFlush: () => flush(),
    dragEnd(t, moved) {
      if (!active) return;
      active = false;
      if (!moved || raw.length < 2) { if (!pend) reset(); c.hud().hint('Ține apăsat și trage ca să desenezi șina.', false, 3000); c.bar(); return; }
      dirty = true; flush(true);
      pend = !!plan && raw.length > 1; anchorMode = 0;
      c.bar();
    },
    tap(t) { // „punct cu punct”: fiecare atingere adaugă un punct; „Construiește” termină
      if (!points || !t) return;
      if (!raw.length) { begin(t); c.hud().hint('Bun! Atinge punctele următoare; apoi „Construiește”.', false, 4000); } else extend(raw, idx, S().w, [t.x, t.y]);
      pend = raw.length > 1; hov = null; dirty = true; flush(true); c.bar();
    },
    hover(t) {
      if (!t) return;
      const g = gh();
      if (points && raw.length && !active) { if (!hov || hov.x !== t.x || hov.y !== t.y) { hov = t; dirty = true; flush(); } return; }
      if (!active && !raw.length && g) g.ring(0, snapTarget(S(), t, by(), 2));
    },
    cancel() { const was = raw.length > 0; reset(); c.bar(); return was; },
    undo() { if (raw.length < 4) return reset(), c.bar(); for (let i = 0; i < 6 && raw.length > 1; i++) { const q = raw.pop(); idx.delete(q[1] * S().w + q[0]); } dirty = true; flush(true); c.bar(); },
    build() {
      if (!plan || !plan.ok) { c.hud().hint(plan && plan.err ? ERR[plan.err] || c.errText(plan.err) || 'Nu se poate aici.' : 'Desenează întâi traseul.', true); return; }
      if (!c.canAfford(plan.cost)) { c.hud().hint(c.errText('bani'), true); return; }
      let ok = true;
      for (const cmd of plan.cmds) { if (!c.exec(cmd).ok) { ok = false; break; } }
      if (ok) c.hud().hint('Șina e gata! Pune gări la capete.', false, 4000);
      reset(); c.refresh();
    },
    bar() {
      if (!pend || !plan) return [];
      const ok = plan.ok && c.canAfford(plan.cost);
      return [
        { label: plan.ok ? (ok ? '✅ Construiește' : '💸 Prea scump') : '⛔ Nu se poate', small: plan.ok ? lei(plan.cost) : '', cls: ok ? 'go' : 'no', fn: api.build },
        { label: '✖ Anulează', cls: 'no', fn: () => { reset(); c.refresh(); } },
      ];
    },
    dispose() { if (label) label.remove(); },
  };
  return api;
}
