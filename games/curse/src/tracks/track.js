// Date derivate dintr-o pistă: linia centrală, curbură, limite de viteză pentru boți, interogare „unde sunt pe pistă”. Pur.
import { walk, resample } from './layout.js';
import { ROAD_HALF } from './pieces.js';

export const A_LAT = 24;    // accelerația laterală pe care o suportă boții (m/s²)
export const V_TOP = 30;    // viteza maximă fără nitro (m/s)
const BRAKE_AI = 15;        // cât de tare frânează boții când pregătesc un viraj (m/s²)

const wrap = (i, n) => ((i % n) + n) % n;

export function createTrack(def) {
  const w = walk(def.tokens);
  const { pts, length, ds } = resample(w.raw, w.lineAt);
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[wrap(i - 1, n)], b = pts[wrap(i + 1, n)];
    const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    pts[i].tx = (b.x - a.x) / l; pts[i].tz = (b.z - a.z) / l;
  }
  // curbură semnată (+ = spre dreapta), netezită pe ±3 puncte
  const raw = pts.map((p, i) => {
    const q = pts[wrap(i + 1, n)];
    const cr = p.tx * q.tz - p.tz * q.tx, dt = p.tx * q.tx + p.tz * q.tz;
    return Math.atan2(cr, dt) / ds;
  });
  const K = 3;
  pts.forEach((p, i) => { let s = 0; for (let j = -K; j <= K; j++) s += raw[wrap(i + j, n)]; p.k = s / (2 * K + 1); });
  // limita de viteză: din curbură, apoi frânare în față (parcurgem de două ori ca să închidem bucla)
  const vmax = pts.map((p) => Math.min(V_TOP, Math.sqrt(A_LAT / Math.max(1e-4, Math.abs(p.k)))));
  for (let pass = 0; pass < 2 * n; pass++) {
    const i = wrap(-pass - 1, n), j = wrap(i + 1, n);
    const lim = Math.sqrt(vmax[j] * vmax[j] + 2 * BRAKE_AI * ds);
    if (vmax[i] > lim) vmax[i] = lim;
  }
  pts.forEach((p, i) => { p.v = vmax[i]; });

  /** Cel mai apropiat punct al liniei centrale; `hint` = indicele anterior (căutare în fereastră), -1 = căutare completă. */
  function query(x, z, hint = -1, win = 24) {
    let best = 0, bd = Infinity;
    const full = hint < 0, cnt = full ? n : 2 * win + 1;
    for (let o = 0; o < cnt; o++) {
      const i = full ? o : wrap(hint - win + o, n), p = pts[i];
      const d2 = (x - p.x) * (x - p.x) + (z - p.z) * (z - p.z);
      if (d2 < bd) { bd = d2; best = i; }
    }
    const p = pts[best];
    const t = (x - p.x) * p.tx + (z - p.z) * p.tz; // proiecția pe tangentă (sub un pas)
    const s = (((p.s + t) % length) + length) % length;
    const d = (x - p.x) * -p.tz + (z - p.z) * p.tx; // + = la dreapta liniei
    const q = t >= 0 ? pts[wrap(best + 1, n)] : pts[wrap(best - 1, n)];
    const y = p.y + (q.y - p.y) * Math.min(1, Math.abs(t) / ds);
    return { i: best, s, d, y, tx: p.tx, tz: p.tz, k: p.k };
  }

  /** Poziție de start: `k` = locul pe grilă (0 = în față, două coloane). */
  function gridSlot(k) {
    const back = 5 + k * 6.5;
    const i = wrap(-Math.round(back / ds), n), p = pts[i];
    const side = (k % 2 ? 1 : -1) * 1.7;
    return { x: p.x - p.tz * side, z: p.z + p.tx * side, angle: Math.atan2(p.tx, -p.tz), s: length - back, i };
  }

  return { def, pts, n, length, ds, placed: w.placed, query, gridSlot, half: ROAD_HALF, wrap: (i) => wrap(i, n) };
}
