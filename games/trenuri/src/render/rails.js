// Gări (șinele sunt în tracks.js): clădirea orientată după planul gării (axa șinei, partea liberă), fără să iasă din placă unde nu e loc.
import { Group, Mesh, MeshLambertMaterial } from 'three';
import { stationShape } from './shapes.js';
import { planOf, platformsOf } from './stationPlan.js';
import { T_PRESENT, DX, DY } from '../sim/consts.js';
import { perf } from '../../../../shared/engine/perf.js';

export { createTrack } from './tracks.js';

const stationMat = new MeshLambertMaterial({ vertexColors: true });

/** Ferestrele clădirii (luminate noaptea, stationLights.js): patrulatere în lume pe fețele lungi ale clădirii din shapes.js. */
function windowsOf(st, P, y0, sy, out) {
  if (st.size < 1) return;
  const bw = P.compact ? 0.2 : 0.28, bx = P.compact ? 0.4 : 0.52, L = 0.5 + st.size * 0.2, c = Math.cos(P.yaw), sn = Math.sin(P.yaw);
  const W = (x, y, z) => [st.x + 0.5 + x * c + z * sn, y0 + y * sy, st.y + 0.5 - x * sn + z * c];
  for (const fx of [bx - bw / 2 - 0.004, bx + bw / 2 + 0.004]) for (let z = -L / 2 + 0.1; z < L / 2 - 0.05; z += 0.16) {
    const y = 0.17 + st.size * 0.05;
    out.push([W(fx, y, z - 0.04), W(fx, y, z + 0.04), W(fx, y + 0.09, z + 0.04), W(fx, y + 0.09, z - 0.04)]);
  }
}

const plain = (s, st) => st.big || st.port || !(s.track[st.y * s.w + st.x] & T_PRESENT);
function oldYaw(s, st) { // terminale și porturi: clădirea după prima legătură a plăcii, ca înainte
  const t = s.track[st.y * s.w + st.x];
  for (let d = 0; d < 8; d++) if ((t >> d) & 1) return Math.atan2(DX[d], DY[d]) + Math.PI;
  return Math.PI;
}

export function createStations(s, g, colorOf) {
  const root = new Group(), q = perf.quality(), wins = [];
  root.userData.wins = wins;
  for (const st of s.stations) {
    if (st.thru) continue; // gara de trecere își desenează clădirea (thruHall.js)
    const P = plain(s, st) ? { yaw: oldYaw(s, st), compact: false } : planOf(s, st), mesh = new Mesh(stationShape(st.size, colorOf(st.owner), P.compact), stationMat);
    mesh.rotation.y = P.yaw;
    mesh.scale.set(1, 1 + 0.12 * (platformsOf(st) - 1), 1); // mai înaltă la upgrade; lungimea rămâne în placă
    mesh.position.set(st.x + 0.5, g.tileY(st.x, st.y), st.y + 0.5);
    mesh.userData.station = st.id; mesh.userData.cast = true; mesh.userData.recv = true;
    mesh.castShadow = mesh.receiveShadow = q >= 1;
    root.add(mesh);
    if (!P.compact || st.size >= 1) windowsOf(st, P, g.tileY(st.x, st.y), mesh.scale.y, wins);
  }
  return root;
}
