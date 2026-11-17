// Trenuri procedurale: o singură geometrie îmbinată per vehicul (locomotivă pe model, vagon pe tip), cu culoarea
// companiei în livrea; geometriile se memorează după model + culoare. Dacă ceva eșuează, trains.js folosește modelele glb.
import { Group, Mesh, MeshBasicMaterial, DoubleSide } from 'three';
import { Builder } from './geo.js';
import { MODELS } from '../sim/consts.js';
import { steam, STEAM } from './locoSteam.js';
import { sleek, diesel, SLEEK } from './locoModern.js';
import { wagon } from './wagons.js';
import { bodyMat, addHeadlights, SCALE } from './trainParts.js';
import { perf } from '../../../../shared/engine/perf.js';

const cache = new Map();
let lampMat = null, solid = null;

/** Dimensiuni (jumătăți) pentru încărcături: aceleași ca la modelele glb, vagoanele noastre au lățime similară. */
function build(kind, id, color) {
  const key = kind + id + color;
  if (cache.has(key)) return cache.get(key);
  const B = new Builder(), L = new Builder();
  if (kind === 'loco') {
    const k = MODELS[id].key;
    if (STEAM[k]) steam(B, L, color, k); else if (SLEEK[k]) sleek(B, L, color, k); else diesel(B, L, color);
  } else wagon(B, color, id);
  const r = { geo: B.geometry(), lamps: L.empty ? null : L.geometry(), tris: B.p.length / 9 };
  cache.set(key, r);
  return r;
}

/** Grup gata de pus pe traseu (scalat ca la glb), sau null dacă modelul nu există. kind: 'loco' | 'car'; id: model / tip vagon. */
export function vehicle(kind, id, color) {
  try {
    if (kind === 'loco' && !MODELS[id]) return null;
    const v = build(kind, id, color), gr = new Group(), on = perf.quality() >= 1;
    if (!solid) { solid = bodyMat(); solid.side = DoubleSide; lampMat = new MeshBasicMaterial({ vertexColors: true }); }
    const m = new Mesh(v.geo, solid); m.userData.cast = true; m.castShadow = on; gr.add(m);
    if (v.lamps) gr.add(new Mesh(v.lamps, lampMat));
    if (kind === 'loco') addHeadlights(gr, 0.6, 1.45);
    gr.scale.setScalar(SCALE);
    gr.rotation.order = 'YXZ';
    return gr;
  } catch (e) { return null; }
}
export const triangles = (kind, id, color = '#ff6b6b') => build(kind, id, color).tris;
