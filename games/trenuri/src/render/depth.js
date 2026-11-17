// Adâncimea apei: un strat translucid cu o textură de câte un pixel pe placă (filtrare liniară).
// Aproape de mal apa e turcoaz limpede (transparentă), departe de uscat devine albastru adânc. Un singur apel de desen.
import { Mesh, PlaneGeometry, MeshBasicMaterial, CanvasTexture, LinearFilter, DoubleSide } from 'three';
import { WATER_Y } from './ground.js';

const R = 5; // raza (în plăci) la care se măsoară cât uscat e în jur

/** Adâncimea 0..255 pe placă (0 = mal, 255 = larg în mare); funcție pură, folosită și în teste. */
export function depthMap(s) {
  const w = s.w, h = s.h, tmp = new Float32Array(w * h), out = new Uint8Array(w * h), n = 2 * R + 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { // suma pe orizontală
    let c = 0; for (let d = -R; d <= R; d++) { const xx = x + d; if (xx >= 0 && xx < w && !s.water[y * w + xx]) c++; }
    tmp[y * w + x] = c;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let c = 0; for (let d = -R; d <= R; d++) { const yy = y + d; if (yy >= 0 && yy < h) c += tmp[yy * w + x]; }
    out[y * w + x] = Math.round(255 * (1 - Math.min(1, (c / (n * n)) * 5)));
  }
  return out;
}

export function createDepth(s) {
  const cv = document.createElement('canvas');
  cv.width = s.w; cv.height = s.h;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(s.w, s.h);
  const tex = new CanvasTexture(cv);
  tex.magFilter = LinearFilter; tex.minFilter = LinearFilter; tex.generateMipmaps = false;
  const mat = new MeshBasicMaterial({ map: tex, transparent: true, opacity: 1, depthWrite: false, side: DoubleSide });
  const mesh = new Mesh(new PlaneGeometry(s.w, s.h), mat);
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(s.w / 2, WATER_Y - 0.002, s.h / 2); mesh.renderOrder = 1.5;
  function rebuild() {
    const m = depthMap(s);
    for (let i = 0; i < m.length; i++) { // mal: turcoaz deschis, ușor transparent -> larg: albastru adânc
      const k = m[i] / 255;
      img.data[i * 4] = Math.round(70 - 55 * k); img.data[i * 4 + 1] = Math.round(190 - 100 * k); img.data[i * 4 + 2] = Math.round(190 - 20 * k);
      img.data[i * 4 + 3] = s.water[i] ? Math.round(110 + 90 * k) : 0;
    }
    ctx.putImageData(img, 0, 0);
    tex.needsUpdate = true;
  }
  rebuild();
  return {
    mesh, rebuild,
    tick(night = 0) { mat.color.setRGB(1 - 0.6 * night, 1 - 0.55 * night, 1 - 0.3 * night); },
    dispose() { tex.dispose(); mat.dispose(); mesh.geometry.dispose(); },
  };
}
