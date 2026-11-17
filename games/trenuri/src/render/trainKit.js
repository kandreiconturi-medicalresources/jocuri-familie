// Piese de construcție pentru trenurile procedurale (fără modele externe): prisme, loft, cilindri, roți, boghiuri,
// tampoane, pantograf, geamuri. Spațiu local: y în sus, z înainte (față = +z), x lateral; roțile ating y = 0.
import { Builder } from './geo.js';

export const PAL = {
  steel: '#2a2d33', dark: '#16181c', iron: '#3a3f47', brass: '#c79a3a', silver: '#b9c2cc', rubber: '#101114',
  glass: '#1d2f44', glassHi: '#3c5f86', white: '#eef1f5', cream: '#e6dcc2', lamp: '#fff3c4', red: '#c0392b',
};
export { Builder };

/** Contur simetric din punctele din dreapta [[x, y], ...] (jos → sus): le oglindește în stânga. */
export const sym = (right) => [...right, ...right.map(([x, y]) => [-x, y]).reverse()];

const centroid = (pr) => { let x = 0, y = 0; for (const p of pr) { x += p[0]; y += p[1]; } return [x / pr.length, y / pr.length]; };
/** Semnul ariei conturului (+1 = antiorar în (x, y)): cu el normala exterioară a unei muchii a→b e (by − ay, −(bx − ax)) · semn, corectă și la contururi concave. */
const orient = (pr) => { let a = 0; for (let i = 0; i < pr.length; i++) { const p = pr[i], q = pr[(i + 1) % pr.length]; a += p[0] * q[1] - q[0] * p[1]; } return a >= 0 ? 1 : -1; };
const outward = (a, b, sg) => [(b[1] - a[1]) * sg, -(b[0] - a[0]) * sg, 0];
const colAt = (col, i) => (Array.isArray(col) ? col[i % col.length] : col);

/** Prismă convexă extrudată pe z între z0 și z1 (capace opționale). col poate fi un tablou: o culoare pe muchie. */
export function prism(B, pr, z0, z1, col, caps = 3) {
  const [cx, cy] = centroid(pr), n = pr.length, sg = orient(pr);
  for (let i = 0; i < n; i++) {
    const a = pr[i], b = pr[(i + 1) % n];
    B.quad([a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1], colAt(col, i), outward(a, b, sg));
  }
  const cap = (z, k, c) => { for (let i = 0; i < n; i++) B.tri([cx, cy, z], [pr[i][0], pr[i][1], z], [pr[(i + 1) % n][0], pr[(i + 1) % n][1], z], c, [0, 0, k]); };
  if (caps & 1) cap(z0, -1, colAt(col, 0));
  if (caps & 2) cap(z1, 1, colAt(col, 0));
}

/** Loft între două contururi cu același număr de puncte (A la zA, B la zB); capacul de la zB opțional. */
export function loft(B, pa, za, pb, zb, col, cap = null) {
  const n = pa.length, sg = orient(pa);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, a = pa[i], b = pa[j], c = pb[j], d = pb[i];
    B.quad([a[0], a[1], za], [b[0], b[1], za], [c[0], c[1], zb], [d[0], d[1], zb], colAt(col, i), outward(a, b, sg));
  }
  if (cap) { const [qx, qy] = centroid(pb); for (let i = 0; i < n; i++) B.tri([qx, qy, zb], [pb[i][0], pb[i][1], zb], [pb[(i + 1) % n][0], pb[(i + 1) % n][1], zb], cap, [0, 0, zb >= za ? 1 : -1]); }
}

/** Cilindru (con) între două puncte; caps: 1 = la p0, 2 = la p1. */
export function cyl(B, p0, p1, r0, r1, seg, col, caps = 3) {
  let dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2];
  const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
  let ux = 0, uy = 1, uz = 0; if (Math.abs(dy) > 0.9) { ux = 1; uy = 0; }
  let vx = dy * uz - dz * uy, vy = dz * ux - dx * uz, vz = dx * uy - dy * ux; const vl = Math.hypot(vx, vy, vz) || 1; vx /= vl; vy /= vl; vz /= vl;
  ux = vy * dz - vz * dy; uy = vz * dx - vx * dz; uz = vx * dy - vy * dx;
  const ring = (p, r, k) => { const a = k / seg * Math.PI * 2, c = Math.cos(a) * r, s = Math.sin(a) * r; return [p[0] + ux * c + vx * s, p[1] + uy * c + vy * s, p[2] + uz * c + vz * s]; };
  for (let k = 0; k < seg; k++) {
    const a = ring(p0, r0, k), b = ring(p0, r0, k + 1), c = ring(p1, r1, k + 1), d = ring(p1, r1, k);
    const m = ring(p0, 1, k + 0.5);
    B.quad(a, b, c, d, col, [m[0] - p0[0], m[1] - p0[1], m[2] - p0[2]]);
    if (caps & 1) B.tri(p0, a, b, col, [-dx, -dy, -dz]);
    if (caps & 2) B.tri(p1, d, c, col, [dx, dy, dz]);
  }
}

