// Generează iconițele PWA (fața lui Bobo) fără dependențe: rasterizare cu funcții de distanță + PNG scris de mână.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BODY = [0xb9, 0x77, 0x3f], BELLY = [0xf2, 0xd3, 0xac], INNER = [0xec, 0x9f, 0x78], OUT = [0x3b, 0x23, 0x14];

// ---- PNG ----
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 biți, RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- distanțe (px, negativ = înăuntru) ----
const ellipse = (cx, cy, rx, ry) => (x, y) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);
const roundRect = (S, r) => (x, y) => {
  const qx = Math.abs(x - S / 2) - (S / 2 - r), qy = Math.abs(y - S / 2) - (S / 2 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};
function curve(pts, w) { // linie groasă prin puncte
  return (x, y) => {
    let d = 1e9;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const vx = bx - ax, vy = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)));
      d = Math.min(d, Math.hypot(x - ax - vx * t, y - ay - vy * t));
    }
    return d - w / 2;
  };
}

function render(S, { rounded, face }) {
  const buf = Buffer.alloc(S * S * 4);
  const k = S * face; // unitatea feței
  const cx = S / 2, cy = S / 2 + k * 0.04;
  const E = (dx, dy, rx, ry) => ellipse(cx + dx * k, cy + dy * k, rx * k, ry * k);
  const lw = k * 0.028;
  const bgShape = rounded ? roundRect(S, S * 0.22) : () => -1;
  const layers = []; // {d, col(x,y), outline?}
  const flat = (c) => () => c;
  // fundal mov cu gradient radial
  layers.push({ d: bgShape, col: (x, y) => {
    const t = Math.min(1, Math.hypot(x - S * 0.5, y - S * 0.38) / (S * 0.75));
    return [0x7a + (0x1b - 0x7a) * t, 0x45 + (0x15 - 0x45) * t, 0xc8 + (0x30 - 0xc8) * t].map((v, i) => v * (1 - t * 0.0) + 0 * i);
  } });
  for (const s of [-1, 1]) { // urechi
    layers.push({ d: E(s * 0.33, -0.3, 0.14, 0.14), col: shadeFn(BODY, cx + s * 0.33 * k, cy - 0.3 * k, 0.14 * k), outline: lw });
    layers.push({ d: E(s * 0.33, -0.29, 0.075, 0.075), col: flat(INNER) });
  }
  layers.push({ d: E(0, 0, 0.42, 0.38), col: shadeFn(BODY, cx, cy, 0.42 * k), outline: lw });
  layers.push({ d: E(0, 0.13, 0.2, 0.15), col: flat(BELLY), outline: lw * 0.7 });
  for (const s of [-1, 1]) {
    layers.push({ d: E(s * 0.17, -0.06, 0.05, 0.057), col: flat([0x2a, 0x1a, 0x12]) });
    layers.push({ d: E(s * 0.17 - 0.015, -0.085, 0.017, 0.017), col: flat([255, 255, 255]) });
    layers.push({ d: E(s * 0.29, 0.1, 0.06, 0.04), col: flat([0xf0, 0x8a, 0x80]), alpha: 0.55 });
  }
  layers.push({ d: E(0, 0.07, 0.06, 0.045), col: flat(OUT) });
  layers.push({ d: E(-0.018, 0.058, 0.018, 0.012), col: flat([255, 255, 255]), alpha: 0.7 });
  const sm = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14; sm.push([cx + (t - 0.5) * 0.15 * k * 2, cy + (0.15 + 0.06 * (1 - (2 * t - 1) ** 2)) * k]); }
  layers.push({ d: curve(sm, lw * 1.1), col: flat(OUT) });

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      const px = x + 0.5, py = y + 0.5;
      for (const L of layers) {
        const over = (d, col, al) => {
          const cov = Math.max(0, Math.min(1, 0.5 - d)) * al;
          if (cov <= 0) return;
          const na = cov + a * (1 - cov);
          r = (col[0] * cov + r * a * (1 - cov)) / na;
          g = (col[1] * cov + g * a * (1 - cov)) / na;
          b = (col[2] * cov + b * a * (1 - cov)) / na;
          a = na;
        };
        const d = L.d(px, py);
        if (L.outline) over(d - L.outline, OUT, 1);
        over(d, L.col(px, py), L.alpha ?? 1);
      }
      const o = (y * S + x) * 4;
      buf[o] = Math.round(r); buf[o + 1] = Math.round(g); buf[o + 2] = Math.round(b); buf[o + 3] = Math.round(a * 255);
    }
  }
  return buf;
}
function shadeFn(base, cx, cy, rad) { // lumină sus-stânga
  return (x, y) => {
    const t = Math.max(0, 1 - Math.hypot(x - (cx - rad * 0.35), y - (cy - rad * 0.4)) / (rad * 1.3));
    return base.map((v) => v + (255 - v) * t * 0.3);
  };
}

const dir = resolve(import.meta.dirname, '..', 'public', 'icons');
mkdirSync(dir, { recursive: true });
const jobs = [
  ['icon-192.png', 192, { rounded: true, face: 0.9 }],
  ['icon-512.png', 512, { rounded: true, face: 0.9 }],
  ['icon-maskable-512.png', 512, { rounded: false, face: 0.74 }], // zona sigură: fața în cercul central de 80%
  ['apple-touch-icon.png', 180, { rounded: false, face: 0.9 }], // fără transparență; iOS rotunjește singur
];
for (const [name, size, opt] of jobs) {
  writeFileSync(resolve(dir, name), encodePNG(size, size, render(size, opt)));
  console.log('scris', name);
}
