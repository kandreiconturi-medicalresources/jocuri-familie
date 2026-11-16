// Terminalul mare: o curte de 4×5 plăci lângă placa gării (linii terminale, hală, service, macara).
// Logic rămâne o gară pe o placă (rutele și rezervările nu se schimbă); curtea e teren ocupat, iar terminalul
// are 4–6 peroane, repară trenurile la oprire (service) și încarcă mai repede (macara).
import { DX, DY, WATER_H, T_PRESENT, MODELS } from './consts.js';

export const BIG_COST = 15000, BIG_PLATFORMS = 4, BIG_MAX = 6;
export const YARD_ALONG = [-2, 2], YARD_ACROSS = [1, 4]; // de-a lungul liniei / spre curte

/** Axele terminalului: C = spre curte (dir 0/2/4/6), A = de-a lungul liniei principale. */
export function frameOf(dir) {
  return { cx: DX[dir], cy: DY[dir], ax: DX[(dir + 2) & 7], ay: DY[(dir + 2) & 7] };
}

/** Plăcile curții (în ordine fixă). */
export function yardTiles(x, y, dir) {
  const f = frameOf(dir), out = [];
  for (let c = YARD_ACROSS[0]; c <= YARD_ACROSS[1]; c++) for (let a = YARD_ALONG[0]; a <= YARD_ALONG[1]; a++) out.push([x + f.ax * a + f.cx * c, y + f.ay * a + f.cy * c]);
  return out;
}

/** null dacă se poate pune curtea în direcția dir, altfel motivul. */
export function yardProblem(s, x, y, dir) {
  if (dir !== 0 && dir !== 2 && dir !== 4 && dir !== 6) return 'teren';
  const h0 = s.height[y * s.w + x];
  for (const [tx, ty] of yardTiles(x, y, dir)) {
    if (tx < 0 || ty < 0 || tx >= s.w || ty >= s.h) return 'harta';
    const i = ty * s.w + tx;
    if (s.water[i] || s.height[i] <= WATER_H) return 'teren';
    if (s.occ[i]) return 'cladire';
    if (s.roads[i]) return 'loc'; // drumurile dintre orașe nu se mută
    if (s.track[i] & T_PRESENT) return 'loc';
    if (Math.abs(s.height[i] - h0) > 1) return 'panta';
  }
  return null;
}

/** Prima direcție bună: perpendiculară pe șina care trece deja prin placă, altfel oricare. -1 dacă nu încape. */
export function autoDir(s, x, y) {
  const t = s.track[y * s.w + x] & 0xff;
  let order = [2, 6, 0, 4];
  if (t & 0x11) order = [2, 6]; // șina merge N–S: curtea la est sau vest
  else if (t & 0x44) order = [0, 4];
  else if (t) return -1; // șină pe diagonală: terminalul mare cere o linie dreaptă
  for (const d of order) if (!yardProblem(s, x, y, d)) return d;
  return -1;
}

/** Marchează curțile terminalelor ca ocupate (stratul derivat occ). */
export function markYards(s) {
  for (const st of s.stations) if (st.big) for (const [x, y] of yardTiles(st.x, st.y, st.dir)) s.occ[y * s.w + x] = 1;
}

/** La construire: curtea devine ocupată, pădurea dispare. */
export function claimYard(s, st) {
  for (const [x, y] of yardTiles(st.x, st.y, st.dir)) { const i = y * s.w + x; s.occ[i] = 1; s.forest[i] = 0; }
}
export function freeYard(s, st) {
  for (const [x, y] of yardTiles(st.x, st.y, st.dir)) s.occ[y * s.w + x] = 0;
}

/** Service-ul terminalului: trenul care oprește aici e reparat complet. */
export function terminalService(t) {
  const full = MODELS[t.model].rel;
  if ((t.rel === undefined ? full : t.rel) >= full) return false;
  t.rel = full; t.broken = 0;
  return true;
}
