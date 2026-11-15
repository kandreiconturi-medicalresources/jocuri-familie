// Straturi derivate (nu intră în hash și nu se salvează): drumuri între orașe și plăcile ocupate de clădiri.
import { createHeap, KEY } from './heap.js';
import { DX, DY } from './consts.js';
import { rebuildBlocks } from './blocks.js';

/** Drum pe uscat între două orașe (A* pe 4 direcții, fără apă). Întoarce lista de indici sau null. */
function landPath(w, h, water, a, b) {
  const goal = b.y * w + b.x, start = a.y * w + a.x;
  const g = new Int32Array(w * h).fill(-1), from = new Int32Array(w * h).fill(-1);
  const heap = createHeap();
  g[start] = 0; heap.push(((Math.abs(a.x - b.x) + Math.abs(a.y - b.y)) * KEY) + start);
  while (heap.size) {
    const cur = heap.pop() % KEY;
    if (cur === goal) break;
    const x = cur % w, y = (cur / w) | 0;
    for (let d = 0; d < 8; d += 2) {
      const nx = x + DX[d], ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (water[ni]) continue;
      const ng = g[cur] + 1;
      if (g[ni] >= 0 && g[ni] <= ng) continue;
      g[ni] = ng; from[ni] = cur;
      heap.push((ng + Math.abs(nx - b.x) + Math.abs(ny - b.y)) * KEY + ni);
    }
  }
  if (g[goal] < 0) return null;
  const out = [];
  for (let c = goal; c !== start; c = from[c]) out.push(c);
  out.push(start);
  return out;
}

export function deriveLayers(s) {
  const { w, h, cities } = s;
  s.roads = new Uint8Array(w * h);
  s.occ = new Uint8Array(w * h);
  for (let i = 1; i < cities.length; i++) {
    let best = 0, bd = 1e9;
    for (let j = 0; j < i; j++) {
      const d = Math.abs(cities[i].x - cities[j].x) + Math.abs(cities[i].y - cities[j].y);
      if (d < bd) { bd = d; best = j; }
    }
    const p = landPath(w, h, s.water, cities[i], cities[best]);
    if (p) for (const idx of p) s.roads[idx] = 1;
  }
  for (const c of cities) {
    for (const b of c.buildings) s.occ[b[1] * w + b[0]] = 1;
    s.roads[c.y * w + c.x] = 1;
  }
  for (const o of s.industries) s.occ[o.y * w + o.x] = 1;
  rebuildBlocks(s);
}
