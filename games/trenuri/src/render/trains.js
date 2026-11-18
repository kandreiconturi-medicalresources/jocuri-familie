// Trenuri: modele procedurale din trainMeshes.js (glb din trains/ doar rezervă; cu dungă în culoarea companiei, cuplaje, faruri), mișcare interpolată,
// înclinare în curbe, fum de abur; la calitate 0 umbre „blob”, la ≥1 umbre reale.
import { Group, InstancedMesh, Matrix4, Quaternion, Vector3, Euler } from 'three';
import { MODELS } from '../sim/consts.js';
import { CAR_TYPES } from '../sim/goods.js';
import { poseAt, travelled, stubPath, cumOf } from './pose.js';
import { carGroup, setNight } from './trainParts.js';
import { vehicle } from './trainMeshes.js';
import { createSmoke } from './smoke.js';
import { createCargo, wagonFills } from './cargo.js';
import { makeBeacon } from './depot.js';
import { blobGeometry, blobMaterial } from './blob.js';
import { perf } from '../../../../shared/engine/perf.js';
import { frameOf } from '../sim/terminal.js';
import { LANE } from './terminal.js';
import { bayMap } from './bays.js';
import { laneV } from './thruLayout.js';

export const TRAIN_MODELS = [...MODELS.map((m) => 'trains/' + m.glb), ...CAR_TYPES.map((c) => 'trains/' + c.glb)];
const CAR_GAP = 250, MAX_BLOBS = 600;
const CAR_MODEL = CAR_TYPES.map((c) => 'trains/' + c.glb);
const m4 = new Matrix4(), qq = new Quaternion(), vv = new Vector3(), ss = new Vector3(), ee = new Euler();
const oa = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, ob = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

