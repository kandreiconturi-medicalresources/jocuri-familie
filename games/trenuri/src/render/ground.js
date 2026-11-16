// Înălțimile terenului pentru randare: un vârf la fiecare colț de placă (media plăcilor vecine).
export const WATER_Y = 0, SEA_BED = -0.14;
export const tileHeight = (hv) => (hv - 3) * 0.13;

export function makeGround(s) {
  const { w, h } = s, W = w + 1;
  const vy = new Float32Array(W * (h + 1));
  const tile = (x, y) => {
    x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(h - 1, y));
    const i = y * w + x;
    return s.water[i] ? SEA_BED : tileHeight(s.height[i]);
  };
  /** Recalculează vârfurile din jurul plăcilor x0..x1 × y0..y1 (după nivelare). */
  const refresh = (x0 = 0, y0 = 0, x1 = w, y1 = h) => {
    for (let j = Math.max(0, y0); j <= Math.min(h, y1 + 1); j++) for (let i = Math.max(0, x0); i <= Math.min(w, x1 + 1); i++) {
      vy[j * W + i] = (tile(i - 1, j - 1) + tile(i, j - 1) + tile(i - 1, j) + tile(i, j)) / 4;
    }
  };
  refresh();
  const at = (fx, fz) => { // suprafața (bilinear) în coordonate de lume
    fx = Math.max(0, Math.min(w - 0.001, fx)); fz = Math.max(0, Math.min(h - 0.001, fz));
    const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, k = j * W + i;
    return (vy[k] * (1 - tx) + vy[k + 1] * tx) * (1 - tz) + (vy[k + W] * (1 - tx) + vy[k + W + 1] * tx) * tz;
  };
  /** Înălțimea la centrul plăcii; pe apă (poduri) rămâne deasupra apei. */
  const tileY = (x, y) => (s.water[y * w + x] ? 0.16 : at(x + 0.5, y + 0.5));
  return { vy, at, tileY, W, refresh };
}
