// Ajutoare de desen vectorial (stilul din original): elipse, cercuri, dreptunghiuri rotunjite, stele, hash determinist.
import { ell, circ, starPath } from '../sprites.js';

export { ell, circ };
export const TAU = Math.PI * 2;
export const E = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); };
export function rr(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
export function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h % 1000) / 1000;
}
export const star = (c, x, y, r, rot = 0) => { starPath(c, x, y, r, rot); c.fill(); };
/** Elipsă umplută + contur (conturul închis al desenelor). */
export const blob = (c, x, y, rx, ry, fill, rot = 0) => { E(c, x, y, rx, ry, rot); c.fillStyle = fill; c.fill(); c.stroke(); };
