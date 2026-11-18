// Semnalizare simplă: plăcile de șină ocupate de trenuri (derivat, nu se salvează). Gările nu blochează.
import { markLanes } from './laneGeo.js';
const CAR_GAP = 218;
export const tailTiles = (t) => (((t.cars + 1) * CAR_GAP + 255) >> 8) + 1;

/** Marchează (+1) sau demarchează (-1) plăcile ocupate de un tren în mișcare: de la coadă până la placa spre care merge. */
export function mark(s, t, d) {
  if (t.state !== 1 || t.path.length < 2) return;
  const hi = Math.min(t.path.length - 1, t.seg + 1), lo = Math.max(0, t.seg - tailTiles(t));
  for (let k = lo; k <= hi; k++) { const i = t.path[k]; if (!s.stm[i]) s.blk[i] += d; }
}

export const blocked = (s, i) => !s.stm[i] && s.blk[i] > 0;

export function rebuildBlocks(s) {
  s.blk = new Uint8Array(s.w * s.h);
  s.stm = new Uint8Array(s.w * s.h);
  for (const st of s.stations) s.stm[st.y * s.w + st.x] = 1;
  for (const d of s.depots || []) s.stm[d.y * s.w + d.x] = 1; // depoul se poartă ca o gară: intrarea e un singur loc
  markLanes(s); // peroanele liniilor independente ale gărilor mari (câte un loc pe linie)
  for (const t of s.trains) mark(s, t, 1);
}

/** Câte legături are o placă de șină (0–8): 3 sau mai multe = macaz. */
export function linkCount(t) { let c = 0; for (let d = 0; d < 8; d++) c += (t >> d) & 1; return c; }
