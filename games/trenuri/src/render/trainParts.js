// Piese ale unui tren: grup de model Kenney + dungă în culoarea companiei + cuplaj + far (noaptea). Geometriile se refolosesc.
import { Group, Mesh, MeshLambertMaterial, MeshBasicMaterial, Sprite, SpriteMaterial, PlaneGeometry, AdditiveBlending, DoubleSide } from 'three';
import { getParts } from './models.js';
import { Builder } from './geo.js';
import { softTexture } from './texgen.js';
import { perf } from '../../../../shared/engine/perf.js';

export const SCALE = 0.34;
const trim = new Map(), bbox = new Map(), stripeMat = new MeshLambertMaterial({ vertexColors: true });
let glowMat = null, beamMat = null, beamGeo = null;
export const lights = { get glow() { return glowMat; }, get beam() { return beamMat; } };

function box(name) {
  if (bbox.has(name)) return bbox.get(name);
  const b = { x: 0.6, y: 1.5, z: 1.3, h: 1.5 };
  for (const p of getParts(name)) { p.geo.computeBoundingBox(); const bb = p.geo.boundingBox; b.x = Math.max(b.x, bb.max.x); b.z = Math.max(b.z, bb.max.z); b.h = Math.max(b.h, bb.max.y); }
  bbox.set(name, b);
  return b;
}
function trimGeo(name, color, loco) {
  const key = name + '|' + color + loco;
  if (trim.has(key)) return trim.get(key);
  const b = box(name), B = new Builder(), L = b.z * 2;
  for (const s of [-1, 1]) B.obox(s * (b.x + 0.012), b.h * 0.3, 0, 0, 1, L * 0.43, 0.012, b.h * 0.07, color);
  B.obox(0, 0.3, -b.z - 0.05, 0, 1, 0.22, 0.07, 0.06, '#26282c'); // cuplaj
  if (loco) B.obox(0, 0.3, b.z + 0.06, 0, 1, 0.06, 0.2, 0.06, '#26282c'); // tampon față
  const g = B.geometry();
  trim.set(key, g);
  return g;
}

/** Grup (scalat) pentru un model; loco = true adaugă far (sprite + fascicul pe sol). */
export function carGroup(name, color, loco) {
  const gr = new Group(), on = perf.quality() >= 1;
  for (const p of getParts(name)) { const m = new Mesh(p.geo, p.mat); m.userData.cast = true; m.castShadow = on; gr.add(m); }
  gr.add(new Mesh(trimGeo(name, color, loco), stripeMat));
  if (loco) {
    const b = box(name);
    if (!glowMat) {
      glowMat = new SpriteMaterial({ map: softTexture(), color: 0xfff0c0, blending: AdditiveBlending, transparent: true, depthWrite: false, opacity: 0, fog: false });
      beamMat = new MeshBasicMaterial({ map: softTexture(), color: 0xffe9b0, blending: AdditiveBlending, transparent: true, depthWrite: false, opacity: 0, side: DoubleSide });
      beamGeo = new PlaneGeometry(2.6, 7); beamGeo.rotateX(-Math.PI / 2);
    }
    const sp = new Sprite(glowMat); sp.position.set(0, 0.62, b.z + 0.15); sp.scale.set(2.2, 2.2, 1); sp.userData.light = true; sp.visible = false;
    const bm = new Mesh(beamGeo, beamMat); bm.position.set(0, 0.07, b.z + 3.6); bm.userData.light = true; bm.visible = false; bm.renderOrder = 4;
    gr.add(sp, bm);
  }
  gr.scale.setScalar(SCALE);
  gr.rotation.order = 'YXZ';
  return gr;
}
export const setNight = (n) => { if (glowMat) { glowMat.opacity = Math.min(1, n * 1.8); beamMat.opacity = Math.min(0.5, n * 0.9); } };
