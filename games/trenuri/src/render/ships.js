// Porturi (cheiul, macaraua, containere) și vapoare desenate în cod (cocă, punte, cabină, containere colorate după marfă).
import { Group, Mesh, MeshLambertMaterial } from 'three';
import { Builder } from './geo.js';
import { LEN, SHIP_MODELS } from '../sim/consts.js';
import { GOODS } from '../sim/goods.js';
import { stepDir } from '../sim/seaPath.js';

const lam = new MeshLambertMaterial({ vertexColors: true });
const tileXZ = (s, i) => ({ x: (i % s.w) + 0.5, z: ((i / s.w) | 0) + 0.5 });

/** Poziția (în plăci) și direcția vaporului; alpha = fracțiunea de pas dintre două actualizări ale simulării. */
export function shipXY(s, sh, alpha) {
  if (sh.state === 1 || sh.path.length < 2) {
    const p = s.stations.find((q) => q.id === sh.dest), d = p ? tileXZ(s, p.dock) : { x: 0, z: 0 };
    return { x: d.x, z: d.z, ang: p ? Math.atan2(-(p.y + 0.5 - d.z), p.x + 0.5 - d.x) + Math.PI / 2 : 0 };
  }
  const a = tileXZ(s, sh.path[sh.seg]), b = tileXZ(s, sh.path[Math.min(sh.path.length - 1, sh.seg + 1)]);
  const L = LEN[stepDir(s.w, sh.path[sh.seg], sh.path[sh.seg + 1])], t = Math.min(1, (sh.pos + alpha * SHIP_MODELS[sh.model].speed) / L);
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, ang: Math.atan2(-(b.z - a.z), b.x - a.x) };
}

const box = (B, x, y, z, ang, l, w, hgt, col) => B.obox(x, y + hgt / 2, z, Math.cos(ang), -Math.sin(ang), l / 2, w / 2, hgt / 2, col);

function shipMesh(sh, owner) {
  const B = new Builder(), m = SHIP_MODELS[sh.model], L = 0.7 + sh.model * 0.14, W = 0.26 + sh.model * 0.03;
  box(B, 0, -0.06, 0, 0, L, W, 0.12, '#2f3a48'); // coca
  box(B, L / 2 + 0.06, -0.06, 0, 0, 0.14, W * 0.6, 0.12, '#2f3a48'); // prova
  box(B, 0, 0.06, 0, 0, L, W + 0.02, 0.03, owner); // dunga companiei
  box(B, -L / 2 + 0.12, 0.09, 0, 0, 0.18, W * 0.8, 0.16, '#f2f2ee'); // cabina
  if (sh.model === 0) { box(B, 0.05, 0.09, 0, 0, 0.03, 0.03, 0.5, '#7a5a3a'); box(B, 0.08, 0.2, 0, 0, 0.02, W * 0.9, 0.34, '#fbf6e8'); } // catarg + pânză
  else box(B, -L / 2 + 0.12, 0.25, 0, 0, 0.06, 0.06, 0.14, sh.model === 1 ? '#3a3a3a' : owner); // coș
  const full = Math.min(6, Math.ceil((sh.load.reduce((n, b) => n + b.n, 0) * 6) / m.cap));
  for (let k = 0; k < full; k++) { // containere colorate după marfă
    const b = sh.load[k % sh.load.length], x = -L / 2 + 0.3 + (k >> 1) * ((L - 0.4) / 3), z = (k & 1 ? 1 : -1) * W * 0.22;
    box(B, x, 0.09, z, 0, (L - 0.45) / 3.3, W * 0.4, 0.1, GOODS[b.c].color);
  }
  const mesh = new Mesh(B.geometry(), lam); mesh.userData.cast = true;
  return mesh;
}

function portsMesh(s, g, colorOf) {
  const B = new Builder();
  for (const p of s.stations) {
    if (!p.port) continue;
    const d = tileXZ(s, p.dock), ang = Math.atan2(-(d.z - p.y - 0.5), d.x - p.x - 0.5), y = g.tileY(p.x, p.y);
    const ux = Math.cos(ang), uz = -Math.sin(ang), qx = (p.x + 0.5 + d.x) / 2, qz = (p.y + 0.5 + d.z) / 2;
    box(B, qx, -0.15, qz, ang, 1.0, 1.2, y + 0.17, '#9b9488'); // cheiul de piatră
    box(B, qx + ux * 0.2, y + 0.02, qz + uz * 0.2, ang, 0.1, 1.2, 0.03, colorOf(p.owner)); // marginea cheiului
    const cx = qx - uz * 0.4, cz = qz + ux * 0.4;
    box(B, cx, y, cz, 0, 0.08, 0.08, 0.9, '#e0a020'); // macaraua de port
    box(B, cx + ux * 0.3, y + 0.86, cz + uz * 0.3, ang, 0.9, 0.06, 0.06, '#e0a020');
    box(B, cx + ux * 0.66, y + 0.5, cz + uz * 0.66, 0, 0.012, 0.012, 0.36, '#222');
    for (let k = 0; k < 4; k++) { const ox = -uz * (k - 1.5) * 0.24, oz = ux * (k - 1.5) * 0.24; box(B, p.x + 0.5 + ox - ux * 0.15, y, p.y + 0.5 + oz - uz * 0.15, ang, 0.32, 0.18, 0.16, ['#d64a3a', '#3a7ad6', '#3aa65a', '#e0a020'][(k + p.id) & 3]); }
  }
  const mesh = new Mesh(B.geometry(), lam); mesh.userData.cast = true; mesh.userData.recv = true;
  return mesh;
}

/** Stratul mării: porturile (refăcute când se schimbă gările) și vapoarele (actualizate în fiecare cadru). */
export function createSea(s, g, colorOf) {
  const root = new Group(), items = new Map();
  let ports = null, portKey = '';
  function update(alpha, t) {
    const pk = s.stations.filter((q) => q.port).map((q) => q.id + ':' + q.owner).join();
    if (pk !== portKey) { portKey = pk; if (ports) { root.remove(ports); ports.geometry.dispose(); } ports = portsMesh(s, g, colorOf); root.add(ports); }
    const seen = new Set();
    for (const sh of s.ships || []) {
      seen.add(sh.id);
      const key = sh.load.map((b) => b.c + ':' + b.n).join() + '|' + sh.model;
      let it = items.get(sh.id);
      if (!it || it.key !== key) { if (it) { root.remove(it.mesh); it.mesh.geometry.dispose(); } it = { key, mesh: shipMesh(sh, colorOf(sh.owner)) }; items.set(sh.id, it); root.add(it.mesh); }
      const p = shipXY(s, sh, alpha);
      it.mesh.position.set(p.x, 0.04 + Math.sin(t * 2 + sh.id) * 0.015, p.z);
      it.mesh.rotation.y = p.ang;
    }
    for (const [id, it] of items) if (!seen.has(id)) { root.remove(it.mesh); it.mesh.geometry.dispose(); items.delete(id); }
  }
  return { root, update };
}
