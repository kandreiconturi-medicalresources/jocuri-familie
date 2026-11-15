// Trenuri: modele din trains/, mișcare interpolată între pașii simulării, fum de abur.
import { Group, InstancedMesh, IcosahedronGeometry, MeshBasicMaterial, Matrix4, Quaternion, Vector3, Mesh } from 'three';
import { MODELS, carKind } from '../sim/consts.js';
import { getParts } from './models.js';
import { poseAt, travelled } from './pose.js';

export const TRAIN_MODELS = [...MODELS.map((m) => 'trains/' + m.glb), 'trains/train-carriage-container-blue', 'trains/train-carriage-box'];
const SCALE = 0.3, CAR_GAP = 218, PUFFS = 40;
const CAR_MODEL = ['trains/train-carriage-container-blue', 'trains/train-carriage-box'];
const m4 = new Matrix4(), qq = new Quaternion(), vv = new Vector3(), ss = new Vector3();

function modelGroup(name) {
  const gr = new Group();
  for (const p of getParts(name)) gr.add(new Mesh(p.geo, p.mat));
  gr.scale.setScalar(SCALE);
  gr.rotation.order = 'YXZ';
  return gr;
}

export function createTrains(s, g) {
  const root = new Group(), items = new Map();
  const puffMesh = new InstancedMesh(new IcosahedronGeometry(0.1, 0), new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false }), PUFFS);
  puffMesh.frustumCulled = false; puffMesh.count = 0;
  root.add(puffMesh);
  const pf = { x: new Float32Array(PUFFS), y: new Float32Array(PUFFS), z: new Float32Array(PUFFS), age: new Float32Array(PUFFS).fill(9) };
  let pn = 0, acc = 0;

  const sync = () => {
    const alive = new Set();
    for (const t of s.trains) {
      alive.add(t.id);
      let it = items.get(t.id);
      if (it && it.cars !== t.cars) { root.remove(it.group); items.delete(t.id); it = null; }
      if (!it) {
        const group = new Group(), parts = [modelGroup('trains/' + MODELS[t.model].glb)];
        for (let i = 0; i < t.cars; i++) parts.push(modelGroup(CAR_MODEL[carKind(i)]));
        parts.forEach((p) => group.add(p));
        root.add(group);
        const d = travelled(s, t);
        it = { group, parts, cars: t.cars, prev: d, cur: d, path: t.path };
        items.set(t.id, it);
      }
    }
    for (const [id, it] of items) if (!alive.has(id)) { root.remove(it.group); items.delete(id); }
  };

  return {
    root,
    /** Apelat după fiecare pas al simulării. */
    onStep() {
      if (items.size !== s.trains.length || s.dirty.trains) { sync(); s.dirty.trains = false; }
      for (const t of s.trains) {
        const it = items.get(t.id);
        if (!it) continue;
        const d = travelled(s, t);
        if (it.path !== t.path) { it.path = t.path; it.prev = d; } else it.prev = it.cur;
        it.cur = d;
      }
    },
    resync() { sync(); },
    update(alpha, dt) {
      acc += dt;
      for (const t of s.trains) {
        const it = items.get(t.id);
        if (!it) continue;
        let path = t.path;
        if (path.length < 2) {
          const st = s.stations.find((q) => q.id === t.to);
          if (!st) continue;
          if (!it.stub || it.stubId !== st.id) { it.stub = [st.y * s.w + st.x]; it.stubId = st.id; }
          path = it.stub;
        }
        const d = it.prev + (it.cur - it.prev) * alpha;
        it.parts.forEach((p, k) => {
          const o = poseAt(s, g, path, d - k * CAR_GAP);
          p.position.set(o.x, o.y, o.z); p.rotation.set(-o.pitch, o.yaw, 0);
          if (k === 0 && MODELS[t.model].smoke && acc > 0.12 && it.cur !== it.prev) {
            pf.x[pn] = o.x + Math.sin(o.yaw) * 0.18; pf.y[pn] = o.y + 0.5; pf.z[pn] = o.z + Math.cos(o.yaw) * 0.18; pf.age[pn] = 0; pn = (pn + 1) % PUFFS;
          }
        });
      }
      if (acc > 0.12) acc = 0;
      let n = 0;
      for (let i = 0; i < PUFFS; i++) {
        pf.age[i] += dt * 0.6;
        const a = pf.age[i];
        if (a >= 1) continue;
        pf.y[i] += dt * 0.55; pf.x[i] += dt * 0.12;
        const sc = (0.5 + a * 2.4) * (1 - a * a);
        m4.compose(vv.set(pf.x[i], pf.y[i], pf.z[i]), qq.identity(), ss.set(sc, sc, sc));
        puffMesh.setMatrixAt(n++, m4);
      }
      puffMesh.count = n; puffMesh.instanceMatrix.needsUpdate = true;
    },
    pickAt(wx, wz) { // cel mai apropiat tren la ≤1 placă de punctul de lume
      let best = null, bd = 1.2;
      for (const t of s.trains) {
        const it = items.get(t.id);
        if (!it) continue;
        const p = it.parts[0].position, d = Math.hypot(p.x - wx, p.z - wz);
        if (d < bd) { bd = d; best = t; }
      }
      return best;
    },
    positionOf(id) { const it = items.get(id); return it ? it.parts[0].position : null; },
  };
}
