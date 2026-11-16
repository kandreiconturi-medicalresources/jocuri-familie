// Semnale de bloc automate pe linie lungă: pe fiecare porțiune de linie simplă (plăci cu exact 2 legături, fără gară) pune un semnal la fiecare N plăci,
// câte unul pentru fiecare sens. Trenurile din același sens merg atunci unul după altul la distanță de un bloc.
import { DX, DY, T_PRESENT } from './consts.js';
import { linkCount } from './blocks.js';

/** Apelează put(placă, direcția de intrare) pentru fiecare semnal de bloc. */
export function blockSignals(s, n, dirOf, put) {
  const { w } = s, seen = new Uint8Array(w * s.h);
  const simple = (i) => (s.track[i] & T_PRESENT) && !s.stm[i] && linkCount(s.track[i]) === 2;
  const nbs = (i) => { const o = []; for (let d = 0; d < 8; d++) if ((s.track[i] >> d) & 1) o.push(i + DY[d] * w + DX[d]); return o; };
  for (let i = 0; i < seen.length; i++) {
    if (seen[i] || !simple(i)) continue;
    seen[i] = 1;
    let run = [i];
    for (let side = 0; side < 2; side++) {
      const part = [];
      let prev = i, cur = nbs(i)[side];
      while (cur !== undefined && simple(cur) && !seen[cur]) {
        seen[cur] = 1; part.push(cur);
        const nx = nbs(cur).find((q) => q !== prev);
        prev = cur; cur = nx;
      }
      run = side === 0 ? part.reverse().concat(run) : run.concat(part);
    }
    for (let k = n; k <= run.length - 2; k += n) { put(run[k], dirOf(w, run[k - 1], run[k])); put(run[k], dirOf(w, run[k + 1], run[k])); }
  }
}
