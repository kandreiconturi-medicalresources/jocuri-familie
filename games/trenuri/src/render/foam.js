// Spumă la mal (7.7): un singur plan alb peste apă, cu o textură de câte un pixel pe placă (netezită de filtrarea liniară).
// Pixelul e cu atât mai alb cu cât sunt mai multe plăci de uscat în jur. Se „respiră” ușor în timp (val). Un singur apel de desen.
import { Mesh, PlaneGeometry, MeshBasicMaterial, CanvasTexture, LinearFilter, DoubleSide } from 'three';
import { WATER_Y } from './ground.js';

/** Valorile 0..255 ale spumei pe fiecare placă (funcție pură, folosită și în teste). */
export function foamMap(s) {
  const w = s.w, h = s.h, out = new Uint8Array(w * h);
  const land = (x, y) => x >= 0 && y >= 0 && x < w && y < h && !s.water[y * w + x];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let n = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (land(x + dx, y + dy)) n++;
    const i = y * w + x;
    if (s.water[i]) out[i] = Math.min(255, Math.round(255 * Math.min(1, (n / 25) * 3.4)));
    else { let wet = false; for (let k = 0; k < 4 && !wet; k++) wet = !land(x + (k === 0 ? 1 : k === 1 ? -1 : 0), y + (k === 2 ? 1 : k === 3 ? -1 : 0)); out[i] = wet ? 230 : 0; }
  }
  return out;
}

export function createFoam(s) {
  const cv = document.createElement('canvas');
  cv.width = s.w; cv.height = s.h;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(s.w, s.h);
  const tex = new CanvasTexture(cv);
  tex.magFilter = LinearFilter; tex.minFilter = LinearFilter; tex.generateMipmaps = false;
  const mat = new MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.7, depthWrite: false, side: DoubleSide });
  const mesh = new Mesh(new PlaneGeometry(s.w, s.h), mat);
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(s.w / 2, WATER_Y + 0.003, s.h / 2); mesh.renderOrder = 3;
  function rebuild() {
    const m = foamMap(s);
    for (let i = 0; i < m.length; i++) { img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255; img.data[i * 4 + 3] = m[i]; }
    ctx.putImageData(img, 0, 0);
    tex.needsUpdate = true;
  }
  rebuild();
  return {
    mesh, rebuild,
    tick(t, night = 0) { mat.opacity = 0.62 + 0.22 * Math.sin(t * 1.6); mat.color.setRGB(1 - 0.5 * night, 1 - 0.45 * night, 1 - 0.25 * night); },
    dispose() { tex.dispose(); mat.dispose(); mesh.geometry.dispose(); },
  };
}
