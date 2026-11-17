// Logică pură pentru sunetele trenurilor (fără WebAudio): tipul sunetului, ponderi după distanță/zoom, selecție, limitare.

/** Tipul de sunet după câmpurile modelului (nu după id): 'steam' | 'diesel' | 'electric' | 'fast'. */
export function kindOf(m) {
  if (!m) return 'electric';
  if (m.smoke) return 'steam';
  if (/diesel/i.test(m.key || '')) return 'diesel';
  return (m.vmax || 0) >= 60 ? 'fast' : 'electric';
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Cât din ecran acoperă camera, în plăci (raza în care un tren se aude). */
export const hearRadius = (dist) => Math.max(6, dist * 0.8);

/** Câștig după zoom: aproape = 1, foarte departe = 0. */
export const zoomGain = (dist) => Math.pow(clamp(1 - (dist - 12) / 70, 0, 1), 1.4);

/** Pondere 0..1 a unui tren la (x,z) pentru camera {x,z,dist}. */
export function weightOf(x, z, cam) {
  const d = Math.hypot(x - cam.x, z - cam.z), r = hearRadius(cam.dist);
  if (d >= r) return 0;
  return Math.pow(1 - d / r, 1.5) * zoomGain(cam.dist);
}

/** Cele mai apropiate `n` trenuri: [{ id, w }] descrescător. `items`: [{ id, x, z }]. */
export function pickLoud(items, cam, n, minW = 0.02) {
  const out = [];
  for (const it of items) {
    const w = weightOf(it.x, it.z, cam);
    if (w >= minW) out.push({ id: it.id, w });
  }
  out.sort((a, b) => b.w - a.w || a.id - b.id);
  return out.slice(0, n);
}

/** Limitator de ritm: `allow(now)` dă true cel mult o dată la `gap` secunde. */
export function createLimiter(gap) {
  let last = -Infinity;
  return { allow(now) { if (now - last < gap) return false; last = now; return true; }, reset() { last = -Infinity; } };
}

/** Un corn/clopoțel se aude doar dacă trenul e în cadru și zoom-ul nu e prea larg. */
export const inView = (x, z, cam) => cam.dist <= 95 && Math.hypot(x - cam.x, z - cam.z) < hearRadius(cam.dist);

/** Raportul vitezei (0..1) pentru ritmul roților. */
export const speedRatio = (t, m) => (typeof t.speed === 'number' && m && m.vmax ? clamp(t.speed / m.vmax, 0, 1) : 1);
