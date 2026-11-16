// Terminalul mare: curte cu linii terminale (opritoare la capăt), peroane, hală acoperită, clădire de capăt,
// hală de service și macara portal animată peste curtea de marfă. Coordonate locale: x = spre curte, z = de-a lungul liniei.
import { Group, Mesh, MeshLambertMaterial, BoxGeometry, MeshBasicMaterial } from 'three';
import { Builder } from './geo.js';
import { frameOf } from '../sim/terminal.js';

const lam = new MeshLambertMaterial({ vertexColors: true });
export const LANE = 0.6, LADDER = 0.75; // distanța dintre linii; panta scării de macaze
const laneC = (k) => k * LANE, laneStart = (k) => -2.45 + laneC(k) * LADDER, END = 1.7;

function rails(B, pts) {
  B.ribbon(pts.map((p) => [p[0], 0.05, p[1]]), 0.1, -0.02, 0.03, '#9d9385', '#7d7468');
  for (const o of [-0.06, 0.06]) B.ribbon(pts.map((p) => [p[0], 0.09, p[1]]), 0.012, 0.0, 0.03, '#e9edf3', '#8d939b', o);
}
const box = (B, c0, c1, a0, a1, y0, y1, col) => B.obox((c0 + c1) / 2, (y0 + y1) / 2, (a0 + a1) / 2, 0, 1, (a1 - a0) / 2, (c1 - c0) / 2, (y1 - y0) / 2, col);

function yard(B, n, owner) {
  const last = laneC(n - 1), top = last + 0.3;
  box(B, 0.5, 4.5, -2.5, 2.5, -0.4, 0.04, '#a39a8a'); // platforma curții (ascunde denivelările)
  rails(B, [[0, -2.45], [laneC(n - 1) + 0.0001, laneStart(n - 1)]]); // scara de macaze din linia principală
  for (let k = 1; k < n; k++) {
    rails(B, [[laneC(k), laneStart(k)], [laneC(k), END]]);
    box(B, laneC(k) - 0.1, laneC(k) + 0.1, END, END + 0.06, 0.05, 0.16, '#d63a2a'); // opritor
    const pc = laneC(k) - LANE / 2; // peron între linia k-1 și k
    box(B, pc - 0.17, pc + 0.17, laneStart(k) + 0.25, END - 0.05, 0.04, 0.1, '#cfc7b8');
    box(B, pc - 0.17, pc - 0.14, laneStart(k) + 0.25, END - 0.05, 0.1, 0.105, '#f2c230');
    box(B, pc + 0.14, pc + 0.17, laneStart(k) + 0.25, END - 0.05, 0.1, 0.105, '#f2c230');
  }
  for (let k = 1; k < n; k++) { // copertine peste peroane (liniile rămân la vedere, ca să se vadă trenurile)
    const pc = laneC(k) - LANE / 2, a0 = Math.max(-0.4, laneStart(k) + 0.35);
    for (let a = a0 + 0.1; a <= END - 0.1; a += 0.55) box(B, pc - 0.02, pc + 0.02, a - 0.02, a + 0.02, 0.1, 0.5, '#5a6470');
    box(B, pc - 0.2, pc + 0.2, a0, END - 0.05, 0.5, 0.54, k % 2 ? '#c9d3de' : '#b8c6d6');
    box(B, pc - 0.21, pc + 0.21, a0, END - 0.05, 0.47, 0.5, owner);
  }
  box(B, 0.32, top, END + 0.1, 2.45, 0.04, 0.5, '#e8d8b8'); // clădirea de capăt (călători), lângă linia principală
  box(B, 0.3, top + 0.02, END + 0.08, 2.47, 0.5, 0.58, owner);
  box(B, (top + 0.3) / 2 - 0.12, (top + 0.3) / 2 + 0.12, END + 0.07, END + 0.09, 0.62, 0.86, '#ffffff'); // ceasul
  box(B, (top + 0.3) / 2 - 0.13, (top + 0.3) / 2 + 0.13, END + 0.08, END + 0.1, 0.58, 0.88, '#4a4038');
  for (let c = 0.45; c < top - 0.1; c += 0.35) box(B, c, c + 0.18, END + 0.08, END + 0.09, 0.15, 0.4, '#7fb2d8'); // ferestre
  // service: linie din scară până în hală
  const sc = 3.9, sa = -2.45 + sc * LADDER;
  rails(B, [[laneC(n - 1), laneStart(n - 1)], [sc, sa], [sc, 2.3]]);
  box(B, sc - 0.4, sc + 0.4, 0.7, 2.4, 0.04, 0.5, '#c9b79c');
  box(B, sc - 0.44, sc + 0.44, 0.68, 2.42, 0.5, 0.56, '#8a4a3a');
  box(B, sc - 0.18, sc + 0.18, 0.66, 0.69, 0.06, 0.4, '#3a3430'); // poarta
  // curtea de marfă: containere și portalul macaralei
  const cols = ['#d64a3a', '#3a7ad6', '#3aa65a', '#e0a020', '#8a5ad6'];
  for (let i = 0; i < 6; i++) { const c = 2.9 + (i % 3) * 0.42, a = -2.2 + ((i / 3) | 0) * 0.5; box(B, c - 0.18, c + 0.18, a - 0.11, a + 0.11, 0.04, 0.24, cols[i % 5]); }
  for (const c of [2.65, 4.35]) for (const a of [-2.35, -0.85]) box(B, c - 0.03, c + 0.03, a - 0.03, a + 0.03, 0.04, 0.82, '#e0a020');
  for (const a of [-2.35, -0.85]) box(B, 2.62, 4.38, a - 0.04, a + 0.04, 0.78, 0.86, '#e0a020');
}

