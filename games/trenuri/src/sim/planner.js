// Planificatorul de rută, partea 2 (pură, numai întregi): surse recomandate, câte vagoane, planul complet (gări + șină + tren)
// și „mai e cineva care vrea aceeași marfă?” cu ocolul. Nimic nu schimbă starea: executarea e în ui/plannerRun.js, prin applyCommand.
import { MODELS, CAR_PRICE, MAX_CARS, DWELL, TICKS_PER_DAY, DAYS_PER_MONTH, availableModels, STATION_COST, MAINT } from './consts.js';
import { CAR_TYPES, CAR_OF, GOODS, INDUSTRIES, wantOf } from './goods.js';
import { tileDist } from './cargo.js';
import { suppliers, destinations } from './routes.js';
import { isCity, monthlyOutput, stationAtPlace, sizeFor, railLink, spotFor, planLeg } from './plannerSrc.js';

export * from './plannerSrc.js';
export const MONTH = TICKS_PER_DAY * DAYS_PER_MONTH; // pași într-o lună
export const NEAR_PCT = 25; // ocol sub atât la sută din traseu = „pe drum”
const ceil = (a, b) => ((a + b - 1) / b) | 0;

/** Timpul unei curse într-un sens (pași): drumul la viteza maximă + accelerarea și frânarea. */
export const oneWayTicks = (m, len) => ((len * 256) / m.vmax | 0) + 3 * m.vmax;

/** Câte vagoane (și trenuri) trebuie ca să duci `flow` tone pe lună pe `len` plăci cu locomotiva m. */
export function carsNeeded(m, g, flow, len) {
  const cap = CAR_TYPES[CAR_OF[g]].cap, rt = 2 * oneWayTicks(m, len) + 2 * DWELL + 40; // dus-întors cu oprirea
  const cars = Math.max(1, ceil(Math.max(1, flow) * rt, cap * MONTH)), per = Math.max(1, Math.min(MAX_CARS, m.power));
  const trains = Math.max(1, ceil(cars, per)), carsPer = ceil(cars, trains);
  return { cars, trains, carsPer, cap, rtDays: ceil(rt, TICKS_PER_DAY), oneWayDays: ceil(oneWayTicks(m, len), TICKS_PER_DAY), perMonth: ((trains * carsPer * cap * MONTH) / rt) | 0 };
}

/** Cea mai potrivită locomotivă disponibilă: cea mai rapidă care încape într-un sfert din bani (altfel cea mai ieftină). */
export function pickModel(year, cash, want = null) {
  const av = availableModels(year);
  if (want !== null && av.some((m) => m.id === want)) return MODELS[want];
  const fit = av.filter((m) => m.price <= cash / 4);
  if (!fit.length) return av.reduce((a, b) => (b.price < a.price ? b : a));
  return fit.reduce((a, b) => (b.vmax > a.vmax || (b.vmax === a.vmax && b.price < a.price) ? b : a));
}

/** Cererea la o oprire (tone pe lună): oraș = cererea lui, industrie = locul din stoc. */
const wantAt = (o, g) => (isCity(o) ? wantOf(o, g) : Math.max(0, 250 - o.in[g]));

/**
 * Planul complet. req = { g, owner, stops: [src, dst, ...] (obiecte din s), cash, year, model?: id, cache? }.
 * Întoarce { ok, g, stops[{o, st, spot, size, cost, want, drop}], legs[{link, plan, len, cost, err}], flow, len, build: {stations, track}, train: {...}, total, cashLeft, profit }.
 */
export function buildPlan(s, req) {
  const { g, owner, stops: objs } = req, cache = req.cache || {}, src = objs[0];
  const stops = objs.map((o, i) => {
    const toward = objs[i + 1 === objs.length ? i - 1 : i + 1], st = stationAtPlace(s, o, owner, toward), size = st ? st.size : sizeFor(o);
    const spot = st ? { x: st.x, y: st.y } : spotFor(s, o, toward, size, owner);
    return { o, st, spot, size, cost: st || !spot ? 0 : STATION_COST[size], want: i ? wantAt(o, g) : 0, drop: null };
  });
  const legs = [];
  for (let i = 0; i + 1 < stops.length; i++) {
    const a = stops[i].spot, b = stops[i + 1].spot;
    if (!a || !b) { legs.push({ link: null, plan: null, len: tileDist(stops[i].o, stops[i + 1].o), cost: 0, err: 'teren' }); continue; }
    const link = railLink(s, a, b, owner);
    if (link) { legs.push({ link, plan: null, len: link.length - 1, cost: 0 }); continue; }
    const p = planLeg(s, a, b, owner, cache);
    legs.push({ link: null, plan: p.plan, len: p.len, cost: p.cost, err: p.err || '' });
  }
  const len = Math.max(1, legs.reduce((n, l) => n + l.len, 0)), wants = stops.slice(1).reduce((n, x) => n + x.want, 0), prod = INDUSTRIES[src.type].out === g ? monthlyOutput(src) : 0;
  const flow = Math.max(0, Math.min(wants, prod)), m = pickModel(req.year, req.cash, req.model === undefined ? null : req.model), nd = carsNeeded(m, g, flow, len);
  const stationsCost = stops.reduce((n, x) => n + x.cost, 0), trackCost = legs.reduce((n, l) => n + l.cost, 0), trainCost = nd.trains * (m.price + nd.carsPer * CAR_PRICE);
  let revenue = 0, left = flow;
  for (let i = 1; i < stops.length && left > 0; i++) { const t = Math.min(left, stops[i].want); revenue += t * tileDist(src, stops[i].o) * GOODS[g].rate; left -= t; }
  const newTiles = legs.reduce((n, l) => n + (l.plan ? l.plan.tiles.length : 0), 0);
  const upkeep = nd.trains * m.maint + newTiles * MAINT.tile + stops.filter((x) => !x.st).length * MAINT.station;
  const total = stationsCost + trackCost + trainCost, err = legs.find((l) => l.err) || stops.find((x) => !x.spot);
  return {
    ok: !err, g, owner, stops, legs, flow, len, wants, prod, model: m, nd, kinds: Array(nd.carsPer).fill(CAR_OF[g]),
    build: { stations: stationsCost, track: trackCost, train: trainCost }, total, cashLeft: req.cash - total, revenue, profit: revenue - upkeep,
    linked: legs.every((l) => l.link), missing: stops.filter((x) => !x.st).length,
  };
}

