// Gări care cresc: numărul de peroane (1–4) depinde de orașul din apropiere și de producția din rază.
import { MAX_PLATFORMS, PLATFORM_COST } from './consts.js';
import { near } from './industry.js';
import { addNews } from './news.js';

const fail = (err) => ({ ok: false, err });
export const platformsOf = (st) => st.platforms || 1;

/** Câte peroane poate avea gara: sat 2, oraș 3, metropolă 4; fără oraș, după câte industrii sunt în rază (1→2, 2→3, 3+→4). */
export function maxPlatforms(s, st) {
  const c = st.cityId >= 0 ? s.cities[st.cityId] : null;
  let m = c ? 2 + c.level : 1;
  let n = 0;
  for (const o of s.industries) if (near(st, o)) n++;
  m = Math.max(m, n >= 3 ? 4 : n + 1);
  return Math.min(MAX_PLATFORMS, m);
}
export const upgradeCost = (st) => PLATFORM_COST * platformsOf(st);

function upgradeStation(s, cmd, c) {
  const st = s.stations.find((q) => q.id === (cmd.id !== undefined ? cmd.id : cmd.stationId));
  if (!st) return fail('inexistent');
  if (st.owner !== c.id) return fail('proprietar');
  if (platformsOf(st) >= maxPlatforms(s, st)) return fail('limita');
  const cost = upgradeCost(st);
  if (!s.sandbox && c.cash < cost) return fail('bani');
  if (!s.sandbox) c.cash -= cost;
  st.platforms = platformsOf(st) + 1;
  s.dirty.stations = true;
  addNews(s, '🚉', `${st.name} are acum ${st.platforms} peroane!`);
  return { ok: true, cost };
}

export const STATION_COMMANDS = { upgradeStation };
