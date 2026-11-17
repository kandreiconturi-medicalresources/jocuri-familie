// Banca în lumea cu insule (etapa 7.4): împrumuturile pe tranșe din modul expert merg și în modul simplu.
// `setAutoRepay { pct }`: 0–50% din profitul lunii se duce singur la rambursare (tranșa cu dobânda cea mai mare întâi).
import { interestOf, isEx } from './expert/finance.js';
import { addNews } from './news.js';

const fail = (err) => ({ ok: false, err });

function setAutoRepay(s, cmd, c) {
  if (!s.islands || !c.tr || c.dead) return fail('expert');
  if (!Number.isInteger(cmd.pct) || cmd.pct < 0 || cmd.pct > 50) return fail('drum');
  c.ar = cmd.pct;
  return { ok: true, cost: 0 };
}

/** Plătește `amt` din datorie, începând cu tranșa cea mai scumpă (cea mai nouă la egalitate). Întoarce cât a plătit. */
export function repayAmount(co, amt) {
  let paid = 0;
  while (amt > 0 && co.tr.length) {
    let k = 0;
    for (let i = 0; i < co.tr.length; i++) if (co.tr[i].r >= co.tr[k].r) k = i;
    const p = Math.min(amt, co.tr[k].p);
    co.tr[k].p -= p; co.loan -= p; co.cash -= p; amt -= p; paid += p;
    if (!co.tr[k].p) co.tr.splice(k, 1);
  }
  return paid;
}

/** Lunar (după ce istoricul s-a completat): dobânda în modul simplu (în expert o plătește `payMonthly`) și rambursarea automată. */
export function bankMonthly(s) {
  for (const co of s.companies) {
    if (co.dead || !co.tr) continue;
    if (!isEx(s, co)) {
      const int = interestOf(co);
      if (int && !s.sandbox) co.cash -= int;
      if (int && co.history.length) co.history[co.history.length - 1] -= int;
    }
    const profit = co.history.length ? co.history[co.history.length - 1] : 0;
    if (co.ar && profit > 0 && co.tr.length) {
      const amt = Math.min(Math.floor((profit * co.ar) / 100), Math.max(0, co.cash));
      const paid = amt > 0 ? repayAmount(co, amt) : 0;
      if (paid && !co.ai) addNews(s, '🏦', `${co.name}: banca a primit singură ${paid} lei din profitul lunii. Datoria a scăzut.`);
    }
  }
}

export const BANK_COMMANDS = { setAutoRepay };
