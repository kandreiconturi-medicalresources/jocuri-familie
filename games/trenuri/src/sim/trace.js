// Urma mâinii → plăci. Numai întregi: eșantioane [x,y] (plăci) → Bresenham pe 8 direcții → fără dubluri și întoarceri
// → netezire (medie mobilă pe plăci) → colțurile ascuțite (≥ 90°) devin curbe de 45°.
import { DX, DY } from './consts.js';

const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
export const dirOf = (a, b) => { const dx = Math.sign(b[0] - a[0]), dy = Math.sign(b[1] - a[1]); return DX.findIndex((v, q) => v === dx && DY[q] === dy); };
/** Unghiul dintre două direcții, în pași de 45° (0–4). */
export const turn = (d1, d2) => { const t = (d2 - d1) & 7; return Math.min(t, 8 - t); };

/** Plăcile de la a (exclusiv) la b (inclusiv), pe linie dreaptă (Bresenham). */
export function line(a, b) {
  const out = [];
  let x = a[0], y = a[1];
  const dx = Math.abs(b[0] - x), dy = -Math.abs(b[1] - y), sx = x < b[0] ? 1 : -1, sy = y < b[1] ? 1 : -1;
  let err = dx + dy;
  while (x !== b[0] || y !== b[1]) {
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
    out.push([x, y]);
  }
  return out;
}

/** Linie dreaptă de la a spre b; snap45 = cea mai apropiată dintre cele 8 direcții (lungimea după axa mai lungă). */
export function straight(a, b, snap45 = false) {
  if (!snap45) return line(a, b);
  const dx = b[0] - a[0], dy = b[1] - a[1], ax = Math.abs(dx), ay = Math.abs(dy);
  let sx = Math.sign(dx), sy = Math.sign(dy), n = Math.max(ax, ay);
  if (ay * 2 < ax) { sy = 0; n = ax; } else if (ax * 2 < ay) { sx = 0; n = ay; } else n = Math.max(1, Math.round((ax + ay) / 2));
  return line(a, [a[0] + sx * n, a[1] + sy * n]);
}

/** Adaugă o placă la urmă: fără dubluri; o placă deja în urmă taie bucla sau întoarcerea. `idx` = Map cheie → poziție (ținut de apelant). */
export function pushTile(tiles, idx, w, t) {
  const k = t[1] * w + t[0], j = idx.get(k);
  if (j !== undefined) { for (let q = tiles.length - 1; q > j; q--) idx.delete(tiles[q][1] * w + tiles[q][0]); tiles.length = j + 1; return; }
  idx.set(k, tiles.length); tiles.push(t);
}
/** Extinde urma până la `t` cu Bresenham; întoarce true dacă s-a schimbat ceva. */
export function extend(tiles, idx, w, t) {
  if (!tiles.length) { pushTile(tiles, idx, w, t); return true; }
  const n = tiles.length, last = tiles[n - 1];
  if (last[0] === t[0] && last[1] === t[1]) return false;
  for (const q of line(last, t)) pushTile(tiles, idx, w, q);
  return true;
}

/** Medie mobilă pe 5 plăci (capetele rămân pe loc): îndepărtează tremurul mâinii. */
export function average(tiles, r = 2) {
  const n = tiles.length;
  if (n < 4) return tiles.slice();
  const pts = [tiles[0]];
  for (let i = 1; i < n - 1; i++) {
    const k = Math.min(r, i, n - 1 - i);
    let sx = 0, sy = 0;
    for (let j = i - k; j <= i + k; j++) { sx += tiles[j][0]; sy += tiles[j][1]; }
    const c = 2 * k + 1;
    pts.push([Math.floor((sx + (c >> 1)) / c), Math.floor((sy + (c >> 1)) / c)]);
  }
  pts.push(tiles[n - 1]);
  const out = [pts[0]];
  for (let i = 1; i < n; i++) for (const q of line(out[out.length - 1], pts[i])) out.push(q);
  return out;
}

/** Colțurile ≥ 90° se taie: B dintre A și C e înlocuit cu linia A→C (0 sau 1 placă). Rezultatul are doar curbe de 45°. */
export function cutCorners(tiles) {
  const t = tiles.map((q) => q.slice());
  let guard = t.length * 4, k = 1;
  while (k < t.length - 1 && guard-- > 0) {
    if (turn(dirOf(t[k - 1], t[k]), dirOf(t[k], t[k + 1])) >= 2) {
      t.splice(k, 1, ...line(t[k - 1], t[k + 1]).slice(0, -1));
      k = Math.max(1, k - 1);
    } else k++;
  }
  return t;
}

/** Tot lanțul: urma brută (cu bucle) → plăci curate, conectate pe 8 direcții, fără dubluri și fără colțuri ascuțite. */
export function smoothTrace(raw, w) {
  if (raw.length < 2) return raw.slice();
  const tiles = [], idx = new Map();
  for (const q of average(raw)) pushTile(tiles, idx, w, q);
  let out = cutCorners(tiles);
  const t2 = [], i2 = new Map();
  for (const q of out) pushTile(t2, i2, w, q); // tăierea colțurilor poate crea o dublură
  out = t2;
  return out;
}
