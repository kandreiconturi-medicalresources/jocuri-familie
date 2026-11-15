// Stratul „Mărfuri”: săgeți colorate de la industrii la cine le ia marfa (se văd și prin dealuri).
import { Mesh, BufferGeometry, Float32BufferAttribute, MeshBasicMaterial, DoubleSide, Color } from 'three';
import { goodsLinks } from '../sim/links.js';
import { GOODS } from '../sim/goods.js';

export function createLinks(s, g) {
  const mesh = new Mesh(new BufferGeometry(), new MeshBasicMaterial({ vertexColors: true, side: DoubleSide, depthTest: false, transparent: true, opacity: 0.8 }));
  mesh.renderOrder = 8; mesh.frustumCulled = false; mesh.visible = false;
  const col = new Color();
  function rebuild() {
    const pos = [], cols = [];
    const tri = (a, b, c, k) => { pos.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) cols.push(k.r, k.g, k.b); };
    goodsLinks(s).forEach((l, n) => {
      const k = col.set(GOODS[l.good].color).clone();
      const lift = 1.1 + (n % 3) * 0.12;
      const A = [l.from.x + 0.5, g.tileY(l.from.x, l.from.y) + lift, l.from.y + 0.5], B = [l.to.x + 0.5, g.tileY(l.to.x, l.to.y) + lift, l.to.y + 0.5];
      const dx = B[0] - A[0], dz = B[2] - A[2], len = Math.hypot(dx, dz) || 1, ux = dx / len, uz = dz / len, px = -uz, pz = ux;
      const head = Math.min(0.9, len * 0.4), W = 0.07, HW = 0.3;
      const E = [B[0] - ux * head, B[1] + (A[1] - B[1]) * 0, B[2] - uz * head];
      const P = (p, o) => [p[0] + px * o, p[1], p[2] + pz * o];
      tri(P(A, -W), P(A, W), P(E, W), k); tri(P(A, -W), P(E, W), P(E, -W), k);
      tri(P(E, -HW), P(E, HW), [B[0] - ux * 0.35, B[1], B[2] - uz * 0.35], k);
    });
    mesh.geometry.dispose();
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new Float32BufferAttribute(cols, 3));
    mesh.geometry = geo;
  }
  return { mesh, rebuild, show(v) { if (v) rebuild(); mesh.visible = v; }, get visible() { return mesh.visible; } };
}
