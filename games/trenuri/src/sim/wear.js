// Uzura trenurilor: fiabilitatea scade cu timpul și cu vârsta; atelierul de la gară o readuce. Numai întregi.
import { MODELS, REL_FLOOR, WORKSHOP, TICKS_PER_DAY } from './consts.js';
import { addNews } from './news.js';

/** Fiabilitatea curentă (0–100). Trenurile din salvări vechi n-au `rel`: pornesc de la cea a modelului. */
export const relOf = (t) => (t.rel === undefined ? MODELS[t.model].rel : t.rel);
export const ageMonths = (s, t) => Math.max(0, s.date.y * 12 + s.date.m - t.born);
/** Cât stă un tren stricat: cu cât e mai uzat, cu atât mai mult. */
export const repairTicks = (t) => TICKS_PER_DAY * (1 + (((100 - relOf(t)) / 30) | 0));

/** Lunar: simplu = uzură blândă (1 punct pe trimestru, minim 70); expert = completă (2–4 puncte pe lună, minim 30). */
export function wearMonthly(s) {
  const ex = s.mode === 'expert', floor = ex ? REL_FLOOR.expert : REL_FLOOR.simple;
  for (const t of s.trains) {
    const age = ageMonths(s, t);
    const d = ex ? 2 + (age > 36 ? 1 : 0) + (age > 96 ? 1 : 0) : (s.date.m % 3 === 0 ? 1 : 0);
    t.rel = Math.max(Math.min(floor, MODELS[t.model].rel), relOf(t) - d);
  }
}

/** La oprirea într-o gară cu atelier: trenul e reparat. */
export function serviceAt(s, t, st) {
  const full = MODELS[t.model].rel;
  if (!st.up[WORKSHOP] || relOf(t) >= full) return;
  if (relOf(t) < full - 2) addNews(s, '🔧', `Trenul ${t.id} a fost reparat la ${st.name}: iar merge ca nou!`);
  t.rel = full; t.broken = 0;
}
