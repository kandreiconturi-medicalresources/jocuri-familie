// Încărcare GLB Kenney cu LoadingManager: progres real, tolerant la modele lipsă (cutie de rezervă).
// Fiecare model devine o listă de „părți” { geo, mat }: geometrie coaptă (matricea nodului aplicată), un singur material per textură.
import { LoadingManager, BoxGeometry, MeshLambertMaterial, Color } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const BASE = '../../models/trenuri/';
const cache = new Map();
// Culorile frunzelor din kitul nature ies albăstrui: le înlocuim după numele materialului
const TINT = { leafsGreen: 0x5cb04a, leafsDark: 0x3f8f45, grass: 0x7bc35a, woodBark: 0x8a5a3a, woodBarkDark: 0x6e4a30 };
export const missing = [];

function fallback(name) {
  const g = new BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0);
  return [{ geo: g, mat: new MeshLambertMaterial({ color: new Color(/train/.test(name) ? 0xb04040 : 0xc9b79c) }) }];
}

function bake(scene) {
  scene.updateMatrixWorld(true);
  const groups = new Map();
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry.attributes.position) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', g.attributes.position.clone());
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(o.matrixWorld);
    const m = o.material, col = TINT[m.name] !== undefined ? new Color(TINT[m.name]) : m.color, key = (m.map ? m.map.uuid : '') + col.getHexString();
    if (!groups.has(key)) groups.set(key, { mat: new MeshLambertMaterial({ map: m.map || null, color: col.clone() }), list: [] });
    groups.get(key).list.push(g);
  });
  return [...groups.values()].map((q) => ({ geo: q.list.length > 1 ? mergeGeometries(q.list) : q.list[0], mat: q.mat }));
}

/** names: ['kit/nume', ...]. Întoarce promisiunea cache-ului; onProgress(0..1) după octeți și fișiere. */
export function loadModels(names, onProgress = () => {}) {
  const need = names.filter((n) => !cache.has(n));
  const manager = new LoadingManager();
  const loader = new GLTFLoader(manager);
  const frac = {}; let done = 0;
  const report = () => onProgress(Math.min(1, (done + need.reduce((s, n) => s + (frac[n] || 0), 0)) / Math.max(1, need.length)));
  report();
  let next = 0;
  const worker = async () => {
    while (next < need.length) {
      const n = need[next++];
      try {
        const gltf = await new Promise((ok, bad) => loader.load(`${BASE}${n}.glb`, ok, (e) => {
          if (e.lengthComputable) { frac[n] = e.loaded / e.total; report(); }
        }, bad));
        cache.set(n, bake(gltf.scene));
      } catch (e) {
        missing.push(n);
        cache.set(n, fallback(n));
      }
      frac[n] = 0; done++; report();
    }
  };
  return Promise.all(Array.from({ length: Math.min(6, need.length) }, worker)).then(() => { onProgress(1); return cache; });
}

export const getParts = (name) => cache.get(name) || fallback(name);
