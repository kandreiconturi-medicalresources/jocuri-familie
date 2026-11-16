// Trenuri: modele din trains/ (mai mari, cu dungă în culoarea companiei, cuplaje, faruri), mișcare interpolată,
// înclinare în curbe, fum de abur; la calitate 0 umbre „blob”, la ≥1 umbre reale.
import { Group, InstancedMesh, Matrix4, Quaternion, Vector3, Euler } from 'three';
import { MODELS } from '../sim/consts.js';
import { CAR_TYPES } from '../sim/goods.js';
import { poseAt, travelled } from './pose.js';
import { carGroup, setNight } from './trainParts.js';
import { createSmoke } from './smoke.js';
import { blobGeometry, blobMaterial } from './blob.js';
import { perf } from '../../../../shared/engine/perf.js';

export const TRAIN_MODELS = [...MODELS.map((m) => 'trains/' + m.glb), ...CAR_TYPES.map((c) => 'trains/' + c.glb)];
const CAR_GAP = 250, MAX_BLOBS = 600;
const CAR_MODEL = CAR_TYPES.map((c) => 'trains/' + c.glb);
const m4 = new Matrix4(), qq = new Quaternion(), vv = new Vector3(), ss = new Vector3(), ee = new Euler();
const oa = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, ob = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export function createTrains(s, g, camera) {
  const root = new Group(), items = new Map(), q = perf.quality();
  const smoke = createSmoke(camera, q >= 2 ? 220 : q >= 1 ? 130 : 56);
  const blobs = new InstancedMesh(blobGeometry(), blobMaterial(), MAX_BLOBS);
  blobs.userData.blob = true; blobs.visible = q === 0; blobs.frustumCulled = false; blobs.count = 0; blobs.renderOrder = 3;
  root.add(blobs, smoke.mesh);
  let acc = 0, night = 0;
  const colorOf = (t) => (s.companies[t.owner] ? s.companies[t.owner].color : '#ff6b6b');

  const sync = () => {
    const alive = new Set();
    for (const t of s.trains) {
      alive.add(t.id);
      let it = items.get(t.id);
      if (it && it.cars !== t.cars) { root.remove(it.group); items.delete(t.id); it = null; }
      if (!it) {
        const group = new Group(), c = colorOf(t), parts = [carGroup('trains/' + MODELS[t.model].glb, c, true)];
        for (let i = 0; i < t.cars; i++) parts.push(carGroup(CAR_MODEL[t.kinds[i]], c, false));
        parts.forEach((p) => group.add(p));
        root.add(group);
        const lights = []; parts[0].traverse((o) => { if (o.userData.light) lights.push(o); });
        const d = travelled(s, t);
        it = { group, parts, cars: t.cars, prev: d, cur: d, path: t.path, lights, roll: 0 };
        items.set(t.id, it);
      }
    }
    for (const [id, it] of items) if (!alive.has(id)) { root.remove(it.group); items.delete(id); }
  };

  return {
    root,
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
    update(alpha, dt, nightLevel = 0) {
      acc += dt;
      if (nightLevel !== night) { night = nightLevel; setNight(night); }
      const lit = night > 0.04;
      let nb = 0;
      for (const t of s.trains) {
        const it = items.get(t.id);
        if (!it) continue;
        let path = t.path;
        if (path.length < 2) {
          const st = s.stations.find((z) => z.id === t.to);
          if (!st) continue;
          if (!it.stub || it.stubId !== st.id) { it.stub = [st.y * s.w + st.x]; it.stubId = st.id; }
          path = it.stub;
        }
        const d = it.prev + (it.cur - it.prev) * alpha, moving = it.cur !== it.prev;
        it.parts.forEach((p, k) => {
          const dd = d - k * CAR_GAP, o = poseAt(s, g, path, dd), yaw = o.yaw, pitch = o.pitch, ox = o.x, oy = o.y, oz = o.z;
          let roll = 0;
          if (path.length > 1) { // înclinare în curbă, după schimbarea direcției puțin înainte față de puțin în urmă
            roll = Math.max(-0.09, Math.min(0.09, wrap(poseAt(s, g, path, dd + 70, oa).yaw - poseAt(s, g, path, dd - 70, ob).yaw) * 0.22));
          }
          p.position.set(ox, oy, oz); p.rotation.set(-pitch, yaw, roll);
          if (blobs.visible && nb < MAX_BLOBS) blobs.setMatrixAt(nb++, m4.compose(vv.set(ox, oy + 0.04, oz), qq.setFromEuler(ee.set(0, yaw, 0)), ss.set(0.55, 1, 1.0)));
          if (k === 0 && MODELS[t.model].smoke && acc > 0.1 && moving) smoke.emit(ox + Math.sin(yaw) * 0.2, oy + 0.56, oz + Math.cos(yaw) * 0.2, 1);
        });
        if (it.lit !== lit) { it.lit = lit; for (const l of it.lights) l.visible = lit; }
      }
      if (acc > 0.1) acc = 0;
      blobs.count = nb; blobs.instanceMatrix.needsUpdate = true;
      smoke.update(dt);
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
