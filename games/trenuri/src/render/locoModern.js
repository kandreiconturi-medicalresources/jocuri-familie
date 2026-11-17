// Locomotive diesel și electrice procedurale: capotă + cabină (diesel), caroserie cu nas aerodinamic în trepte,
// bandă de geamuri, uși, fuste de boghiu, pantograf, rezervoare de hidrogen. Tot într-un singur Builder.
import { PAL, slab, cyl, prism, loft, sym, windows, bogie, ends, pantograph, lamp } from './trainKit.js';

/** Familia „sleek”: nas în trepte (len = lungime, tw/th = lățime/înălțime la vârf). */
export const SLEEK = {
  electric: { hw: 0.46, y1: 1.2, body: '#dcd3b8', roof: '#8b8f93', low: '#4a5a4c', nose: { len: 0.25, tw: 0.9, th: 0.92 }, pan: 1, skirt: 0, roofBox: 0, band: 1 },
  glont: { hw: 0.46, y1: 1.18, body: '#eef1f5', roof: '#c9d0d8', low: '#8c97a4', nose: { len: 0.75, tw: 0.42, th: 0.55 }, pan: 1, skirt: 0, roofBox: 0, band: 2 },
  intercity: { hw: 0.48, y1: 1.24, body: '#dfe3e8', roof: '#9aa3ad', low: '#555d68', nose: { len: 0.55, tw: 0.6, th: 0.72 }, pan: 1, skirt: 1, roofBox: 1, band: 2 },
  tgv: { hw: 0.46, y1: 1.12, body: '#f4f6f9', roof: '#1c2a4a', low: '#1c2a4a', nose: { len: 1.05, tw: 0.22, th: 0.42 }, pan: 1, skirt: 1, roofBox: 0, band: 3 },
  regio: { hw: 0.5, y1: 1.3, body: '#f1f3f6', roof: '#aeb6bf', low: '#5b636d', nose: { len: 0.4, tw: 0.78, th: 0.82 }, pan: 1, skirt: 1, roofBox: 2, band: 4 },
  hidrogen: { hw: 0.48, y1: 1.26, body: '#e3f4f2', roof: '#b8d8d4', low: '#3b6f6a', nose: { len: 0.7, tw: 0.5, th: 0.62 }, pan: 0, skirt: 1, roofBox: 3, band: 3 },
};

export function sleek(B, L, c, key) {
  const o = SLEEK[key], hw = o.hw, y0 = o.skirt ? 0.17 : 0.3, y1 = o.y1, zr = -1.3, nz = o.nose.len, zn0 = 1.3 - nz, H = y1 - y0;
  const prof = (sx, yl, ys) => sym([[hw * 0.95, 0], [hw, 0.1], [hw, H - 0.32], [hw * 0.88, H - 0.1], [hw * 0.5, H]]).map(([x, y]) => [x * sx, yl + y * ys]);
  const body = [o.low, o.body, o.body, o.roof, o.roof, o.roof, o.body, o.body, o.low, PAL.dark];
  const glassTop = body.slice(); glassTop[3] = glassTop[4] = glassTop[5] = PAL.glass;
  const full = prof(1, y0, 1), tip = prof(o.nose.tw, y0 + 0.07, o.nose.th), mid = prof(1 - (1 - o.nose.tw) * 0.45, y0 + 0.03, 1 - (1 - o.nose.th) * 0.5);
  prism(B, full, zr, zn0, body, 1);
  loft(B, full, zn0, mid, zn0 + nz * 0.5, body);
  loft(B, mid, zn0 + nz * 0.5, tip, 1.3, nz > 0.3 ? glassTop : body, o.body);
  const th = o.nose.th * H, tx = hw * o.nose.tw;
  // față: geam, far, număr; spate: ușă de capăt
  slab(B, 0, y0 + 0.07 + th * 0.62, 1.3 + 0.004, tx * 0.82, th * 0.26, 0.004, PAL.glass);
  slab(B, 0, y0 + 0.07 + th * 0.18, 1.3 + 0.004, tx * 0.9, 0.025, 0.004, c);
  for (const s of [-1, 1]) lamp(L, s * tx * 0.66, y0 + 0.07 + th * 0.22, 1.3 + 0.012, 0.045, 0.03);
  slab(B, 0, y0 + 0.07 + th * 0.18, 1.3 + 0.01, 0.07, 0.016, 0.006, PAL.red);
  slab(B, 0, y0 + 0.5, zr - 0.004, 0.2, 0.3, 0.004, PAL.glass);
  for (const s of [-1, 1]) lamp(L, s * hw * 0.7, y0 + 0.12, zr - 0.012, 0.04, 0.025, '#ff3b30');
  // bandă de geamuri, uși, dungi de livrea
  const w0 = zr + 0.68, w1 = zn0 - 0.5, px = hw + 0.003;
  if (w1 - w0 > 0.3) windows(B, px, w0, w1, y0 + 0.3, y0 + 0.62, Math.max(1, Math.round((w1 - w0) / 0.34)), PAL.glass, 0.78, PAL.glassHi);
  for (const s of [-1, 1]) {
    for (const dz of [zr + 0.38, zn0 - 0.3]) { slab(B, s * (hw + 0.004), y0 + 0.38, dz, 0.006, 0.34, 0.15, '#6c7480'); slab(B, s * (hw + 0.009), y0 + 0.5, dz, 0.004, 0.14, 0.07, PAL.glass); }
    const bz0 = zr + 0.02, bz1 = zn0 + nz * 0.35, bh = [0, 0.08, 0.14, 0.2, 0.3][o.band];
    slab(B, s * (hw + 0.002), y0 + 0.11 + bh / 2, (bz0 + bz1) / 2, 0.005, bh / 2 + 0.02, (bz1 - bz0) / 2, c);
    if (o.band >= 3) slab(B, s * (hw + 0.003), y0 + 0.23 + bh, (bz0 + bz1) / 2, 0.004, 0.012, (bz1 - bz0) / 2, PAL.silver);
  }
  // acoperiș: pantograf, echipamente, aer condiționat, rezervoare de hidrogen
  if (o.pan) pantograph(B, y1, zr + 0.8, 0.5);
  if (o.roofBox === 1) slab(B, 0, y1 + 0.04, zn0 - 0.7, 0.2, 0.04, 0.3, '#7d8691');
  if (o.roofBox === 2) for (const zz of [zr + 1.6, zn0 - 0.5]) slab(B, 0, y1 + 0.05, zz, 0.26, 0.05, 0.3, '#8e97a2');
  if (o.roofBox === 3) for (const s of [-1, 1]) { cyl(B, [s * 0.16, y1 + 0.1, zr + 0.5], [s * 0.16, y1 + 0.1, zn0 - 0.3], 0.1, 0.1, 10, PAL.silver, 3); cyl(B, [s * 0.16, y1 + 0.1, zn0 - 0.36], [s * 0.16, y1 + 0.1, zn0 - 0.3], 0.103, 0.103, 10, c, 3); }
  // boghiuri, tampoane
  bogie(B, 0.8 - (nz > 0.6 ? 0.1 : 0), hw + 0.02, 0.17, 2, 0.2, 8);
  bogie(B, -0.8, hw + 0.02, 0.17, 2, 0.2, 8);
  ends(B, zr - 0.02, -1, 0.36);
  if (nz < 0.5) ends(B, 1.32, 1, 0.36);
}

