// Aspectul curent al scenei (7.7 și 7.8): vedere 2D / 3D / clasic, „Mod răcoros” și dacă telefonul e slab. Stare comună pentru stage, view și meniu.
import { perf } from '../../../../shared/engine/perf.js';
import { detectPhone, capFps, createPacer } from '../../../../shared/engine/pace.js';

export const MODES = ['3d', '2d', 'classic'];
export const look = { phone: detectPhone(), cool: false, mode: '3d', cap: 60, ultra: false };
look.cap = capFps(look);
/** Ritmul desenării (plafonul de cadre): citit de bucla din main.js. */
export const pacer = createPacer(look.cap);
const cbs = [];

/** Umbre reale: doar la calitatea 2, nu în modul răcoros și nu în 2D (blob-urile rămân doar la calitatea 0). */
export const shadowsOn = () => perf.quality() >= 2 && !look.cool && look.mode !== '2d';
/** Straturi „de lux” (nori, catenară, păsări): calitatea 2 fără modul răcoros. */
export const rich = () => perf.quality() >= 2 && !look.cool;

/** Grafica Ultra (post-procesare, umbre moi 4K): doar pe PC, la calitatea 2, fără modul răcoros, în 3D/clasic. */
export const ultraOn = () => look.ultra && !look.phone && rich() && look.mode !== '2d';

export function setLook(patch) {
  Object.assign(look, patch);
  look.cap = capFps(look); pacer.setCap(look.cap); perf.setCap(look.cap);
  cbs.slice().forEach((cb) => { try { cb(look); } catch (e) { /* ignorat */ } });
}
export const onLook = (cb) => { cbs.push(cb); return () => { const i = cbs.indexOf(cb); if (i >= 0) cbs.splice(i, 1); }; };