/** Cutie aliniată pe axe: centru, semi-dimensiuni (x, y, z). */
export const slab = (B, cx, cy, cz, hx, hy, hz, col, bottom = false) => B.obox(cx, cy, cz, 0, 1, hz, hx, hy, col, bottom);

/** Roată (axa pe x): raza r, la (x, r, z); fața exterioară are butuc colorat. */
export function wheel(B, x, z, r, side, col = PAL.steel, hub = PAL.brass, seg = 9, y = r) {
  const o = side * 0.045;
  cyl(B, [x - o, y, z], [x + o, y, z], r, r, seg, col, 2);
  cyl(B, [x + o, y, z], [x + o + side * 0.012, y, z], r * 0.42, r * 0.42, 6, hub, 2);
}

/** Boghiu: ramă + osii cu roți (nr osii), cutii de unsoare; x lateral = hw. */
export function bogie(B, z, hw, r = 0.17, axles = 2, span = 0.2, seg = 9) {
  slab(B, 0, r + 0.07, z, hw - 0.1, 0.045, span + 0.14, PAL.dark);
  slab(B, 0, r + 0.02, z, 0.06, 0.04, span + 0.1, PAL.iron);
  for (let a = 0; a < axles; a++) {
    const zz = z + (axles === 1 ? 0 : (a / (axles - 1) - 0.5) * 2 * span);
    cyl(B, [-hw + 0.1, r, zz], [hw - 0.1, r, zz], 0.03, 0.03, 5, PAL.iron, 0);
    for (const s of [-1, 1]) { wheel(B, s * (hw - 0.07), zz, r, s, PAL.steel, PAL.silver, seg); slab(B, s * (hw - 0.1), r, zz, 0.025, 0.04, 0.05, PAL.iron); }
  }
}

/** Tampoane + cuplaj la capătul z (semn sg = ±1). */
export function ends(B, z, sg, hw = 0.4) {
  slab(B, 0, 0.36, z, hw, 0.05, 0.025, PAL.dark);
  for (const s of [-1, 1]) { cyl(B, [s * hw * 0.62, 0.36, z], [s * hw * 0.62, 0.36, z + sg * 0.1], 0.03, 0.03, 5, PAL.iron, 0); slab(B, s * hw * 0.62, 0.36, z + sg * 0.12, 0.06, 0.045, 0.012, PAL.silver); }
  slab(B, 0, 0.3, z + sg * 0.07, 0.025, 0.02, 0.09, PAL.iron);
}

/** Șir de geamuri pe ambele laturi: n geamuri între z0 și z1, la înălțimea y0..y1, pe planul x = ±px. */
export function windows(B, px, z0, z1, y0, y1, n, col = PAL.glass, fill = 0.72, hi = PAL.glassHi) {
  const st = (z1 - z0) / n;
  for (let i = 0; i < n; i++) {
    const a = z0 + i * st + st * (1 - fill) / 2, b = a + st * fill;
    for (const s of [-1, 1]) {
      const x = s * px;
      B.quad([x, y0, a], [x, y1, a], [x, y1, b], [x, y0, b], col, [s, 0, 0]);
      B.quad([x + s * 0.002, y1 - (y1 - y0) * 0.28, a], [x + s * 0.002, y1, a], [x + s * 0.002, y1, b], [x + s * 0.002, y1 - (y1 - y0) * 0.28, b], hi, [s, 0, 0]);
    }
  }
}

/** Pantograf: baza pe acoperiș la (0, y, z); brațe în romb + cap cu contact. */
export function pantograph(B, y, z, h = 0.5, col = PAL.iron) {
  slab(B, 0, y + 0.02, z, 0.2, 0.02, 0.2, PAL.dark);
  for (const s of [-1, 1]) {
    const x = s * 0.12;
    cyl(B, [x, y + 0.03, z - 0.14], [s * 0.02, y + h * 0.5, z + 0.04], 0.014, 0.014, 4, col, 0);
    cyl(B, [s * 0.02, y + h * 0.5, z + 0.04], [x, y + h, z - 0.02], 0.012, 0.012, 4, col, 0);
  }
  slab(B, 0, y + h + 0.01, z - 0.02, 0.3, 0.012, 0.045, PAL.silver);
  for (const s of [-1, 1]) slab(B, s * 0.3, y + h - 0.01, z - 0.02, 0.012, 0.03, 0.045, PAL.dark);
}

/** Far (lampă): cutie mică în constructorul de lumini (material emisiv). */
export const lamp = (L, x, y, z, hx = 0.05, hy = 0.04, col = PAL.lamp) => slab(L, x, y, z, hx, hy, 0.012, col);
