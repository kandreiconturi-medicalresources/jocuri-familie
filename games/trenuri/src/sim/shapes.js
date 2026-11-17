// Forme de șină („ștampile”): bucăți gata făcute puse dintr-un clic, cu rotire și oglindire. Comanda `buildShape {kind,x,y,rot,flip}`
// generează traseele în coordonate locale (u de-a lungul liniei, v spre lateral), le validează și le construiește atomic, cu semnale.
import { DX, DY, opp, SIGNAL_COST, T_PRESENT } from './consts.js';
import { pathCost } from './plan.js';
import { layPath } from './terraform.js';
import { linkCount } from './blocks.js';
import { canBuild } from './islands.js';
import { syncAuto } from './signals.js';

const line = (u0, v0, u1, v1) => {
  const du = Math.sign(u1 - u0), dv = Math.sign(v1 - v0), n = Math.max(Math.abs(u1 - u0), Math.abs(v1 - v0)), o = [];
  for (let k = 0; k <= n; k++) o.push([u0 + du * k, v0 + dv * k]);
  return o;
};
/** Ocolire laterală: se desparte la u=-a, merge la distanța d și revine la u=a (rampe în diagonală). */
const side = (a, d) => { const o = [[-a, 0]]; for (let k = 1; k < d; k++) o.push([-a + k, k]); o.push(...line(-a + d, d, a - d, d)); for (let k = d - 1; k >= 1; k--) o.push([a - k, k]); o.push([a, 0]); return o; };

/** Formele: trasee locale și semnale de bloc [uDin, vDin, uÎn, vÎn, ambele sensuri]. */
export const SHAPES = [
  { key: 'loop', icon: '🔁', name: 'Stație de încrucișare', text: 'Linie dublă scurtă cu macaz la ambele capete: trenurile din sens opus se depășesc aici.', paths: [line(-8, 0, 8, 0), side(6, 1)], sig: [] },
  { key: 'cross', icon: '✖️', name: 'Traversare', text: 'Două linii paralele legate în ambele sensuri: trenul trece pe linia liberă.', paths: [line(-4, 0, 4, 0), line(-4, 1, 4, 1), [[-2, 0], [-1, 1]], [[1, 1], [2, 0]]], sig: [] },
  { key: 'double', icon: '🛤️', name: 'Linie dublă', text: 'Două linii paralele, cu semnale de bloc la mijloc pe fiecare.', paths: [line(-6, 0, 6, 0), line(-6, 1, 6, 1)], sig: [[-1, 0, 0, 0, true], [-1, 1, 0, 1, true]] },
  { key: 'wye', icon: '🔱', name: 'Triunghi (Y)', text: 'Ramificație în ambele sensuri: trenul poate coti oricum și se poate întoarce.', paths: [line(-6, 0, 6, 0), line(-3, 0, 0, 3), line(3, 0, 0, 3), line(0, 3, 0, 6)], sig: [] },
  { key: 'bypass', icon: '🚉', name: 'Ocolire de gară', text: 'Pune-o cu mijlocul pe gară: trenurile care nu opresc trec pe lângă.', paths: [line(-7, 0, 7, 0), side(6, 2)], sig: [] },
];

/** Placa (x,y) din coordonate locale: întâi oglindire (v → −v), apoi rotire cu 90° × rot (în sensul acelor de ceas). */
export function place(x, y, rot, flip, u, v) {
  const w = flip ? -v : v;
  switch (rot & 3) {
    case 1: return [x - w, y + u];
    case 2: return [x - u, y - w];
    case 3: return [x + w, y - u];
    default: return [x + u, y + w];
  }
}
const dirTo = (a, b) => DX.findIndex((dx, d) => dx === b[0] - a[0] && DY[d] === b[1] - a[1]);

/** Planul formei (fără să schimbe starea): { ok, err, paths, tiles, sigs, cost, track, forest }. */
export function shapePlan(s, cmd, by) {
  const sh = SHAPES[cmd.kind | 0], x = cmd.x, y = cmd.y, rot = cmd.rot | 0, flip = !!cmd.flip;
  if (!sh || !Number.isInteger(cmd.kind) || !Number.isInteger(x) || !Number.isInteger(y)) return { ok: false, err: 'drum' };
  const paths = sh.paths.map((p) => p.map(([u, v]) => place(x, y, rot, flip, u, v)));
  const v = Object.create(s); // ciornă: aceleași hărți, dar șina și pădurea sunt copii
  v.track = s.track.slice(); v.forest = s.forest.slice(); v.dirty = {};
  let cost = 0, err = null;
  for (const p of paths) {
    const r = pathCost(v, p, by);
    if (!r.ok) { err = err || r.err; continue; }
    cost += r.cost;
    layPath(v, p, { id: by });
  }
  const seen = new Set(), tiles = [];
  for (const p of paths) for (const q of p) { const k = q[1] * s.w + q[0]; if (!seen.has(k)) { seen.add(k); tiles.push(q); } }
  if (!err && s.islands && s.companies[by] && !tiles.every((q) => canBuild(s, s.companies[by], q[0], q[1]))) err = 'insula';
  const sigs = [], has = (q) => sigs.some((g) => g.x === q.x && g.y === q.y && g.dir === q.dir) || s.signals.some((g) => !g.auto && g.x === q.x && g.y === q.y && g.dir === q.dir);
  const add = (q) => { if (!has(q)) sigs.push(q); };
  for (const [u0, v0, u1, v1, two] of sh.sig) {
    const a = place(x, y, rot, flip, u0, v0), b = place(x, y, rot, flip, u1, v1);
    add({ x: b[0], y: b[1], dir: dirTo(a, b), twoWay: !!two });
  }
  if (!err && s.autoSig === false) { // fără semnale automate: forma își pune singură semnale la intrarea în macaze
    for (const q of tiles) {
      const i = q[1] * s.w + q[0], t = v.track[i];
      if (!(t & T_PRESENT) || linkCount(t) < 3) continue;
      for (let d = 0; d < 8; d++) if ((t >> d) & 1) add({ x: q[0], y: q[1], dir: opp(d), twoWay: false });
    }
  }
  cost += sigs.length * SIGNAL_COST;
  return err ? { ok: false, err, paths, tiles, sigs, cost } : { ok: true, paths, tiles, sigs, cost, track: v.track, forest: v.forest };
}

function buildShape(s, cmd, c) {
  const p = shapePlan(s, cmd, c.id);
  if (!p.ok) return { ok: false, err: p.err };
  if (!s.sandbox && c.cash < p.cost) return { ok: false, err: 'bani' };
  if (!s.sandbox) c.cash -= p.cost;
  s.track.set(p.track); s.forest.set(p.forest);
  for (const g of p.sigs) s.signals.push({ id: s.sigId++, owner: c.id, x: g.x, y: g.y, dir: g.dir, twoWay: g.twoWay, auto: false });
  s.dirty.track = s.dirty.forest = s.dirty.signals = true;
  syncAuto(s);
  return { ok: true, cost: p.cost };
}

export const SHAPE_COMMANDS = { buildShape };
