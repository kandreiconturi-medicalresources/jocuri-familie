// Uneltele jucătorului: șină (pe segmente), șină paralelă, gară, îmbunătățire, tren, demolare, info. Totul trece prin ctx.exec(comandă).
import { STATION_RADIUS, CAR_SETS, availableModels, UPGRADES, suggestKinds, MODELS } from '../sim/index.js';
import { CAR_TYPES } from '../sim/goods.js';
import { lei } from '../ui/hud.js';
import { createTrackTool } from './trackTool.js';
import { anchorNear } from './touchGate.js';
import { createParallelTool } from './parallelTool.js';
import { createExtraTools, EXTRA_TOOLS } from './extraTools.js';
import { autoDir, yardTiles, yardProblem } from '../sim/terminal.js';

const GOLD = '#ffd23f', BLUE = '#8fd3ff', OK = '#5fd35f', BAD = '#ff5a5a', TURNS = [-1, 2, 4, 6, 0];

export function createTools(ctx) {
  const o = { tool: 'track', size: 1, model: 0, cars: -1, up: 0, tdir: -1 }; // tdir: -1 = curtea terminalului se așază singură // cars: -1 = vagoane potrivite rutei, altfel indice în CAR_SETS
  let from = null;
  const S = () => ctx.state(), hud = () => ctx.hud, ov = () => ctx.view().overlay;
  const stationAt = (x, y) => S().stations.find((st) => st.x === x && st.y === y);
  const env = { S, hud, ov, ghost: () => { const v = ctx.view(); return v && v.ghost; }, exec: (c) => ctx.exec(c), canAfford: ctx.canAfford, errText: ctx.errText, tool: () => o.tool, bar: () => subBar(), switchTool: (id) => api.setTool(id) };
  const track = createTrackTool(env), par = createParallelTool(env), extra = createExtraTools(env);

  function paint() {
    if (o.tool === 'track') return track.paint();
    if (o.tool === 'parallel') return par.paint();
    if (extra.has(o.tool)) return extra.paint(o.tool);
    const tiles = [];
    if (o.tool === 'train' && from) { const st = S().stations.find((q) => q.id === from); if (st) tiles.push({ x: st.x, y: st.y, color: GOLD }); }
    ov().set(tiles);
  }
  function subBar() {
    const h = hud();
    if (o.tool === 'station') h.stationOpts(o.size, (i) => { o.size = i; subBar(); if (i === 2) h.hint('Terminalul mare are linii terminale, service și macara. Are nevoie de 4×5 plăci libere lângă gară (verde = merge). 🔄 sau R îl rotește.', false, 7000); }, turn, () => api.setTool('thru'));
    else if (o.tool === 'train') {
      if (ctx.assist && ctx.assist.open()) { h.setSub([]); return; } // cu asistentul deschis, alegerile sunt în el
      const av = availableModels(S().date.y);
      if (!av.some((m) => m.id === o.model)) o.model = av[av.length - 1].id;
      h.trainOpts(o.model, o.cars, S().date.y, (i) => { o.model = i; subBar(); }, (i) => { o.cars = i; subBar(); });
    } else if (o.tool === 'upgrade') h.setSub(UPGRADES.map((u, k) => ({ label: u.icon + ' ' + u.name, small: lei(u.cost), on: o.up === k, fn: () => { o.up = k; subBar(); h.hint('Atinge o gară ca să-i dai: ' + u.name + '. ' + u.text, false, 5000); } })));
    else if (o.tool === 'track') h.setSub(track.bar());
    else if (o.tool === 'parallel') h.setSub(par.bar());
    else if (extra.has(o.tool)) h.setSub(extra.bar(o.tool));
    else h.setSub([]);
  }
  /** Direcția curții terminalului mare pe placa t (-1 = nu încape). */
  const yardDir = (t) => (o.tdir >= 0 ? o.tdir : autoDir(S(), t.x, t.y));
  let lastHover = null;
  function turn() { o.tdir = TURNS[(TURNS.indexOf(o.tdir) + 1) % TURNS.length]; hud().hint(o.tdir < 0 ? 'Curtea se așază singură.' : 'Curtea s-a rotit.', false, 2000); if (lastHover) api.hover(lastHover); }
  function reset() { from = null; track.reset(); par.reset(); extra.reset(); paint(); subBar(); }

  /** Info despre ce e la placă: tren, vapor, depou, gară/port, industrie, oraș (și din meniul de clic dreapta). */
  function info(t) {
    const s = S();
    const tr = ctx.view().trains.pickAt(t.fx, t.fz);
    if (tr) { ctx.panels.train(s, tr); return; }
    const sh = s.ships && ctx.panels.shipNear ? ctx.panels.shipNear(s, t.fx, t.fz) : null; // insule: vapor sau port
    if (sh) { ctx.panels.ship(sh); return; }
    const dp = s.depots.find((d) => d.x === t.x && d.y === t.y);
    if (dp) { ctx.panels.depot(s, dp); return; }
    const st = stationAt(t.x, t.y);
    if (st) { if (st.port && ctx.panels.port) ctx.panels.port(st); else ctx.panels.station(s, st); return; }
    const ind = ctx.panels.industryNear(s, t.x, t.y);
    if (ind) { ctx.panels.industry(s, ind); return; }
    const c = ctx.panels.cityNear(s, t.x, t.y);
    if (c) ctx.panels.city(s, c); else ctx.panels.close();
  }

  function tap(t) {
    const s = S();
    if (o.tool === 'track') track.tap(t);
    else if (o.tool === 'parallel') par.tap(t);
    else if (extra.has(o.tool)) extra.tap(o.tool, t);
    else if (o.tool === 'station') {
      const big = o.size === 2, d = big ? yardDir(t) : 0;
      const r = ctx.exec(big ? { type: 'buildStation', x: t.x, y: t.y, size: 2, big: true, dir: d < 0 ? undefined : d } : { type: 'buildStation', x: t.x, y: t.y, size: o.size, dir: 0 });
      if (r.ok) hud().hint(big ? 'Terminal mare nou! Leagă linia principală prin placa gării (de-a lungul curții).' : 'Gară nouă! Leag-o cu șină de alt oraș.', false, 5000);
    } else if (o.tool === 'upgrade') {
      const st = stationAt(t.x, t.y);
      if (!st) { hud().hint('Atinge o gară (🚉) ca să o îmbunătățești.', true); return; }
      const r = ctx.exec({ type: 'buildUpgrade', stationId: st.id, kind: o.up });
      if (r.ok) hud().hint(`${UPGRADES[o.up].icon} ${UPGRADES[o.up].name} la ${st.name}!`, false, 4000);
    } else if (o.tool === 'train') {
      if (ctx.assist && ctx.assist.tap(t)) return; // asistentul de cumpărare își alege gările pe hartă
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
    } else if (o.tool === 'info') info(t);
  }

  const api = {
    state: o, world: S,
    setTool(id) {
      o.tool = id; reset();
      if (extra.has(id)) { ctx.hud.setTool('upgrade'); ctx.hud.hint(EXTRA_TOOLS.find((q) => q.id === id).hint, false, 6000); } else ctx.hud.setTool(id); // uneltele 6.6 n-au buton în bara principală
      ctx.panels.close(); subBar();
    },
    /** Alegeri din catalog: { tool, size?, model?, up? }. */
    choose(c) { Object.assign(o, c); api.setTool(c.tool); },
    wantsDrag: () => o.tool === 'track' && track.wantsDrag(),
    infoAt: info,
    /** Din meniul de clic dreapta: unealta Șină, cu începutul traseului pus pe placa t. */
    startTrack(t) { api.setTool('track'); track.startAt(t); },
    tap,
    dragStart(t) { if (o.tool === 'track') track.dragStart(t); },
    dragMove(t, m) { if (o.tool === 'track') track.dragMove(t, m); },
    dragFlush() { if (o.tool === 'track') track.dragFlush(); },
    dragAbort() { if (o.tool === 'track') track.dragAbort(); },
    touchMode: () => track.touchMode(),
    isAnchor: (t) => anchorNear(S(), t.fx, t.fz),
    holdRing(t) { const v = ctx.view(); if (v && v.ghost) v.ghost.ring(0, t); },
    /** Clic dreapta în timpul trasării: anulează. true = consumat. */
    rightClick() { return o.tool === 'track' && track.rightClick(); },
    dragEnd(t, moved) { if (o.tool === 'track') track.dragEnd(t, moved); },
    dragCancel() { if (o.tool === 'track') track.dragCancel(); },
    key(e) {
      if (o.tool === 'station' && o.size === 2 && (e.key === 'r' || e.key === 'R')) { turn(); return true; }
      return o.tool === 'track' ? track.key(e.key) : false;
    },
    hover(t) {
      if (o.tool === 'track') track.hover(t);
      else if (extra.has(o.tool)) extra.hover(o.tool, t);
      else if (o.tool === 'station' && t) {
        const r = STATION_RADIUS[o.size], tiles = [];
        for (let y = Math.max(0, t.y - r); y <= Math.min(S().h - 1, t.y + r); y++) for (let x = Math.max(0, t.x - r); x <= Math.min(S().w - 1, t.x + r); x++) tiles.push({ x, y, color: x === t.x && y === t.y ? GOLD : BLUE });
        lastHover = t;
        if (o.size === 2) { // curtea terminalului mare: verde dacă încape, roșu dacă nu
          const d = yardDir(t), dd = d < 0 ? 2 : d, ok = d >= 0 && !yardProblem(S(), t.x, t.y, dd);
          const yard = new Set(yardTiles(t.x, t.y, dd).map(([x, y]) => y * S().w + x));
          for (const q of tiles) if (yard.has(q.y * S().w + q.x)) q.color = ok ? OK : BAD;
          for (const [x, y] of yardTiles(t.x, t.y, dd)) if (!tiles.some((q) => q.x === x && q.y === y) && x >= 0 && y >= 0 && x < S().w && y < S().h) tiles.push({ x, y, color: ok ? OK : BAD });
        }
        ov().set(tiles);
      } else if (o.tool !== 'parallel' && o.tool !== 'train') ov().clear();
    },
    paint, reset,
  };
  return api;
}
