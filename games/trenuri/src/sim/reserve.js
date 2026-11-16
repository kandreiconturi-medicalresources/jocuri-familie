// Rezervarea traseului: un tren cere plăcile de la semnal până la următorul semnal; le primește doar dacă toate sunt libere.
// `s.resv[i]` = id tren + 1 (derivat din `t.rv`); `s.pocc[i]` = câte trenuri țin un peron la gara de pe placa i. Plăcile se eliberează după coadă.
import { blocked, tailTiles } from './blocks.js';
import { dirOf } from './signals.js';
import { SIG_OVER } from './consts.js';

export const GO = 0, BLOCKED = 1, RED = 2;

export function rebuildReserve(s) {
  s.resv = new Uint16Array(s.w * s.h);
  s.pocc = new Uint8Array(s.w * s.h);
  for (const t of s.trains) {
    if (!t.rv) t.rv = [];
    for (const i of t.rv) { if (s.stm[i]) s.pocc[i]++; else s.resv[i] = t.id + 1; }
  }
}

const platformsAt = (s, i) => { const st = s.stations.find((q) => q.y * s.w + q.x === i); return st ? st.platforms || 1 : 1; };
/** Gara de pe placa i are toate peroanele ocupate (rezervate)? */
export const pfull = (s, i) => s.stm[i] === 1 && s.pocc[i] >= platformsAt(s, i);
const holds = (s, t, i) => (s.stm[i] ? t.rv.includes(i) : s.resv[i] === t.id + 1);
const signalled = (s, path, k) => k > 0 && ((s.sgm[path[k]] >> dirOf(s.w, path[k - 1], path[k])) & 1) === 1;

/** Ține un loc (placă de șină sau peron) pentru tren. */
export function hold(s, t, i) {
  if (t.rv.includes(i)) return;
  t.rv.push(i);
  if (s.stm[i]) s.pocc[i]++; else s.resv[i] = t.id + 1;
}
export function free(s, t, i) {
  const k = t.rv.indexOf(i);
  if (k < 0) return;
  t.rv.splice(k, 1);
  if (s.stm[i]) s.pocc[i]--; else s.resv[i] = 0;
}

/** Cere rezervarea de la placa j până înaintea următorului semnal (sau capătul drumului). */
function reserve(s, t, path, j) {
  const over = t.hold >= SIG_OVER; // după o așteptare lungă intră și când peroanele sunt pline (altfel două trenuri față în față s-ar bloca)
  let m = j;
  while (m + 1 < path.length && !signalled(s, path, m + 1)) m++;
  for (let k = j; k <= m; k++) {
    const i = path[k];
    if (holds(s, t, i)) continue;
    if (s.stm[i]) { if (!over && s.pocc[i] >= platformsAt(s, i)) return false; } else if ((s.resv[i] && s.resv[i] !== t.id + 1) || blocked(s, i)) return false;
  }
  for (let k = j; k <= m; k++) hold(s, t, path[k]);
  return true;
}

/** Poate trenul să intre pe placa path[j]? GO, BLOCKED (ocupată fizic) sau RED (semnal roșu / rezervată de altul). `force`: semnal de plecare din gară. */
export function enter(s, t, path, j, force = false) {
  const i = path[j];
  if (blocked(s, i)) return BLOCKED;
  if (holds(s, t, i)) return GO;
  if (force || signalled(s, path, j)) return reserve(s, t, path, j) ? GO : RED;
  return !s.stm[i] && s.resv[i] && s.resv[i] !== t.id + 1 ? RED : GO;
}

/** Eliberează plăcile rămase în urma cozii. */
export function releaseTail(s, t) {
  if (!t.rv.length) return;
  const lo = Math.max(0, t.seg - tailTiles(t));
  for (; t.rl < lo; t.rl++) free(s, t, t.path[t.rl]);
}
/** Eliberează tot ce e la indicele `from` sau după el în drum (înainte de a schimba drumul). */
export function releaseFrom(s, t, from) {
  if (!t.rv.length) return;
  for (let k = Math.max(from, 0); k < t.path.length; k++) free(s, t, t.path[k]);
}
/** Eliberează toate rezervările (tren vândut). */
export function releaseAll(s, t) { for (const i of t.rv.slice()) free(s, t, i); }
/** La sosire în gară: rămâne doar peronul. */
export function holdOnlyStation(s, t) {
  const last = t.path[t.path.length - 1];
  for (const i of t.rv.slice()) if (i !== last) free(s, t, i);
  hold(s, t, last);
  t.rl = 0; t.redAt = 0;
}
