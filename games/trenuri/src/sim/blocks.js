// Semnalizare simplă: plăcile de șină ocupate de trenuri (derivat, nu se salvează). Gările nu blochează.
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
  for (const t of s.trains) mark(s, t, 1);
}