function one(s, g, st, colorOf) {
  const f = frameOf(st.dir), root = new Group(), B = new Builder(), n = Math.max(1, Math.min(6, st.platforms | 0 || 4));
  yard(B, n, colorOf(st.owner));
  const body = new Mesh(B.geometry(), lam); body.userData.cast = true; body.userData.recv = true; root.add(body);
  const bridge = new Mesh(new BoxGeometry(1.76, 0.06, 0.1), new MeshLambertMaterial({ color: '#d99a18' }));
  const trolley = new Mesh(new BoxGeometry(0.16, 0.08, 0.14), new MeshLambertMaterial({ color: '#333' }));
  const cable = new Mesh(new BoxGeometry(0.012, 1, 0.012), new MeshBasicMaterial({ color: '#222' }));
  const load = new Mesh(new BoxGeometry(0.36, 0.2, 0.22), new MeshLambertMaterial({ color: '#3a7ad6' }));
  bridge.position.set(3.5, 0.86, -1.6); root.add(bridge, trolley, cable, load);
  root.position.set(st.x + 0.5, g.tileY(st.x, st.y), st.y + 0.5);
  root.rotation.y = Math.atan2(-f.cy, f.cx);
  return { root, update(tm, busy) {
    const sp = busy ? 0.6 : 0.2, ph = tm * sp, along = Math.sin(ph * 0.7) * 0.6, cross = 3.5 + Math.sin(ph) * 0.6, lift = 0.2 + (0.5 + 0.5 * Math.sin(ph * 2)) * 0.45;
    bridge.position.z = -1.6 + along; trolley.position.set(cross, 0.92, -1.6 + along);
    load.position.set(cross, lift, -1.6 + along); cable.scale.y = Math.max(0.01, 0.9 - lift - 0.1); cable.position.set(cross, (0.9 + lift + 0.1) / 2, -1.6 + along);
  } };
}

/** Grupul tuturor terminalelor mari; userData.update(t) mișcă macaralele. */
export function createTerminals(s, g, colorOf) {
  const root = new Group(), items = [];
  for (const st of s.stations) if (st.big) { const it = one(s, g, st, colorOf); it.id = st.id; items.push(it); root.add(it.root); }
  root.userData.update = (tm) => { for (const it of items) it.update(tm, s.trains.some((t) => t.state === 2 && t.to === it.id)); };
  return root;
}
