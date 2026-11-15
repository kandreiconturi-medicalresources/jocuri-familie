// Încărcare GLB (Kenney) cu bară de progres și „coacere” în geometrii cu culori pe vârfuri:
// o singură geometrie per model, fără materiale/texturi → o singură desenare pentru toată pista.
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BufferGeometry, Float32BufferAttribute } from 'three';

const URLS = import.meta.glob('../../assets/models/*.glb', { query: '?url', import: 'default', eager: true });
const urlOf = (name) => URLS[`../../assets/models/${name}.glb`];

const cache = {};

/** Încarcă modelele (o dată), raportează progresul 0..1 (după fișiere + octeți). Întoarce { nume: scenă }. */
export function loadModels(names, onProgress = () => {}) {
  const need = names.filter((n) => !cache[n] && urlOf(n));
  const loader = new GLTFLoader();
  const bytes = {};
  let done = 0;
  const report = () => {
    const part = need.reduce((s, n) => s + (bytes[n] || 0), 0) / Math.max(1, need.length);
    onProgress(Math.min(1, (done + part) / Math.max(1, need.length)));
  };
  report();
  // câte 6 în paralel, ca să nu sufoce un dispozitiv slab
  let next = 0;
  const worker = async () => {
    while (next < need.length) {
      const n = need[next++];
      cache[n] = await new Promise((ok, bad) => loader.load(urlOf(n), (g) => ok(g.scene), (e) => {
        if (e.lengthComputable) { bytes[n] = e.loaded / e.total; report(); }
      }, bad));
      done++; bytes[n] = 0; report();
    }
  };
  return Promise.all(Array.from({ length: Math.min(6, need.length) }, worker)).then(() => { onProgress(1); return cache; });
}

export const getModel = (n) => cache[n];

/** Culorile materialelor sunt înlocuite cu `colorFor(numeMaterial, culoareOriginală)` (sau rămân). */
export function bake(scene, colorFor) {
  const root = scene.children[0];
  if (root) root.position.set(0, 0, 0); // Kenney exportă cu un decalaj fix al nodului rădăcină: îl scoatem
  scene.updateMatrixWorld(true);
  const pos = [], nor = [], col = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    const m = o.material, c = (colorFor && colorFor(m.name, m.color)) || m.color;
    g.applyMatrix4(o.matrixWorld);
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); }
    for (let i = 0; i < p.length / 3; i++) col.push(c.r, c.g, c.b);
  });
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new Float32BufferAttribute(col, 3));
  return geo;
}
