// Depoul (rundă ulterioară; se desenează doar când există state.depots): hală, 2 linii de reparații, macara care ridică locomotiva
// pe fazele lift / repair / lower din depot.jobs. Aici e și girofarul locomotivei de remorcare (train.tow).
import { Group, Mesh, MeshLambertMaterial, MeshBasicMaterial, BoxGeometry, SphereGeometry } from 'three';
import { DX, DY } from '../sim/consts.js';
import { Builder } from './geo.js';

const lam = new MeshLambertMaterial({ vertexColors: true });
const blockGeo = new BoxGeometry(0.2, 0.17, 0.46), sparkGeo = new BoxGeometry(0.05, 0.05, 0.05), hookGeo = new BoxGeometry(0.03, 0.03, 0.03);
const lane = [-0.27, 0.27], LEN = 2.2;

/** Girofar portocaliu care clipește, pe acoperișul locomotivei de remorcare. Coordonate în unități de model (grupul e scalat). */
export function makeBeacon() {
  const mat = new MeshBasicMaterial({ color: 0xff8a1c }), mesh = new Mesh(new SphereGeometry(0.16, 8, 6), mat);
  mesh.position.set(0, 1.9, 0.2);
  return { mesh, update() { const on = ((performance.now() / 280) | 0) % 2 === 0; mat.color.set(on ? 0xffa030 : 0x5a2a08); } };
}

function hall(B) { // hala: pereți, acoperiș în două ape, 2 linii de reparații
  const wall = '#c9b79c', roof = '#8a4a3a', dark = '#4a4038';
  B.obox(0, 0.3, LEN - 0.45, 0, 1, 0.45, 0.62, 0.3, wall, true);
  B.obox(0, 0.64, LEN - 0.45, 0, 1, 0.5, 0.7, 0.04, roof);
  B.obox(-0.33, 0.7, LEN - 0.45, 0, 1, 0.5, 0.36, 0.02, roof); B.obox(0.33, 0.7, LEN - 0.45, 0, 1, 0.5, 0.36, 0.02, roof);
  for (const x of lane) B.obox(x, 0.28, LEN - 0.0, 0, 1, 0.01, 0.12, 0.24, dark); // porți deschise
  for (const x of lane) { // linii (balast + șine)
    B.ribbon([[x, 0.02, 0.1], [x, 0.02, LEN]], 0.15, -0.02, 0.03, '#9d9385', '#7d7468');
    for (const o of [-0.08, 0.08]) B.ribbon([[x + o, 0.06, 0.1], [x + o, 0.06, LEN]], 0.012, 0.0, 0.03, '#e9edf3', '#8d939b');
  }
  for (const sx of [-0.7, 0.7]) B.obox(sx, 0.55, 0.9, 0, 1, 0.04, 0.04, 0.55, '#d9a030'); // piloni macara
  for (const sx of [-0.7, 0.7]) B.obox(sx, 0.97, 1.1, 0, 1, 0.7, 0.03, 0.03, '#d9a030'); // șine de rulare
  B.obox(0, 1.0, 0.9, 1, 0, 0.7, 0.03, 0.04, '#e0a020'); // podul macaralei
}

function one(s, g, dep, colorOf) {
  const root = new Group(), B = new Builder();
  hall(B);
  const body = new Mesh(B.geometry(), lam); body.userData.cast = true; body.userData.recv = true; root.add(body);
  const trolley = new Mesh(new BoxGeometry(0.14, 0.06, 0.1), new MeshLambertMaterial({ color: '#e0a020' })), hook = new Mesh(hookGeo, new MeshBasicMaterial({ color: '#222' }));
  const block = new Mesh(blockGeo, new MeshLambertMaterial({ color: '#cc4444' })), spark = new Mesh(sparkGeo, new MeshBasicMaterial({ color: 0xffe080 }));
  const cable = new Mesh(new BoxGeometry(0.012, 1, 0.012), new MeshBasicMaterial({ color: '#333' }));
  trolley.position.set(lane[0], 0.98, 0.9); trolley.add(cable); root.add(trolley, hook, block, spark);
  block.visible = spark.visible = hook.visible = false;
  root.position.set(dep.x + 0.5, g.tileY(dep.x, dep.y), dep.y + 0.5);
  root.rotation.y = Math.atan2(DX[dep.dir || 0], DY[dep.dir || 0]);
  const owner = colorOf(dep.owner);
  block.material.color.set(owner);
  return { root, update(job, tm) {
    const done = !job;
    block.visible = !done; spark.visible = false; hook.visible = false;
    cable.visible = !done;
    if (done) { trolley.position.x += (lane[0] - trolley.position.x) * 0.05; cable.scale.y = 0.001; return; }
    const p = job.t <= 1 ? Math.max(0, job.t) : (tm * 0.3) % 1, e = p * p * (3 - 2 * p);
    let x, y;
    if (job.phase === 'lift') { x = lane[0] + (lane[1] - lane[0]) * e; y = 0.18 + Math.sin(e * Math.PI) * 0.35; }
    else if (job.phase === 'lower') { x = lane[1] + (lane[0] - lane[1]) * e; y = 0.18 + Math.sin(e * Math.PI) * 0.35; }
    else { x = lane[1]; y = 0.18; spark.visible = Math.floor(tm * 12) % 2 === 0; spark.position.set(x + (Math.random() - 0.5) * 0.15, 0.3 + Math.random() * 0.1, 0.9 + (Math.random() - 0.5) * 0.3); }
    block.position.set(x, y, 0.9); trolley.position.x = x; cable.scale.y = Math.max(0.01, 0.92 - y); cable.position.y = -(0.92 - y) / 2 - 0.03;
    hook.visible = false;
  } };
}

/** Desenează toate depourile; întoarce null dacă lumea nu are state.depots. */
export function createDepots(s, g, colorOf) {
  if (!Array.isArray(s.depots)) return null;
  const root = new Group(), items = new Map();
  return {
    root,
    update(tm) {
      const alive = new Set();
      for (const d of s.depots) {
        alive.add(d.id);
        let it = items.get(d.id);
        if (!it) { it = one(s, g, d, colorOf); items.set(d.id, it); root.add(it.root); }
        it.update((d.jobs || [])[0] || null, tm);
      }
      for (const [id, it] of items) if (!alive.has(id)) { root.remove(it.root); items.delete(id); }
    },
  };
}
