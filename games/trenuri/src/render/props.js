// Decor instanțiat: păduri (pe bucăți, cu culling), case și drumuri între orașe.
import { Group, InstancedMesh, Matrix4, Quaternion, Vector3, Euler, BufferGeometry, Float32BufferAttribute, Mesh, MeshLambertMaterial } from 'three';
import { getParts } from './models.js';

export const TREES = ['nature/tree_default', 'nature/tree_pineDefaultA', 'nature/tree_oak', 'nature/tree_fat'];
export const BUSH = 'nature/plant_bush', ROCK = 'nature/rock_smallA';
export const HOUSES = ['building-type-a', 'building-type-b', 'building-type-c', 'building-type-d', 'building-type-e', 'building-type-f', 'building-type-g', 'building-type-h'].map((n) => 'suburban/' + n)
  .concat(['commercial/building-a', 'commercial/building-b', 'commercial/building-c', 'commercial/building-d', 'commercial/building-skyscraper-a']);
const HOUSE_SCALE = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.55, 0.55, 0.55, 0.55, 0.4];
const CH = 32;

const hash = (x, y, k) => { let h = Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663) ^ Math.imul(k + 7, 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const m4 = new Matrix4(), q = new Quaternion(), e = new Euler(), v = new Vector3(), sc = new Vector3();
export function compose(x, y, z, yaw, s) { q.setFromEuler(e.set(0, yaw, 0)); return m4.compose(v.set(x, y, z), q, sc.set(s, s, s)); }

/** Un InstancedMesh per parte a modelului; `list` = [{x,y,z,yaw,s}]. */
export function addInstances(group, model, list) {
  if (!list.length) return;
  for (const p of getParts(model)) {
    const im = new InstancedMesh(p.geo, p.mat, list.length);
    list.forEach((it, i) => im.setMatrixAt(i, compose(it.x, it.y, it.z, it.yaw, it.s)));
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    group.add(im);
  }
}

export function createForest(s, g, quality) {
  const root = new Group();
  for (let cy = 0; cy * CH < s.h; cy++) for (let cx = 0; cx * CH < s.w; cx++) {
    const lists = TREES.map(() => []), rocks = [];
    for (let y = cy * CH; y < Math.min(s.h, cy * CH + CH); y++) for (let x = cx * CH; x < Math.min(s.w, cx * CH + CH); x++) {
      const i = y * s.w + x;
      if (s.forest[i]) {
        const n = quality >= 2 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const fx = x + 0.2 + 0.6 * hash(x, y, k * 3 + 1), fz = y + 0.2 + 0.6 * hash(x, y, k * 3 + 2);
          const t = Math.min(3, (hash(x, y, k + 9) * 4) | 0);
          lists[t].push({ x: fx, y: g.at(fx, fz) - 0.02, z: fz, yaw: hash(x, y, k + 20) * 6.28, s: 0.34 + 0.2 * hash(x, y, k + 30) });
        }
      } else if (!s.water[i] && !s.track[i] && !s.occ[i] && !s.roads[i] && s.height[i] > 3 && hash(x, y, 77) < 0.05) {
        const fx = x + 0.5, fz = y + 0.5;
        rocks.push({ x: fx, y: g.at(fx, fz), z: fz, yaw: hash(x, y, 5) * 6.28, s: 0.5 });
      }
    }
    TREES.forEach((n, t) => addInstances(root, n, lists[t]));
    addInstances(root, ROCK, rocks);
  }
  return root;
}

export function createCities(s, g) {
  const root = new Group(), lists = HOUSES.map(() => []);
  for (const c of s.cities) for (const [x, y, t, r] of c.buildings) {
    lists[t].push({ x: x + 0.5, y: g.tileY(x, y), z: y + 0.5, yaw: r * Math.PI / 2, s: HOUSE_SCALE[t] });
  }
  HOUSES.forEach((n, t) => addInstances(root, n, lists[t]));
  return root;
}

/** Drumuri: plăci de geometrie lipite de teren (nu sunt simulate). */
export function createRoads(s, g) {
  const pos = [], W = g.W;
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    if (!s.roads[y * s.w + x] || s.water[y * s.w + x]) continue;
    const a = [x, g.vy[y * W + x]], b = [x + 1, g.vy[y * W + x + 1]], c = [x + 1, g.vy[(y + 1) * W + x + 1]], d = [x, g.vy[(y + 1) * W + x]];
    const P = (p, zz) => [p[0], p[1] + 0.02, zz];
    const A = P(a, y), B = P(b, y), C = P(c, y + 1), D = P(d, y + 1);
    pos.push(...A, ...D, ...B, ...B, ...D, ...C);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return new Mesh(geo, new MeshLambertMaterial({ color: 0xcdbf9f, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
}
