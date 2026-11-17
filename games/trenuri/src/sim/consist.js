// Schimbarea vagoanelor unui tren: comanda setCars, aplicată în gară (imediat sau la următoarea oprire).
import { CAR_PRICE, MAX_CARS } from './consts.js';
import { CAR_TYPES, CAR_OF } from './goods.js';
import { load } from './cargo.js';

const fail = (err) => ({ ok: false, err });
const counts = (kinds) => { const n = CAR_TYPES.map(() => 0); for (const k of kinds) n[k]++; return n; };
const same = (a, b) => a.length === b.length && a.every((k, i) => k === b[i]);

/** Câte vagoane se adaugă și câte se scot trecând de la `from` la `to` (pe tipuri). */
export function carsDiff(from, to) {
  const a = counts(from), b = counts(to);
  let add = 0, rem = 0;
  for (let k = 0; k < a.length; k++) { if (b[k] > a[k]) add += b[k] - a[k]; else rem += a[k] - b[k]; }
  return { add, rem };
}

/** Banii pentru schimbare: vagonul nou costă tot, cel scos dă înapoi jumătate. Negativ = primești bani. */
export const carsCost = (from, to) => { const d = carsDiff(from, to); return d.add * CAR_PRICE - d.rem * (CAR_PRICE >> 1); };

/** Trenul e oprit în gară și își poate schimba vagoanele acum. */
export const canSwapNow = (t) => t.state === 2 && !t.tow && !t.cpl;

/** Marfa care nu mai încape rămâne în gară; ordinele manuale pierd mărfurile pe care nu le mai poate duce. */
export function applyCars(s, t, st) {
  const kinds = t.nk;
  t.nk = null;
  if (!kinds || same(kinds, t.kinds)) return;
  t.kinds = kinds.slice(); t.cars = kinds.length;
  const room = counts(kinds).map((n, k) => n * CAR_TYPES[k].cap), keep = [];
  for (const b of t.load) {
    const k = CAR_OF[b.c], n = Math.min(b.n, room[k]);
    room[k] -= n;
    if (n > 0) keep.push(n === b.n ? b : { ...b, n });
    const back = b.n - n;
    if (back > 0 && st) { if (b.c === 0) st.waiting.pass += back; else if (b.c === 1) st.waiting.mail += back; else st.cargo[b.c] += back; }
  }
  t.load = keep;
  if (t.orders) for (const o of t.orders) if (o && o.load) o.load = o.load.filter((g) => kinds.includes(CAR_OF[g]));
  if (st) load(s, t, st); // vagoanele noi se umplu pe loc
  s.dirty.trains = true;
}

function setCars(s, cmd, c) {
  const t = s.trains.find((q) => q.id === cmd.trainId), kinds = cmd.kinds;
  if (!t) return fail('inexistent');
  if (t.owner !== c.id) return fail('proprietar');
  if (t.state === 3 || t.tow || t.cpl) return fail('depou');
  if (!Array.isArray(kinds) || kinds.length < 1 || kinds.length > MAX_CARS || kinds.some((k) => !Number.isInteger(k) || k < 0 || k >= CAR_TYPES.length)) return fail('vagoane');
  const cost = carsCost(t.nk || t.kinds, kinds);
  if (cost > 0 && !s.sandbox && c.cash < cost) return fail('bani');
  if (!s.sandbox) c.cash -= cost;
  t.nk = same(kinds, t.kinds) ? null : kinds.slice();
  if (t.nk && canSwapNow(t)) applyCars(s, t, s.stations.find((q) => q.id === t.to));
  return { ok: true, cost, now: !t.nk };
}

export const CONSIST_COMMANDS = { setCars };