/** Sensul trenului față de axa gării (din ultimii doi pași ai traseului cu care a sosit). */
function headingOf(s, t, st) {
  const p = t.path, f = frameOf(st.dir);
  if (p.length < 2) return 1;
  const a = p[p.length - 2], b = p[p.length - 1], dx = (b % s.w) - (a % s.w), dy = ((b / s.w) | 0) - ((a / s.w) | 0);
  return dx * f.ax + dy * f.ay < 0 ? -1 : 1;
}
/** Trenurile oprite într-un terminal mare sau într-o gară de trecere stau pe liniile lor (linia 0 = traseul): id tren → { st, f, c, a0, sg, thru }. */
function bays(s) {
  const out = new Map();
  for (const [id, b] of bayMap(s, (t, st) => headingOf(s, t, st))) {
    if (!b.lane) continue;
    if (b.real) continue; // linii independente: trenul e desenat pe drumul lui, chiar pe linia lui
    const st = b.st, f = frameOf(st.dir), t = s.trains.find((q) => q.id === id);
    if (st.thru) out.set(id, { st, f, c: laneV(b.lane), a0: ((t ? t.cars : 0) * CAR_GAP) / 512, sg: b.sg, thru: true });
    else out.set(id, { st, f, c: b.lane * LANE, a0: 1.2, sg: 1, thru: false });
  }
  return out;
}
/** Poza vagonului k pe linia din gară (sh din bays) în o. */
function bayPose(g, sh, k, o) {
  const a = sh.sg * (sh.a0 - (k * CAR_GAP) / 256), st = sh.st, f = sh.f;
  o.x = st.x + 0.5 + f.cx * sh.c + f.ax * a; o.y = g.tileY(st.x, st.y) + 0.06; o.z = st.y + 0.5 + f.cy * sh.c + f.ay * a;
  o.yaw = Math.atan2(sh.sg * f.ax, sh.sg * f.ay); o.pitch = 0;
  return o;
}
const bp = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, ease = (x) => x * x * (3 - 2 * x);

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
        const group = new Group(), c = colorOf(t), parts = [vehicle('loco', t.model, c) || carGroup('trains/' + MODELS[t.model].glb, c, true)];
        for (let i = 0; i < t.cars; i++) parts.push(vehicle('car', t.kinds[i], c) || carGroup(CAR_MODEL[t.kinds[i]], c, false));
        const cargos = t.kinds.slice(0, t.cars).map((k, i) => { const cg = createCargo(k, CAR_MODEL[k], q === 0); parts[i + 1].add(cg.group); return cg; });
        const beacon = t.tow ? makeBeacon() : null;
        if (beacon) parts[0].add(beacon.mesh);
        parts.forEach((p) => group.add(p));
        root.add(group);
        const lights = []; parts[0].traverse((o) => { if (o.userData.light) lights.push(o); });
        const d = travelled(s, t);
        it = { group, parts, cars: t.cars, prev: d, cur: d, path: t.path, lights, roll: 0, cargos, beacon, sig: '' };
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
        const sig = t.load.map((b) => b.c + ':' + b.n).join();
        if (sig !== it.sig) { const first = it.sig === ''; it.sig = sig; wagonFills(t).forEach((f, i) => { if (it.cargos[i]) { it.cargos[i].set(f.fill, f.good); if (first) it.cargos[i].snap(); } }); }
      }
    },
    resync() { sync(); },
    update(alpha, dt, nightLevel = 0) {
      acc += dt;
      if (nightLevel !== night) { night = nightLevel; setNight(night); }
      const lit = night > 0.04;
      let nb = 0;
      const bay = bays(s);
      for (const t of s.trains) {
        const it = items.get(t.id);
        if (!it) continue;
        it.group.visible = t.state !== 3; // la depou sau cuplat la remorcă: nu se vede
        if (t.state === 3) continue;
        let path = t.path, stub = false;
        if (path.length < 2) {
          const st = s.stations.find((z) => z.id === t.to), at = st && t.org ? { id: st.id, x: (t.org - 1) % s.w, y: ((t.org - 1) / s.w) | 0 } : st; // nou cumpărat: pe peronul lui
          if (st) { path = stubPath(s, at); stub = path.length > 1; }
          else if (!path.length) continue; // remorca stă pe placa depoului: path are o placă
        }
        const d = stub ? cumOf(s, path)[1] : it.prev + (it.cur - it.prev) * alpha, moving = it.cur !== it.prev;
        const sh = bay.get(t.id);
        if (sh && sh.thru) it.sh = sh;
        it.bl = Math.max(0, Math.min(1, (it.bl || 0) + (sh && sh.thru ? dt : -dt) * 1.4));
        const bl = it.bl;
        it.parts.forEach((p, k) => {
          const dd = d - k * CAR_GAP, o = poseAt(s, g, path, dd), yaw = o.yaw, pitch = o.pitch, ox = o.x, oy = o.y, oz = o.z;
          let roll = 0;
          if (path.length > 1) { // înclinare în curbă, după schimbarea direcției puțin înainte față de puțin în urmă
            roll = Math.max(-0.09, Math.min(0.09, wrap(poseAt(s, g, path, dd + 70, oa).yaw - poseAt(s, g, path, dd - 70, ob).yaw) * 0.22));
          }
          if (sh && !sh.thru) { bayPose(g, sh, k, bp); p.position.set(bp.x, bp.y, bp.z); p.rotation.set(0, bp.yaw, 0); } // terminalul: locomotiva la opritor
          else if (bl > 0.001 && it.sh) { // gara de trecere: trenul trece lin pe linia lui (peste scara de macaze) și înapoi
            bayPose(g, it.sh, k, bp); const e = ease(bl);
            p.position.set(ox + (bp.x - ox) * e, oy + (bp.y - oy) * e, oz + (bp.z - oz) * e); p.rotation.set(-pitch * (1 - e), yaw + wrap(bp.yaw - yaw) * e, roll * (1 - e));
          } else { p.position.set(ox, oy, oz); p.rotation.set(-pitch, yaw, roll); }
          if (blobs.visible && nb < MAX_BLOBS) blobs.setMatrixAt(nb++, m4.compose(vv.set(ox, oy + 0.04, oz), qq.setFromEuler(ee.set(0, yaw, 0)), ss.set(0.55, 1, 1.0)));
          if (k === 0 && MODELS[t.model].smoke && acc > 0.1 && moving) smoke.emit(ox + Math.sin(yaw) * 0.2, oy + 0.56, oz + Math.cos(yaw) * 0.2, 1);
        });
        for (const cg of it.cargos) cg.step(dt);
        if (it.beacon) it.beacon.update();
        if (it.lit !== lit) { it.lit = lit; for (const l of it.lights) l.visible = lit; }
      }
      if (acc > 0.1) acc = 0;
      blobs.count = nb; blobs.instanceMatrix.needsUpdate = true;
      smoke.update(dt);
    },
    /** Poziția în lume a locomotivei (pentru sunet) sau null. */
    posOf(id) { const it = items.get(id); return it && it.group.visible ? it.parts[0].position : null; },
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
