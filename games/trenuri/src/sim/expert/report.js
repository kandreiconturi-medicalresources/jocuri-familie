// Mod expert, raportul anual: venituri, costuri, profit pe tren și pe marfă (se strâng pe parcurs, se închid la 1 ianuarie).
import { NG } from '../goods.js';

/** La fiecare livrare cu venit: pe marfă (co.rep.g) și pe tren (t.yi). */
export function recordIncome(co, t, g, v) {
  if (!co.rep) return;
  co.rep.g[g] += v;
  t.yi = (t.yi | 0) + v;
}

/** Venitul și costul lunii se adaugă în raport (venitul vine din co.month, costul din payMonthly). */
export function addMonthIncome(co) { if (co.rep) co.rep.inc += co.month; }

/** 1 ianuarie: raportul anului care s-a încheiat (ultimii 5 ani rămân). */
export function closeYear(s) {
  for (const co of s.companies) {
    const r = co.rep;
    if (!r || co.dead) continue;
    const tr = s.trains.filter((t) => t.owner === co.id).map((t) => [t.id, (t.yi | 0) - (t.ym | 0)]);
    r.y.push({ y: s.date.y - 1, inc: r.inc, cost: r.mt + r.int, profit: r.inc - r.mt - r.int, mt: r.mt, int: r.int, g: r.g.slice(), tr });
    if (r.y.length > 5) r.y.shift();
    r.inc = 0; r.mt = 0; r.int = 0; r.g = new Array(NG).fill(0);
    for (const t of s.trains) if (t.owner === co.id) { t.yi = 0; t.ym = 0; t.pm = t.money; }
  }
}
