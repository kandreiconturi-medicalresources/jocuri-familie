// Mașinile: o singură plasă per mașină (roțile coapte în caroserie), umbră simplă pe jos.
import { CircleGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { bake, getModel } from './models.js';
import { lambert } from './world.js';

export const CAR_SCALE = 3.6;
const geos = {};
const blobGeo = new CircleGeometry(1, 14);
blobGeo.rotateX(-Math.PI / 2);
const blobMat = new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
const mat = lambert();

export function createCarMesh(colorId, shadows) {
  const geo = geos[colorId] || (geos[colorId] = bake(getModel('raceCar' + colorId).clone(true)));
  const g = new Group(), pivot = new Group();
  const body = new Mesh(geo, mat);
  body.scale.setScalar(CAR_SCALE);
  body.castShadow = shadows;
  pivot.add(body);
  const blob = new Mesh(blobGeo, blobMat);
  blob.scale.set(CAR_SCALE * 0.42, 1, CAR_SCALE * 0.7); blob.position.y = 0.08;
  g.add(blob); g.add(pivot);
  g.userData = { pivot, blob, body };
  return g;
}

/** Pune mașina pe poziția (interpolată) și o înclină la viraj/drift/accelerare. */
export function poseCar(g, car, a) {
  const px = car.px === undefined ? car.x : car.px, pz = car.pz === undefined ? car.z : car.pz;
  const py = car.py === undefined ? car.y : car.py, pa = car.pa === undefined ? car.angle : car.pa;
  let da = car.angle - pa;
  if (da > Math.PI) da -= Math.PI * 2; else if (da < -Math.PI) da += Math.PI * 2;
  g.position.set(px + (car.x - px) * a, py + (car.y - py) * a, pz + (car.z - pz) * a);
  g.rotation.y = Math.PI - (pa + da * a);
  g.userData.pivot.rotation.z = -car.steer * 0.06 * Math.min(1, Math.abs(car.speed) / 25); // se apleacă în afara virajului
  g.userData.pivot.rotation.x = car.boost > 0 ? -0.05 : 0;
  g.userData.blob.visible = true;
}
