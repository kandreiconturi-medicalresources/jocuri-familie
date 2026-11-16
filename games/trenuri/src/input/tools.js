// Uneltele jucătorului: șină (pe segmente), șină paralelă, gară, îmbunătățire, tren, demolare, info. Totul trece prin ctx.exec(comandă).
import { STATION_RADIUS, CAR_SETS, availableModels, UPGRADES, suggestKinds, MODELS } from '../sim/index.js';
import { CAR_TYPES } from '../sim/goods.js';
import { lei } from '../ui/hud.js';
import { createTrackTool } from './trackTool.js';
import { createParallelTool } from './parallelTool.js';

const GOLD = '#ffd23f', BLUE = '#8fd3ff';

export function createTools(ctx) {
  const o = { tool: 'track', size: 1, model: 0, cars: -1, up: 0 }; // cars: -1 = vagoane potrivite rutei, altfel indice în CAR_SETS
  let from = null;
  const S = () => ctx.state(), hud = () => ctx.hud, ov = () => ctx.view().overlay;
  const stationAt = (x, y) => S().stations.find((st) => st.x === x && st.y === y);
  const env = { S, hud, ov, exec: (c) => ctx.exec(c), canAfford: ctx.canAfford, errText: ctx.errText, tool: () => o.tool, bar: () => subBar(), switchTool: (id) => api.setTool(id) };
  const track = createTrackTool(env), par = createParallelTool(env);

  function paint() {
    if (o.tool === 'track') return track.paint();
    if (o.tool === 'parallel') return par.paint();
    const tiles = [];
    if (o.tool === 'train' && from) { const st = S().stations.find((q) => q.id === from); if (st) tiles.push({ x: st.x, y: st.y, color: GOLD }); }
    ov().set(tiles);
  }
  function subBar() {
    const h = hud();
    if (o.tool === 'station') h.stationOpts(o.size, (i) => { o.size = i; subBar(); });
    else if (o.tool === 'train') {
      const av = availableModels(S().date.y);
      if (!av.some((m) => m.id === o.model)) o.model = av[av.length - 1].id;
      h.trainOpts(o.model, o.cars, S().date.y, (i) => { o.model = i; subBar(); }, (i) => { o.cars = i; subBar(); });
    } else if (o.tool === 'upgrade') h.setSub(UPGRADES.map((u, k) => ({ label: u.icon + ' ' + u.name, small: lei(u.cost), on: o.up === k, fn: () => { o.up = k; subBar(); h.hint('Atinge o gară ca să-i dai: ' + u.name + '. ' + u.text, false, 5000); } })));
    else if (o.tool === 'track') h.setSub(track.bar());
    else if (o.tool === 'parallel') h.setSub(par.bar());
    else h.setSub([]);
  }
  function reset() { from = null; track.reset(); par.reset(); paint(); subBar(); }

  function tap(t) {
    const s = S();
    if (o.tool === 'track') track.tap(t);
    else if (o.tool === 'parallel') par.tap(t);
    else if (o.tool === 'station') {
      const r = ctx.exec({ type: 'buildStation', x: t.x, y: t.y, size: o.size, dir: 0 });
      if (r.ok) hud().hint('Gară nouă! Leag-o cu șină de alt oraș.', false, 4000);
    } else if (o.tool === 'upgrade') {
      const st = stationAt(t.x, t.y);
      if (!st) { hud().hint('Atinge o gară (🚉) ca să o îmbunătățești.', true); return; }
      const r = ctx.exec({ type: 'buildUpgrade', stationId: st.id, kind: o.up });
      if (r.ok) hud().hint(`${UPGRADES[o.up].icon} ${UPGRADES[o.up].name} la ${st.name}!`, false, 4000);
    } else if (o.tool === 'train') {
      const st = stationAt(t.x, t.y);
      if (!st) { hud().hint('Atinge o gară (🚉).', true); return; }
      if (!from) { from = st.id; paint(); hud().hint('Bine! Acum atinge gara unde ajunge trenul.', false, 5000); return; }
      if (from === st.id) { hud().hint('Alege altă gară pentru destinație.', true); return; }
      const route = [from, st.id];
      const kinds = o.cars < 0 ? suggestKinds(s, route, MODELS[o.model].power) : CAR_SETS[o.cars];
      const b = ctx.exec({ type: 'buyTrain', model: o.model, kinds: o.cars < 0 ? undefined : kinds, stationId: from, route });
      if (b.ok) {
        hud().hint(`Trenul tău pleacă! Vagoane: ${kinds.map((k) => CAR_TYPES[k].icon).join('')}${b.cost ? ' · a costat ' + lei(b.cost) : ''}.`, false, 5000);
        if (b.id) ctx.follow(b.id);
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
      const ind = ctx.panels.industryNear(s, t.x, t.y);
      if (ind) { ctx.panels.industry(s, ind); return; }
      const c = ctx.panels.cityNear(s, t.x, t.y);
      if (c) ctx.panels.city(s, c); else ctx.panels.close();
    }
  }

  const api = {
    state: o,
    setTool(id) { o.tool = id; reset(); ctx.hud.setTool(id); ctx.panels.close(); subBar(); },
    /** Alegeri din catalog: { tool, size?, model?, up? }. */
    choose(c) { Object.assign(o, c); api.setTool(c.tool); },
    wantsDrag: () => o.tool === 'track',
    tap,
    dragStart(t) { if (o.tool === 'track') track.dragStart(t); },
    dragMove(t) { if (o.tool === 'track') track.dragMove(t); },
    dragEnd(t, moved) { if (o.tool === 'track') track.dragEnd(t, moved); },
    dragCancel() { if (o.tool === 'track') track.dragCancel(); },
    key(e) { return o.tool === 'track' ? track.key(e.key) : false; },
    hover(t) {
      if (o.tool === 'track') track.hover(t);
      else if (o.tool === 'station' && t) {
        const r = STATION_RADIUS[o.size], tiles = [];
        for (let y = Math.max(0, t.y - r); y <= Math.min(S().h - 1, t.y + r); y++) for (let x = Math.max(0, t.x - r); x <= Math.min(S().w - 1, t.x + r); x++) tiles.push({ x, y, color: x === t.x && y === t.y ? GOLD : BLUE });
        ov().set(tiles);
      } else if (o.tool !== 'parallel' && o.tool !== 'train') ov().clear();
    },
    paint, reset,
  };
  return api;
}
