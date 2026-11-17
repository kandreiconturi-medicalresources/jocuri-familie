// Oameni low-poly: două plase instanțiate (haine = culoare pe instanță; cap, picioare și păr cu nuanța pielii), fără schelet.
import { InstancedMesh, MeshLambertMaterial } from 'three';
import { Builder } from './geo.js';

export const CLOTHES = ['#d64a3a', '#3a7ad6', '#3aa65a', '#e0a020', '#8a5ad6', '#e8e8e8', '#ff8fb1', '#2f9aa0', '#c46a2a', '#5b6b7a', '#1f3d7a', '#7a1f3d'];
export const SKINS = ['#ffffff', '#f3d9c4', '#d6b08c', '#9a7050'];
const lam = new MeshLambertMaterial({ vertexColors: true });

function geo(parts) {
  const B = new Builder();
  for (const p of parts) B.obox(p[0], p[1], p[2], 0, 1, p[3], p[4], p[5], p[6]);
  return B.geometry();
}

export function makePeopleMeshes(max) {
  const body = geo([[0, 0.085, 0, 0.015, 0.027, 0.0275, '#ffffff'], [-0.036, 0.085, 0, 0.011, 0.007, 0.025, '#ffffff'], [0.036, 0.085, 0, 0.011, 0.007, 0.025, '#ffffff']]);
  const skin = geo([[-0.012, 0.0275, 0, 0.011, 0.011, 0.0275, '#3a4256'], [0.012, 0.0275, 0, 0.011, 0.011, 0.0275, '#3a4256'], [0, 0.125, 0, 0.02, 0.02, 0.02, '#f0c8a0'], [0, 0.148, -0.002, 0.021, 0.021, 0.006, '#3d2b1f']]);
  const out = [body, skin].map((gm) => { const m = new InstancedMesh(gm, lam, max); m.frustumCulled = false; m.count = 0; return m; });
  return { body: out[0], skin: out[1] };
}
