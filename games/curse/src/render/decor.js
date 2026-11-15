// Decorul din jurul pistei: copaci, corturi, steaguri etc. ca InstancedMesh (o desenare per tip).
// Plasare deterministă (aceeași pistă = același decor) și mereu în afara drumului.
import {
  BoxGeometry, CanvasTexture, Color, InstancedMesh, MeshLambertMaterial, Object3D, Points, PointsMaterial,
  BufferGeometry, Float32BufferAttribute, Group, AdditiveBlending,
} from 'three';
import { rng } from '../../../../shared/engine/rng.js';
import { bake, getModel } from './models.js';
import { lambert } from './world.js';

// scara în metri per unitate de model, și cât de departe de linia centrală (metri)
const SPEC = {
  treeLarge: { sc: 6, min: 11 }, treeSmall: { sc: 6, min: 10 }, tent: { sc: 6, min: 12 }, flagRed: { sc: 6, min: 9 },
  flagGreen: { sc: 6, min: 9 }, flagCheckers: { sc: 6, min: 9 }, pylon: { sc: 7, min: 7.5 }, billboard: { sc: 7, min: 12 },
  lightPostLarge: { sc: 9, min: 7.2, edge: true }, grandStand: { sc: 9, min: 13 },
};
export const DECOR_MODELS = Object.keys(SPEC);
const QF = [0.4, 0.7, 1];

function hashPoints(pts, cell = 14) {
  const map = new Map();
  pts.forEach((p, i) => {
    if (p.y > 1.5) return; // pe pod nu contează pentru decor la sol
    const k = Math.floor(p.x / cell) + ',' + Math.floor(p.z / cell);
    (map.get(k) || map.set(k, []).get(k)).push(i);
  });
  return (x, z, r) => {
    const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      for (const i of map.get((cx + a) + ',' + (cz + b)) || []) {
        if (Math.hypot(pts[i].x - x, pts[i].z - z) < r) return true;
      }
    }
    return false;
  };
}

function make(name, theme, spots) {
  const geo = bake(getModel(name).clone(true), (m) => (m === 'grass' && SPEC[name] && /tree/.test(name) ? new Color(theme.leaf) : null));
  const mesh = new InstancedMesh(geo, lambert(), spots.length);
  const o = new Object3D(), sc = SPEC[name].sc;
  spots.forEach((s, i) => {
    o.position.set(s.x, 0, s.z); o.rotation.set(0, s.r, 0); o.scale.setScalar(sc * s.k); o.updateMatrix();
    mesh.setMatrixAt(i, o.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; mesh.userData.full = spots.length;
  return mesh;
}

function windows() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = '#10142a'; g.fillRect(0, 0, 32, 64);
  for (let y = 3; y < 62; y += 8) for (let x = 3; x < 30; x += 7) { g.fillStyle = Math.random() < 0.55 ? '#ffd86b' : '#27304f'; g.fillRect(x, y, 4, 4); }
  const t = new CanvasTexture(c); return t;
}

function buildings(track, near, r) {
  const tex = windows(), n = 90;
  const mat = new MeshLambertMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, color: 0x667799 });
  const geo = new BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const mesh = new InstancedMesh(geo, mat, n), o = new Object3D();
  for (let i = 0, k = 0; i < n * 8 && k < n; i++) {
    const p = track.pts[r.int(0, track.n - 1)], side = r.chance(0.5) ? 1 : -1, off = 26 + r.range(0, 55);
    const x = p.x - p.tz * side * off, z = p.z + p.tx * side * off;
    if (near(x, z, 24)) continue;
    o.position.set(x, 0, z); o.rotation.set(0, r.range(0, 3), 0); o.scale.set(r.range(14, 26), r.range(18, 70), r.range(14, 26)); o.updateMatrix();
    mesh.setMatrixAt(k++, o.matrix);
    if (k === n) break;
  }
  mesh.frustumCulled = false; mesh.userData.full = n; mesh.count = n;
  return mesh;
}

function glow(spots) {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,230,150,1)'); gr.addColorStop(1, 'rgba(255,200,80,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  const geo = new BufferGeometry(); geo.setAttribute('position', new Float32BufferAttribute(spots.flatMap((s) => [s.x, 8.4, s.z]), 3));
  return new Points(geo, new PointsMaterial({ size: 6, map: new CanvasTexture(c), transparent: true, opacity: 0.85, depthWrite: false, blending: AdditiveBlending, fog: false }));
}

/** Întoarce { group, setQuality(q) }. */
export function createDecor(track, theme, q) {
  const group = new Group(), r = rng(track.length | 0), near = hashPoints(track.pts);
  const meshes = [];
  const base = track.length / 10;
  for (const [name, dens] of theme.decor) {
    const spec = SPEC[name], spots = [];
    const want = Math.round(base * dens);
    for (let t = 0; t < want * 6 && spots.length < want; t++) {
      const i = r.int(0, track.n - 1), p = track.pts[i];
      if (p.y > 1.5) continue;
      const side = r.chance(0.5) ? 1 : -1, off = spec.edge ? spec.min + r.range(0, 1.5) : spec.min + r.range(0, 55) * r.next();
      const x = p.x - p.tz * side * off, z = p.z + p.tx * side * off;
      if (near(x, z, spec.min - 0.5)) continue;
      if (spec.edge && spots.length && t % 3) continue; // stâlpii la distanțe mai mari
      spots.push({ x, z, r: r.range(0, 6.28), k: 0.85 + r.next() * 0.5 });
    }
    if (spots.length) { const m = make(name, theme, spots); group.add(m); meshes.push(m); }
    if (name === 'lightPostLarge') group.add(glow(spots));
  }
  // tribune la start
  const s0 = track.pts[0];
  const stand = [1, -1].map((side) => ({ x: s0.x - s0.tz * side * 14, z: s0.z + s0.tx * side * 14, r: Math.atan2(s0.tx, -s0.tz) + (side > 0 ? 0 : Math.PI) + Math.PI, k: 1 }));
  if (!theme.night) { const m = make('grandStand', theme, stand); group.add(m); }
  if (theme.city) { const b = buildings(track, near, r); group.add(b); meshes.push(b); }
  const setQuality = (qq) => meshes.forEach((m) => { m.count = Math.max(1, Math.round(m.userData.full * QF[qq])); });
  setQuality(q);
  return { group, setQuality };
}
