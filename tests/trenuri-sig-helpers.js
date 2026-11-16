// Ajutoare pentru testele de semnale (6.6): lume plată, gări, șină, trenuri, urmărirea coliziunilor.
import assert from 'node:assert/strict';
import { createWorld, applyCommand, planTrack, stepWorld } from '../games/trenuri/src/sim/index.js';
import { tailTiles } from '../games/trenuri/src/sim/blocks.js';

export const ok = (r) => { assert.ok(r.ok, r.err); return r; };
export const run = (s, n) => { for (let i = 0; i < n; i++) stepWorld(s); };

export function flat() {
  const s = createWorld({ seed: 4, size: 'S', year: 1950 });
  s.height.fill(8); s.water.fill(0); s.forest.fill(0); s.occ.fill(0); s.roads.fill(0);
  s.industries.length = 0;
  for (const c of s.cities) { c.x = 2; c.y = 2; } // orașele nu încurcă
  return s;
}
export const station = (s, x, y, size = 0) => ok(applyCommand(s, { type: 'buildStation', by: 0, x, y, size })).id;
export const track = (s, a, b) => ok(applyCommand(s, { type: 'buildTrack', by: 0, path: planTrack(s, a, b, 0).path }));
export const lane = (s, pts) => ok(applyCommand(s, { type: 'buildTrack', by: 0, path: pts }));
export const buy = (s, model, at, route, kinds = [0, 0, 1]) => {
  const t = ok(applyCommand(s, { type: 'buyTrain', by: 0, model, stationId: at, kinds, route }));
  return s.trains.find((q) => q.id === t.id);
};
export const tile = (s, x, y) => y * s.w + x;

/** Plăcile (fără gări) pe care se află trupul trenului. */
function body(s, t) {
  if (t.state !== 1 || t.path.length < 2) return [];
  const out = [];
  for (let k = Math.max(0, t.seg - tailTiles(t)); k <= Math.min(t.path.length - 1, t.seg + 1); k++) if (!s.stm[t.path[k]]) out.push(t.path[k]);
  return out;
}
/** Rulează și numără sosirile; întoarce și numărul de plăci ocupate de două trenuri deodată. */
export function watch(s, trains, ticks, each = null) {
  const seen = trains.map(() => new Set()), count = trains.map(() => 0), was = trains.map((t) => t.state);
  let clash = 0, reds = 0;
  for (let i = 0; i < ticks; i++) {
    stepWorld(s);
    if (each) each(s, i);
    const used = new Map();
    for (const t of s.trains) for (const p of body(s, t)) { if (used.has(p) && used.get(p) !== t.id) clash++; used.set(p, t.id); }
    trains.forEach((t, k) => { if (t.state === 2 && was[k] !== 2) { seen[k].add(t.to); count[k]++; } was[k] = t.state; if (t.redAt) reds++; });
  }
  return { seen, count, clash, reds };
}

/** Linie simplă A — S1 = (două fire) = S2 — B, cu stație de încrucișare între macazuri. */
export function crossing(s, y = 20) {
  const a = station(s, 6, y), b = station(s, 32, y);
  track(s, [6, y], [32, y]);
  const up = []; for (let x = 13; x <= 23; x++) up.push([x, y - 1]);
  lane(s, [[12, y], ...up, [24, y]]);
  return [a, b];
}

