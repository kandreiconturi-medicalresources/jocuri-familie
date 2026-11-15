// Generator de hartă: zgomot de valori cu numere întregi, râuri, păduri, orașe pe teren plat.
import { rng } from '../../../../shared/engine/rng.js';
import { DX, DY, WATER_H } from './consts.js';

function lat(x, y, s) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) & 255;
}
const smooth = (t) => (t * t * (768 - 2 * t)) >> 16; // 0..256 -> 0..256
function noise(x, y, c, s) {
  const gx = Math.floor(x / c), gy = Math.floor(y / c);
  const tx = smooth(((x - gx * c) << 8) / c | 0), ty = smooth(((y - gy * c) << 8) / c | 0);
  const a = lat(gx, gy, s), b = lat(gx + 1, gy, s), d = lat(gx, gy + 1, s), e = lat(gx + 1, gy + 1, s);
  const top = a * 256 + (b - a) * tx, bot = d * 256 + (e - d) * tx;
  return (top * 256 + (bot - top) * ty) >> 16;
}

const FIRST = ['Valea', 'Dealu', 'Podu', 'Lunca', 'Poiana', 'Izvoru', 'Câmpu', 'Pădurea', 'Piatra', 'Stejaru', 'Crinul', 'Soarele', 'Brazii', 'Fluturii', 'Albina', 'Mărul'];
const SECOND = ['Mare', 'Mic', 'Nou', 'Verde', 'Frumos', 'Vesel', 'de Sus', 'de Jos', 'Senin', 'Albastru', 'Auriu', 'Liniștit'];
const COUNT = { S: [6, 8], M: [8, 11], L: [10, 14] };
const MIN_DIST = { S: 11, M: 12, L: 13 };

export function generateMap(seed, size, w, h) {
  const r = rng(seed ^ 0x9e3779b9);
  const height = new Uint8Array(w * h), water = new Uint8Array(w * h), forest = new Uint8Array(w * h);
  const s1 = seed >>> 0, s2 = (seed * 31 + 7) >>> 0, s3 = (seed * 17 + 3) >>> 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = (noise(x, y, 24, s1) * 4 + noise(x, y, 12, s2) * 2 + noise(x, y, 6, s3)) / 7 | 0;
    const v = Math.max(0, Math.min(15, ((n - 62) * 16 / 130) | 0));
    height[y * w + x] = v;
    water[y * w + x] = v <= WATER_H ? 1 : 0;
  }
  carveRivers(r, size, w, h, height, water);
  const cities = placeCities(r, size, w, h, height, water);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (water[i] || height[i] > 11 || height[i] < 5) continue;
    if (noise(x, y, 9, s2 ^ 0x55) + noise(x, y, 4, s3) / 4 < 168) continue;
    if (cities.some((c) => Math.abs(c.x - x) < 4 && Math.abs(c.y - y) < 4)) continue;
    forest[i] = 1;
  }
  return { height, water, forest, cities };
}

function carveRivers(r, size, w, h, height, water) {
  const n = size === 'S' ? 1 : size === 'M' ? 2 : 3;
  for (let k = 0; k < n; k++) {
    let cur = -1;
    for (let t = 0; t < 300 && cur < 0; t++) { const i = r.int(0, w * h - 1); if (height[i] >= 9) cur = i; }
    if (cur < 0) continue;
    const seen = new Set();
    for (let step = 0; step < 400; step++) {
      seen.add(cur);
      const x = cur % w, y = (cur / w) | 0;
      const wasWater = water[cur];
      water[cur] = 1; height[cur] = Math.min(height[cur], 2);
      for (let d = 0; d < 8; d += 2) { // maluri line
        const nx = x + DX[d], ny = y + DY[d];
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && !water[ny * w + nx]) height[ny * w + nx] = Math.min(height[ny * w + nx], 5);
      }
      if (wasWater && step > 0) break;
      let best = -1, bh = 99;
      const off = r.int(0, 3);
      for (let q = 0; q < 4; q++) {
        const d = ((q + off) & 3) * 2, nx = x + DX[d], ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (seen.has(ni)) continue;
        const hv = water[ni] ? 0 : height[ni] + (q === 0 ? 0 : 0);
        if (hv < bh) { bh = hv; best = ni; }
      }
      if (best < 0) break;
      cur = best;
    }
  }
}

function placeCities(r, size, w, h, height, water) {
  const [lo, hi] = COUNT[size], want = r.int(lo, hi), md = MIN_DIST[size];
  const cities = [], used = new Set();
  for (let t = 0; t < 6000 && cities.length < want; t++) {
    const x = r.int(5, w - 6), y = r.int(5, h - 6);
    if (water[y * w + x] || cities.some((c) => Math.abs(c.x - x) + Math.abs(c.y - y) < md)) continue;
    let ok = true;
    for (let dy = -3; dy <= 3 && ok; dy++) for (let dx = -3; dx <= 3; dx++) {
      const i = (y + dy) * w + x + dx;
      if (water[i] || Math.abs(height[i] - height[y * w + x]) > 2) { ok = false; break; }
    }
    if (!ok) continue;
    const base = Math.max(4, Math.min(8, height[y * w + x]));
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) height[(y + dy) * w + x + dx] = base;
    let name = '';
    for (let q = 0; q < 30; q++) { name = r.pick(FIRST) + ' ' + r.pick(SECOND); if (!used.has(name)) break; }
    used.add(name);
    cities.push({ id: cities.length, name, x, y, pop: r.int(120, 700), level: 0, demand: { pass: 0, mail: 0 }, supply: { pass: 0, mail: 0 }, delivered: 0, buildings: [] });
  }
  return cities;
}
