// Cele 8 arene: aspect + o regulă mică. Construiește grila cu seed.
import { W, H, EMPTY, WALL, CRATE, BUSH, CORNERS, idx } from './rules.js';

const T = (a, b, wall, crate, bg) => ({ a, b, wall, crate, bg });
const line = (x0, y0, x1, y1, dir) => {
  const o = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) o.push([x, y, dir]);
  return o;
};

export const ARENAS = [
  { id: 0, name: 'Grădina', desc: 'Clasică: iarbă și lăzi.', crate: 0.62, loot: 0.34, theme: T('#86dd5c', '#78d052', 'terrain_stone_block_center', 'block_planks', '#2d6a2f') },
  { id: 1, name: 'Plaja', desc: 'Nisip și mai puține lăzi.', crate: 0.36, loot: 0.5, theme: T('#ffe5a0', '#f8d680', 'terrain_sand_block_center', 'block_plank', '#2aa5d6') },
  { id: 2, name: 'Gheața', desc: 'Alunecă pe gheață!', ice: true, crate: 0.58, loot: 0.34, theme: T('#dff5ff', '#c9ebfb', 'terrain_snow_block_center', 'block_blue', '#3a6fb0') },
  { id: 3, name: 'Pădurea', desc: 'Tufișuri care ascund bonusuri.', bush: 0.18, crate: 0.5, loot: 0.3, theme: T('#62bb5c', '#57ae52', 'terrain_dirt_block_center', 'block_green', '#1c4a2a') },
  { id: 4, name: 'Peștera', desc: 'Întuneric: vezi doar în jurul tău.', dark: true, crate: 0.6, loot: 0.34, theme: T('#8f84a3', '#82779a', 'bricks_grey', 'block_strong_empty', '#1b1530') },
  { id: 5, name: 'Cetatea', desc: 'Benzi rulante te plimbă.', crate: 0.5, loot: 0.34, theme: T('#c9b79c', '#bba98e', 'brick_grey', 'block_red', '#4a3a52'),
    belts: [...line(5, 3, 9, 3, 1), ...line(5, 9, 9, 9, 3), ...line(3, 5, 3, 7, 0), ...line(11, 5, 11, 7, 2)] },
  { id: 6, name: 'Norii', desc: 'Teleportoare pereche.', crate: 0.55, loot: 0.34, theme: T('#f3eaff', '#e6d9fb', 'terrain_purple_block_center', 'block_yellow', '#6f8fe0'),
    portals: [[3, 3, 11, 9], [11, 3, 3, 9]] },
  { id: 7, name: 'Vulcanul', desc: 'Lava pulsează: ai grijă!', crate: 0.52, loot: 0.34, theme: T('#8a5a4a', '#7d4f40', 'bricks_brown', 'block_strong_danger', '#3a1410'),
    lava: [[5, 6], [9, 6]] },
];
export const arenaById = (id) => ARENAS[id] || ARENAS[0];

const LOOT_W = [30, 30, 18, 12, 10]; // bomb, fire, speed, kick, shield -> id 1..5
function randLoot(r) {
  let x = r.next() * 100;
  for (let i = 0; i < LOOT_W.length; i++) { if (x < LOOT_W[i]) return i + 1; x -= LOOT_W[i]; }
  return 1;
}

/** Întoarce { grid, loot, pick, belts }. `loot` = ce se ascunde sub lăzi; `pick` = bonusuri vizibile (sub tufișuri la Pădure). */
export function buildArena(arena, r) {
  const grid = new Uint8Array(W * H), loot = new Uint8Array(W * H), pick = new Uint8Array(W * H);
  const blocked = new Set();
  for (const [cx, cy] of CORNERS) {
    const sx = cx < 7 ? 1 : -1, sy = cy < 6 ? 1 : -1;
    blocked.add(idx(cx, cy)); blocked.add(idx(cx + sx, cy)); blocked.add(idx(cx, cy + sy));
  }
  for (const p of arena.portals || []) { blocked.add(idx(p[0], p[1])); blocked.add(idx(p[2], p[3])); }
  for (const c of arena.lava || []) blocked.add(idx(c[0], c[1]));
  const belts = new Uint8Array(W * H);
  for (const b of arena.belts || []) { belts[idx(b[0], b[1])] = b[2] + 1; blocked.add(idx(b[0], b[1])); }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1 || (x % 2 === 0 && y % 2 === 0)) { grid[i] = WALL; continue; }
      if (blocked.has(i)) continue;
      if (arena.bush && r.chance(arena.bush)) { grid[i] = BUSH; if (r.chance(0.3)) pick[i] = randLoot(r); continue; }
      if (r.chance(arena.crate)) { grid[i] = CRATE; if (r.chance(arena.loot)) loot[i] = randLoot(r); }
    }
  }
  return { grid, loot, pick, belts };
}
