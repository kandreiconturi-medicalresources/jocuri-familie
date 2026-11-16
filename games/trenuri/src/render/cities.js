// Orașe: case cu fața spre drum, scară și nuanță variate, grădini; parcuri (oraș) și piețe cu fântână (metropolă).
import { Group, Mesh, MeshLambertMaterial } from 'three';
import { addInstances, hash, HOUSES, GARDEN, TREE_LOW } from './props.js';
import { blobMesh } from './blob.js';
import { Builder } from './geo.js';

const HOUSE_SCALE = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.55, 0.55, 0.55, 0.55, 0.4, 0.55, 0.4, 0.4];
const TINTS = [0xffffff, 0xffffff, 0xfff0e0, 0xe8f0ff, 0xfff6c8, 0xf3e4ff, 0xe4ffe8, 0xffe4e0, 0xf6eedc];
const FRONT = 0; // unghiul fețelor modelelor Kenney față de +Z (față spre drum)
const N4 = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const roadAt = (s, x, y) => x >= 0 && y >= 0 && x < s.w && y < s.h && s.roads[y * s.w + x] > 0 && !s.water[y * s.w + x];

function freeNear(s, c, skip, from = 1) {
  for (let r = from; r <= 4; r++) for (let k = 0; k < 8 * r; k++) {
    const a = (k / (8 * r)) * 6.283 + c.id, x = Math.round(c.x + Math.cos(a) * r), y = Math.round(c.y + Math.sin(a) * r), i = y * s.w + x;
    if (x < 1 || y < 1 || x >= s.w - 1 || y >= s.h - 1 || skip.has(i)) continue;
    if (!s.water[i] && !s.forest[i] && !s.occ[i] && !s.roads[i] && !s.track[i] && s.height[i] > 4) return [x, y, i];
  }
  return null;
}

function civic(s, g, c, root, used) {
  const B = new Builder();
  const top = (x, y, dx, dz) => [x + dx, g.vy[(y + dz) * g.W + x + dx] + 0.03, y + dz];
  const park = freeNear(s, c, used);
  if (park) {
    const [x, y, i] = park; used.add(i);
    B.quad(top(x, y, 0, 0), top(x, y, 1, 0), top(x, y, 1, 1), top(x, y, 0, 1), '#74c050', [0, 1, 0]);
    B.obox(x + 0.5, g.at(x + 0.5, y + 0.5) + 0.04, y + 0.5, 1, 0, 0.5, 0.05, 0.006, '#e3d6b0'); B.obox(x + 0.5, g.at(x + 0.5, y + 0.5) + 0.04, y + 0.5, 0, 1, 0.5, 0.05, 0.006, '#e3d6b0');
    const trees = [[0.22, 0.22], [0.78, 0.25], [0.25, 0.78], [0.8, 0.8]].map(([dx, dz], k) => ({ x: x + dx, y: g.at(x + dx, y + dz) - 0.02, z: y + dz, yaw: k, s: 0.3 + 0.08 * k % 3 * 0.5, c: 0xffffff }));
    addInstances(root, TREE_LOW[c.id % 2], trees);
  }
  if (c.level >= 2) {
    const sq = freeNear(s, c, used, 1);
    if (sq) {
      const [x, y, i] = sq; used.add(i);
      const y0 = g.at(x + 0.5, y + 0.5);
      B.quad(top(x, y, 0, 0), top(x, y, 1, 0), top(x, y, 1, 1), top(x, y, 0, 1), '#d4cdbd', [0, 1, 0]);
      B.obox(x + 0.5, y0 + 0.07, y + 0.5, 1, 0, 0.17, 0.17, 0.035, '#bdb6a6'); B.obox(x + 0.5, y0 + 0.11, y + 0.5, 1, 0, 0.13, 0.13, 0.012, '#4aa8e0');
      B.obox(x + 0.5, y0 + 0.2, y + 0.5, 1, 0, 0.02, 0.02, 0.09, '#cfc8b8'); B.obox(x + 0.5, y0 + 0.3, y + 0.5, 1, 0, 0.06, 0.06, 0.01, '#4aa8e0');
      for (const [dx, dz] of [[0.12, 0.12], [0.88, 0.12], [0.12, 0.88], [0.88, 0.88]]) B.obox(x + dx, g.at(x + dx, y + dz) + 0.13, y + dz, 1, 0, 0.012, 0.012, 0.13, '#3c3f46');
    }
  }
  if (!B.empty) { const m = new Mesh(B.geometry(), new MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); m.userData.recv = true; m.userData.cast = true; root.add(m); }
}

export function createCities(s, g) {
  const root = new Group(), lists = HOUSES.map(() => []), garden = [[], []], blobs = [];
  for (const c of s.cities) {
    const used = new Set();
    for (const [x, y, t, r] of c.buildings) {
      let yaw = r * Math.PI / 2;
      for (let k = 0; k < 4; k++) { const [dx, dz] = N4[(k + r) & 3]; if (roadAt(s, x + dx, y + dz)) { yaw = Math.atan2(dx, dz) + FRONT; break; } }
      const sc = HOUSE_SCALE[t] * (0.93 + 0.14 * hash(x, y, 1)), py = g.tileY(x, y);
      lists[t].push({ x: x + 0.5, y: py, z: y + 0.5, yaw, s: sc, c: TINTS[(hash(x, y, 2) * TINTS.length) | 0] });
      blobs.push({ x: x + 0.5, y: py, z: y + 0.5, r: 0.45, rz: 0.38 });
      if (t < 8 && hash(x, y, 3) < 0.4) { // grădină: un copăcel în colț
        const gx = x + 0.5 + Math.cos(yaw + 2.2) * 0.38, gz = y + 0.5 + Math.sin(yaw + 2.2) * 0.38;
        garden[hash(x, y, 4) < 0.5 ? 0 : 1].push({ x: gx, y: g.at(gx, gz), z: gz, yaw: hash(x, y, 5) * 6, s: 0.7 + 0.5 * hash(x, y, 6) });
      }
    }
    if (c.level >= 1) civic(s, g, c, root, used);
  }
  HOUSES.forEach((n, t) => addInstances(root, n, lists[t]));
  garden.forEach((l, k) => addInstances(root, GARDEN[k], l));
  if (blobs.length) root.add(blobMesh(blobs));
  return root;
}
