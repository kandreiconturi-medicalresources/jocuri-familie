// Șine (InstancedMesh, refăcut doar când se schimbă), poduri și gări.
import { Group, InstancedMesh, Mesh, Matrix4, Quaternion, Vector3, Euler, MeshLambertMaterial, Color } from 'three';
import { DX, DY, T_BRIDGE, T_PRESENT } from '../sim/consts.js';
import { railSegment, railNode, bridgeDeck, stationShape } from './shapes.js';

const mat = new MeshLambertMaterial({ vertexColors: true });
const geoSeg = railSegment(), geoNode = railNode(), geoBridge = bridgeDeck();
const m4 = new Matrix4(), q = new Quaternion(), eu = new Euler(), v = new Vector3(), sc = new Vector3(), up = new Vector3(0, 1, 0);

function layer(geo, list) {
  const im = new InstancedMesh(geo, mat, Math.max(1, list.length));
  im.count = list.length;
  list.forEach((a, i) => im.setMatrixAt(i, a));
  im.instanceMatrix.needsUpdate = true;
  im.frustumCulled = false;
  return im;
}

export function createTrack(s, g) {
  const root = new Group(), segs = [], nodes = [], bridges = [];
  const lift = (i) => g.tileY(i % s.w, (i / s.w) | 0) + 0.01;
  for (let i = 0; i < s.track.length; i++) {
    const t = s.track[i];
    if (!(t & T_PRESENT)) continue;
    const x = i % s.w, y = (i / s.w) | 0, y0 = lift(i);
    nodes.push(m4.compose(v.set(x + 0.5, y0, y + 0.5), q.identity(), sc.set(1, 1, 1)).clone());
    if (t & T_BRIDGE) bridges.push(m4.compose(v.set(x + 0.5, y0, y + 0.5), q.identity(), sc.set(1, 1, 1)).clone());
    for (let d = 2; d <= 5; d++) { // doar direcțiile cu index mai mare: fiecare legătură o singură dată
      if (!((t >> d) & 1)) continue;
      const nx = x + DX[d], ny = y + DY[d], y1 = lift(ny * s.w + nx);
      const dx = DX[d], dz = DY[d], flat = Math.hypot(dx, dz), dy = y1 - y0;
      const len = Math.hypot(flat, dy);
      q.setFromUnitVectors(up.set(0, 0, 1), v.set(dx, dy, dz).normalize());
      segs.push(m4.compose(v.set(x + 0.5 + dx / 2, (y0 + y1) / 2, y + 0.5 + dz / 2), q, sc.set(1, 1, len)).clone());
    }
  }
  root.add(layer(geoSeg, segs), layer(geoNode, nodes), layer(geoBridge, bridges));
  return root;
}

const stationMats = {};
const stationMat = () => stationMats.m || (stationMats.m = new MeshLambertMaterial({ vertexColors: true }));

export function createStations(s, g, colorOf) {
  const root = new Group();
  for (const st of s.stations) {
    const geo = stationShape(st.size, colorOf(st.owner));
    const mesh = new Mesh(geo, stationMat());
    let yaw = 0;
    const t = s.track[st.y * s.w + st.x];
    for (let d = 0; d < 8; d++) if ((t >> d) & 1) { yaw = Math.atan2(DX[d], DY[d]); break; }
    mesh.rotation.y = yaw + Math.PI;
    mesh.position.set(st.x + 0.5, g.tileY(st.x, st.y), st.y + 0.5);
    mesh.userData.station = st.id;
    root.add(mesh);
  }
  return root;
}
