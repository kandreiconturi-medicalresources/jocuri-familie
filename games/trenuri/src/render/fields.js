// Câmpuri arate și culturi lângă ferme, cu garduri de lemn. Plăcile ocupate sunt cunoscute și de forest.js (să nu pună copaci pe ele).
import { Group, Mesh, MeshLambertMaterial } from 'three';
import { INDUSTRIES } from '../sim/goods.js';
import { Builder } from './geo.js';
import { fieldTexture } from './texgen.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
let memo = null;

/** Blocuri de câmp pe plăci libere lângă fiecare fermă: [{ i, x, y, kind }] (kind 0 = arat, 1 = cultură). */
export function fieldPlan(s) {
  if (memo && memo.s === s && memo.n === s.industries.length) return memo.plan;
  const plan = [], taken = new Set();
  for (const o of s.industries) {
    const k = INDUSTRIES[o.type].key;
    if (k !== 'ferma' && k !== 'fermalapte') continue;
    const [dx, dy] = DIRS[(o.id + o.x * 3 + o.y) & 3], px = -dy, py = dx, base = s.height[o.y * s.w + o.x];
    for (let a = 1; a <= 2; a++) for (let b = -1; b <= 1; b++) {
      const x = o.x + dx * a + px * b, y = o.y + dy * a + py * b;
      if (x < 0 || y < 0 || x >= s.w || y >= s.h) continue;
      const i = y * s.w + x;
      if (taken.has(i) || s.water[i] || s.forest[i] || s.occ[i] || s.roads[i] || s.track[i] || Math.abs(s.height[i] - base) > 1 || s.height[i] <= 4) continue;
      taken.add(i);
      plan.push({ i, x, y, kind: k === 'ferma' ? ((b + 1 + o.id) & 1) : 1, vert: dx !== 0 });
    }
  }
  memo = { s, n: s.industries.length, plan };
  return plan;
}
export const fieldSet = (s) => new Set(fieldPlan(s).map((f) => f.i));

export function createFields(s, g) {
  const root = new Group(), plan = fieldPlan(s), set = new Set(plan.map((f) => f.i)), B = [new Builder(), new Builder()], F = new Builder();
  for (const f of plan) {
    const c = (dx, dz) => [f.x + dx, g.vy[(f.y + dz) * g.W + f.x + dx] + 0.03, f.y + dz];
    const uv = f.vert ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [0, 1], [1, 1], [1, 0]];
    B[f.kind].quad(c(0, 0), c(1, 0), c(1, 1), c(0, 1), 0xffffff, [0, 1, 0], uv);
    for (const [dx, dy] of DIRS) { // gard pe laturile fără câmp vecin
      if (set.has((f.y + dy) * s.w + f.x + dx)) continue;
      const cx = f.x + 0.5 + dx * 0.5, cz = f.y + 0.5 + dy * 0.5, y0 = g.at(cx, cz), tx = dy !== 0 ? 1 : 0, tz = dx !== 0 ? 1 : 0;
      for (const h of [0.07, 0.13]) F.obox(cx, y0 + h, cz, tx, tz, 0.5, 0.008, 0.009, '#b08c5a');
      for (const k of [-0.45, 0, 0.45]) F.obox(cx + tx * k, y0 + 0.07, cz + tz * k, tx, tz, 0.014, 0.014, 0.075, '#8a6a42');
    }
  }
  B.forEach((b, k) => { if (!b.empty) { const m = new Mesh(b.geometry(true), new MeshLambertMaterial({ vertexColors: true, map: fieldTexture(k) })); m.userData.recv = true; root.add(m); } });
  if (!F.empty) { const m = new Mesh(F.geometry(), new MeshLambertMaterial({ vertexColors: true })); m.userData.cast = true; m.userData.recv = true; root.add(m); }
  return root;
}
