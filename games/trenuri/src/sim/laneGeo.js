// Liniile independente ale gării mari de trecere (`st.ln = 1`, la intrări separate și la culoar): linia k stă pe rândul de plăci k
// (0 = linia principală, spre `dir`), dreaptă prin tot corpul gării și mai departe până la macazul ei din evantai (a = ±(FAN_AT + k)).
// Peronul liniei k e placa P_k (a = 0, rândul k): toate peroanele sunt ale aceleiași gări (același id), dar fiecare e un loc separat
// (`stm`, câte un tren), deci n trenuri pe n linii opresc deodată fără să atingă vreo placă a altei linii.
// Totul se deduce din gară (x, y, dir, platforms): straturile `stAt` și `stm` ale peroanelor se refac la încărcare.
import { frameOf } from './terminal.js';
import { T_PRESENT } from './consts.js';

export const FAN_AT = 5; // evantaiul (macazele scării) începe la 5 plăci de gară
/** Jumătatea lungimii corpului gării (în plăci) de-a lungul liniei: 7 plăci, 9 la peste 6 linii. */
export const halfLen = (n) => (n > 6 ? 4 : 3);

/** Placa (indice) a peronului liniei k. */
export function platAt(s, st, k) {
  const f = frameOf(st.dir);
  return (st.y + f.cy * k) * s.w + st.x + f.cx * k;
}
/** Peroanele gării: la liniile independente câte unul pe linie (P_0 = placa gării), altfel doar placa gării. */
export function platsOf(s, st) {
  if (!st.ln) return [st.y * s.w + st.x];
  const out = [];
  for (let k = 0; k < st.platforms; k++) out.push(platAt(s, st, k));
  return out;
}
/** Linia k pe latura e (±1), de la peron (a = 0) până la a = e·to: [[x, y], ...] (în hartă sau nu). */
export function innerPath(x, y, dir, k, e, to) {
  const f = frameOf(dir), out = [];
  for (let a = 0; a <= to; a++) out.push([x + f.ax * e * a + f.cx * k, y + f.ay * e * a + f.cy * k]);
  return out;
}
/** Rândul (linia) plăcii i față de gara st (0..n-1), sau -1 dacă nu e pe o linie a gării. */
export function laneOfTile(s, st, i) {
  const f = frameOf(st.dir), x = i % s.w, y = (i / s.w) | 0, k = (x - st.x) * f.cx + (y - st.y) * f.cy;
  return k >= 0 && k < (st.platforms | 0) ? k : -1;
}

/** Strat derivat (după `stm`): `stAt[i]` = id gară + 1 pe liniile ei (corp + calea până la macaz); peroanele P_k (k ≥ 1) devin locuri de gară. */
export function markLanes(s) {
  s.stAt = new Int32Array(s.w * s.h);
  for (const st of s.stations) {
    if (!st.ln) continue;
    const n = st.platforms, A = halfLen(n);
    for (let k = 0; k < n; k++) {
      for (const e of [-1, 1]) for (const [x, y] of innerPath(st.x, st.y, st.dir, k, e, k ? FAN_AT + k : A)) {
        if (x < 0 || y < 0 || x >= s.w || y >= s.h) continue;
        const i = y * s.w + x;
        if (s.track[i] & T_PRESENT) s.stAt[i] = st.id + 1;
      }
      if (k) { const i = platAt(s, st, k); if (i >= 0 && i < s.stm.length) s.stm[i] = 1; }
    }
  }
}
