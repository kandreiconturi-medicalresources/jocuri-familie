// Încărcătura vizibilă a vagoanelor: grămezi (cărbune, minereu), bușteni, saci, containere colorate, cisterne, oțel.
// Fiecare vagon are un grup de „felii”; gradul de umplere arată câte felii (și cât din ultima) se văd.
import { Group, Mesh, MeshLambertMaterial, CylinderGeometry, BoxGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GOODS, CAR_TYPES, CAR_OF } from '../sim/goods.js';
import { box } from './trainParts.js';

const mats = new Map(), geos = new Map();
const mat = (c) => { let m = mats.get(c); if (!m) mats.set(c, m = new MeshLambertMaterial({ color: c })); return m; };
const tone = { 2: '#e8c24a', 4: '#8a5a3a', 5: '#d9a864', 6: '#2c2c36', 7: '#b0633c', 8: '#8aa0b8', 9: '#4aa8e8' };
export const goodColor = (g) => tone[g] || GOODS[g].color;

/** Cum se umple fiecare vagon: [{ fill 0..1, good }] după t.load (primele vagoane de același tip se umplu întâi). */
export function wagonFills(t) {
  const left = new Map(), out = [];
  for (const b of t.load) left.set(CAR_OF[b.c], (left.get(CAR_OF[b.c]) || []).concat([{ g: b.c, n: b.n }]));
  for (const k of t.kinds) {
    const cap = CAR_TYPES[k].cap, q = left.get(k) || [];
    let fill = 0, good = -1;
    while (q.length && fill < cap) {
      const e = q[0], take = Math.min(e.n, cap - fill);
      if (good < 0) good = e.g;
      fill += take; e.n -= take;
      if (e.n <= 0) q.shift();
    }
    out.push({ fill: fill / cap, good });
  }
  return out;
}

function pile(b) { // grămadă tăiată, cu creastă
  const w = b.x * 0.82, l = b.z * 0.8, g = new CylinderGeometry(0.0, 1, 1, 8, 1);
  g.scale(w, 0.62, l); g.translate(0, 0.31, 0);
  return [g];
}
function layers(n, make) { return Array.from({ length: n }, (_, j) => make(j)); }
function geoFor(kind, b) {
  const key = kind + '|' + b.x + '|' + b.z;
  if (geos.has(key)) return geos.get(key);
  const W = b.x * 0.9, L = b.z * 0.88;
  let r;
  if (kind === 3) r = pile(b);
  else if (kind === 4) r = layers(3, (j) => { // bușteni așezați peste vagon
    const list = [];
    for (let i = 0; i < 5 - j; i++) { const c = new CylinderGeometry(0.1, 0.1, W * 1.8, 8); c.rotateZ(Math.PI / 2); c.translate(0, 0.1 + j * 0.19, (i - (4 - j) / 2) * (L * 0.4)); list.push(c); }
    return mergeGeometries(list);
  });
  else if (kind === 2) r = layers(3, (j) => { // saci de cereale / lăzi
    const list = [];
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) { const c = new BoxGeometry(W * 0.8, 0.14, L * 0.3); c.translate(s * W * 0.45, 0.07 + j * 0.15, (i - 1) * L * 0.62); list.push(c); }
    return mergeGeometries(list);
  });
  else if (kind === 6) r = layers(2, (j) => { const c = new BoxGeometry(W * 1.5, 0.3, L * 1.8); c.translate(0, 0.17 + j * 0.31, 0); return c; });
  else if (kind === 7) r = layers(3, (j) => { const c = new BoxGeometry(W * 1.6, 0.08, L * 1.8); c.translate(0, 0.05 + j * 0.1, 0); return c; });
  else if (kind === 5) { const c = new CylinderGeometry(b.x * 0.62, b.x * 0.62, L * 1.8, 14); c.rotateX(Math.PI / 2); c.translate(0, 0.62, 0); r = [c]; }
  else r = [];
  geos.set(key, r);
  return r;
}

/** Încărcătura unui vagon de tipul `kind`. set(fill, good) cere animație lină; step(dt) o face. */
export function createCargo(kind, modelName, low = false) {
  const b = box(modelName), root = new Group(), parts = geoFor(kind, b).map((g) => { const m = new Mesh(g); m.castShadow = !low; root.add(m); return m; });
  const base = kind === 5 ? 0 : 0.42;
  root.position.y = base; root.visible = false;
  let shown = 0, target = 0, good = -1;
  function paint() {
    root.visible = shown > 0.01 && parts.length > 0;
    if (!root.visible) return;
    if (kind === 3) { parts[0].scale.set(0.5 + 0.5 * shown, shown, 0.5 + 0.5 * shown); return; }
    if (kind === 5) { parts[0].scale.set(1, 1, Math.max(0.05, shown)); return; }
    const n = parts.length;
    parts.forEach((m, i) => { const f = Math.min(1, Math.max(0, shown * n - i)); m.visible = f > 0.02; m.scale.y = f; });
  }
  return {
    group: root,
    set(fill, g) {
      target = fill;
      if (g >= 0 && g !== good) { good = g; const m = mat(goodColor(g)); for (const p of parts) p.material = m; }
    },
    /** Întoarce true cât timp se mai animă (încărcare/descărcare). */
    step(dt) {
      if (shown === target) return false;
      const d = target - shown, k = Math.min(Math.abs(d), dt * 0.6);
      shown += Math.sign(d) * k;
      paint();
      return true;
    },
    snap() { shown = target; paint(); },
  };
}
