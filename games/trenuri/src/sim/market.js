// Piața insulelor (etapa 7.2): un preț întreg pe tonă pentru fiecare insulă și marfă, recalculat lunar.
// Ce lipsește pe insulă (cerere mare, stoc mic) e scump; ce prisosește e ieftin. Pasagerii și poșta nu au preț.
import { PROD } from './consts.js';
import { GOODS, NG, INDUSTRIES, wantOf } from './goods.js';
import { islandAt, islandGoods } from './islands.js';

export const basePrice = (g) => (g < 2 ? 0 : GOODS[g].rate * 20);
/** Prețul pe tonă al mărfii g pe insula k (pe mare = prețul de bază). */
export const priceOf = (s, k, g) => (k >= 0 && s.market && s.market[k] ? s.market[k][g] : basePrice(g));

export function initMarket(s) {
  s.market = s.islands.map((_, k) => { const can = islandGoods(s, k); return GOODS.map((_g, g) => ((basePrice(g) * (can[g] ? 80 : 150)) / 100) | 0); });
}

/** Cerere, producție și stoc pe insula k pentru fiecare marfă (tone pe lună). */
export function islandBalance(s, k) {
  const dem = new Array(NG).fill(0), sup = new Array(NG).fill(0), stock = new Array(NG).fill(0);
  for (const c of s.cities) if (islandAt(s, c.x, c.y) === k) for (let g = 2; g < NG; g++) dem[g] += wantOf(c, g);
  for (const o of s.industries) {
    if (islandAt(s, o.x, o.y) !== k) continue;
    const d = INDUSTRIES[o.type];
    for (const g of d.in) dem[g] += PROD;
    if (d.out >= 0) sup[d.out] += PROD;
  }
  for (const st of s.stations) if (st.port && islandAt(s, st.x, st.y) === k) for (let g = 2; g < NG; g++) stock[g] += st.cargo[g];
  return { dem, sup, stock };
}

/** Lunar: fiecare preț se mută cu ⅓ spre ținta dată de cerere − producție − jumătate din stocul porturilor. */
export function marketMonthly(s) {
  s.islands.forEach((_, k) => {
    const b = islandBalance(s, k), row = s.market[k];
    for (let g = 2; g < NG; g++) {
      const base = basePrice(g), diff = b.dem[g] - b.sup[g] - (b.stock[g] >> 1), den = Math.max(PROD, b.dem[g] + b.sup[g]);
      const pct = Math.max(50, Math.min(220, 100 + ((diff * 60) / den | 0)));
      const target = ((base * pct) / 100) | 0;
      row[g] = Math.max(Math.max(1, (base / 3) | 0), Math.min(base * 3, row[g] + (((target - row[g]) / 3) | 0)));
    }
  });
}
