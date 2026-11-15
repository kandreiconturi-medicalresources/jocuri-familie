// Ce se poate lega: de la fiecare industrie la cele mai apropiate care îi iau marfa (industrii sau orașe). Funcție pură.
import { INDUSTRIES, CITY_GOODS } from './goods.js';
import { tileDist } from './cargo.js';

/** [{ from: {x,y}, to: {x,y}, good, fromName, toName }], cel mult 2 industrii și 1 oraș, în 32 de plăci. */
export function goodsLinks(s) {
  const out = [];
  for (const o of s.industries) {
    const g = INDUSTRIES[o.type].out;
    if (g < 0) continue;
    const inds = s.industries.filter((q) => INDUSTRIES[q.type].in.includes(g)).sort((x, y) => tileDist(o, x) - tileDist(o, y)).slice(0, 2);
    const cities = CITY_GOODS.some((l) => l.includes(g)) ? s.cities.slice().sort((x, y) => tileDist(o, x) - tileDist(o, y)).slice(0, 1) : [];
    const cand = [...inds, ...cities].filter((q) => tileDist(o, q) <= 32);
    for (const q of cand.slice(0, 2)) out.push({ from: o, to: q, good: g });
  }
  return out;
}
