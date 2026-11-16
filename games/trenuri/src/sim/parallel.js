// Linie dublă și ramificații: secțiune de șină între două plăci, șina paralelă și macazurile (plăci cu 3+ legături).
import { DX, DY, T_PRESENT } from './consts.js';
import { planTrack } from './plan.js';
import { findRail } from './trains.js';
import { linkCount } from './blocks.js';

/** Plăcile de șină (existentă) pe cel mai scurt drum între două plăci, ca [[x,y],...]; null dacă nu sunt legate. */
export function trackSection(s, a, b) {
  const ia = a[1] * s.w + a[0], ib = b[1] * s.w + b[0];
  if (!(s.track[ia] & T_PRESENT) || !(s.track[ib] & T_PRESENT) || ia === ib) return null;
  const p = findRail(s, ia, ib);
  return p ? p.map((i) => [i % s.w, (i / s.w) | 0]) : null;
}

/** Șină paralelă la o placă distanță (side = 1 sau -1). Se desparte de cea veche la a doua placă și se alătură la penultima (acolo apar macazurile; gările rămân pe linia veche). Ocolește clădiri și apă. { path, cost } sau null. */
export function parallelPlan(s, section, side, by) {
  if (!section || section.length < 4) return null;
  const path = section.slice(1, -1);
  const prefer = new Set(), n = path.length;
  const add = (p, dx, dy) => {
    const x = p[0] + side * -dy, y = p[1] + side * dx;
    if (x >= 0 && y >= 0 && x < s.w && y < s.h) prefer.add(y * s.w + x);
  };
  for (let k = 0; k < n; k++) {
    if (k + 1 < n) add(path[k], path[k + 1][0] - path[k][0], path[k + 1][1] - path[k][1]);
    if (k > 0) add(path[k], path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]);
  }
  return planTrack(s, path[0], path[n - 1], by, { reuse: false, prefer });
}

export const links = linkCount;
/** Macazurile: plăcile unde șina se desparte (3 sau mai multe legături). */
export function switches(s) {
  const out = [];
  for (let i = 0; i < s.track.length; i++) if ((s.track[i] & T_PRESENT) && links(s.track[i]) >= 3) out.push([i % s.w, (i / s.w) | 0]);
  return out;
}
export const neighbours = (x, y) => DX.map((dx, d) => [x + dx, y + DY[d]]);
