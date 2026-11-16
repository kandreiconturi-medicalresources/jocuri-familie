// Gări (șinele sunt în tracks.js): clădirea orientată după prima legătură a plăcii.
import { Group, Mesh, MeshLambertMaterial } from 'three';
import { DX, DY } from '../sim/consts.js';
import { stationShape } from './shapes.js';
import { perf } from '../../../../shared/engine/perf.js';

export { createTrack } from './tracks.js';

const stationMat = new MeshLambertMaterial({ vertexColors: true });

export function createStations(s, g, colorOf) {
  const root = new Group(), q = perf.quality();
  for (const st of s.stations) {
    const mesh = new Mesh(stationShape(st.size, colorOf(st.owner)), stationMat);
    let yaw = 0;
    const t = s.track[st.y * s.w + st.x];
    for (let d = 0; d < 8; d++) if ((t >> d) & 1) { yaw = Math.atan2(DX[d], DY[d]); break; }
    mesh.rotation.y = yaw + Math.PI;
    mesh.position.set(st.x + 0.5, g.tileY(st.x, st.y), st.y + 0.5);
    mesh.userData.station = st.id; mesh.userData.cast = true; mesh.userData.recv = true;
    mesh.castShadow = mesh.receiveShadow = q >= 1;
    root.add(mesh);
  }
  return root;
}
