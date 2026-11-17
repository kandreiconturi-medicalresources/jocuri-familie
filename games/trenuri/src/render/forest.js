// Păduri pe bucăți (cu culling): specii în pâlcuri după relief și zgomot, scară/rotire/nuanță aleatoare, copaci singuratici,
// pietre, tufe, iarbă și flori (scatter.js). La calitate 0: umbre „blob” sub copaci.
import { Group } from 'three';
import { addInstances, hash, TREE_LOW, TREE_HIGH, ROCKS, BUSHES, PALM } from './props.js';
import { blobMesh } from './blob.js';
import { fieldSet } from './fields.js';
import { scatterChunk } from './scatter.js';
import { reservedTiles } from './stationPlan.js';

const CH = 32;
const TINTS = [0xffffff, 0xf0f8e0, 0xe2f0d0, 0xfff0d8, 0xe8ffe8, 0xf4ffd8];
const noise = (x, y) => { // zgomot de valoare simplu, pentru pâlcuri de aceeași specie
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, a = hash(i, j, 3), b = hash(i + 1, j, 3), c = hash(i, j + 1, 3), d = hash(i + 1, j + 1, 3);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
};

/** sparse = „Mod răcoros”: fără iarbă și flori, decor rar (pe jumătate din plăci). */
export function createForest(s, g, quality, sparse = false) {
  const root = new Group(), fields = fieldSet(s), low = quality >= 1 ? TREE_LOW : TREE_LOW.slice(0, 3), high = quality >= 1 ? TREE_HIGH : TREE_HIGH.slice(0, 2);
  const res = reservedTiles(s), free = (i) => !res.has(i) && !s.water[i] && !s.track[i] && !s.occ[i] && !s.roads[i] && !fields.has(i);
  for (let cy = 0; cy * CH < s.h; cy++) for (let cx = 0; cx * CH < s.w; cx++) {
    const lists = new Map(), blobs = [], rocks = ROCKS.map(() => []), add = (m, it) => { if (!lists.has(m)) lists.set(m, []); lists.get(m).push(it); };
    for (let y = cy * CH; y < Math.min(s.h, cy * CH + CH); y++) for (let x = cx * CH; x < Math.min(s.w, cx * CH + CH); x++) {
      const i = y * s.w + x;
      if (sparse && hash(x, y, 88) < 0.5) continue;
      if (s.forest[i] && !res.has(i)) {
        const n = quality >= 2 ? 2 : 1, z = noise(x * 0.11, y * 0.11), hi = s.height[i] >= 9 || (s.height[i] >= 8 && z > 0.55);
        for (let k = 0; k < n; k++) {
          const fx = x + 0.2 + 0.6 * hash(x, y, k * 3 + 1), fz = y + 0.2 + 0.6 * hash(x, y, k * 3 + 2), set = hi ? high : low;
          const pick = Math.min(set.length - 1, ((hash(x, y, k + 9) * 0.55 + z * 0.45) * set.length) | 0), sc = 0.3 + 0.32 * hash(x, y, k + 30) * hash(x, y, k + 31) + 0.14 * hash(x, y, k + 32);
          const gy = g.at(fx, fz);
          add(set[pick], { x: fx, y: gy - 0.02, z: fz, yaw: hash(x, y, k + 20) * 6.28, s: sc, c: TINTS[(hash(x, y, k + 40) * TINTS.length) | 0] });
          if (quality === 0) blobs.push({ x: fx, y: gy, z: fz, r: 0.2 * sc / 0.4 + 0.1 });
        }
      } else if (free(i) && s.height[i] > 3) {
        const r = hash(x, y, 77), fx = x + 0.15 + 0.7 * hash(x, y, 78), fz = y + 0.15 + 0.7 * hash(x, y, 79), sc = 0.28 + 0.16 * hash(x, y, 80);
        if (r < 0.05) { const t = ((hash(x, y, 5) * 3) | 0) % 3; rocks[t].push({ x: fx, y: g.at(fx, fz), z: fz, yaw: hash(x, y, 6) * 6.28, s: 0.4 + 0.5 * hash(x, y, 7) }); }
        else if (r < 0.06 && s.height[i] >= 10) rocks[3].push({ x: fx, y: g.at(fx, fz) - 0.03, z: fz, yaw: hash(x, y, 6) * 6.28, s: 0.35 + 0.3 * hash(x, y, 7) });
        else if (quality >= 1 && s.height[i] === 4 && r < 0.12 && hash(x, y, 81) < 0.5) { const gy = g.at(fx, fz); add(PALM, { x: fx, y: gy, z: fz, yaw: hash(x, y, 6) * 6.28, s: 0.34 + 0.12 * hash(x, y, 7) }); }
        else if (quality >= 1 && s.height[i] > 4 && r < 0.085) { const gy = g.at(fx, fz); add(TREE_LOW[(hash(x, y, 82) * 3) | 0], { x: fx, y: gy - 0.02, z: fz, yaw: hash(x, y, 6) * 6.28, s: sc, c: TINTS[(hash(x, y, 83) * TINTS.length) | 0] }); if (quality === 0) blobs.push({ x: fx, y: gy, z: fz, r: 0.18 }); }
        else if (quality >= 1 && s.height[i] > 4 && r < 0.12) { const gy = g.at(fx, fz); add(BUSHES[hash(x, y, 84) < 0.7 ? 0 : 1], { x: fx, y: gy - 0.02, z: fz, yaw: hash(x, y, 6) * 6.28, s: 0.5 + 0.5 * hash(x, y, 7) }); }
      }
    }
    for (const [m, list] of lists) addInstances(root, m, list);
    rocks.forEach((l, t) => addInstances(root, ROCKS[t], l));
    if (blobs.length) root.add(blobMesh(blobs));
    if (quality >= 1 && !sparse) scatterChunk(root, s, g, cx, cy, quality, free);
  }
  return root;
}
