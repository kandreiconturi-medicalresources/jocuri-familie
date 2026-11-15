// Uneltele jucătorului: șină (tragere + confirmare), gară, tren, demolare, info. Totul trece prin ctx.exec(comandă).
import { planTrack, STATION_RADIUS } from '../sim/index.js';
import { lei } from '../ui/hud.js';

const GREEN = '#5bd66f', RED = '#ff5a6a', GOLD = '#ffd23f', BLUE = '#8fd3ff';

export function createTools(ctx) {
  const o = { tool: 'track', size: 1, model: 1 };
  let start = null, plan = null, from = null, last = null;
  const S = () => ctx.state(), hud = () => ctx.hud, ov = () => ctx.view().overlay;
  const stationAt = (x, y) => S().stations.find((st) => st.x === x && st.y === y);

  function paint() {
    const tiles = [];
    if (o.tool === 'track') {
      if (plan) {
        const ok = ctx.canAfford(plan.cost);
        for (const [x, y] of plan.path) tiles.push({ x, y, color: ok ? GREEN : RED });
      } else if (start) tiles.push({ x: start.x, y: start.y, color: GOLD });
    }
    if (o.tool === 'train' && from) { const st = S().stations.find((q) => q.id === from); if (st) tiles.push({ x: st.x, y: st.y, color: GOLD }); }
    ov().set(tiles);
  }
  function subBar() {
    const h = hud();
    if (o.tool === 'station') h.stationOpts(o.size, (i) => { o.size = i; subBar(); });
    else if (o.tool === 'train') h.trainOpts(o.model, (i) => { o.model = i; subBar(); });
    else if (o.tool === 'track' && plan) {
      const ok = ctx.canAfford(plan.cost);
      h.setSub([
        { label: ok ? `✅ Construiește` : '💸 Prea scump', small: lei(plan.cost), cls: ok ? 'go' : 'no', fn: () => { if (ok) build(); else h.hint(ctx.errText('bani'), true); } },
        { label: '✖ Anulează', cls: 'no', fn: reset },
      ]);
    } else h.setSub([]);
  }
  function reset() { start = null; plan = null; from = null; paint(); subBar(); }
  function build() {
    if (!plan) return;
    const r = ctx.exec({ type: 'buildTrack', path: plan.path });
    if (r.ok) hud().hint('Șina e gata! Pune gări la capete.', false, 4000);
    reset();
  }
  function setPlan(a, b) {
    const p = a && b && (a.x !== b.x || a.y !== b.y) ? planTrack(S(), [a.x, a.y], [b.x, b.y], 0) : null;
    plan = p;
    if (!p && a && b && (a.x !== b.x || a.y !== b.y)) hud().hint('Acolo nu se poate trage șină. Încearcă altfel.', true);
    paint(); subBar();
  }

  function tap(t) {
    const s = S();
    if (o.tool === 'track') { // atingeri: prima = început, a doua = sfârșit
      if (!start || plan) { plan = null; start = t; paint(); subBar(); hud().hint('Acum atinge unde se termină șina.', false, 4000); }
      else setPlan(start, t);
    } else if (o.tool === 'station') {
      const r = ctx.exec({ type: 'buildStation', x: t.x, y: t.y, size: o.size, dir: 0 });
      if (r.ok) hud().hint('Gară nouă! Leag-o cu șină de alt oraș.', false, 4000);
    } else if (o.tool === 'train') {
      const st = stationAt(t.x, t.y);
      if (!st) { hud().hint('Atinge o gară (🚉).', true); return; }
      if (!from) { from = st.id; paint(); hud().hint('Bine! Acum atinge gara unde ajunge trenul.', false, 5000); return; }
      if (from === st.id) { hud().hint('Alege altă gară pentru destinație.', true); return; }
      const b = ctx.exec({ type: 'buyTrain', model: o.model, stationId: from });
      if (b.ok) {
        ctx.exec({ type: 'setRoute', trainId: b.id, route: [from, st.id] });
        hud().hint(`Trenul tău pleacă! A costat ${lei(b.cost)}.`, false, 4000);
        ctx.follow(b.id);
      }
      reset();
    } else if (o.tool === 'demolish') {
      const st = stationAt(t.x, t.y);
      const r = st ? ctx.exec({ type: 'removeStation', id: st.id }) : ctx.exec({ type: 'removeTrack', x: t.x, y: t.y });
      if (r.ok) hud().hint('Gata, am șters.', false, 2000);
    } else if (o.tool === 'info') {
      const tr = ctx.view().trains.pickAt(t.fx, t.fz);
      if (tr) { ctx.panels.train(s, tr); return; }
      const st = stationAt(t.x, t.y);
      if (st) { ctx.panels.station(s, st); return; }
      const c = ctx.panels.cityNear(s, t.x, t.y);
      if (c) ctx.panels.city(c); else ctx.panels.close();
    }
  }

  return {
    state: o,
    setTool(id) { o.tool = id; reset(); hud().setTool(id); ctx.panels.close(); subBar(); },
    wantsDrag: () => o.tool === 'track',
    tap,
    dragStart(t) { plan = null; start = t; last = t; paint(); subBar(); },
    dragMove(t) { if (t && start && (t.x !== last.x || t.y !== last.y)) { last = t; setPlan(start, t); } },
    dragEnd(t, moved) {
      if (!moved) { start = null; if (t) tap(t); return; }
      if (t && start) setPlan(start, t);
      if (!plan) { start = null; paint(); }
    },
    dragCancel() { start = null; plan = null; paint(); subBar(); },
    hover(t) {
      if (o.tool === 'station' && t) {
        const r = STATION_RADIUS[o.size], tiles = [];
        for (let y = Math.max(0, t.y - r); y <= Math.min(S().h - 1, t.y + r); y++) for (let x = Math.max(0, t.x - r); x <= Math.min(S().w - 1, t.x + r); x++) tiles.push({ x, y, color: x === t.x && y === t.y ? GOLD : BLUE });
        ov().set(tiles);
      } else if (o.tool !== 'track' && o.tool !== 'train') ov().clear();
    },
    paint, reset,
  };
}
