// Un pas de simulare: trenuri, apoi zi/lună/an. Singurul loc unde avansează timpul.
import { TICKS_PER_DAY, DAYS_PER_MONTH, MODELS } from './consts.js';
import { stepTrain } from './trains.js';
import { depotStep } from './depotJobs.js';
import { spawnCargo, monthly } from './economy.js';
import { processDaily, collectDaily } from './industry.js';
import { addNews } from './news.js';
import { checkScenario } from './scenarios/index.js';

export function stepWorld(s) {
  s.tick++;
  for (const t of s.trains) stepTrain(s, t);
  depotStep(s);
  if (s.tick % TICKS_PER_DAY === 0) {
    spawnCargo(s);
    processDaily(s);
    collectDaily(s);
    if (++s.date.d > DAYS_PER_MONTH) {
      s.date.d = 1;
      if (++s.date.m > 12) {
        s.date.m = 1; s.date.y++;
        for (const m of MODELS) if (m.year === s.date.y) addNews(s, '🚂', `O nouă locomotivă a fost inventată! ${m.name} (${m.year})`);
      }
      monthly(s);
      if (s.scn) checkScenario(s);
    }
  }
}
