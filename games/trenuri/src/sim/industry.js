// Industrii: producție (lunar pentru primare, zilnic din ce au primit pentru prelucrătoare), colectare de către gări.
import { INDUSTRIES, GOODS, NG } from './goods.js';
import { PROD, STOCK_CAP, WAIT_CAP, STATION_RADIUS } from './consts.js';

export const reach = (st) => STATION_RADIUS[st.size] + 1; // raza gării pentru industrii (placa industriei e o singură placă)
export const near = (st, o, r = reach(st)) => Math.abs(o.x - st.x) <= r && Math.abs(o.y - st.y) <= r;

/** Industriile primare produc lunar (cu bonus de recoltă). */
export function produceMonthly(s) {
  for (const o of s.industries) {
    const t = INDUSTRIES[o.type];
    if (t.in.length || t.out < 0) { o.boost = 0; continue; }
    const n = o.boost ? (PROD * 3) >> 1 : PROD;
    o.out[t.out] = Math.min(STOCK_CAP, o.out[t.out] + n);
    o.made += n; o.boost = 0;
  }
}

/** Prelucrătoarele produc doar din ce au primit: câte unități au din TOATE intrările. */
export function processDaily(s) {
  for (const o of s.industries) {
    const t = INDUSTRIES[o.type];
    if (!t.in.length) continue;
    let n = STOCK_CAP;
    for (const g of t.in) n = Math.min(n, o.in[g]);
    if (t.out >= 0) n = Math.min(n, STOCK_CAP - o.out[t.out]);
    if (n <= 0) continue;
    for (const g of t.in) o.in[g] -= n;
    if (t.out >= 0) o.out[t.out] += n;
    o.made += n;
  }
}

/** Gările iau din industriile din raza lor ce au de dus. */
export function collectDaily(s) {
  for (const st of s.stations) {
    for (const o of s.industries) {
      const g = INDUSTRIES[o.type].out;
      if (g < 0 || o.out[g] <= 0 || !near(st, o) || (o.buyer !== undefined && o.buyer !== st.owner)) continue; // industria cumpărată (7.4) dă doar gărilor cumpărătorului
      const n = Math.min(o.out[g], WAIT_CAP - st.cargo[g]);
      if (n > 0) { o.out[g] -= n; st.cargo[g] += n; }
    }
  }
}

/** Marfa se strică încet în gări (mai încet cu depozit). */
export function spoilMonthly(s) {
  for (const st of s.stations) {
    const sh = st.up[3] ? 5 : 3;
    for (let g = 2; g < NG; g++) if (st.cargo[g] > 0 && GOODS[g].perish) st.cargo[g] -= Math.max(1, st.cargo[g] >> sh);
  }
}

export const industryAt = (s, x, y) => s.industries.find((o) => o.x === x && o.y === y);
