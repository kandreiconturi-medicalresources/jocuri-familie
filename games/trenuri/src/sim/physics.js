// Fizică simplă, numai întregi: greutatea trenului (marfa încărcată cântărește), puterea locomotivei, rampe și pante.
import { MODELS, LOCO_W, CAR_W, T_TUNNEL } from './consts.js';

export const weightOf = (t) => { let n = 0; for (const b of t.load) n += b.n; return LOCO_W[t.model] + CAR_W * t.cars + (n >> 1); };
export const pullOf = (t) => 28 * MODELS[t.model].power + 8;
/** Raportul greutate/forță în sutimi: 100 = locomotiva abia trage trenul. */
export const heaviness = (t) => ((weightOf(t) * 100) / pullOf(t)) | 0;

/** La câți pași crește viteza cu o treaptă: mai greu = mai încet. */
export function accelEvery(t) { const r = heaviness(t); return r < 100 ? 2 : r < 150 ? 3 : 4; }

/** Diferența de înălțime pe segmentul curent (+ urcă, − coboară); 0 pe pod, în tunel sau în gară. */
export function gradeOf(s, t) {
  if (t.path.length < t.seg + 2) return 0;
  const a = t.path[t.seg], b = t.path[t.seg + 1];
  if (s.water[a] || s.water[b] || ((s.track[a] | s.track[b]) & T_TUNNEL)) return 0;
  return s.height[b] - s.height[a];
}

/** Viteza maximă pe rampa curentă: trenul greu pierde mult pe urcare, unul ușor puțin; la vale câștigă puțin. */
export function slopeVmax(s, t, vm) {
  const dh = gradeOf(s, t);
  if (dh > 0) return Math.max(4, vm >> 2, vm - ((dh * heaviness(t) * vm) / 800 | 0));
  if (dh < 0) return vm + Math.min(-dh * 2, vm >> 3);
  return vm;
}
