// Generatorul lumii cu insule (etapa 7.1): câte o insulă per companie, în mare, cu resursele primare împărțite
// astfel încât nicio insulă să nu le aibă pe toate (deci e nevoie de comerț). Numai întregi, totul din seed.
import { rng } from '../../../../shared/engine/rng.js';
import { noise, FIRST, SECOND } from './mapgen.js';
import { INDUSTRIES, NG } from './goods.js';

/** Industriile primare (fără intrări): fermă, pădure, mină de cărbune, mină de fier, fermă de lapte, sondă. */
export const PRIMARY = [0, 2, 4, 6, 9, 11];
export const ISLAND_NAMES = ['Insula Pescărușilor', 'Insula Delfinilor', 'Insula Scoicilor', 'Insula Farului', 'Insula Corăbiilor', 'Insula Pelicanilor', 'Insula Chihlimbarului', 'Insula Cormoranilor'];
export const SIDE = { S: 30, M: 38, L: 46 };
export const NEAR = [5, 8], FAR = [16, 22]; // apă între vecini, înainte de forma rotunjită (apropiat = pod posibil mai târziu)
const MARGIN = 8, CITIES = { S: 2, M: 3, L: 4 };
const CITY_WANTS = [3, 5, 11, 9, 13, 8]; // ce poate cere în plus un oraș dacă insula lui nu produce

