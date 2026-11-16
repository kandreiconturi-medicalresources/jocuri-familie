// Umbre „blob” (calitate 0): discuri moi întunecate sub copaci, clădiri și trenuri, într-un singur InstancedMesh.
import { InstancedMesh, PlaneGeometry, MeshBasicMaterial, Matrix4, Vector3, Quaternion } from 'three';
import { softTexture } from './texgen.js';
import { perf } from '../../../../shared/engine/perf.js';

let geo = null, mat = null;
const m4 = new Matrix4(), q = new Quaternion(), v = new Vector3(), sc = new Vector3();
export function blobMaterial() {
  if (!mat) mat = new MeshBasicMaterial({ map: softTexture(), color: 0x1d2a14, transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  return mat;
}
export function blobGeometry() {
  if (!geo) { geo = new PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2); }
  return geo;
}
/** list: [{x,y,z,r}] — r = raza discului. Vizibil doar la calitate 0 (stage.js comută după userData.blob). */
export function blobMesh(list, max = list.length) {
  const im = new InstancedMesh(blobGeometry(), blobMaterial(), Math.max(1, max));
  im.userData.blob = true; im.visible = perf.quality() === 0; im.frustumCulled = false; im.renderOrder = 3;
  im.count = Math.min(list.length, max);
  for (let i = 0; i < im.count; i++) { const b = list[i]; im.setMatrixAt(i, m4.compose(v.set(b.x, b.y + 0.025, b.z), q.identity(), sc.set(b.r * 2, 1, (b.rz || b.r) * 2))); }
  im.instanceMatrix.needsUpdate = true;
  return im;
}
