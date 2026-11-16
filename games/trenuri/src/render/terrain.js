// Teren pe bucăți (32×32, culling): iarbă texturată + culori pe vârfuri (nisip la mal, stâncă pe pante, nuanțe line) + apă animată.
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, Mesh, MeshLambertMaterial, MeshBasicMaterial, PlaneGeometry, Color, Group, DoubleSide } from 'three';
import { WATER_Y } from './ground.js';
import { grassTexture, waterTexture } from './texgen.js';
import { perf } from '../../../../shared/engine/perf.js';

const CH = 32, UV = 1 / 3.2;
const PAL = [ // înălțime 0..15 -> culoare
  '#4f8f95', '#4f8f95', '#4f8f95', '#4f8f95', '#e3cf94', '#a8d26a', '#96ca5e', '#85c253', '#78b84b', '#6aa842', '#789f4a', '#98996a', '#a89d8e', '#b9b2a8', '#d8d6d2', '#f4f4f4',
].map((c) => new Color(c));
const ROCK = new Color('#8f897e'), SAND = new Color('#dccb92'), DEEP = new Color('#2d6f95'), WET = new Color('#bba975');

const hash = (x, y) => { let h = Math.imul(x, 73856093) ^ Math.imul(y, 19349663); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const smooth = (t) => t * t * (3 - 2 * t);
function vnoise(x, y) {
  const i = Math.floor(x), j = Math.floor(y), fx = smooth(x - i), fy = smooth(y - j);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

function tileColor(s, x, y, out) {
  x = Math.max(0, Math.min(s.w - 1, x)); y = Math.max(0, Math.min(s.h - 1, y));
  const i = y * s.w + x;
  out.copy(PAL[s.water[i] ? 0 : s.height[i]]);
  if (s.forest[i]) out.multiplyScalar(0.84);
  return out;
}

let mat = null;
const MATERIAL = () => mat || (mat = new MeshLambertMaterial({ vertexColors: true, map: grassTexture(perf.quality() >= 1 ? 256 : 128), color: new Color(1.2, 1.2, 1.15) }));

function chunk(s, g, cx, cy) {
  const x0 = cx * CH, y0 = cy * CH, nx = Math.min(CH, s.w - x0), ny = Math.min(CH, s.h - y0), W = nx + 1;
  const pos = new Float32Array(W * (ny + 1) * 3), nor = new Float32Array(pos.length), col = new Float32Array(pos.length), uv = new Float32Array(W * (ny + 1) * 2);
  const c = new Color(), tmp = new Color(), idx = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const gx = x0 + i, gy = y0 + j, k = (j * W + i) * 3;
    const y = g.vy[gy * g.W + gx];
    pos[k] = gx; pos[k + 1] = y; pos[k + 2] = gy; uv[(j * W + i) * 2] = gx * UV; uv[(j * W + i) * 2 + 1] = gy * UV;
    const l = g.vy[gy * g.W + Math.max(0, gx - 1)], r = g.vy[gy * g.W + Math.min(s.w, gx + 1)];
    const u = g.vy[Math.max(0, gy - 1) * g.W + gx], d = g.vy[Math.min(s.h, gy + 1) * g.W + gx];
    const nlen = Math.hypot(l - r, 2, u - d);
    nor[k] = (l - r) / nlen; nor[k + 1] = 2 / nlen; nor[k + 2] = (u - d) / nlen;
    c.setRGB(0, 0, 0);
    for (let q = 0; q < 4; q++) c.add(tileColor(s, gx - 1 + (q & 1), gy - 1 + (q >> 1), tmp));
    c.multiplyScalar(0.25);
    const n = vnoise(gx * 0.16, gy * 0.16) * 0.6 + vnoise(gx * 0.55, gy * 0.55) * 0.4; // petice mari de nuanță
    c.r *= 0.9 + 0.24 * n + 0.07 * (n - 0.5); c.g *= 0.9 + 0.2 * n; c.b *= 0.9 + 0.2 * n - 0.1 * (n - 0.5);
    const slope = 1 - nor[k + 1];
    if (y > 0.12) c.lerp(ROCK, smooth(Math.min(1, Math.max(0, (slope - 0.1) / 0.14))) * 0.85); // stâncă pe pante
    if (y > -0.04 && y < 0.07) c.lerp(y < 0.02 ? WET : SAND, 0.55); // mal: nisip ud, apoi uscat
    else if (y <= -0.04) c.lerp(DEEP, Math.min(0.75, (-0.04 - y) * 6)); // fund de apă
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
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geo.setIndex(new Uint32BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  const m = new Mesh(geo, MATERIAL());
  m.userData.recv = true; m.receiveShadow = perf.quality() >= 1;
  return m;
}

export function createTerrain(s, g) {
  const root = new Group(), chunks = new Map();
  for (let cy = 0; cy * CH < s.h; cy++) for (let cx = 0; cx * CH < s.w; cx++) { const m = chunk(s, g, cx, cy); chunks.set(cy * 1000 + cx, m); root.add(m); }
  const tex = waterTexture(), tex2 = waterTexture(), big = Math.max(s.w, s.h) * 4;
  tex.repeat.set(big / 6, big / 6); tex2.repeat.set(big / 9, big / 9);
  const wm = new MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.86, side: DoubleSide, depthWrite: false });
  const water = new Mesh(new PlaneGeometry(big, big), wm);
  water.rotation.x = -Math.PI / 2; water.position.set(s.w / 2, WATER_Y - 0.005, s.h / 2); water.renderOrder = 1;
  const glint = new Mesh(water.geometry, new MeshBasicMaterial({ map: tex2, transparent: true, opacity: 0.2, side: DoubleSide, depthWrite: false })); // al doilea strat, alt ritm: sclipiri
  glint.rotation.copy(water.rotation); glint.position.copy(water.position); glint.position.y += 0.004; glint.renderOrder = 2;
  root.add(water, glint);
  return {
    root,
    /** După nivelare: reface doar bucățile (cx, cy) date. */
    rebuild(list) {
      for (const [cx, cy] of list) {
        const old = chunks.get(cy * 1000 + cx);
        if (old) { root.remove(old); old.geometry.dispose(); }
        const m = chunk(s, g, cx, cy);
        chunks.set(cy * 1000 + cx, m); root.add(m);
      }
    },
    tick(t, night = 0) {
      tex.offset.set(t * 0.004, t * 0.0026); tex2.offset.set(-t * 0.0033, t * 0.0021);
      wm.color.setRGB(1 - 0.6 * night, 1 - 0.55 * night, 1 - 0.3 * night); glint.material.color.copy(wm.color);
    },
    dispose() { root.traverse((o) => o.geometry && o.geometry.dispose()); },
  };
}
