// Gări (șinele sunt în tracks.js): clădirea orientată după planul gării (axa șinei, partea liberă), fără să iasă din placă unde nu e loc.
import { Group, Mesh, MeshLambertMaterial } from 'three';
import { stationShape } from './shapes.js';
import { planOf, platformsOf } from './stationPlan.js';
import { T_PRESENT, DX, DY } from '../sim/consts.js';
import { perf } from '../../../../shared/engine/perf.js';

export { createTrack } from './tracks.js';

const stationMat = new MeshLambertMaterial({ vertexColors: true });

const plain = (s, st) => st.big || st.port || !(s.track[st.y * s.w + st.x] & T_PRESENT);
function oldYaw(s, st) { // terminale și porturi: clădirea după prima legătură a plăcii, ca înainte
  const t = s.track[st.y * s.w + st.x];
  for (let d = 0; d < 8; d++) if ((t >> d) & 1) return Math.atan2(DX[d], DY[d]) + Math.PI;
  return Math.PI;
}

export function createStations(s, g, colorOf) {
  const root = new Group(), q = perf.quality();
  for (const st of s.stations) {
    const P = plain(s, st) ? { yaw: oldYaw(s, st), compact: false } : planOf(s, st), mesh = new Mesh(stationShape(st.size, colorOf(st.owner), P.compact), stationMat);
    mesh.rotation.y = P.yaw;
    mesh.scale.set(1, 1 + 0.12 * (platformsOf(st) - 1), 1); // mai înaltă la upgrade; lungimea rămâne în placă
    mesh.position.set(st.x + 0.5, g.tileY(st.x, st.y), st.y + 0.5);
    mesh.userData.station = st.id; mesh.userData.cast = true; mesh.userData.recv = true;
    mesh.castShadow = mesh.receiveShadow = q >= 1;
    root.add(mesh);
  }
  return root;
}
