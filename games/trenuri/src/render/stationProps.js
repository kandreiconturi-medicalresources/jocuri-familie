// Mobilier de peron (bănci, felinare, ceas, intrare în pasaj subteran, copertină), generic: axa lungă (tx,tz) în plan, y = fața peronului.
const STEEL = '#4a525c', WOOD = '#8a5a32';

export function bench(B, x, y, z, tx, tz) {
  const rx = -tz, rz = tx;
  B.obox(x, y + 0.04, z, tx, tz, 0.055, 0.017, 0.004, WOOD);
  B.obox(x + rx * 0.018, y + 0.066, z + rz * 0.018, tx, tz, 0.055, 0.003, 0.02, WOOD);
  for (const s of [-1, 1]) B.obox(x + tx * s * 0.045, y + 0.02, z + tz * s * 0.045, tx, tz, 0.004, 0.015, 0.02, '#2d3238');
}
export function lamp(B, x, y, z) {
  B.obox(x, y + 0.14, z, 0, 1, 0.006, 0.006, 0.14, STEEL);
  B.obox(x, y + 0.3, z, 0, 1, 0.03, 0.03, 0.006, STEEL);
  B.obox(x, y + 0.287, z, 0, 1, 0.022, 0.022, 0.008, '#ffe9a8');
}
/** Ceas de peron: stâlp cu fața pătrată (față către ambele capete ale peronului). */
export function clock(B, x, y, z, tx, tz) {
  B.obox(x, y + 0.11, z, 0, 1, 0.005, 0.005, 0.11, STEEL);
  B.obox(x, y + 0.25, z, tx, tz, 0.012, 0.042, 0.042, STEEL);
  B.obox(x, y + 0.25, z, tx, tz, 0.014, 0.034, 0.034, '#f6f3ea');
  B.obox(x, y + 0.255, z, tx, tz, 0.016, 0.003, 0.016, '#2a2a2a');
}
/** Intrare în pasaj: casa scării cu acoperiș, deschidere întunecată și balustrade galbene. */
export function stairs(B, x, y, z, tx, tz, roof = '#b8503e') {
  const rx = -tz, rz = tx;
  B.obox(x, y + 0.003, z, tx, tz, 0.075, 0.06, 0.003, '#24262c');
  for (const s of [-1, 1]) {
    B.obox(x + rx * s * 0.068, y + 0.075, z + rz * s * 0.068, tx, tz, 0.075, 0.006, 0.075, '#d9d1c2');
    B.obox(x + tx * s * 0.07, y + 0.075, z + tz * s * 0.07, tx, tz, 0.005, 0.06, 0.075, '#d9d1c2');
  }
  B.obox(x, y + 0.165, z, tx, tz, 0.085, 0.078, 0.008, roof);
  B.obox(x, y + 0.015, z + 0, tx, tz, 0.06, 0.05, 0.002, '#9a9488');
}
/** Copertină: acoperiș plat pe stâlpi, peste un peron de lungime 2·hl și lățime 2·hw. */
export function canopy(B, x, y, z, tx, tz, hl, hw, h, col, trim) {
  const rx = -tz, rz = tx;
  B.obox(x, y + h, z, tx, tz, hl, hw, 0.007, col);
  B.obox(x, y + h - 0.01, z, tx, tz, hl + 0.005, hw + 0.005, 0.005, trim);
  for (const s of [-0.8, 0, 0.8]) for (const r of [-1, 1]) B.obox(x + tx * hl * s + rx * hw * 0.7 * r, y + h / 2, z + tz * hl * s + rz * hw * 0.7 * r, 0, 1, 0.005, 0.005, h / 2, STEEL);
}
