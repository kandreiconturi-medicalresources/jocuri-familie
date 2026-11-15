// Scenarii: crearea lumii, verificarea lunară a obiectivelor, termen în ani de joc.
import { createWorld } from '../world.js';
import { addNews } from '../news.js';
import { SCENARIOS, scenarioById } from './defs.js';
import { evaluate, MEDAL_NAMES, MEDAL_ICONS } from './goals.js';

export { SCENARIOS, scenarioById, evaluate, MEDAL_NAMES, MEDAL_ICONS };
export * from './medals.js';

/** Lumea unui scenariu: hartă fixă din seed, bani și an de start; `s.scn` ține progresul (se salvează odată cu starea). */
export function createScenarioWorld(sc) {
  const s = createWorld({ seed: sc.seed, size: sc.size, year: sc.year });
  s.companies[0].cash = sc.cash;
  s.scn = { id: sc.id, end: sc.year + sc.years, best: 0, done: false, vals: sc.goals.map(() => 0) };
  s.news.length = 0;
  addNews(s, sc.icon, sc.story);
  return s;
}

/** Construcție liberă: bani nelimitați, fără termen, toate locomotivele (anul 1970). */
export const createFreeWorld = (seed, size = 'S') => createWorld({ seed, size, year: 1970, sandbox: true });

/** Apelat la sfârșit de lună (din stepWorld). Actualizează medalia și închide scenariul la aur sau la termen. */
export function checkScenario(s) {
  const sc = s.scn && !s.scn.done ? scenarioById(s.scn.id) : null;
  if (!sc) return;
  const ev = evaluate(s, sc);
  s.scn.vals = ev.goals.map((g) => g.value);
  if (ev.medal > s.scn.best) {
    s.scn.best = ev.medal;
    addNews(s, '🏅', `${MEDAL_NAMES[ev.medal]}! ${MEDAL_ICONS[ev.medal]} Scenariul „${sc.name}” a primit medalie.`);
  }
  if (s.scn.best === 3 || s.date.y >= s.scn.end) s.scn.done = true;
}
