// Părțile „mari” ale unei gări normale: linii suplimentare cu peroane insulă și copertine între ele, opritoare, scări de pasaj și pasarela peste linii.
import { stairs, canopy, bench, lamp, clock } from './stationProps.js';
import { STEP } from './stationPlan.js';

const CONC = '#cfc7b8', YEL = '#f2c230', WHITE = '#e9edf1', GLASS = '#2c4a66', DARK = '#3a3f46';

/** Linie suplimentară cu pat de balast, traverse și șine; u între a și b, v = decalajul lateral. */
function lane(B, c, y0, a, b, v) {
  const P = (u, dv, y) => { const [x, z] = c.W(u, v + dv); return [x, y, z]; };
  const [cx, cz] = c.W((a + b) / 2, v);
  B.obox(cx, y0 - 0.12, cz, c.ax, c.az, (b - a) / 2, 0.13, 0.15, '#9d9385'); // pat de balast, adânc ca să nu atârne pe pantă
  for (let u = a + 0.08; u < b; u += 0.13) { const [x, z] = c.W(u, v); B.obox(x, y0 + 0.034, z, c.bx, c.bz, 0.011, 0.085, 0.006, '#6e4a2e'); }
  for (const r of [-0.06, 0.06]) B.ribbon([P(a, r, y0 + 0.07), P(b, r, y0 + 0.07)], 0.012, 0, 0.03, '#e9edf3', '#8d939b');
  for (const e of [a, b]) { const [x, z] = c.W(e + (e < 0 ? 0.03 : -0.03), v); B.obox(x, y0 + 0.1, z, c.ax, c.az, 0.008, 0.09, 0.03, '#d63a2a'); } // opritoare
}

/** Peron insulă între linia k-1 și k, cu copertine (lăsând loc pasarelei), scări de pasaj, bănci și felinare. */
function island(B, c, y0, k, own) {
  const { P, top } = c, v = -(k - 0.5) * STEP, a = P.eN, b = P.eP, [mx, mz] = c.W((a + b) / 2, v);
  B.obox(mx, y0 + (top - 0.3) / 2, mz, c.ax, c.az, (b - a) / 2, STEP / 2 - 0.13, (top + 0.3) / 2, CONC);
  for (const e of [-1, 1]) { const [x, z] = c.W((a + b) / 2, v + e * (STEP / 2 - 0.135)); B.obox(x, y0 + top + 0.001, z, c.ax, c.az, (b - a) / 2, 0.008, 0.0025, YEL); }
  const [sx, sz] = c.W(b - 0.13, v); stairs(B, sx, y0 + top, sz, c.ax, c.az);
  const gap = P.bridge === null ? 99 : P.bridge;
  for (let u = a + 0.3; u + 0.8 < b - 0.4; u += 1.7) {
    if (P.bridge !== null && Math.abs(u + 0.4 - P.bridge) < 0.6) continue; // sub pasarelă nu mai e nevoie de acoperiș
    const [qx, qz] = c.W(u + 0.4, v); canopy(B, qx, y0 + top, qz, c.ax, c.az, 0.4, 0.085, 0.27, '#c9d3de', own);
  }
  const [bx, bz] = c.W(a + 0.5, v); bench(B, bx, y0 + top, bz, c.ax, c.az);
  const [lx, lz] = c.W(b - 0.6, v + 0.05); lamp(B, lx, y0 + top, lz);
  if (k === 1) { const [kx, kz] = c.W(a + 0.9, v); clock(B, kx, y0 + top, kz, c.ax, c.az); }
}

/** Pasarelă acoperită: punte vitrată peste toate liniile, cu turnuri de scări la peronul clădirii și la fiecare insulă. */
function footbridge(B, c, y0, own) {
  const { P, top } = c, u = P.bridge, vHi = 0.3, vLo = -(P.lanes - 1.5) * STEP - 0.04, dk = y0 + top + 0.74, hw = 0.065;
  const [mx, mz] = c.W(u, (vHi + vLo) / 2), hl = (vHi - vLo) / 2 + 0.07;
  B.obox(mx, dk, mz, c.bx, c.bz, hl, hw, 0.014, DARK);
  for (const e of [-1, 1]) {
    const [wx, wz] = c.W(u + e * hw, (vHi + vLo) / 2);
    B.obox(wx, dk + 0.06, wz, c.bx, c.bz, hl, 0.006, 0.05, WHITE);
    B.obox(wx + c.ax * e * 0.003, dk + 0.072, wz + c.az * e * 0.003, c.bx, c.bz, hl - 0.03, 0.006, 0.026, GLASS); // bandă de geamuri
  }
  B.obox(mx, dk + 0.12, mz, c.bx, c.bz, hl + 0.01, hw + 0.012, 0.007, own);
  const plats = [0.255]; for (let k = 1; k < P.lanes; k++) plats.push(-(k - 0.5) * STEP);
  for (const v of plats) {
    const [tx, tz] = c.W(u, v), ty = y0 + top + (dk - (y0 + top)) / 2;
    B.obox(tx, ty, tz, c.ax, c.az, hw + 0.006, 0.06, (dk - y0 - top) / 2, WHITE); // turnul de scări
    B.obox(tx, y0 + top + 0.045, tz, c.ax, c.az, hw + 0.008, 0.062, 0.045, GLASS);
    B.obox(tx, dk + 0.12, tz, c.ax, c.az, hw + 0.012, 0.07, 0.007, own);
    const sg = u > 0 ? -1 : 1; // scară cu trepte spre capătul scurt al peronului
    for (let i = 0; i < 6; i++) { const [px, pz] = c.W(u + sg * (hw + 0.04 + i * 0.045), v); B.obox(px, y0 + top + 0.03 + (5 - i) * 0.11, pz, c.ax, c.az, 0.024, 0.04, 0.006, '#9a9488'); }
  }
}

/** Liniile suplimentare, insulele și pasarela unei gări (c = { P, W, ax, az, bx, bz, top }). */
export function extras(B, c, y0, own) {
  const { P } = c;
  for (let k = 1; k < P.lanes; k++) { lane(B, c, y0, P.eN - 0.05, P.eP + 0.05, -k * STEP); island(B, c, y0, k, own); }
  if (P.lanes > 1 && P.bridge !== null) footbridge(B, c, y0, own);
}
