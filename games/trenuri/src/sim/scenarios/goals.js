// Măsurători pentru obiectivele scenariilor și medalii (0 = fără, 1 = bronz, 2 = argint, 3 = aur). Numai numere întregi.
import { T_BRIDGE, T_PRESENT, STATION_RADIUS } from '../consts.js';
import { netWorth } from '../expert/stocks.js';

export const MEDAL_NAMES = ['Fără medalie', 'Bronz', 'Argint', 'Aur'];
export const MEDAL_ICONS = ['', '🥉', '🥈', '🥇'];

const near = (c, st) => Math.max(Math.abs(c.x - st.x), Math.abs(c.y - st.y)) <= STATION_RADIUS[st.size] + 2;
/** Orașe cu o gară în rază, în care oprește măcar un tren. */
function served(s) {
  return s.cities.filter((c) => s.trains.some((t) => t.route.length > 1 && t.route.some((id) => { const st = s.stations.find((q) => q.id === id); return st && near(c, st); }))).length;
}

export const METRICS = {
  del: (s, a) => s.stats.del[a],
  earn: (s) => s.stats.earn,
  ups: (s) => s.stats.up,
  lvl: (s, a) => s.cities.filter((c) => c.level >= a).length,
  bridge: (s) => { let n = 0; for (let i = 0; i < s.track.length; i++) if ((s.track[i] & T_PRESENT) && (s.track[i] & T_BRIDGE)) n++; return n; },
  served,
  cash: (s) => s.companies[0].cash,
  nw: (s) => netWorth(s, 0),
};

export const tierOf = (v, t) => (v >= t[2] ? 3 : v >= t[1] ? 2 : v >= t[0] ? 1 : 0);

/** Starea obiectivelor: [{ goal, value, tier }] și medalia scenariului (cea mai mică dintre obiective). */
export function evaluate(s, sc) {
  const goals = sc.goals.map((g) => { const value = METRICS[g.k](s, g.a); return { goal: g, value, tier: tierOf(value, g.t) }; });
  return { goals, medal: Math.min(...goals.map((g) => g.tier)) };
}