/** Sursele (sau destinațiile, cu fixed = sursa) clasate după efort (cost de construit + distanță): [{ o, d, prod, want, rail, plan, cost, profit, score, why }], prima = recomandată. */
export function rankOptions(s, { fixed, mode = 'to', g, owner, cash, year, cache = {}, max = 10 }) {
  const list = mode === 'to' ? suppliers(s, fixed, g, owner) : destinations(s, fixed, g, owner).filter((e) => e.level > 0 && (e.kind === 'city' || e.o.type !== undefined));
  const out = list.slice(0, max).map((e) => {
    const stops = mode === 'to' ? [e.o, fixed] : [fixed, e.o], plan = buildPlan(s, { g, owner, stops, cash, year, cache });
    const prod = mode === 'to' ? monthlyOutput(e.o) : monthlyOutput(fixed);
    const cost = plan.build.stations + plan.build.track, afford = plan.total <= cash;
    const chain = mode === 'to' && prod <= 0 ? chainOf(s, e.o, owner) : null; // sursa nu produce: ce îi lipsește și de unde se aduce
    return { chain, o: e.o, d: e.d, prod, want: mode === 'to' ? wantAt(fixed, g) : wantAt(e.o, g), rail: e.rail, linked: plan.linked, plan, cost, profit: plan.profit, afford, score: (prod > 0 ? 0 : -1e7) + (afford ? 0 : -1e6) - cost - e.d * 60 - (chain ? chain.d * 60 : 0) }; // cel mai puțin efort: ce e deja construit și ce e aproape; profitul se arată, dar nu decide
  });
  out.sort((a, b) => b.score - a.score || a.d - b.d || a.o.id - b.o.id);
  if (out.length) out[0].why = out[0].prod > 0 || mode !== 'to' ? whyBest(out) : 'nimeni nu produce acum; asta e cea mai ușor de pornit';
  return out;
}

/** Pentru o prelucrătoare fără materii: prima materie care lipsește și cea mai apropiată industrie care o produce: { g, from, d, forPlan } sau null. */
export function chainOf(s, o, owner) {
  const g = INDUSTRIES[o.type].in.find((q) => o.in[q] <= 0);
  if (g === undefined) return null;
  const src = suppliers(s, o, g, owner)[0];
  return src ? { g, from: src.o, d: src.d } : { g, from: null, d: 99 };
}

/** O propoziție scurtă: de ce e prima alegere. */
export function whyBest(list) {
  const b = list[0], parts = [];
  if (list.every((x) => b.d <= x.d)) parts.push('cea mai aproape');
  if (b.linked) parts.push('șina e deja pusă'); else if (b.plan.missing === 0) parts.push('are deja gări'); else if (b.rail === 'station') parts.push('are deja gară'); else if (b.rail === 'track') parts.push('șina trece aproape');
  if (!parts.length && list.every((x) => b.cost <= x.cost)) parts.push('costă cel mai puțin de construit');
  if (!parts.length && list.every((x) => b.prod >= x.prod)) parts.push('produce cel mai mult');
  return parts.length ? parts.join(' și ') : 'aduce cel mai bun profit pe lună';
}

/**
 * Alte orașe care cer aceeași marfă, cu ocolul față de traseul planului: [{ o, extra, pct, where: 'after'|'between', onRoad, addCars, stops }].
 * onRoad = ocolul e sub NEAR_PCT din traseu: se adaugă pe același tren (stops = noua listă de opriri); altfel e mai bine un tren nou.
 * noStock = sursa nu produce destul ca să mai rămână marfă pentru el (gain = tonele în plus pe lună).
 */
export function otherTakers(s, req, plan) {
  const { g, stops: objs } = req, src = objs[0], dst = objs[objs.length - 1], base = Math.max(1, tileDist(src, dst)), out = [];
  for (const c of s.cities) {
    if (objs.includes(c) || wantOf(c, g) <= 0) continue;
    const after = tileDist(dst, c), between = tileDist(src, c) + tileDist(c, dst) - base;
    const where = after <= between || objs.length > 2 ? 'after' : 'between', extra = where === 'after' ? after : between;
    const stops = where === 'after' ? [...objs, c] : [...objs.slice(0, -1), c, dst], pct = ((extra * 100) / base) | 0, onRoad = pct < NEAR_PCT;
    const p2 = onRoad ? buildPlan(s, { ...req, stops }) : null;
    const gain = p2 ? p2.flow - plan.flow : Math.min(Math.max(0, plan.prod - plan.wants), wantOf(c, g)); // tone în plus pe lună pentru el (0 = sursa nu mai are de dat)
    out.push({ o: c, d: tileDist(src, c), extra, pct, where, onRoad, want: wantOf(c, g), stops, gain, noStock: gain <= 0, addCars: p2 ? Math.max(0, p2.nd.cars - plan.nd.cars) : 0, plan: p2 });
  }
  return out.sort((a, b) => a.pct - b.pct || a.o.id - b.o.id).slice(0, 4);
}
