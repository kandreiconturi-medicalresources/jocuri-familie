// Creșterea orașelor: clădiri noi pe plăci libere în jurul centrului (ordine deterministă).
import { rng } from '../../../../shared/engine/rng.js';
import { CITY_LEVELS, WATER_H } from './consts.js';

const RING = [];
for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
  const d = dx * dx + dy * dy;
  if (d > 0 && d <= 36) RING.push([dx, dy, d]);
}
RING.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);

export const targetBuildings = (pop) => Math.min(70, 3 + Math.floor(pop / 40));
export const levelOf = (pop) => (pop >= CITY_LEVELS[2] ? 2 : pop >= CITY_LEVELS[1] ? 1 : 0);

function free(s, x, y, base) {
  if (x < 0 || y < 0 || x >= s.w || y >= s.h) return false;
  const i = y * s.w + x;
  return !s.water[i] && !s.occ[i] && !s.roads[i] && !s.track[i] && Math.abs(s.height[i] - base) <= 2 && s.height[i] > WATER_H;
}

/** Adaugă clădiri până la ținta orașului. Foloseste rng-ul stării (avansează `s.rng`). */
export function growBuildings(s, c, max = 6) {
  const want = targetBuildings(c.pop), base = s.height[c.y * s.w + c.x];
  let guard = 0;
  while (c.buildings.length < want && guard++ < max) {
    const r = rng(s.rng); const a = r.int(0, 7), b = r.int(0, 3), t = r.int(0, 999);
    s.rng = (s.rng + 3 * 0x6d2b79f5) >>> 0;
    const start = a; let placed = false;
    for (let k = 0; k < RING.length && !placed; k++) {
      const [dx, dy] = RING[k];
      // la început umple ordonat; mai târziu sare peste unele plăci pentru aspect aerisit
      if (((k * 7 + start) & 3) === 0 && c.buildings.length < want - 1 && k > 8) continue;
      const x = c.x + dx, y = c.y + dy;
      if (!free(s, x, y, base)) continue;
      const pool = c.level >= 2 ? 13 : c.level >= 1 ? 11 : 8;
      let type = t % 8;
      if (c.level >= 1 && ((dx * dx + dy * dy) < 9 || (x + y) % 3 === 0)) type = 8 + (t % (pool - 8));
      c.buildings.push([x, y, type, b]);
      s.occ[y * s.w + x] = 1; placed = true;
    }
    if (!placed) break;
  }
  s.dirty.cities = true;
}
