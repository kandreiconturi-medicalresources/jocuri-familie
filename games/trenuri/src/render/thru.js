// Gara mare de trecere: liniile paralele cu scara de macaze la ambele capete, peroane insulă cu copertine, felinare, bănci,
// ceasuri și intrări în pasaj; clădirea, pasarela și piața sunt în thruHall.js. Coordonate locale: x = v (spre clădire), z = u (de-a lungul liniei).
import { Group, Mesh, MeshLambertMaterial, DoubleSide } from 'three';
import { Builder } from './geo.js';
import { box } from './terminalLayout.js';
import { thruGeo, thruFrame, nOf, straightU, TOP } from './thruLayout.js';
import { bench, lamp, clock, stairs, canopy, lampSink } from './stationProps.js';
import { hall } from './thruHall.js';

const lam = new MeshLambertMaterial({ vertexColors: true });
const glass = new MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.35, depthWrite: false, side: DoubleSide });
const CONC = '#cfc7b8', YEL = '#f2c230';

function rails(B, pts) {
  B.ribbon(pts.map((p) => [p[0], 0.05, p[1]]), 0.1, -0.02, 0.03, '#9d9385', '#7d7468');
  for (const o of [-0.06, 0.06]) B.ribbon(pts.map((p) => [p[0], 0.09, p[1]]), 0.012, 0.0, 0.03, '#e9edf3', '#8d939b', o);
}
/** Macazul de la ramificație: levier galben și disc alb-roșu lângă linie. */
function switchMark(B, v, u) {
  box(B, v - 0.2, v - 0.19, u - 0.01, u + 0.01, 0.04, 0.18, '#444');
  box(B, v - 0.2, v - 0.195, u - 0.035, u + 0.035, 0.13, 0.2, '#ffffff');
  box(B, v - 0.201, v - 0.194, u - 0.022, u + 0.022, 0.145, 0.185, '#d63a2a');
  box(B, v - 0.16, v - 0.1, u - 0.01, u + 0.01, 0.04, 0.06, '#e6b422');
}

/** Liniile: fiecare linie k ≥ 1 iese din scara diagonală care pleacă din linia principală la ambele capete. */
function tracks(B, G) {
  const { n, E, lanes } = G, last = lanes[n - 1], a = E - 0.1, b = straightU(n, n - 1);
  for (const e of [-1, 1]) {
    rails(B, [[0, e * a], [last, e * b]]); // scara de macaze
    for (let k = 1; k < n; k++) switchMark(B, lanes[k], e * straightU(n, k));
  }
  for (let k = 1; k < n; k++) { const s = straightU(n, k); rails(B, [[lanes[k], -s], [lanes[k], s]]); }
}

function platform(B, pl, k, own, bridgeU) {
  const { v, hw, u0, u1 } = pl, mid = (u0 + u1) / 2;
  box(B, v - hw, v + hw, u0, u1, 0.04, TOP, CONC);
  for (const e of [-1, 1]) box(B, v + e * (hw - 0.03) - 0.012, v + e * (hw - 0.03) + 0.012, u0, u1, TOP, TOP + 0.003, YEL); // linia galbenă
  // copertine pe tot peronul, cu loc pentru pasarelă
  const segs = [[u0 + 0.45, bridgeU - 0.32], [bridgeU + 0.12, u1 - 0.45]]; // capetele rămân descoperite: felinarele de acolo se văd de sus
  for (const [p, q] of segs) if (q - p > 0.2) canopy(B, v, TOP, (p + q) / 2, 0, 1, (q - p) / 2, hw - 0.01, 0.36, k % 2 ? '#c9d3de' : '#bcc8d4', own);
  for (let u = u0 + 0.35; u < u1 - 0.2; u += 0.7) if (Math.abs(u - bridgeU) > 0.3) lamp(B, v, TOP, u);
  for (let u = u0 + 0.6; u < u1 - 0.3; u += 1.2) if (Math.abs(u - bridgeU) > 0.35 && Math.abs(u + 0.85) > 0.3) bench(B, v + (k % 2 ? 0.07 : -0.07), TOP, u, 0, 1);
  clock(B, v, TOP, mid - 0.25, 0, 1);
  box(B, v - 0.11, v + 0.11, mid + 0.25, mid + 0.26, TOP + 0.22, TOP + 0.3, own); // panou cu numărul peronului
  box(B, v - 0.08, v + 0.08, mid + 0.245, mid + 0.25, TOP + 0.235, TOP + 0.285, '#ffffff');
}

function one(s, g, st, colorOf) {
  const n = nOf(st), G = thruGeo(n), F = thruFrame(st), own = colorOf(st.owner), root = new Group(), B = new Builder(), GL = new Builder(), wins = [];
  const lamps = [];
  lampSink.list = lamps;
  box(B, 0.08, G.vB1, -G.E, G.E, -0.4, 0.04, '#a39a8a'); // platforma gării (ascunde denivelările)
  tracks(B, G);
  G.plats.forEach((pl, k) => { platform(B, pl, k, own, G.uB); stairs(B, pl.v, TOP, G.uU, 0, 1, own); });
  hall(B, GL, G, own, wins);
  lampSink.list = null;
  const body = new Mesh(B.geometry(), lam); body.userData.cast = true; body.userData.recv = true; root.add(body);
  if (!GL.empty) { const gm = new Mesh(GL.geometry(), glass); gm.renderOrder = 2; root.add(gm); }
  const y0 = g.tileY(st.x, st.y);
  root.position.set(F.ox, y0, F.oz);
  root.rotation.y = F.yaw;
  const toW = (p) => { const [x, z] = F.W(p[0], p[2]); return [x, y0 + p[1], z]; };
  return { root, lamps: lamps.map(toW), wins: wins.map((q) => q.map(toW)) };
}

/** Grupul tuturor gărilor de trecere; userData.lamps / wins = felinare și ferestre în lume (pentru luminile de noapte). */
export function createThru(s, g, colorOf) {
  const root = new Group();
  root.userData.lamps = []; root.userData.wins = [];
  for (const st of s.stations) if (st.thru) { const it = one(s, g, st, colorOf); root.add(it.root); root.userData.lamps.push(...it.lamps); root.userData.wins.push(...it.wins); }
  return root;
}