/** Diesel clasic: capotă lungă în față, cabină înaltă, capotă scurtă în spate, grilaje, ventilator, evacuare. */
export function diesel(B, L, c) {
  const body = '#394a3c', hood = '#44594a', dark = '#13141a';
  slab(B, 0, 0.36, 0, 0.47, 0.06, 1.28, PAL.dark);
  slab(B, 0, 0.27, 0, 0.3, 0.07, 0.5, '#232529'); // rezervor de combustibil
  prism(B, sym([[0.42, 0.42], [0.42, 0.82], [0.31, 0.96]]), 0.3, 1.25, [hood, hood, hood, hood, hood, dark], 2);
  prism(B, sym([[0.46, 0.42], [0.46, 1.1], [0.38, 1.24], [0.2, 1.3]]), -0.78, 0.3, [body, body, '#8d9299', '#8d9299', '#8d9299', body, body, dark], 3);
  prism(B, sym([[0.4, 0.42], [0.4, 0.78], [0.3, 0.9]]), -1.25, -0.78, hood, 3);
  slab(B, 0, 0.86, 0.3 + 0.004, 0.2, 0.28, 0.006, PAL.glass); // geam față cabină
  slab(B, 0, 0.5, 0.82, 0.04, 0.02, 0.44, PAL.dark);
  windows(B, 0.465, -0.65, 0.2, 0.8, 1.08, 2, PAL.glass, 0.8);
  windows(B, 0.427, 0.38, 1.16, 0.56, 0.78, 5, '#0d0e12', 0.7, '#2b2f36');
  for (const s of [-1, 1]) {
    slab(B, s * 0.425, 0.5, 0.78, 0.006, 0.07, 0.5, c);
    slab(B, s * 0.468, 0.6, -0.2, 0.006, 0.1, 0.52, c);
    slab(B, s * 0.402, 0.62, -1.02, 0.006, 0.12, 0.2, '#0d0e12');
  }
  cyl(B, [0, 0.9, -1.0], [0, 0.96, -1.0], 0.17, 0.17, 12, '#16171b', 3); // ventilator radiator
  cyl(B, [0, 0.96, 0.68], [0, 1.12, 0.68], 0.05, 0.065, 8, '#101114', 2); // evacuare
  slab(B, 0, 0.7, 1.252, 0.3, 0.2, 0.006, hood); slab(B, 0, 0.62, 1.256, 0.18, 0.04, 0.005, c);
  for (const s of [-1, 1]) lamp(L, s * 0.2, 0.85, 1.262, 0.06, 0.04);
  lamp(L, 0, 0.96, 1.26, 0.05, 0.03);
  slab(B, 0, 1.19, 0.34, 0.1, 0.012, 0.05, PAL.silver); // girofar / semnal
  bogie(B, 0.78, 0.5, 0.2, 2, 0.23, 9); bogie(B, -0.78, 0.5, 0.2, 2, 0.23, 9);
  ends(B, 1.28, 1, 0.38); ends(B, -1.28, -1, 0.38);
}
