// Intrările gării mari de trecere: la fiecare capăt, din linia principală se desfac în evantai mai multe linii scurte
// (prin macaze pe diagonală), fiecare cu un capăt liber de care legi șina venită din altă parte. Așa intră în aceeași gară
// trenuri de pe 5, 6 sau mai multe linii diferite. Totul e șină obișnuită (rutele și semnalele merg ca peste tot).
import { WATER_H, T_PRESENT, T_OWNER_SHIFT } from './consts.js';
import { frameOf } from './terminal.js';

const STUB = 2; // plăci drepte la capătul fiecărei intrări
const FAN_AT = 5; // evantaiul începe la 5 plăci de gară: gara (max ±4) poate crește fără să-l atingă

/** Căile de pus: [[ [x,y], ... ], ...] (fiecare pornește din capătul liniei principale). Ramurile blocate se sar. */
export function fanPaths(s, x, y, dir, A, rows, by, h0) {
  const f = frameOf(dir), w = s.w, R = Math.min(3, rows), out = [];
  const at = (a, c) => [x + f.ax * a + f.cx * c, y + f.ay * a + f.cy * c];
  const free = ([tx, ty]) => {
    if (tx < 0 || ty < 0 || tx >= w || ty >= s.h) return false;
    const i = ty * w + tx, t = s.track[i];
    if (s.water[i] || s.height[i] <= WATER_H || s.occ[i] || s.stm[i]) return false;
    if ((t & T_PRESENT) && ((t >> T_OWNER_SHIFT) & 7) !== by) return false;
    return Math.abs(s.height[i] - h0) <= 1;
  };
  for (const e of [-1, 1]) {
    const a0 = e * FAN_AT, lead = [];
    for (let a = A; a <= FAN_AT; a++) lead.push(at(e * a, 0)); // linia principală merge drept până la evantai (dincolo de cea mai lungă gară)
    if (!lead.slice(1).every(free)) continue;
    for (let r = 0; r <= R; r++) {
      const p = lead.slice();
      for (let i = 1; i <= r; i++) p.push(at(a0 + e * i, i)); // diagonala macazelor
      for (let k = 1; k <= STUB; k++) p.push(at(a0 + e * (r + k), r)); // capătul drept, de legat
      if (p.slice(1).every(free)) out.push(p);
    }
  }
  return out;
}

/** Capetele libere ale intrărilor (unde legi șina), pentru indicii pe hartă. */
export const fanEnds = (paths) => paths.map((p) => p[p.length - 1]);
