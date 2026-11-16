// Drumul vapoarelor (etapa 7.2): A* pe plăcile de apă, 8 direcții (diagonala doar printre două plăci de apă),
// cost 10 drept / 14 pe diagonală. Rezultatul se ține în cache-ul derivat `s.seaC` (nu se salvează): apa nu se schimbă.
import { createHeap } from './heap.js';
import { DX, DY } from './consts.js';

/** Lista plăcilor de la a la b (indici), inclusiv capetele, sau null. */
export function seaPath(s, a, b) {
  if (!s.seaC) s.seaC = new Map();
  const key = a * s.w * s.h + b;
  if (s.seaC.has(key)) return s.seaC.get(key);
  const p = search(s, a, b);
  s.seaC.set(key, p);
  return p;
}

function search(s, a, b) {
  const { w, h, water } = s, N = w * h;
  if (a < 0 || b < 0 || !water[a] || !water[b]) return null;
  if (a === b) return [a];
  const g = new Int32Array(N).fill(-1), from = new Int32Array(N).fill(-1), heap = createHeap();
  const bx = b % w, by = (b / w) | 0;
  const est = (x, y) => { const dx = Math.abs(x - bx), dy = Math.abs(y - by); return 10 * Math.max(dx, dy) + 4 * Math.min(dx, dy); };
  g[a] = 0; heap.push(est(a % w, (a / w) | 0) * N + a);
  while (heap.size) {
    const k = heap.pop(), cur = k % N;
    if (cur === b) break;
    const x = cur % w, y = (cur / w) | 0, f = (k - cur) / N;
    if (f > g[cur] + est(x, y)) continue; // intrare veche din heap
    for (let d = 0; d < 8; d++) {
      const nx = x + DX[d], ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (!water[ni]) continue;
      if ((d & 1) && (!water[y * w + nx] || !water[ny * w + x])) continue;
      const ng = g[cur] + (d & 1 ? 14 : 10);
      if (g[ni] >= 0 && g[ni] <= ng) continue;
      g[ni] = ng; from[ni] = cur;
      heap.push((ng + est(nx, ny)) * N + ni);
    }
  }
  if (g[b] < 0) return null;
  const out = [];
  for (let c = b; c !== a; c = from[c]) out.push(c);
  out.push(a);
  return out.reverse();
}

/** Direcția (0–7) pasului de la placa i la placa j vecină. */
export function stepDir(w, i, j) {
  const dx = (j % w) - (i % w), dy = ((j / w) | 0) - ((i / w) | 0);
  for (let d = 0; d < 8; d++) if (DX[d] === dx && DY[d] === dy) return d;
  return 0;
}
