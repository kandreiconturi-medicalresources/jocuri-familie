// Numere aleatoare din starea jocului: avansează s.rng (determinist, salvat în stare).
import { rng } from '../../../../shared/engine/rng.js';

/** Un rng nou derivat din s.rng; s.rng avansează, deci fiecare apel dă alt rezultat. */
export function fork(s) {
  const r = rng(s.rng);
  s.rng = (r.int(0, 0x7fffffff) ^ 0x2545f491) >>> 0;
  return r;
}
/** Număr întreg 0..n-1. */
export const roll = (s, n) => fork(s).int(0, n - 1);
