// Texturi procedurale (canvas), generate o singură dată și refolosite: iarbă, apă, ogor, pată moale.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, LinearMipmapLinearFilter, LinearFilter } from 'three';

const rng = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const canvas = (n) => { const c = document.createElement('canvas'); c.width = c.height = n; return c; };
/** Desenează de până la 4 ori, ca marginile să se potrivească la repetare. */
function wrapped(n, x, y, r, fn) {
  for (const dx of x < r ? [0, n] : x > n - r ? [-n, 0] : [0]) for (const dy of y < r ? [0, n] : y > n - r ? [-n, 0] : [0]) fn(x + dx, y + dy);
}
function tex(c, repeat = true) {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
  t.generateMipmaps = true; t.minFilter = LinearMipmapLinearFilter; t.magFilter = LinearFilter; t.anisotropy = 4;
  return t;
}
function blob(x, n, px, py, rad, col, a) {
  wrapped(n, px, py, rad, (u, v) => { const g = x.createRadialGradient(u, v, 0, u, v, rad); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); x.fillStyle = g; x.fillRect(u - rad, v - rad, rad * 2, rad * 2); });
}

/** Iarbă bogată, aproape albă (se înmulțește cu culoarea de pe vârfuri): fire, pete de nuanță și de pământ. */
export function grassTexture(n = 256) {
  const c = canvas(n), x = c.getContext('2d'), r = rng(1234);
  x.fillStyle = '#d6e4bb'; x.fillRect(0, 0, n, n);
  for (let i = 0; i < n * 0.35; i++) blob(x, n, r() * n, r() * n, 10 + r() * 26, r() < 0.5 ? '170,200,120' : '238,246,214', 0.55);
  for (let i = 0; i < 5; i++) blob(x, n, r() * n, r() * n, 7 + r() * 9, '176,150,112', 0.55);
  const cols = ['#7aa24f', '#a5c873', '#e2efb8', '#d6d38c', '#5d8a3a', '#bcd88a'];
  x.lineCap = 'round';
  for (let i = 0; i < n * n / 20; i++) { // fire
    const px = r() * n, py = r() * n, h = 4 + r() * 8, lean = (r() - 0.5) * 5;
    x.strokeStyle = cols[(r() * cols.length) | 0]; x.globalAlpha = 0.6 + r() * 0.4; x.lineWidth = 1.2 + r() * 1.1;
    wrapped(n, px, py, 10, (a, b) => { x.beginPath(); x.moveTo(a, b); x.lineTo(a + lean, b - h); x.stroke(); });
  }
  x.globalAlpha = 1;
  return tex(c);
}

export function waterTexture(n = 128) {
  const c = canvas(n), x = c.getContext('2d'), r = rng(77);
  x.fillStyle = '#47a8df'; x.fillRect(0, 0, n, n);
  for (let i = 0; i < 18; i++) blob(x, n, r() * n, r() * n, 14 + r() * 22, r() < 0.5 ? '30,120,190' : '120,205,240', 0.45);
  x.lineCap = 'round';
  for (let i = 0; i < 34; i++) {
    const px = r() * n, py = r() * n, w = 8 + r() * 12;
    x.strokeStyle = `rgba(255,255,255,${0.25 + r() * 0.35})`; x.lineWidth = 1.5;
    wrapped(n, px, py, w + 4, (a, b) => { x.beginPath(); x.moveTo(a, b); x.quadraticCurveTo(a + w / 2, b - 3, a + w, b); x.stroke(); });
  }
  return tex(c);
}

/** Ogor: dungi. kind 0 = arat (pământ brun), 1 = cultură (verde-auriu). */
export function fieldTexture(kind) {
  const n = 64, c = canvas(n), x = c.getContext('2d'), r = rng(9 + kind);
  const a = kind ? ['#9ec55a', '#86b247', '#c9c15a'] : ['#8a6240', '#6f4d32', '#7d5838'];
  for (let i = 0; i < n; i += 8) { x.fillStyle = a[(i / 8) % 2]; x.fillRect(i, 0, 8, n); x.fillStyle = a[2]; x.globalAlpha = 0.25; x.fillRect(i + 3, 0, 2, n); x.globalAlpha = 1; }
  for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(0,0,0,${r() * 0.12})`; x.fillRect(r() * n, r() * n, 2, 2); }
  return tex(c);
}

/** Pată rotundă moale (alb în centru, transparent la margine): fum, umbre „blob”, nori, fascicul. */
export function softTexture(n = 64) {
  const c = canvas(n), x = c.getContext('2d'), g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, n, n);
  return tex(c, false);
}
