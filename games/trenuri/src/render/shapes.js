// Geometrie proprie simplă: cutii colorate lipite într-o singură geometrie (culori pe vârfuri).
import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Color } from 'three';

/** parts: [{ w, h, d, x, y, z, color, ry }]; întoarce o geometrie neindexată cu culori. */
export function boxes(parts) {
  const pos = [], nor = [], col = [], c = new Color();
  for (const p of parts) {
    const g = new BoxGeometry(p.w, p.h, p.d).toNonIndexed();
    if (p.ry) g.rotateY(p.ry);
    g.translate(p.x || 0, p.y || 0, p.z || 0);
    c.set(p.color);
    const a = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < a.length; i++) { pos.push(a[i]); nor.push(n[i]); }
    for (let i = 0; i < a.length / 3; i++) col.push(c.r, c.g, c.b);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new Float32BufferAttribute(col, 3));
  return geo;
}

/** Clădire de gară pe mărime: 0 haltă, 1 gară, 2 terminal. Axa lungă = Z (de-a lungul șinei), x = spre clădire; compact = nu iese din placă. */
export function stationShape(size, color, compact = false) {
  const wd = compact ? 0.36 : 0.5, xc = compact ? 0.32 : 0.38, bw = compact ? 0.2 : 0.28, bx = compact ? 0.4 : 0.52, rw = compact ? 0.25 : 0.34;
  const parts = [{ w: wd, h: 0.08, d: 0.9 + size * 0.1, x: xc, y: 0.04, color: '#cfc7b8' }];
  if (size === 0) parts.push({ w: 0.2, h: 0.22, d: 0.3, x: bx - 0.14, y: 0.19, color }, { w: 0.26, h: 0.05, d: 0.36, x: bx - 0.14, y: 0.32, color: '#8a4a3a' });
  else {
    const L = 0.5 + size * 0.2;
    parts.push({ w: bw, h: 0.3 + size * 0.1, d: L, x: bx, y: 0.23 + size * 0.05, color: '#f2e2c4' }, { w: rw, h: 0.06, d: L + 0.08, x: bx, y: 0.41 + size * 0.1, color: '#b8503e' },
      { w: 0.2, h: 0.04, d: L, x: bx - 0.22, y: 0.3, color }, { w: 0.03, h: 0.2, d: 0.03, x: bx - 0.3, y: 0.18, z: L / 2 - 0.05, color: '#6a5a4a' }, { w: 0.03, h: 0.2, d: 0.03, x: bx - 0.3, y: 0.18, z: -L / 2 + 0.05, color: '#6a5a4a' });
    if (size === 2) parts.push({ w: 0.18, h: 0.18, d: 0.18, x: bx, y: 0.62, color: '#f2e2c4' }, { w: 0.24, h: 0.05, d: 0.24, x: bx, y: 0.74, color: '#b8503e' });
  }
  return boxes(parts);
}
