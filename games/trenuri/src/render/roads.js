// Drumuri: în oraș asfalt cu bordură și trotuar (se leagă între plăci vecine), între orașe drum de pământ cu margini.
import { Mesh, MeshLambertMaterial } from 'three';
import { Builder } from './geo.js';

const N4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export function createRoads(s, g) {
  const B = new Builder(), near = new Uint8Array(s.w * s.h);
  for (const c of s.cities) for (let y = Math.max(0, c.y - 5); y <= Math.min(s.h - 1, c.y + 5); y++) for (let x = Math.max(0, c.x - 5); x <= Math.min(s.w - 1, c.x + 5); x++) near[y * s.w + x] = 1;
  const road = (x, y) => x >= 0 && y >= 0 && x < s.w && y < s.h && s.roads[y * s.w + x] && !s.water[y * s.w + x];
  const P = (x, z, lift) => [x, g.at(x, z) + lift, z];
  const quad = (x0, z0, x1, z1, lift, col) => B.quad(P(x0, z0, lift), P(x1, z0, lift), P(x1, z1, lift), P(x0, z1, lift), col, [0, 1, 0]);
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    if (!road(x, y)) continue;
    const n = N4.map(([dx, dz]) => road(x + dx, y + dz)), city = near[y * s.w + x];
    const m = city ? 0.13 : 0.1; // grosimea marginii (trotuar / umăr)
    if (city) quad(x, y, x + 1, y + 1, 0.03, '#d9d3c4'); else quad(x, y, x + 1, y + 1, 0.03, '#b8a77e');
    quad(x + (n[3] ? 0 : m), y + (n[0] ? 0 : m), x + 1 - (n[1] ? 0 : m), y + 1 - (n[2] ? 0 : m), 0.04, city ? '#7a746f' : '#d2c3a0');
  }
  const mesh = new Mesh(B.geometry(), new MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  mesh.userData.recv = true;
  return mesh;
}
