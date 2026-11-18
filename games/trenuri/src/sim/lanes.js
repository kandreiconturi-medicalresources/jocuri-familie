// Trenurile și liniile independente ale gării mari (`st.ln`, vezi laneGeo.js): de pe ce peron pleacă trenul, spre ce peroane merge
// (oricare peron al gării e „gara X”), care peron e deja luat și schimbarea peronului din mers când al lui s-a ocupat.
// La gările obișnuite nu se schimbă nimic (aceleași drumuri, același hash). Numai întregi, ordine deterministă.
import { platsOf } from './laneGeo.js';
import { findRail, segLen } from './trains.js';
import { releaseFrom } from './reserve.js';

const pathLen = (w, p) => { let L = 0; for (let k = 0; k + 1 < p.length; k++) L += segLen(w, p, k); return L; };
const GOAL_PEN = 4096; // un peron luat costă cât 16 plăci de ocol: se alege peronul liber al liniei vecine

/** Placa de pe care pleacă trenul oprit în gara A (peronul liniei lui). */
export function standAt(s, t, A) {
  const main = A.y * s.w + A.x;
  if (t.org) return t.org - 1;
  if (!A.ln) return main;
  const e = t.path.length ? t.path[t.path.length - 1] : -1;
  return e >= 0 && s.stAt && s.stAt[e] === A.id + 1 && s.stm[e] ? e : main;
}

/** Peronul i e luat pentru trenul t: îl ține alt tren (oprit sau care intră) sau e ținta unui tren care ajunge înaintea lui. */
export function taken(s, t, i) {
  if (s.pocc[i] > 0 && !t.rv.includes(i)) return true;
  const my = t.state === 1 ? t.left : 1e9;
  for (const o of s.trains) {
    if (o === t || o.state !== 1 || o.path[o.path.length - 1] !== i) continue;
    if (o.left < my || (o.left === my && o.id < t.id)) return true;
  }
  return false;
}

/** Țintele drumului spre gara B: { g: placa gării sau lista peroanelor, pen: penalizarea peroanelor luate (null la gările obișnuite) }. */
export function goalsOf(s, t, B) {
  const g = platsOf(s, B);
  if (!B.ln) return { g: g[0], pen: null };
  const bad = new Set(g.filter((i) => taken(s, t, i)));
  return { g, pen: bad.size ? (i) => (bad.has(i) ? GOAL_PEN : 0) : null };
}

/** Ținta drumului curent: dacă trenul merge spre un peron al gării lui (linii independente), oricare peron al ei; altfel capătul drumului. */
export function destOf(s, t) {
  const e = t.path[t.path.length - 1];
  if (!s.stAt || s.stAt[e] !== t.to + 1) return { g: e, pen: null };
  const B = s.stations.find((q) => q.id === t.to);
  return B && B.ln ? goalsOf(s, t, B) : { g: e, pen: null };
}

/** Peronul spre care merge trenul s-a ocupat (sau îl ia un tren mai apropiat): trece pe un peron liber al aceleiași gări, dacă poate. */
export function laneRetarget(s, t) {
  const last = t.path.length - 1, j = t.seg + 2, e = t.path[last];
  if (t.state !== 1 || j > last || !s.stAt || s.stAt[e] !== t.to + 1 || !s.stm[e] || t.rv.includes(e) || !taken(s, t, e)) return false;
  const B = s.stations.find((q) => q.id === t.to);
  if (!B || !B.ln) return false;
  const free = platsOf(s, B).filter((i) => i !== e && !taken(s, t, i));
  if (!free.length) return false;
  const w = s.w, back = t.path[t.seg], here = t.path[t.seg + 1];
  const alt = findRail(s, here, free, (i) => i === back || (s.stm[i] && s.pocc[i] > 0 && !t.rv.includes(i)));
  if (!alt || alt.length < 2) return false;
  const path = t.path.slice(0, j).concat(alt.slice(1)), done = pathLen(w, t.path.slice(0, t.seg + 1)) + t.pos, L = pathLen(w, path);
  if (L - done > t.left + (t.left >> 1) + 1024) return false; // ocol prea mare: mai bine așteaptă peronul lui
  releaseFrom(s, t, j);
  t.path = path; t.left = L - done; t.rr = s.tick + 1;
  return true;
}
