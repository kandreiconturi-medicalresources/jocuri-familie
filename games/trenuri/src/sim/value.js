// Valoarea unei companii (clasamentul din modul competitiv) și crearea lumii pentru un meci în rețea.
import { STATION_COST, MODELS, CAR_PRICE, COST, T_PRESENT, T_OWNER_MASK, T_OWNER_SHIFT, T_BIGBR, BRIDGE, SHIP_MODELS } from './consts.js';
import { createWorld } from './world.js';
import { createScenarioWorld, scenarioById } from './scenarios/index.js';
import { netWorth } from './expert/stocks.js';
import { landWorth } from './land.js';
import { TEAMS, normTeams, teamMembers } from './teams.js';

/** Bani − împrumut + gări + trenuri + șine (jumătate din prețul unei plăci). Numai întregi. */
export function companyValue(s, id) {
  const c = s.companies[id];
  if (!c) return 0;
  let v = c.cash - c.loan;
  for (const st of s.stations) if (st.owner === id) v += STATION_COST[st.size];
  for (const t of s.trains) if (t.owner === id) v += MODELS[t.model].price + t.cars * CAR_PRICE;
  if (s.ships) for (const q of s.ships) if (q.owner === id) v += SHIP_MODELS[q.model].price;
  let tiles = 0, bridges = 0;
  for (let i = 0; i < s.track.length; i++) { const t = s.track[i]; if ((t & T_PRESENT) && ((t & T_OWNER_MASK) >> T_OWNER_SHIFT) === id) { tiles++; if (t & T_BIGBR) bridges++; } }
  if (s.islands) return v + tiles * (COST.tile >> 1) + bridges * BRIDGE.val + landWorth(s, id); // 7.4: podurile mari și proprietățile contează
  return v + tiles * (COST.tile >> 1);
}

/** Clasament: [{ id, name, color, value, mem? }] descrescător (la egalitate, după id). `mem` = membrii echipei (7.5). */
export function standings(s) {
  const ex = s.mode === 'expert' && !s.islands; // în expert contează averea directorului: bani personali + acțiuni
  const tm = !!(s.net && s.net.team);
  return s.companies.filter((c) => !c.dead).map((c) => {
    const r = { id: c.id, name: c.name, color: c.color, value: ex ? netWorth(s, c.id) : companyValue(s, c.id) };
    if (tm) r.mem = teamMembers(s, c.id);
    return r;
  }).sort((a, b) => b.value - a.value || a.id - b.id);
}

/** cfg = { mode: 'coop'|'comp', seed, size, year, scn?, map?, ai?, teams?, players: [{id,name,color}] }. Toți clienții obțin aceeași lume.
 *  7.5: cu `map: 'islands'` și `teams: [[idJucător…]…]` fiecare echipă e o companie (cu insula ei), comandată de toți membrii. */
export function createNetWorld(cfg) {
  const pl = cfg.players.slice(0, 4);
  if (cfg.scn && cfg.mode !== 'comp') {
    const sc = scenarioById(cfg.scn);
    if (sc) { const s = createScenarioWorld(sc); s.companies[0].color = pl[0].color; s.net = { mode: 'coop', pl: {} }; return s; }
  }
  const isl = cfg.map === 'islands'; // etapa 7.1: lumea cu insule (AI-urile merg și în modul simplu)
  const teams = isl && Array.isArray(cfg.teams) && cfg.teams.length ? normTeams(cfg.teams, pl) : null;
  const coop = !teams && cfg.mode !== 'comp';
  const players = teams ? teams.map((t, i) => ({ id: i, name: TEAMS[i].name, color: pl.find((p) => p.id === t[0]).color }))
    : coop ? [{ id: 0, name: 'Echipa', color: pl[0].color }] : pl.map((p) => ({ id: p.id, name: p.name, color: p.color }));
  const s = createWorld({ seed: cfg.seed >>> 0, size: cfg.size || 'S', year: cfg.year || 1950, players, mode: cfg.expert ? 'expert' : 'simple', ai: cfg.expert || isl ? cfg.ai || [] : [], map: isl ? 'islands' : 'normal' });
  s.net = { mode: coop ? 'coop' : 'comp', pl: {} };
  if (teams) {
    s.net.team = 1; s.net.nm = {};
    teams.forEach((t, i) => t.forEach((id) => { s.net.pl[id] = i; s.net.nm[id] = pl.find((p) => p.id === id).name; }));
  } else if (!coop) pl.forEach((p, i) => { s.net.pl[p.id] = i; });
  return s;
}
