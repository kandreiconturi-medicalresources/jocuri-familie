// Constructor de niveluri (portat din originalul `class B`), folosit de nivelurile clasice și de generator.
import { ROWS } from '../tiles.js';

export const GROUND_TOP = 15; // rândul suprafeței implicite

export class LevelBuilder {
  constructor(width) {
    this.width = width;
    this.grid = Array.from({ length: ROWS }, () => Array(width).fill('.'));
    this.enemies = []; this.platforms = []; this.checkpoints = [];
    this.spawn = { tx: 3, ty: GROUND_TOP };
    this.portal = { tx: width - 8, ty: GROUND_TOP };
    this.boss = null;
  }
  put(x, y, c) { if (x >= 0 && x < this.width && y >= 0 && y < ROWS) this.grid[y][x] = c; }
  get(x, y) { return x >= 0 && x < this.width && y >= 0 && y < ROWS ? this.grid[y][x] : '.'; }
  /** Teren plin de la rândul `top` în jos, pe coloanele a..b. */
  ground(a, b, top = GROUND_TOP, c = '#') { for (let x = a; x <= b; x++) for (let y = top; y < ROWS; y++) this.put(x, y, c); }
  row(x, y, n, c) { for (let i = 0; i < n; i++) this.put(x + i, y, c); }
  col(x, y, n, c) { for (let i = 0; i < n; i++) this.put(x, y - i, c); }
  stairs(x, h, dir = 1, top = GROUND_TOP) {
    for (let i = 0; i < h; i++) { const hh = dir > 0 ? i + 1 : h - i; for (let k = 0; k < hh; k++) this.put(x + i, top - 1 - k, 'L'); }
  }
  arc(x, n, row, c = 'o') { for (let i = 0; i < n; i++) { const t = n > 1 ? i / (n - 1) : 0.5; this.put(x + i, row - Math.round(Math.sin(t * Math.PI) * 2), c); } }
  enemy(type, tx, ty, extra = {}) { this.enemies.push({ type, tx, ty, ...extra }); }
  snail(x, row = GROUND_TOP - 1) { this.enemy('snail', x, row); }
  bee(x, row, range = 3) { this.enemy('bee', x, row, { range }); }
  platform(tx, ty, w, dx, dy, speed = 1) { this.platforms.push({ tx, ty, w, dx, dy, speed }); }
  check(tx, ty = GROUND_TOP) { this.checkpoints.push({ tx, ty }); }

  /** Rezultatul final, în formatul din games/bobo/README.md. */
  build(meta) {
    return {
      ...meta,
      width: this.width, rows: ROWS,
      grid: this.grid.map((r) => r.slice()),
      spawn: { ...this.spawn }, portal: { ...this.portal },
      checkpoints: this.checkpoints.map((c) => ({ ...c })),
      enemies: this.enemies.map((e) => ({ ...e })),
      platforms: this.platforms.map((p) => ({ ...p })),
      boss: this.boss ? { ...this.boss } : null,
    };
  }
}
