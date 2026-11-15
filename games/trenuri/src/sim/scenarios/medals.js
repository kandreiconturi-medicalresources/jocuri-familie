// Medaliile scenariilor, salvate în gameSave('trenuri') sub cheia 'medals': { idScenariu: 1..3 }.
import { SCENARIOS } from './defs.js';

export const loadMedals = (save) => { const m = save.get('medals', {}); return m && typeof m === 'object' ? m : {}; };

/** Salvează medalia doar dacă e mai bună decât cea veche. Întoarce true dacă s-a schimbat ceva. */
export function recordMedal(save, id, tier) {
  const m = loadMedals(save);
  if (!(tier > (m[id] | 0))) return false;
  m[id] = tier;
  save.set('medals', m);
  return true;
}

/** Scenariul i e deblocat dacă e primul sau cel dinainte are cel puțin bronz. */
export const isUnlocked = (medals, i) => i === 0 || (medals[SCENARIOS[i - 1].id] | 0) >= 1;
