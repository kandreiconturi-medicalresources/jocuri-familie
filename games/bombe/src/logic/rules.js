// Constante și funcții pure ale regulilor (fără DOM).
export const W = 15, H = 13;
export const HZ = 30;              // pași de simulare pe secundă
export const FUSE = 75;            // 2,5 s
export const FLAME_T = 15;         // 0,5 s
export const ROUND_STEPS = 3600;   // 2 min
export const SHRINK_AT = 2700;     // 90 s
export const SHRINK_EVERY = 6;
export const END_DELAY = 45;
export const INVULN = 45;
export const HIT_R = 0.34;
export const BASE_SPEED = 3.4;     // plăci/s
export const SPEED_ADD = 0.55;
export const MAX_SPEED = 3, MAX_BOMBS = 6, MAX_RANGE = 7, MAX_SHIELD = 2;
export const CORNERS = [[1, 1], [13, 11], [13, 1], [1, 11]];
export const BONUS = ['', 'bomb', 'fire', 'speed', 'kick', 'shield'];
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const DEFAULT_RULES = { rounds: 3, gentle: true, botLevel: 'easy' };
export const EMPTY = 0, WALL = 1, CRATE = 2, BUSH = 3;

export const idx = (x, y) => y * W + x;
export const inB = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
export const speedOf = (p) => BASE_SPEED + SPEED_ADD * p.spd;

export function bombAt(s, x, y) {
  for (const b of s.bombs) if (b.x === x && b.y === y) return b;
  return null;
}

/** Celulele lovite de o bombă: în cruce, oprite de pereți; lada și bomba opresc flacăra după ce o includ. */
export function blastCells(s, b) {
  const out = [idx(b.x, b.y)];
  for (const [dx, dy] of DIRS) {
    for (let k = 1; k <= b.r; k++) {
      const x = b.x + dx * k, y = b.y + dy * k;
      if (!inB(x, y)) break;
      const g = s.grid[idx(x, y)];
      if (g === WALL) break;
      out.push(idx(x, y));
      if (g === CRATE || bombAt(s, x, y)) break;
    }
  }
  return out;
}

/** Lava: 0 stinsă, 1 avertisment, 2 fierbinte (ciclu de 4 s). */
export function lavaPhase(s) {
  const t = s.tick % 120;
  return t < 45 ? 0 : t < 60 ? 1 : 2;
}
export const lavaAt = (s, x, y) => !!(s.arena.lava && s.arena.lava.some((c) => c[0] === x && c[1] === y));

/** Ordinea în care se strânge arena: spirală dinspre margini spre mijloc. */
export const SPIRAL = (() => {
  const out = [];
  for (let k = 0; k < 6; k++) {
    const x0 = 1 + k, x1 = W - 2 - k, y0 = 1 + k, y1 = H - 2 - k;
    for (let x = x0; x <= x1; x++) out.push(idx(x, y0));
    for (let y = y0 + 1; y <= y1; y++) out.push(idx(x1, y));
    for (let x = x1 - 1; x >= x0; x--) out.push(idx(x, y1));
    for (let y = y1 - 1; y > y0; y--) out.push(idx(x0, y));
  }
  return out;
})();
