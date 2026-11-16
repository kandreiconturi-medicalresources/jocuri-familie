// Valoarea unei companii (clasamentul din modul competitiv) și crearea lumii pentru un meci în rețea.
import { STATION_COST, MODELS, CAR_PRICE, COST, T_PRESENT, T_OWNER_MASK, T_OWNER_SHIFT, SHIP_MODELS } from './consts.js';
import { createWorld } from './world.js';
import { createScenarioWorld, scenarioById } from './scenarios/index.js';
import { netWorth } from './expert/stocks.js';

/** Bani − împrumut + gări + trenuri + șine (jumătate din prețul unei plăci). Numai întregi. */
export function companyValue(s, id) {
  const c = s.companies[id];
  if (!c) return 0;
  let v = c.cash - c.loan;
  for (const st of s.stations) if (st.owner === id) v += STATION_COST[st.size];
  for (const t of s.trains) if (t.owner === id) v += MODELS[t.model].price + t.cars * CAR_PRICE;
  if (s.ships) for (const q of s.ships) if (q.owner === id) v += SHIP_MODELS[q.model].price;
  let tiles = 0;
  for (let i = 0; i < s.track.length; i++) { const t = s.track[i]; if ((t & T_PRESENT) && ((t & T_OWNER_MASK) >> T_OWNER_SHIFT) === id) tiles++; }
  return v + tiles * (COST.tile >> 1);
}

/** Clasament: [{ id, name, color, value }] descrescător (la egalitate, după id). */
export function standings(s) {
  const ex = s.mode === 'expert'; // în expert contează averea directorului: bani personali + acțiuni
  return s.companies.filter((c) => !c.dead).map((c) => ({ id: c.id, name: c.name, color: c.color, value: ex ? netWorth(s, c.id) : companyValue(s, c.id) })).sort((a, b) => b.value - a.value || a.id - b.id);
}

/** cfg = { mode: 'coop'|'comp', seed, size, year, scn?, players: [{id,name,color}] }. Toți clienții obțin aceeași lume. */
export function createNetWorld(cfg) {
  const pl = cfg.players.slice(0, 4);
  if (cfg.scn && cfg.mode !== 'comp') {
    const sc = scenarioById(cfg.scn);
    if (sc) { const s = createScenarioWorld(sc); s.companies[0].color = pl[0].color; s.net = { mode: 'coop', pl: {} }; return s; }
  }
  const coop = cfg.mode !== 'comp';
  const players = coop ? [{ id: 0, name: 'Echipa', color: pl[0].color }] : pl.map((p) => ({ id: p.id, name: p.name, color: p.color }));
  const isl = cfg.map === 'islands'; // etapa 7.1: lumea cu insule (AI-urile merg și în modul simplu)
  const s = createWorld({ seed: cfg.seed >>> 0, size: cfg.size || 'S', year: cfg.year || 1950, players, mode: cfg.expert ? 'expert' : 'simple', ai: cfg.expert || isl ? cfg.ai || [] : [], map: isl ? 'islands' : 'normal' });
  s.net = { mode: coop ? 'coop' : 'comp', pl: {} };
  if (!coop) pl.forEach((p, i) => { s.net.pl[p.id] = i; });
  return s;
}