/** Împarte cele 6 resurse primare: fiecare insulă are ~jumătate, nicio insulă pe toate, de la 3 insule fiecare resursă e pe ≥ 2. */
export function splitResources(r, n) {
  const perm = PRIMARY.slice();
  for (let i = perm.length - 1; i > 0; i--) { const j = r.int(0, i), t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  const c = n === 3 ? 4 : 3;
  return Array.from({ length: n }, (_, i) => {
    const sh = c === 3 && n > 2 ? ((i * c) / 6) | 0 : 0, out = [];
    for (let k = 0; k < c; k++) out.push(perm[(i * c + k + sh) % 6]);
    return out.sort((a, b) => a - b);
  });
}

/** Ce mărfuri se pot face cu industriile date (primare + prelucrătoare cu toate intrările disponibile). */
export function goodsOf(types) {
  const can = new Array(NG).fill(false);
  for (const t of types) if (!INDUSTRIES[t].in.length && INDUSTRIES[t].out >= 0) can[INDUSTRIES[t].out] = true;
  for (let k = 0; k < 4; k++) for (const t of types) { const d = INDUSTRIES[t]; if (d.in.length && d.out >= 0 && d.in.every((g) => can[g])) can[d.out] = true; }
  return can;
}

/** Grila insulelor: coloane, rânduri, goluri de apă (primul apropiat, cel puțin unul departe când sunt ≥ 2 goluri). */
function layout(r, n, side) {
  let cols = 1;
  while (cols * cols < n) cols++;
  const rows = ((n + cols - 1) / cols) | 0, total = cols - 1 + rows - 1, kind = [];
  for (let k = 0; k < total; k++) kind.push(k === 0 ? 0 : r.int(0, 1));
  if (total >= 2 && !kind.includes(1)) kind[total - 1] = 1;
  const len = kind.map((k) => (k ? r.int(FAR[0], FAR[1]) : r.int(NEAR[0], NEAR[1])));
  const cg = len.slice(0, cols - 1), rg = len.slice(cols - 1);
  const starts = (n2, gaps) => { const out = []; let p = MARGIN; for (let i = 0; i < n2; i++) { out.push(p); p += side + (gaps[i] || 0); } return { out, end: p - (gaps[n2 - 1] || 0) + MARGIN }; };
  const X = starts(cols, cg), Y = starts(rows, rg), rects = [];
  for (let i = 0; i < n; i++) {
    const sw = side - r.int(0, 2), sh = side - r.int(0, 2), ox = r.int(0, side - sw), oy = r.int(0, side - sh);
    const x0 = X.out[i % cols] + ox, y0 = Y.out[(i / cols) | 0] + oy;
    rects.push({ x0, y0, x1: x0 + sw - 1, y1: y0 + sh - 1 });
  }
  return { w: X.end, h: Y.end, rects, cols };
}

/** Uscatul unei insule: formă rotunjită (super-elipsă) cu margini zimțate de zgomot, dealuri mici, plajă joasă. */
function shapeIsland(m, q, s1, s2) {
  const { w, height, water } = m, rx = q.x1 - q.x0 + 1, ry = q.y1 - q.y0 + 1;
  const RX4 = rx * rx * rx * rx, RY4 = ry * ry * ry * ry, lim = RX4 * RY4;
  for (let y = q.y0; y <= q.y1; y++) for (let x = q.x0; x <= q.x1; x++) {
    const dx = Math.abs(2 * x + 1 - (q.x0 + q.x1 + 1)), dy = Math.abs(2 * y + 1 - (q.y0 + q.y1 + 1));
    const v = dx * dx * dx * dx * RY4 + dy * dy * dy * dy * RX4, wob = (noise(x, y, 5, s2) * 22) >> 8;
    if (v * 100 > lim * (100 - wob)) continue;
    const i = y * w + x;
    water[i] = 0; height[i] = 4 + ((noise(x, y, 9, s1) * 6) >> 8);
  }
  for (let y = q.y0; y <= q.y1; y++) for (let x = q.x0; x <= q.x1; x++) {
    const i = y * w + x;
    if (!water[i] && (water[i - 1] || water[i + 1] || water[i - w] || water[i + w])) height[i] = 4;
  }
}

const landAround = (m, x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (m.water[(y + dy) * m.w + x + dx]) return false; return true; };
const cheb = (a, x, y) => Math.max(Math.abs(a.x - x), Math.abs(a.y - y));

function placeCities(r, m, q, want, used) {
  const out = [];
  const add = (x, y) => {
    const base = Math.max(4, Math.min(8, m.height[y * m.w + x]));
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const i = (y + dy) * m.w + x + dx; m.height[i] = base; m.water[i] = 0; }
    let name = '';
    for (let k = 0; k < 40; k++) { name = r.pick(FIRST) + ' ' + r.pick(SECOND); if (!used.has(name)) break; }
    used.add(name);
    const c = { id: m.cities.length, name, x, y, pop: r.int(120, 700), level: 0, demand: { pass: 0, mail: 0 }, supply: { pass: 0, mail: 0 }, delivered: 0, buildings: [] };
    m.cities.push(c); out.push(c);
  };
  for (let t = 0; t < 900 && out.length < want; t++) {
    const x = r.int(q.x0 + 5, q.x1 - 5), y = r.int(q.y0 + 5, q.y1 - 5);
    if (!landAround(m, x, y, 3) || m.cities.some((c) => Math.abs(c.x - x) + Math.abs(c.y - y) < 11)) continue;
    add(x, y);
  }
  if (!out.length) add((q.x0 + q.x1) >> 1, (q.y0 + q.y1) >> 1); // insula are mereu cel puțin un oraș
  return out;
}

function nameFor(cities, type, x, y) {
  let best = null, bd = 1e9;
  for (const c of cities) { const d = Math.abs(c.x - x) + Math.abs(c.y - y); if (d < bd) { bd = d; best = c; } }
  return INDUSTRIES[type].name + (best ? ' ' + best.name : '');
}

