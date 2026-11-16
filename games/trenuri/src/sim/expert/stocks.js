// Mod expert, bursa simplificată: preț lunar din profit, active, datorii și creștere; cumpărare/vânzare; dividende; preluare.
import { T_PRESENT, T_OWNER_MASK, T_OWNER_SHIFT } from '../consts.js';
import { companyValue } from '../value.js';
import { addNews } from '../news.js';
import { SHARES, DIV_PCT, MAX_CO } from './consts.js';

const fail = (err) => ({ ok: false, err });
export const profit12 = (co) => co.history.slice(-12).reduce((n, v) => n + v, 0);

/** Prețul țintă al unei acțiuni: valoarea netă + 4×profit pe 12 luni + 2×creștere − un sfert din datorii, împărțit la numărul de acțiuni. */
export function targetPrice(s, co) {
  const v = companyValue(s, co.id), old = co.vh.length >= 12 ? co.vh[co.vh.length - 12] : co.vh.length ? co.vh[0] : v;
  const t = v + 4 * profit12(co) + 2 * Math.max(-v, v - old) - (co.loan >> 2);
  return Math.max(3, (t / SHARES) | 0);
}

/** Lunar: prețul se mută spre țintă (3/4 vechi + 1/4 nou ca să nu sară), istoricul valorii se păstrează 24 de luni. */
export function updatePrices(s) {
  for (const co of s.companies) {
    if (co.dead) continue;
    co.px = Math.max(3, (co.px * 3 + targetPrice(s, co)) >> 2);
    co.vh.push(companyValue(s, co.id));
    if (co.vh.length > 24) co.vh.shift();
  }
}

/** Valoarea netă a directorului companiei `d`: avere personală + acțiunile deținute la toate companiile. */
export function netWorth(s, d) {
  const me = s.companies[d];
  if (!me || !me.sh) return 0;
  let v = me.pw;
  for (const c of s.companies) v += (c.sh[d] || 0) * c.px;
  return v;
}

/** Procentul din acțiuni deținut de directorul `d` la compania `c`. */
export const stakePct = (c, d) => ((c.sh[d] * 100) / SHARES) | 0;
export const isMajor = (c, d) => c.sh[d] * 2 > SHARES;

/** În decembrie: dividend = DIV_PCT% din profit (cel mult jumătate din cash), plătit directorilor; partea publicului dispare. */
export function payDividends(s) {
  for (const co of s.companies) {
    const p = profit12(co);
    if (co.dead || co.easy || p <= 0 || co.cash <= 0) continue;
    const per = Math.min((p * DIV_PCT / 100) | 0, co.cash >> 1) / SHARES | 0;
    if (per <= 0) continue;
    let total = co.mk * per;
    for (let d = 0; d < MAX_CO; d++) if (co.sh[d]) { total += co.sh[d] * per; if (s.companies[d]) s.companies[d].pw += co.sh[d] * per; }
    co.cash -= total;
    co.divPaid = per;
    if (!co.ai) addNews(s, '🎁', `${co.name} a dat dividend: ${per} lei pe acțiune.`);
  }
}

function buyShares(s, cmd, me) {
  const c = s.companies[cmd.co | 0], n = cmd.n | 0;
  if (s.mode !== 'expert' || me.easy || !c || c.dead || !(n >= 1 && n <= SHARES)) return fail('actiuni');
  if (c.mk < n) return fail('actiuni');
  const cost = c.px * n;
  if (me.pw < cost) return fail('bani');
  me.pw -= cost; c.mk -= n; c.sh[me.id] += n;
  return { ok: true, cost };
}

function sellShares(s, cmd, me) {
  const c = s.companies[cmd.co | 0], n = cmd.n | 0;
  if (s.mode !== 'expert' || !c || !(n >= 1 && n <= SHARES) || c.sh[me.id] < n) return fail('actiuni');
  me.pw += c.px * n; c.sh[me.id] -= n; c.mk += n;
  return { ok: true, cost: -c.px * n };
}

/** Preluare: peste 50% dintr-o companie AI. Bunurile și datoriile ei trec la compania ta; ceilalți directori umani sunt plătiți la preț. */
function takeover(s, cmd, me) {
  const t = s.companies[cmd.co | 0];
  if (s.mode !== 'expert' || me.easy || !t || !t.ai || t.dead || t.id === me.id) return fail('actiuni');
  if (!isMajor(t, me.id)) return fail('actiuni');
  let pay = 0;
  for (let d = 0; d < MAX_CO; d++) if (d !== me.id && t.sh[d] && s.companies[d] && !s.companies[d].ai) pay += t.sh[d] * t.px;
  if (me.cash < pay) return fail('bani');
  for (let d = 0; d < MAX_CO; d++) if (d !== me.id && t.sh[d] && s.companies[d] && !s.companies[d].ai) s.companies[d].pw += t.sh[d] * t.px;
  me.cash += t.cash - pay; me.loan += t.loan; me.tr = me.tr.concat(t.tr);
  for (let i = 0; i < s.track.length; i++) { const v = s.track[i]; if ((v & T_PRESENT) && ((v & T_OWNER_MASK) >> T_OWNER_SHIFT) === t.id) s.track[i] = (v & ~T_OWNER_MASK) | (me.id << T_OWNER_SHIFT); }
  for (const st of s.stations) if (st.owner === t.id) st.owner = me.id;
  for (const tr of s.trains) if (tr.owner === t.id) { tr.owner = me.id; tr.route = tr.route.slice(); }
  t.dead = 1; t.cash = 0; t.loan = 0; t.tr = []; t.px = 0; t.mk = 0; t.sh.fill(0);
  s.dirty.track = s.dirty.stations = s.dirty.trains = true;
  addNews(s, '🤝', `${me.name} a preluat ${t.name}! Gările și trenurile ei sunt acum ale tale.`);
  return { ok: true, cost: pay };
}

export const STOCK_COMMANDS = { buyShares, sellShares, takeover };
