// Mașini Ultra (doar decor, nu țin de simulare): circulă pe drumuri pe banda din dreapta, cu viraje line (curbă Bézier prin centrul plăcii).
// Pornesc lângă orașe; la fiecare placă aleg o ieșire (fără întoarcere, decât la capăt de drum). Un InstancedMesh per parte de model.
import { Group, InstancedMesh, Matrix4, Quaternion, Vector3, Euler, Box3, DynamicDrawUsage } from 'three';
import { CARS, hash } from './props.js';
import { getParts } from './models.js';

const N4 = [[0, -1], [1, 0], [0, 1], [-1, 0]], LEN = 0.3, LANE = 0.14, MAX = 90;
const m4 = new Matrix4(), q = new Quaternion(), e = new Euler(), v = new Vector3(), sc = new Vector3();

/** Mărimea și înălțimea roților pentru fiecare model (din cutia geometriei coapte). */
function fit(model) {
  const box = new Box3(), b = new Box3();
  for (const p of getParts(model)) { p.geo.computeBoundingBox(); b.copy(p.geo.boundingBox); box.union(b); }
  const k = LEN / Math.max(0.01, box.max.z - box.min.z);
  return { k, lift: -box.min.y * k };
}

export function createCars(s, g) {
  const root = new Group(), road = (x, y) => x >= 0 && y >= 0 && x < s.w && y < s.h && s.roads[y * s.w + x] > 0 && !s.water[y * s.w + x];
  const starts = [];
  for (const c of s.cities) for (let y = c.y - 6; y <= c.y + 6; y++) for (let x = c.x - 6; x <= c.x + 6; x++) if (road(x, y)) starts.push([x, y]);
  const count = Math.min(MAX, Math.floor(starts.length / 3));
  const cars = [], byModel = CARS.map(() => []);
  for (let i = 0; i < count; i++) {
    const [x, y] = starts[(hash(i, 7, 1) * starts.length) | 0];
    const dirs = [0, 1, 2, 3].filter((k) => road(x + N4[k][0], y + N4[k][1]));
    const din = dirs.length ? dirs[(hash(i, 7, 2) * dirs.length) | 0] : 0;
    const city = hash(i, 7, 3) < 0.85, m = city ? (hash(i, 7, 4) * 11) | 0 : 12 - ((hash(i, 7, 5) * 2) | 0) * 5; // tractoare și camioane și pe câmp
    const car = { x, y, din, dout: din, t: hash(i, 7, 6), sp: (m === 7 || m >= 10 ? 0.55 : 0.8) + 0.25 * hash(i, 7, 8), m, slot: byModel[m].length, yaw: 0, n: i };
    byModel[m].push(car); cars.push(car);
    car.dout = pick(car);
  }
  function pick(c) {
    const opts = [0, 1, 2, 3].filter((k) => k !== ((c.din + 2) & 3) && road(c.x + N4[k][0], c.y + N4[k][1]));
    if (!opts.length) return (c.din + 2) & 3; // capăt de drum: se întoarce
    return opts[(hash(c.x, c.y, c.n * 13 + (c.turns = (c.turns || 0) + 1)) * opts.length) | 0];
  }
  const meshes = CARS.map((model, k) => {
    if (!byModel[k].length) return null;
    const f = fit(model);
    const parts = getParts(model).map((p) => { const im = new InstancedMesh(p.geo, p.mat, byModel[k].length); im.instanceMatrix.setUsage(DynamicDrawUsage); im.frustumCulled = false; im.userData.cast = true; im.userData.recv = true; root.add(im); return im; });
    return { f, parts };
  });
  const P = { x: 0, z: 0, tx: 0, tz: 0 };
  /** Punct și tangentă pe curba plăcii: intrare (mijlocul laturii) → centru → ieșire. */
  function at(c, t) {
    const cx = c.x + 0.5, cz = c.y + 0.5, [ix, iz] = N4[c.din], [ox, oz] = N4[c.dout];
    const ax = cx - ix * 0.5, az = cz - iz * 0.5, bx = cx + ox * 0.5, bz = cz + oz * 0.5, u = 1 - t;
    P.x = u * u * ax + 2 * u * t * cx + t * t * bx; P.z = u * u * az + 2 * u * t * cz + t * t * bz;
    P.tx = 2 * u * (cx - ax) + 2 * t * (bx - cx); P.tz = 2 * u * (cz - az) + 2 * t * (bz - cz);
    return P;
  }
  function update(dt) {
    dt = Math.min(dt, 0.1);
    for (const c of cars) {
      c.t += dt * c.sp;
      while (c.t >= 1) { c.t -= 1; c.x += N4[c.dout][0]; c.y += N4[c.dout][1]; c.din = c.dout; c.dout = road(c.x, c.y) ? pick(c) : (c.din + 2) & 3; }
      const p = at(c, c.t), l = Math.hypot(p.tx, p.tz);
      if (l > 0.05) c.yaw = Math.atan2(p.tx / l, p.tz / l);
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), px = p.x - fz * LANE, pz = p.z + fx * LANE; // banda din dreapta
      const mm = meshes[c.m];
      m4.compose(v.set(px, g.at(px, pz) + 0.04 + mm.f.lift, pz), q.setFromEuler(e.set(0, c.yaw, 0)), sc.setScalar(mm.f.k));
      for (const im of mm.parts) im.setMatrixAt(c.slot, m4);
    }
    for (const mm of meshes) if (mm) for (const im of mm.parts) im.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return { root, update, dispose() { root.traverse((o) => { if (o.isInstancedMesh) o.dispose(); }); } };
}
