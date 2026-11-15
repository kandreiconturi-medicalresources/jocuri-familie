// Un pas de simulare: trenuri, apoi zi/lună. Singurul loc unde avansează timpul.
import { TICKS_PER_DAY, DAYS_PER_MONTH } from './consts.js';
import { stepTrain } from './trains.js';
import { spawnCargo, monthly } from './economy.js';

export function stepWorld(s) {
  s.tick++;
  for (const t of s.trains) stepTrain(s, t);
  if (s.tick % TICKS_PER_DAY === 0) {
    spawnCargo(s);
    if (++s.date.d > DAYS_PER_MONTH) {
      s.date.d = 1;
      if (++s.date.m > 12) { s.date.m = 1; s.date.y++; }
      monthly(s);
    }
  }
}
