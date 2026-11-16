// Descărcarea parțială într-o gară: moduri „tot”, „după cerere”, „X vagoane”, „X%”, „nimic”. Pură și deterministă (numai întregi).
import { MAX_CARS } from './consts.js';

export const DROP_MODES = ['demand', 'all', 'cars', 'pct', 'none'];
export const DROP_TEXT = { demand: 'După cerere', all: 'Tot', cars: 'Vagoane', pct: 'Procent', none: 'Nimic' };

/** Forma unei descărcări: { m, v? } (v = vagoane 1..MAX_CARS sau procent 1..100). null/undefined = regula veche. */
export function validDrop(d) {
  if (d == null) return true;
  if (typeof d !== 'object' || !DROP_MODES.includes(d.m)) return false;
  if (d.m === 'cars') return Number.isInteger(d.v) && d.v >= 1 && d.v <= MAX_CARS;
  if (d.m === 'pct') return Number.isInteger(d.v) && d.v >= 1 && d.v <= 100;
  return true;
}
export const cleanDrop = (d) => (d ? (d.m === 'cars' || d.m === 'pct' ? { m: d.m, v: d.v } : { m: d.m }) : null);

/** Câte unități din n se descarcă. room = cât mai cere gara, later = o gară următoare din rută cere marfa, cap = capacitatea unui vagon. */
export function dropAmount(drop, n, { room, later, cap }) {
  switch (drop.m) {
    case 'all': return n;
    case 'none': return 0;
    case 'pct': return Math.min(n, ((n * drop.v + 99) / 100) | 0);
    case 'cars': return Math.min(n, drop.v * cap);
    default: return later ? Math.min(n, Math.max(0, room)) : n; // „după cerere”: restul merge mai departe, iar la ultima gară se lasă tot
  }
}
