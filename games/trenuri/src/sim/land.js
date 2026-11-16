// Proprietăți (etapa 7.4): parcele 4×4 pe insula altuia (`buyLand`) și industrii străine (`buyIndustry`).
// Pe parcelele tale poți construi (șină, gară, port, capete de pod) în ciuda regulii „insula e a altuia” (vezi `canBuild`).
import { WATER_H, LAND } from './consts.js';
import { INDUSTRIES } from './goods.js';
import { islandAt } from './islands.js';
import { parcelsW, tileOwner } from './landBase.js';
import { addNews } from './news.js';

export { parcelsW, parcelId, tileOwner } from './landBase.js';
const fail = (err) => ({ ok: false, err });
const isInt = Number.isInteger;
const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

/** Valoarea terenului unei parcele (lei, întreg): uscatul, locurile fără pădure, orașele și industriile din jur. */
export function landValue(s, px, py) {
  let land = 0, open = 0;
  for (let y = py * 4; y < py * 4 + 4 && y < s.h; y++) for (let x = px * 4; x < px * 4 + 4 && x < s.w; x++) {
    const i = y * s.w + x;
    if (s.water[i] || s.height[i] <= WATER_H) continue;
    land++;
    if (!s.forest[i]) open++;
  }
  if (!land) return 0;
  const cx = px * 4 + 2, cy = py * 4 + 2;
  let v = land * 150 + open * 50;
  for (const c of s.cities) { const d = cheb(c.x, c.y, cx, cy); if (d < 12) v += (12 - d) * (c.pop >> 4); }
  for (const o of s.industries) { const d = cheb(o.x, o.y, cx, cy); if (d < 9) v += (9 - d) * 120; }
  return v;
}
export const landPrice = (s, px, py) => landValue(s, px, py) * LAND.mult;
export const industryPrice = (o) => LAND.ind + 10 * Math.min(o.made, 2000);

/** O placă de uscat a parcelei (sau null): arată pe ce insulă e. */
function landTile(s, px, py) {
  for (let y = py * 4; y < py * 4 + 4 && y < s.h; y++) for (let x = px * 4; x < px * 4 + 4 && x < s.w; x++) {
    const i = y * s.w + x;
    if (!s.water[i] && s.height[i] > WATER_H && s.isl[i]) return [x, y];
  }
  return null;
}

/** Ce se întâmplă dacă `c` cumpără parcela: { ok, err, price, seller, island } (pentru interfață și pentru comandă). */
export function parcelInfo(s, c, px, py) {
  if (!s.islands || !isInt(px) || !isInt(py) || px < 0 || py < 0 || px >= parcelsW(s) || py >= (s.h + 3) >> 2) return fail('harta');
  const t = landTile(s, px, py);
  if (!t) return fail('teren');
  const k = islandAt(s, t[0], t[1]), owner = s.islands[k].owner, seller = tileOwner(s, t[0], t[1]);
  if (owner < 0) return fail('teren'); // insula fără stăpân e liberă: nu are ce vinde
  if (seller === c.id) return fail('exista');
  for (const st of s.stations) if (st.owner !== c.id && (st.x >> 2) === px && (st.y >> 2) === py) return fail('ocupat');
  for (const d of s.depots) if ((d.x >> 2) === px && (d.y >> 2) === py) return fail('ocupat');
  return { ok: true, price: landPrice(s, px, py), seller, island: k, owner };
}

function buyLand(s, cmd, c) {
  const r = parcelInfo(s, c, cmd.px, cmd.py);
  if (!r.ok) return r;
  if (!s.sandbox && c.cash < r.price) return fail('bani');
  if (!s.sandbox) { c.cash -= r.price; s.companies[r.seller].cash += r.price; }
  if (!s.land) s.land = new Uint8Array(parcelsW(s) * ((s.h + 3) >> 2));
  s.land[cmd.py * parcelsW(s) + cmd.px] = c.id === r.owner ? 0 : c.id + 1; // înapoi la stăpânul insulei = 0
  s.dirty.land = true;
  addNews(s, '🏠', `${c.name} a cumpărat teren pe ${s.islands[r.island].name}. Acolo poate construi.`);
  return { ok: true, cost: r.price, to: r.seller };
}

/** Industria cumpărată dă marfa gărilor cumpărătorului (vezi `collectDaily`). */
function buyIndustry(s, cmd, c) {
  const o = isInt(cmd.id) ? s.industries[cmd.id] : null;
  if (!s.islands || !o) return fail('inexistent');
  const k = islandAt(s, o.x, o.y), owner = k >= 0 ? s.islands[k].owner : -1;
  if (owner < 0) return fail('teren');
  if (owner === c.id || o.buyer !== undefined) return fail('exista');
  if (INDUSTRIES[o.type].out < 0) return fail('teren');
  const price = industryPrice(o);
  if (!s.sandbox && c.cash < price) return fail('bani');
  if (!s.sandbox) { c.cash -= price; s.companies[owner].cash += price; }
  o.buyer = c.id;
  s.dirty.industries = true;
  addNews(s, '🏭', `${c.name} a cumpărat ${o.name} de pe ${s.islands[k].name}. Acum marfa ei merge la gările lui.`);
  return { ok: true, cost: price, to: owner };
}

/** Valoarea proprietăților unei companii (pentru clasament): parcelele ținute, la preț, și industriile cumpărate. */
export function landWorth(s, id) {
  let v = 0;
  if (s.land) { const w = parcelsW(s); for (let i = 0; i < s.land.length; i++) if (s.land[i] === id + 1) v += landPrice(s, i % w, (i / w) | 0); }
  for (const o of s.industries) if (o.buyer === id) v += industryPrice(o);
  return v;
}

export const LAND_COMMANDS = { buyLand, buyIndustry };
