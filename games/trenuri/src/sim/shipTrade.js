// Comerțul vapoarelor în port (etapa 7.2). Ordinul opririi: `load` (încarcă din depozit), `sell` (💰 vinde pe bani),
// `swap` (🔁 vinde și cu banii cumpără pe loc marfa `w` din depozitul portului).
// În portul tău: marfa se descarcă în depozit (fără bani), iar încărcarea e gratis.
// În portul altuia: vinzi la prețul pieței insulei (marfa intră în depozitul lui), cumperi din depozitul lui (banii merg la el),
// iar el primește și o taxă de andocare.
import { PORT, SHIP_MODELS } from './consts.js';
import { GOODS, NG } from './goods.js';
import { islandAt } from './islands.js';
import { priceOf } from './market.js';
import { portCap } from './ports.js';
import { addNews } from './news.js';

export const shipLoad = (sh) => sh.load.reduce((n, b) => n + b.n, 0);
export const shipFree = (sh) => SHIP_MODELS[sh.model].cap - shipLoad(sh);
function put(sh, g, n) {
  if (n <= 0) return;
  const b = sh.load.find((q) => q.c === g);
  if (b) b.n += n; else { sh.load.push({ c: g, n }); sh.load.sort((x, y) => x.c - y.c); }
}
function pay(s, from, to, n) { // bani de la o companie la alta (-1 = piața)
  if (n <= 0 || s.sandbox) return;
  if (from >= 0) s.companies[from].cash -= n;
  if (to >= 0) { s.companies[to].cash += n; s.companies[to].month += n; }
}

/** Câte tone din g poate cumpăra compania co din port (stoc, loc în cală și, la alții, bani). */
function canBuy(s, sh, st, g, mine, price) {
  let n = Math.min(st.cargo[g], shipFree(sh));
  if (!mine && !s.sandbox && price > 0) n = Math.min(n, Math.max(0, (s.companies[sh.owner].cash / price) | 0));
  return Math.max(0, n);
}

/** Vapor ajuns în portul st cu ordinul stop (poate lipsi). Întoarce ce s-a întâmplat, pentru ziar. */
export function trade(s, sh, st, stop) {
  const mine = st.owner === sh.owner, k = islandAt(s, st.x, st.y), msg = [];
  if (!mine) { const fee = PORT.fee + 30 * sh.model; pay(s, sh.owner, st.owner, fee); msg.push(`taxă de port ${fee} lei`); }
  if (!stop) return msg;
  let earn = 0;
  if (stop.a === 'sell' || stop.a === 'swap') {
    const keep = [];
    for (const b of sh.load) {
      if (stop.g.length && !stop.g.includes(b.c)) { keep.push(b); continue; }
      const n = Math.min(b.n, Math.max(0, portCap(st) - st.cargo[b.c]));
      st.cargo[b.c] += n;
      if (!mine) earn += n * priceOf(s, k, b.c);
      if (n) msg.push(`${mine ? 'a descărcat' : 'a vândut'} ${n} t ${GOODS[b.c].name.toLowerCase()}`);
      if (b.n > n) keep.push({ c: b.c, n: b.n - n });
    }
    sh.load = keep;
  }
  if (stop.a === 'swap' && stop.w >= 2 && stop.w < NG) {
    const g = stop.w, p = priceOf(s, k, g);
    let n = Math.min(st.cargo[g], shipFree(sh));
    if (!mine && p > 0) n = Math.min(n, (earn / p) | 0);
    if (n > 0) {
      st.cargo[g] -= n; put(sh, g, n);
      if (!mine) { earn -= n * p; pay(s, -1, st.owner, n * p); }
      msg.push(`a luat la schimb ${n} t ${GOODS[g].name.toLowerCase()}`);
    }
  }
  if (earn > 0) { pay(s, -1, sh.owner, earn); sh.money += earn; msg.push(`+${earn} lei`); }
  if (stop.a === 'load') buyList(s, sh, st, k, mine, stop.g.length ? stop.g : GOODS.map((_, g) => g).filter((g) => g >= 2), msg);
  if (stop.l && stop.l.length) buyList(s, sh, st, k, mine, stop.l, msg); // după vânzare: încarcă și marfa de dus mai departe
  s.dirty.stations = true;
  return msg;
}

/** Încarcă mărfurile din listă din depozitul portului (la alții le plătești la prețul pieței). */
function buyList(s, sh, st, k, mine, list, msg) {
  for (const g of list) {
    const p = priceOf(s, k, g), n = canBuy(s, sh, st, g, mine, p);
    if (n <= 0) continue;
    st.cargo[g] -= n; put(sh, g, n);
    if (!mine) { pay(s, sh.owner, st.owner, n * p); sh.money -= n * p; }
    msg.push(`a încărcat ${n} t ${GOODS[g].name.toLowerCase()}${mine ? '' : ` (${n * p} lei)`}`);
  }
}

/** Ziarul: o propoziție scurtă pentru jucători (doar când s-a întâmplat ceva cu marfa). */
export function tellTrade(s, sh, st, msg) {
  if (msg.length && msg.some((m) => !m.startsWith('taxă'))) addNews(s, '🚢', `Vaporul ${sh.id} la ${st.name}: ${msg.join(', ')}.`);
}
