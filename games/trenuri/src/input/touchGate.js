// Decizia desen sau cameră pe touch (pură, testată): un deget desenează doar din „ancoră” sau după apăsare lungă.
export const HOLD_MS = 300, ANCHOR_R = 1.5;

/** Ancoră = placă cu șină, gară, oraș sau industrie la cel mult `r` plăci de punctul (fx, fy) (distanța până la marginea plăcii). */
export function anchorNear(s, fx, fy, r = ANCHOR_R) {
  const x0 = Math.max(0, Math.floor(fx - r - 1)), x1 = Math.min(s.w - 1, Math.floor(fx + r + 1)), y0 = Math.max(0, Math.floor(fy - r - 1)), y1 = Math.min(s.h - 1, Math.floor(fy + r + 1));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * s.w + x;
    if (!(s.track[i] & 0x4000) && !s.occ[i]) continue;
    const dx = Math.max(x - fx, 0, fx - (x + 1)), dy = Math.max(y - fy, 0, fy - (y + 1));
    if (dx * dx + dy * dy <= r * r) return true;
  }
  return false;
}

/** 'draw' | 'camera' | 'wait' (încă se așteaptă apăsarea lungă). mode: 'pan' | 'draw' (comutatorul). Mouse desenează mereu. */
export function startDecision({ touch, fingers, mode, anchor, holdMs = 0, moved = false }) {
  if (!touch) return 'draw';
  if (fingers >= 2) return 'camera';
  if (mode === 'draw' || anchor) return 'draw';
  if (moved) return 'camera';
  return holdMs >= HOLD_MS ? 'draw' : 'wait';
}
