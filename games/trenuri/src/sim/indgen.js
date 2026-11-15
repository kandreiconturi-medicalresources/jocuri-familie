// Plasarea industriilor: lângă resurse (păduri, dealuri pentru mine, câmpie pentru ferme), cu seed.
import { rng } from '../../../../shared/engine/rng.js';
import { WATER_H } from './consts.js';
import { INDUSTRIES, NG } from './goods.js';

const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Verifică o placă pentru un tip de industrie. `m` = { w, h, height, water, forest, cities, industries, busy(i) }. */
function fits(m, type, x, y, relax) {
  const { w, h, height, water, forest } = m, i = y * w + x, hv = height[i];
  if (x < 3 || y < 3 || x >= w - 3 || y >= h - 3 || water[i] || hv <= WATER_H || (m.busy && m.busy(i))) return false;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const j = i + dy * w + dx;
    if (water[j] || Math.abs(height[j] - hv) > 2 || (m.busy && m.busy(j) && !dx && !dy)) return false;
  }
  if (m.cities.some((c) => cheb(c, { x, y }) < 8)) return false;
  if (m.industries.some((o) => cheb(o, { x, y }) < 4)) return false;
  const place = INDUSTRIES[type].place;
  if (place === 'forest') {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) n += forest[i + dy * w + dx];
    return n >= (relax ? 3 : 5);
  }
  if (place === 'hill') return hv >= (relax ? 8 : 9);
  return hv >= 4 && hv <= 9;
}

function nameFor(m, type, x, y) {
  let best = null, bd = 1e9;
  for (const c of m.cities) { const d = Math.abs(c.x - x) + Math.abs(c.y - y); if (d < bd) { bd = d; best = c; } }
  return INDUSTRIES[type].name + (best ? ' ' + best.name : '');
}

/** Încearcă să pună o industrie de tipul `type`; întoarce obiectul sau null. */
export function placeOne(m, r, type, id) {
  for (let t = 0; t < 700; t++) {
    const x = r.int(3, m.w - 4), y = r.int(3, m.h - 4);
    if (!fits(m, type, x, y, t > 350)) continue;
    return { id, type, x, y, name: nameFor(m, type, x, y), in: new Array(NG).fill(0), out: new Array(NG).fill(0), made: 0, boost: 0 };
  }
  return null;
}

/** Industriile hărții. Minele întâi (au nevoie de dealuri), apoi restul. */
export function placeIndustries(seed, size, w, h, height, water, forest, cities) {
  const r = rng((seed ^ 0x51ed270b) >>> 0), list = [];
  const m = { w, h, height, water, forest, cities, industries: list };
  const mult = size === 'S' ? 1 : size === 'M' ? 2 : 3;
  const order = INDUSTRIES.map((_, i) => i).sort((a, b) => (INDUSTRIES[b].place === 'hill') - (INDUSTRIES[a].place === 'hill') || (INDUSTRIES[b].place === 'forest') - (INDUSTRIES[a].place === 'forest') || a - b);
  for (const type of order) {
    for (let k = 0; k < INDUSTRIES[type].n * mult; k++) {
      const o = placeOne(m, r, type, list.length);
      if (!o) break;
      list.push(o);
      forest[o.y * w + o.x] = 0;
    }
  }
  list.sort((a, b) => a.type - b.type || a.y - b.y || a.x - b.x);
  list.forEach((o, i) => { o.id = i; if (INDUSTRIES[o.type].out >= 0 && !INDUSTRIES[o.type].in.length) o.out[INDUSTRIES[o.type].out] = 10; });
  return list;
}
