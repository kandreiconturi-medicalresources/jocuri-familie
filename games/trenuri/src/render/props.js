// Decor instanțiat: liste de modele, instanțiere cu culoare/umbre. Pădurile sunt în forest.js, orașele în cities.js, drumurile în roads.js.
import { InstancedMesh, Matrix4, Quaternion, Vector3, Euler, Color } from 'three';
import { getParts } from './models.js';
import { perf } from '../../../../shared/engine/perf.js';

const N = (n) => 'nature/' + n;
export const TREE_LOW = ['tree_default', 'tree_oak', 'tree_fat', 'tree_default_fall'].map(N);
export const TREE_HIGH = ['tree_pineDefaultA', 'tree_cone', 'tree_pineRoundA'].map(N);
export const BUSHES = ['plant_bush', 'plant_bushLarge'].map(N);
export const ROCKS = ['rock_smallA', 'rock_smallB', 'rock_smallC', 'rock_largeA'].map(N);
export const PALM = N('tree_palm'), GARDEN = ['suburban/tree-small', 'suburban/tree-large'], CROPS = [N('crops_wheatStageB'), N('crops_cornStageC')];
export const ROCK = ROCKS[0];
/** Toate modelele de decor: main.js le încarcă din această listă. */
export const TREES = [...TREE_LOW, ...TREE_HIGH, ...BUSHES, ...ROCKS.slice(1), PALM, ...GARDEN, ...CROPS];
export const HOUSES = ['building-type-a', 'building-type-b', 'building-type-c', 'building-type-d', 'building-type-e', 'building-type-f', 'building-type-g', 'building-type-h'].map((n) => 'suburban/' + n)
  .concat(['commercial/building-a', 'commercial/building-b', 'commercial/building-c', 'commercial/building-d', 'commercial/building-skyscraper-a', 'commercial/building-e', 'commercial/building-skyscraper-b', 'commercial/building-skyscraper-c']);

export const hash = (x, y, k) => { let h = Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663) ^ Math.imul(k + 7, 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const m4 = new Matrix4(), q = new Quaternion(), e = new Euler(), v = new Vector3(), sc = new Vector3(), col = new Color();
export function compose(x, y, z, yaw, s) { q.setFromEuler(e.set(0, yaw, 0)); return m4.compose(v.set(x, y, z), q, sc.set(s, s, s)); }

/** Un InstancedMesh per parte a modelului; `list` = [{x,y,z,yaw,s,c?}] (c = nuanță 0xRRGGBB înmulțită cu culoarea). */
export function addInstances(group, model, list, cast = true) {
  if (!list.length) return;
  const on = perf.quality() >= 1;
  for (const p of getParts(model)) {
    const im = new InstancedMesh(p.geo, p.mat, list.length);
    list.forEach((it, i) => { im.setMatrixAt(i, compose(it.x, it.y, it.z, it.yaw, it.s)); if (it.c !== undefined) im.setColorAt(i, col.set(it.c)); });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    im.userData.cast = cast; im.userData.recv = true; im.castShadow = on && cast; im.receiveShadow = on;
    group.add(im);
  }
}

