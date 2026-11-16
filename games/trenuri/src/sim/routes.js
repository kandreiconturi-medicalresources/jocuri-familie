// Unde poate duce o marfă și cine o poate aproviziona: liste sortate după profit estimat. Pure (fără DOM), doar pentru sfaturi și interfață.
import { GOODS, INDUSTRIES, wantOf } from './goods.js';
import { LOW_PAY, STOCK_CAP, T_PRESENT } from './consts.js';
import { near } from './industry.js';
import { tileDist } from './cargo.js';

const LOAD = 120; // un tren de 6 vagoane duce cam atât: baza profitului estimat
export const CITY_HIGH = 10; // cerere lunară de la care spunem „mare”

/** 'station' dacă o gară e lângă loc, 'track' dacă trece șină la mai puțin de 3 plăci, altfel 'none'. */
export function railAt(s, o, owner = null) {
  if (s.stations.some((st) => (owner === null || st.owner === owner) && (o.type === undefined ? tileDist(st, o) <= 5 : near(st, o)))) return 'station';
  for (let y = Math.max(0, o.y - 2); y <= Math.min(s.h - 1, o.y + 2); y++) for (let x = Math.max(0, o.x - 2); x <= Math.min(s.w - 1, o.x + 2); x++) if (s.track[y * s.w + x] & T_PRESENT) return 'track';
  return 'none';
}

/** Venitul estimat pe tonă (fără bonus de viteză) pentru marfa g dusă la d plăci. */
export const perTon = (g, d) => d * GOODS[g].rate;

/** Cât cere un oraș din g: { want, level: 0 deloc | 1 mică | 2 mare }. */
export function cityDemand(c, g) {
  const want = wantOf(c, g);
  return { want, level: want <= 0 ? 0 : want >= CITY_HIGH ? 2 : 1 };
}

/** Profitul estimat al unui tren plin dus la d plăci unde se cer `units` tone (fără cerere, doar LOW_PAY). */
const profit = (g, d, units) => (units > 0 ? perTon(g, d) * Math.min(LOAD, units) : ((perTon(g, d) * 20 * LOW_PAY) / 100) | 0);

/** Spre ce orașe și industrii poate duce marfa g din src, sortat descrescător după profit (apoi distanță, apoi id). */
export function destinations(s, src, g, owner = null) {
  const out = [];
  for (const c of s.cities) {
    const d = tileDist(src, c), dm = cityDemand(c, g);
    out.push({ kind: 'city', o: c, d, want: dm.want, level: dm.level, perTon: dm.level ? perTon(g, d) : (perTon(g, d) * LOW_PAY / 100) | 0, profit: profit(g, d, dm.want), rail: railAt(s, c, owner) });
  }
  for (const o of s.industries) {
    if (o === src || !INDUSTRIES[o.type].in.includes(g)) continue;
    const d = tileDist(src, o), room = Math.max(0, STOCK_CAP - o.in[g]);
    out.push({ kind: 'ind', o, d, want: room, level: room >= CITY_HIGH ? 2 : room > 0 ? 1 : 0, perTon: perTon(g, d), profit: profit(g, d, room), rail: railAt(s, o, owner) });
  }
  return out.sort((a, b) => b.profit - a.profit || a.d - b.d || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.o.id - b.o.id));
}

/** Industriile care produc g, de la cea mai apropiată: [{ o, d, perTon, rail }] (cine poate aproviziona dst). */
export function suppliers(s, dst, g, owner = null) {
  return s.industries.filter((o) => INDUSTRIES[o.type].out === g)
    .map((o) => ({ o, d: tileDist(o, dst), perTon: perTon(g, tileDist(o, dst)), rail: railAt(s, o, owner) }))
    .sort((a, b) => a.d - b.d || a.o.id - b.o.id);
}
