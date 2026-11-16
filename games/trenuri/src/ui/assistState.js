// Starea asistentului de cumpărare a trenului: logică pură (fără DOM), ca selecția gărilor să poată fi testată.
// Selecția trăiește aici, nu în unealta de pe hartă: deschiderea Info, schimbarea uneltei sau mutarea camerei n-o ating.
import { CAR_OF, CAR_SETS, GOODS, INDUSTRIES } from '../sim/goods.js';
import { MAX_CARS } from '../sim/consts.js';
import { tileDist, accepts, stockOf } from '../sim/cargo.js';
import { near } from '../sim/industry.js';
import { cityDemand } from '../sim/routes.js';

export const MAX_STOPS = 8;

/** preset (opțional): { good, stops: [id gară], model } — de pildă din „Fă o rută” din panoul industriei. */
export function newAssist(preset = {}) {
  const freight = preset.good !== undefined && preset.good >= 2;
  return {
    step: freight ? 3 : 1, type: freight ? 'freight' : 'pass', good: freight ? preset.good : -1, model: preset.model || 0,
    cars: freight ? CAR_OF[preset.good] - 1 : -1, n: 3, full: false, stops: (preset.stops || []).map((id) => ({ id, drop: null })), pick: true,
  };
}

/** Acțiuni pure: întoarce o stare nouă. `tool` (Info, șină…) și `scroll`/`zoom` nu schimbă nimic din selecție. */
export function assistReduce(a, act) {
  const stops = a.stops;
  switch (act.t) {
    case 'toggle': {
      const i = stops.findIndex((x) => x.id === act.id);
      if (i >= 0) return { ...a, stops: stops.filter((_, k) => k !== i) };
      return stops.length >= MAX_STOPS ? a : { ...a, stops: [...stops, { id: act.id, drop: null }] };
    }
    case 'remove': return { ...a, stops: stops.filter((_, k) => k !== act.i) };
    case 'move': {
      const j = act.i + act.d;
      if (j < 0 || j >= stops.length) return a;
      const c = stops.slice(); [c[act.i], c[j]] = [c[j], c[act.i]];
      return { ...a, stops: c };
    }
    case 'drop': return { ...a, stops: stops.map((x, k) => (k === act.i ? { ...x, drop: act.drop } : x)) };
    case 'clear': return { ...a, stops: [] };
    case 'step': return { ...a, step: act.step };
    case 'set': return { ...a, ...act.v };
    case 'cars': return { ...a, n: Math.max(1, Math.min(MAX_CARS, act.n)) };
    case 'tool': case 'info': case 'camera': default: return a; // nimic din asta nu pierde selecția
  }
}

/** Scoate din selecție gările care nu mai există (demolate) sau nu sunt ale jucătorului. */
export function pruneStops(a, s, owner) {
  const ok = a.stops.filter((x) => s.stations.some((q) => q.id === x.id && q.owner === owner));
  return ok.length === a.stops.length ? a : { ...a, stops: ok };
}

/** Descărcarea efectivă la oprirea i: cea aleasă, altfel „după cerere” (ultima gară: tot, ca trenul să nu rămână cu rest). */
export const dropOf = (a, i) => a.stops[i].drop || { m: i === a.stops.length - 1 ? 'all' : 'demand' };

/** Vagoanele cumpărate: undefined = potrivite rutei (decide simularea). */
export function kindsOf(a) {
  if (a.good >= 0 && a.cars === CAR_OF[a.good] - 1) return Array(a.n).fill(CAR_OF[a.good]);
  return a.cars < 0 ? undefined : CAR_SETS[a.cars].slice();
}

/** Ordinele trenului: doar pentru marfă cu mai mult de două gări sau cu o descărcare aleasă; altfel null (modul Automat, ca până acum). */
export function buildOrders(a) {
  if (a.type !== 'freight' || a.good < 0 || a.stops.length < 2) return null;
  if (a.stops.length === 2 && a.stops.every((x) => !x.drop)) return null;
  return a.stops.map((x, i) => ({ load: [a.good], unload: null, drop: dropOf(a, i) }));
}

/** Comanda buyTrain pentru starea curentă (sau null dacă ruta nu e gata). */
export function buyCommand(a) {
  if (a.stops.length < 2 || a.stops.some((x, i) => i && x.id === a.stops[i - 1].id)) return null;
  const cmd = { type: 'buyTrain', model: a.model, stationId: a.stops[0].id, route: a.stops.map((x) => x.id) };
  const kinds = kindsOf(a), orders = buildOrders(a);
  if (kinds) cmd.kinds = kinds;
  if (orders) cmd.orders = orders;
  return cmd;
}

/** Rândurile listei de gări din asistent: nume, oraș, distanță de la ultima gară aleasă, ce are sau cere marfa aleasă. */
export function stationRows(s, a, owner) {
  const at = (i) => (a.stops.length ? s.stations.find((q) => q.id === a.stops[i].id) : null), last = at(a.stops.length - 1), first = at(0), g = a.good;
  const rows = s.stations.filter((st) => st.owner === owner).map((st) => {
    let city = null;
    for (const c of s.cities) if (!city || tileDist(st, c) < tileDist(st, city)) city = c;
    const inds = s.industries.filter((o) => near(st, o));
    const has = g >= 2 ? stockOf(st, g) > 0 || inds.some((o) => INDUSTRIES[o.type].out === g) : false;
    const wants = g >= 2 ? accepts(s, st, g) : false;
    const gives = inds.filter((o) => INDUSTRIES[o.type].out >= 0).map((o) => INDUSTRIES[o.type].out);
    const asks = inds.flatMap((o) => INDUSTRIES[o.type].in);
    const cityAsks = g >= 2 && city && tileDist(st, city) <= 6 && cityDemand(city, g).level > 0;
    return { st, city: city ? city.name : '', d: last && last !== st ? tileDist(last, st) : null, has, wants, gives: [...new Set(gives)], asks: [...new Set(asks)], cityAsks: !!cityAsks, sel: a.stops.findIndex((x) => x.id === st.id) + 1, df: first ? tileDist(first, st) : 0 };
  });
  return rows.sort((x, y) => (y.has || y.wants ? 1 : 0) - (x.has || x.wants ? 1 : 0) || x.df - y.df || x.st.id - y.st.id);
}
export const goodName = (g) => (g >= 0 ? GOODS[g].icon + ' ' + GOODS[g].name : '');
