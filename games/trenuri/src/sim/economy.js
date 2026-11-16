// Economie: apariția pasagerilor și a poștei, creșterea orașelor cu ce primesc, întreținere lunară.
import { STATION_RADIUS, WAIT_CAP, MAINT, MODELS, T_PRESENT, T_OWNER_MASK, T_OWNER_SHIFT } from './consts.js';
import { NG, wantOf } from './goods.js';
import { growBuildings, levelOf } from './growth.js';
import { addNews } from './news.js';
import { produceMonthly, spoilMonthly } from './industry.js';
import { monthlyEvents } from './events.js';
import { isEx, payMonthly } from './expert/finance.js';
import { expertMonthly } from './expert/index.js';
import { wearMonthly } from './wear.js';
import { islandMonthly } from './islandMonth.js';

export function spawnCargo(s) {
  for (const st of s.stations) {
    const r = STATION_RADIUS[st.size] + 2;
    let pop = 0;
    for (const c of s.cities) if (Math.abs(c.x - st.x) <= r && Math.abs(c.y - st.y) <= r) pop += c.pop;
    if (!pop) continue;
    const mail = pop >> 1;
    st.rem.pass += pop + (st.up[2] ? pop >> 1 : 0); st.rem.mail += mail + (st.up[1] ? mail >> 1 : 0);
    const p = (st.rem.pass / 100) | 0, m = (st.rem.mail / 100) | 0;
    st.rem.pass -= p * 100; st.rem.mail -= m * 100;
    st.waiting.pass = Math.min(WAIT_CAP, st.waiting.pass + p);
    st.waiting.mail = Math.min(WAIT_CAP, st.waiting.mail + m);
  }
}

/** Creșterea lunară a unui oraș: puțin singur, mult cu ce i se aduce (pasageri, poștă, mărfuri cerute). */
export function growCity(s, c) {
  const served = s.stations.some((st) => Math.max(Math.abs(c.x - st.x), Math.abs(c.y - st.y)) <= STATION_RADIUS[st.size] + 2);
  let gain = Math.max(2, (c.pop * (served ? 2 : 1) / 100) | 0);
  for (let g = 0; g < NG; g++) gain += Math.min(c.got[g], wantOf(c, g)) * (g < 2 ? 1 : 2);
  c.pop += Math.min(gain, ((c.pop * 15) / 100 | 0) + 6);
  c.prev = c.got; c.got = new Array(NG).fill(0);
  const lv = levelOf(c.pop);
  if (lv > c.level) { s.stats.up += lv - c.level; c.level = lv; addNews(s, '🏙️', `${c.name} a crescut: acum e ${lv === 1 ? 'un oraș' : 'o metropolă'}!`); }
  growBuildings(s, c, 12);
}

export function monthly(s) {
  monthlyEvents(s);
  produceMonthly(s);
  spoilMonthly(s);
  wearMonthly(s);
  for (const c of s.cities) growCity(s, c);
  for (const co of s.companies) {
    if (co.dead) { co.month = 0; continue; }
    let tiles = 0;
    for (let i = 0; i < s.track.length; i++) if ((s.track[i] & T_PRESENT) && ((s.track[i] & T_OWNER_MASK) >> T_OWNER_SHIFT) === co.id) tiles++;
    const cost = tiles * MAINT.tile + s.stations.filter((q) => q.owner === co.id).length * MAINT.station + s.trains.filter((q) => q.owner === co.id).reduce((n, q) => n + MODELS[q.model].maint, 0);
    const ex = isEx(s, co), paid = ex ? payMonthly(s, co) : cost;
    if (!s.sandbox && !ex) co.cash -= cost;
    if (co.rep) co.rep.inc += co.month;
    co.history.push(co.month - paid);
    if (co.history.length > 24) co.history.shift();
    if (co.id === 0 && co.month > 500 && co.month > co.record) { co.record = co.month; addNews(s, '🏆', `Record de livrări! Luna asta ai câștigat ${co.month} lei din transport.`); }
    co.month = 0;
    if (co.id === 0 && !co.dead) addNews(s, '📅', `Luna s-a încheiat: ${co.history[co.history.length - 1] >= 0 ? 'câștig' : 'pierdere'} de ${Math.abs(co.history[co.history.length - 1])} lei.`);
  }
  if (s.mode === 'expert') expertMonthly(s);
  if (s.islands) islandMonthly(s);
}
