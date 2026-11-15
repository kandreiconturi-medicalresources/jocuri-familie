// Boți: urmăresc linia centrală (puțin decalați), frânează înainte de viraje, folosesc nitro pe drepte.
// Fiecare bot are „caracter” (viteză, culoar) și primește ajutor dacă a rămas în urmă. Pur.
import { turnRate } from './car.js';
import { V_TOP } from '../tracks/track.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const LEVELS = { easy: 0.74, mid: 0.86, hard: 0.96 };

/** `level` = easy | mid | hard; `seed` face fiecare bot diferit. */
export function createBot(level, rnd) {
  const skill = (LEVELS[level] || LEVELS.mid) * (0.97 + rnd() * 0.05);
  return { skill, lane: (rnd() - 0.5) * 3.2, wob: rnd() * 6.28, wobF: 0.2 + rnd() * 0.25, nitroAt: 0.9 + rnd() * 0.1 };
}

/** Comenzi pentru mașina `car` a botului (viteza maximă, `capMul`, o setează cursa: caracter + ajutor). */
export function botControls(bot, car, track, t) {
  const sp = Math.max(1, car.speed);
  const look = clamp(6 + sp * 0.55, 8, 22);
  const n = track.n, step = Math.max(1, Math.round(look / track.ds));
  const p = track.pts[(car.i + step) % n];
  // culoarul oscilează încet; pe curbe se apropie de linia centrală
  const lane = bot.lane * (0.6 + 0.4 * Math.sin(t * bot.wobF + bot.wob)) * (1 - clamp(Math.abs(p.k) * 14, 0, 1));
  const tx = p.x - p.tz * lane, tz = p.z + p.tx * lane;
  const want = Math.atan2(tx - car.x, -(tz - car.z));
  let err = want - car.angle;
  err = Math.atan2(Math.sin(err), Math.cos(err));
  const dist = Math.max(4, Math.hypot(tx - car.x, tz - car.z));
  const wNeed = (2 * sp * Math.sin(err)) / dist;                // curbura pure-pursuit × viteza
  const steer = clamp(wNeed / Math.max(0.5, turnRate(sp)), -1, 1);

  // viteza țintă: limita curburii în punctul din față, cu ajutor pentru cei din urmă
  const ahead = track.pts[(car.i + Math.round(sp * 0.35 / track.ds)) % n].v;
  const target = Math.min(ahead * (0.9 + 0.1 * bot.skill), V_TOP * (car.capMul || 1)) * (car.boost > 0 ? 1.3 : 1);
  const throttle = sp < target ? 1 : 0;
  const brake = sp > target + 2.5 ? clamp((sp - target) / 8, 0.3, 1) : 0;

  // nitro: bara plină și drum drept înainte
  const farV = track.pts[(car.i + Math.round(60 / track.ds)) % n].v;
  const nitro = car.nitro >= bot.nitroAt && farV > V_TOP * 0.85 && Math.abs(err) < 0.1;
  return { steer, throttle, brake, drift: false, nitro, reset: false };
}
