// Catenară (calitate 2): stâlpi și fir de contact pe plăcile parcurse de trenuri electrice.
import { Group, Mesh, MeshLambertMaterial } from 'three';
import { Builder } from './geo.js';
import { tilePolys } from './tracks.js';

const mat = new MeshLambertMaterial({ vertexColors: true });
export function createCatenary(s, g, tiles) {
  const B = new Builder();
  for (const i of tiles) {
    const x = i % s.w, y = (i / s.w) | 0, polys = tilePolys(s, g, x, y, 4);
    for (const pts of polys) B.ribbon(pts.map((p) => [p[0], p[1] + 0.64, p[2]]), 0.007, 0, 0.012, '#2a2c30');
    if (!polys.length || (x * 3 + y * 5) % 3 !== 0) continue;
    const p = polys[0], a = p[0], b = p[p.length - 1];
    let tx = b[0] - a[0], tz = b[2] - a[2]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const c = polys.length === 1 && p.length > 2 ? p[p.length >> 1] : [x + 0.5, g.tileY(x, y), y + 0.5], rx = -tz, rz = tx, o = 0.27;
    B.obox(c[0] + rx * o, c[1] + 0.33, c[2] + rz * o, tx, tz, 0.014, 0.014, 0.33, '#5a626c');
    B.obox(c[0] + rx * o / 2, c[1] + 0.63, c[2] + rz * o / 2, rx, rz, o / 2 + 0.014, 0.01, 0.01, '#5a626c');
  }
  if (B.empty) return new Group();
  const m = new Mesh(B.geometry(), mat);
  m.userData.cast = true; m.userData.recv = false;
  return m;
}
