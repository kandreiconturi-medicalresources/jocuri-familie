// Poziția unui tren pe traseu (în coordonate de lume), din distanța parcursă (1/256 de placă).
import { DX, DY } from '../sim/consts.js';
const cache = new WeakMap(), stubs = new Map();

/** Traseu de două plăci pentru un tren care stă în gară fără drum (nou cumpărat): cu fața spre gară pe prima legătură, vagoanele pe șină. */
export function stubPath(s, st) {
  const i = st.y * s.w + st.x, key = st.id + ':' + st.x + ',' + st.y + ',' + s.track[i];
  let p = stubs.get(key);
  if (!p) {
    let d = 0; for (; d < 8; d++) if ((s.track[i] >> d) & 1) break;
    const nx = st.x + (DX[d] | 0), ny = st.y + (DY[d] | 0);
    p = d < 8 && nx >= 0 && ny >= 0 && nx < s.w && ny < s.h ? [ny * s.w + nx, i] : [i];
    stubs.set(key, p);
    if (stubs.size > 300) stubs.delete(stubs.keys().next().value);
  }
  return p;
}

/** Distanțe cumulate pe traseu (în 1/256), memorate pe tabloul traseului. */
export function cumOf(s, path) {
  let c = cache.get(path);
  if (c) return c;
  c = [0];
  for (let k = 0; k + 1 < path.length; k++) {
    const dx = (path[k + 1] % s.w) - (path[k] % s.w), dy = ((path[k + 1] / s.w) | 0) - ((path[k] / s.w) | 0);
    c.push(c[k] + (dx && dy ? 362 : 256));
  }
  cache.set(path, c);
  return c;
}
export const travelled = (s, t) => (t.path.length > 1 ? cumOf(s, t.path)[t.seg] + t.pos : 0);

const lerpAng = (a, b, f) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * f; };
const out = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };

/** Întoarce același obiect refolosit { x, y, z, yaw, pitch }. `g` = ground (tileY). */
export function poseAt(s, g, path, d, o = out) {
  const n = path.length;
  if (n < 2) { const i = path[0] || 0; o.x = (i % s.w) + 0.5; o.z = ((i / s.w) | 0) + 0.5; o.y = 0; o.yaw = 0; o.pitch = 0; return o; }
  const cum = cumOf(s, path), last = n - 2;
  let k = 0;
  if (d >= cum[last + 1]) k = last;
  else if (d > 0) { let lo = 0, hi = last; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (cum[mid] <= d) lo = mid; else hi = mid - 1; } k = lo; }
  const L = cum[k + 1] - cum[k], local = d - cum[k], f = local / L;
  const ax = path[k] % s.w, az = (path[k] / s.w) | 0, bx = path[k + 1] % s.w, bz = (path[k + 1] / s.w) | 0;
  const yawOf = (j) => Math.atan2((path[j + 1] % s.w) - (path[j] % s.w), ((path[j + 1] / s.w) | 0) - ((path[j] / s.w) | 0));
  let yaw = yawOf(k);
  if (local < 96 && k > 0) yaw = lerpAng(yawOf(k - 1), yaw, 0.5 + 0.5 * Math.max(0, local) / 96);
  else if (L - local < 96 && k < last) yaw = lerpAng(yaw, yawOf(k + 1), 0.5 * (1 - (L - local) / 96));
  const ay = g.tileY(ax, az), by = g.tileY(bx, bz);
  o.x = ax + 0.5 + (bx - ax) * f; o.z = az + 0.5 + (bz - az) * f; o.y = ay + (by - ay) * Math.min(1, Math.max(0, f)) + 0.03;
  o.yaw = yaw; o.pitch = Math.atan2(by - ay, L / 256);
  return o;
}
