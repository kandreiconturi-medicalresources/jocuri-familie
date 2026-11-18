// Rutare inteligentă: când blocul din față e ținut de alt tren, trenul caută imediat un drum spre țintă al cărui bloc următor e liber
// (al doilea fir al stației de încrucișare, linia paralelă, traversarea), cel mai scurt dintre ele. Numai întregi, ordine deterministă.
import { findRail, segLen } from './trains.js';
import { blocked, linkCount, tailTiles } from './blocks.js';
import { pfull, canReserve, releaseFrom, blockEnd } from './reserve.js';
import { SIG_ALT } from './consts.js';
import { destOf } from './lanes.js';

const H = 14; // orizontul (plăci): ce e ocupat mai departe se eliberează până ajunge trenul
const pathLen = (w, p) => { let L = 0; for (let k = 0; k + 1 < p.length; k++) L += segLen(w, p, k); return L; };

/** Trenul (real) care ține placa i: rezervare sau trup pe linie; null dacă nu e niciunul. */
function holderOf(s, t, i) {
  if (!s.stm[i] && s.resv[i] && s.resv[i] !== t.id + 1) { const o = s.trains.find((q) => q.id === s.resv[i] - 1); if (o) return o; }
  if (blocked(s, i)) {
    for (const o of s.trains) {
      if (o === t || o.state !== 1) continue;
      const k = o.path.indexOf(i, Math.max(0, o.seg - tailTiles(o)));
      if (k >= 0 && k <= o.seg + 1) return o;
    }
  }
  return null;
}

/** Cine ține blocul de la j (și linia simplă de după el, unde nu se poate încrucișa): trenul, sau null. */
export function blockerOf(s, t, path, j) {
  if (!path || j >= path.length) return null;
  const m = blockEnd(s, path, j);
  for (let k = j; k < path.length; k++) {
    const i = path[k];
    if (k > m && (s.stm[i] || linkCount(s.track[i]) > 2)) break;
    const o = holderOf(s, t, i);
    if (o) return o;
  }
  return null;
}

/** Ocolește pe linia liberă: true dacă a schimbat drumul (blocul nou e liber acum). Doar pentru blocuri ținute de alte trenuri. */
export function smartReroute(s, t) {
  const last = t.path.length - 1, j = t.seg + 2;
  if (j > last || t.tow || !blockerOf(s, t, t.path, j)) return false;
  const w = s.w, here = t.path[t.seg + 1], back = t.path[t.seg], D = destOf(s, t), hx = here % w, hy = (here / w) | 0;
  const near = (i) => Math.max(Math.abs((i % w) - hx), Math.abs(((i / w) | 0) - hy)) <= H;
  const bad = (i) => pfull(s, i) || (!s.stm[i] && (blocked(s, i) || (s.resv[i] && s.resv[i] !== t.id + 1)));
  const alt = findRail(s, here, D.g, (i) => i === back || (near(i) && bad(i)), D.pen);
  if (!alt || alt.length < 2) return false;
  const path = t.path.slice(0, j).concat(alt.slice(1));
  if (path.length === t.path.length && path.every((v, k) => v === t.path[k])) return false;
  const done = pathLen(w, t.path.slice(0, t.seg + 1)) + t.pos, L = pathLen(w, path);
  if (L - done > t.left + (t.left >> 1) + 1024) return false; // ocol prea mare: mai bine așteaptă
  if (canReserve(s, t, path, j) < 0) return false;
  releaseFrom(s, t, j);
  t.path = path; t.left = L - done; t.rr = s.tick + 1;
  return true;
}

/** De ce stă trenul (pentru panou și etichetă), în română; null dacă merge normal. */
export function waitReason(s, t) {
  if (t.rr && s.tick + 1 - t.rr < 40 && t.state === 1) return '🔀 Ocolește pe linia liberă';
  if (t.state !== 1 || t.speed > 0 || !t.hold || t.broken || t.dead) return null;
  const o = blockerOf(s, t, t.path, t.seg + 2), by = o ? ` (trenul ${o.id})` : '';
  if (t.redAt) return `🔴 Așteaptă la semnal: linia din față e ocupată${by}${t.hold >= SIG_ALT ? ' · caută alt drum' : ''}`;
  return `🚧 Așteaptă: în față e alt tren${by}`;
}