/** Pune o industrie pe insulă; terenul din jur se potrivește tipului (deal pentru mine, pădure, câmpie). */
function placeIndustry(r, m, q, type, own) {
  for (let t = 0; t < 600; t++) {
    const x = r.int(q.x0 + 3, q.x1 - 3), y = r.int(q.y0 + 3, q.y1 - 3);
    if (!landAround(m, x, y, 1) || m.cities.some((c) => cheb(c, x, y) < (t < 300 ? 7 : 5)) || m.industries.some((o) => cheb(o, x, y) < 4)) continue;
    const place = INDUSTRIES[type].place, h0 = m.height[y * m.w + x];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const i = (y + dy) * m.w + x + dx;
      if (place === 'hill') m.height[i] = dx || dy ? 9 : 10;
      else m.height[i] = Math.max(4, Math.min(9, h0));
      m.forest[i] = place === 'forest' && (dx || dy) ? 1 : 0;
    }
    const o = { id: 0, type, x, y, name: nameFor(own, type, x, y), in: new Array(NG).fill(0), out: new Array(NG).fill(0), made: 0, boost: 0 };
    m.industries.push(o);
    return o;
  }
  return null;
}

/** Ce industrii prelucrătoare primește insula: cele care folosesc măcar o resursă de-a ei (+ fabrica de bunuri lângă oțelărie). */
function processorsFor(has) {
  const outs = has.map((t) => INDUSTRIES[t].out), list = [];
  INDUSTRIES.forEach((d, t) => { if (d.in.length && d.in.some((g) => outs.includes(g))) list.push(t); });
  if (list.includes(7)) list.push(8);
  return list;
}

/** Lumea cu n insule (2–8). Întoarce terenul, orașele, industriile și lista insulelor (fără proprietari). */
export function generateIslands(seed, size, n) {
  const r = rng((seed ^ 0x1517a9d3) >>> 0), side = SIDE[size] || SIDE.M;
  n = Math.max(2, Math.min(8, n | 0));
  const L = layout(r, n, side), w = L.w, h = L.h;
  const m = { w, h, height: new Uint8Array(w * h).fill(1), water: new Uint8Array(w * h).fill(1), forest: new Uint8Array(w * h), cities: [], industries: [] };
  const s1 = seed >>> 0, s2 = (seed * 31 + 7) >>> 0, s3 = (seed * 17 + 3) >>> 0;
  const split = splitResources(r, n), used = new Set(), islands = [];
  L.rects.forEach((q) => shapeIsland(m, q, s1, s2));
  const own = L.rects.map((q) => placeCities(r, m, q, CITIES[size] || 3, used));
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { // păduri, ca pe harta obișnuită
    const i = y * w + x;
    if (m.water[i] || m.height[i] < 5 || noise(x, y, 9, s2 ^ 0x55) + noise(x, y, 4, s3) / 4 < 168) continue;
    if (!m.cities.some((c) => Math.abs(c.x - x) < 4 && Math.abs(c.y - y) < 4)) m.forest[i] = 1;
  }
  L.rects.forEach((q, k) => {
    const types = [];
    for (const t of split[k]) for (let j = 0; j < (size === 'S' ? 1 : 2); j++) if (placeIndustry(r, m, q, t, own[k])) types.push(t);
    for (const t of processorsFor(split[k])) if (placeIndustry(r, m, q, t, own[k])) types.push(t);
    const can = goodsOf(types), lack = CITY_WANTS.filter((g) => !can[g]);
    own[k].forEach((c, j) => { if (lack.length) c.want = [lack[(j + k) % lack.length]]; });
    islands.push({ id: k, owner: -1, name: ISLAND_NAMES[k], x0: q.x0, y0: q.y0, x1: q.x1, y1: q.y1, has: PRIMARY.filter((t) => types.includes(t)) });
  });
  for (const o of m.industries) m.forest[o.y * w + o.x] = 0;
  m.industries.sort((a, b) => a.type - b.type || a.y - b.y || a.x - b.x);
  m.industries.forEach((o, i) => { o.id = i; if (INDUSTRIES[o.type].out >= 0 && !INDUSTRIES[o.type].in.length) o.out[INDUSTRIES[o.type].out] = 10; });
  return { w, h, height: m.height, water: m.water, forest: m.forest, cities: m.cities, industries: m.industries, islands, cols: L.cols };
}
