// Teren pe bucăți (chunk-uri 32×32, culling) cu culori pe înălțime + apă albastră animată simplu.
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, Mesh, MeshLambertMaterial, MeshBasicMaterial, PlaneGeometry, CanvasTexture, RepeatWrapping, Color, Group, DoubleSide } from 'three';
import { WATER_Y } from './ground.js';

const CH = 32;
const PAL = [ // înălțime 0..15 -> culoare
  '#6a8f7a', '#6a8f7a', '#6a8f7a', '#6a8f7a', '#e6d59a', '#a9d36b', '#97cb5f', '#86c254', '#79b84c', '#6ba843', '#7e9f4a', '#9a9a6a', '#a89d8e', '#b9b2a8', '#d8d6d2', '#f4f4f4',
].map((c) => new Color(c));

const jitter = (x, y) => { let h = Math.imul(x, 73856093) ^ Math.imul(y, 19349663); h = Math.imul(h ^ (h >>> 13), 1274126177); return (((h ^ (h >>> 16)) >>> 0) & 255) / 255; };

function tileColor(s, x, y, out) {
  x = Math.max(0, Math.min(s.w - 1, x)); y = Math.max(0, Math.min(s.h - 1, y));
  const i = y * s.w + x;
  out.copy(PAL[s.water[i] ? 0 : s.height[i]]);
  if (s.forest[i]) out.multiplyScalar(0.82);
  return out;
}

function chunk(s, g, cx, cy) {
  const x0 = cx * CH, y0 = cy * CH, nx = Math.min(CH, s.w - x0), ny = Math.min(CH, s.h - y0), W = nx + 1;
  const pos = new Float32Array(W * (ny + 1) * 3), nor = new Float32Array(pos.length), col = new Float32Array(pos.length);
  const c = new Color(), tmp = new Color(), idx = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const gx = x0 + i, gy = y0 + j, k = (j * W + i) * 3;
    const y = g.vy[gy * g.W + gx];
    pos[k] = gx; pos[k + 1] = y; pos[k + 2] = gy;
    const l = g.vy[gy * g.W + Math.max(0, gx - 1)], r = g.vy[gy * g.W + Math.min(s.w, gx + 1)];
    const u = g.vy[Math.max(0, gy - 1) * g.W + gx], d = g.vy[Math.min(s.h, gy + 1) * g.W + gx];
    const nlen = Math.hypot(l - r, 2, u - d);
    nor[k] = (l - r) / nlen; nor[k + 1] = 2 / nlen; nor[k + 2] = (u - d) / nlen;
    c.setRGB(0, 0, 0);
    for (let q = 0; q < 4; q++) c.add(tileColor(s, gx - 1 + (q & 1), gy - 1 + (q >> 1), tmp));
    c.multiplyScalar(0.25 * (0.94 + 0.12 * jitter(gx, gy)));
    col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * W + i;
    idx.push(a, a + W, a + 1, a + 1, a + W, a + W + 1);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new Float32BufferAttribute(col, 3));
  geo.setIndex(new Uint32BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return new Mesh(geo, MATERIAL());
}

let mat = null;
const MATERIAL = () => mat || (mat = new MeshLambertMaterial({ vertexColors: true }));

function waterTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const x = cv.getContext('2d');
  x.fillStyle = '#3fa7e0'; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 2; x.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const px = (i * 53) % 128, py = (i * 97) % 128;
    for (const dx of [-128, 0, 128]) { x.beginPath(); x.moveTo(px + dx, py); x.quadraticCurveTo(px + dx + 8, py - 4, px + dx + 16, py); x.stroke(); }
  }
  const t = new CanvasTexture(cv); t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

export function createTerrain(s, g) {
  const root = new Group();
  for (let cy = 0; cy * CH < s.h; cy++) for (let cx = 0; cx * CH < s.w; cx++) root.add(chunk(s, g, cx, cy));
  const tex = waterTexture(), big = Math.max(s.w, s.h) * 4;
  tex.repeat.set(big / 6, big / 6);
  const water = new Mesh(new PlaneGeometry(big, big), new MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.88, side: DoubleSide }));
  water.rotation.x = -Math.PI / 2; water.position.set(s.w / 2, WATER_Y - 0.005, s.h / 2);
  root.add(water);
  return { root, tick(t) { tex.offset.set(t * 0.004, t * 0.0026); }, dispose() { root.traverse((o) => o.geometry && o.geometry.dispose()); } };
}
