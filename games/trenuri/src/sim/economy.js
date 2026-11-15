// Economie: apariția pasagerilor și a poștei, creșterea orașelor, întreținere lunară.
import { STATION_RADIUS, WAIT_CAP, MAINT, T_PRESENT, T_OWNER_MASK, T_OWNER_SHIFT } from './consts.js';
import { growBuildings, levelOf } from './growth.js';
import { addNews } from './news.js';

export function spawnCargo(s) {
  for (const st of s.stations) {
    const r = STATION_RADIUS[st.size] + 2;
    let pop = 0;
    for (const c of s.cities) if (Math.abs(c.x - st.x) <= r && Math.abs(c.y - st.y) <= r) pop += c.pop;
    if (!pop) continue;
    st.rem.pass += pop; st.rem.mail += pop >> 1;
    const p = (st.rem.pass / 100) | 0, m = (st.rem.mail / 100) | 0;
    st.rem.pass -= p * 100; st.rem.mail -= m * 100;
    st.waiting.pass = Math.min(WAIT_CAP, st.waiting.pass + p);
    st.waiting.mail = Math.min(WAIT_CAP, st.waiting.mail + m);
  }
}

export function monthly(s) {
  for (const c of s.cities) {
    const served = c.delivered > 0 || s.stations.some((st) => Math.max(Math.abs(c.x - st.x), Math.abs(c.y - st.y)) <= STATION_RADIUS[st.size] + 2);
    c.pop += Math.max(2, (c.pop * (c.delivered > 0 ? 5 : served ? 2 : 1) / 100) | 0);
    c.delivered = 0;
    c.supply.pass = c.pop >> 2; c.supply.mail = c.pop >> 4; c.demand.pass = c.pop >> 2; c.demand.mail = c.pop >> 5;
    const lv = levelOf(c.pop);
    if (lv > c.level) { c.level = lv; addNews(s, '🏙️', `${c.name} a crescut: acum e ${lv === 1 ? 'un oraș' : 'o metropolă'}!`); }
    growBuildings(s, c);
  }
  for (const co of s.companies) {
    let tiles = 0;
    for (let i = 0; i < s.track.length; i++) if ((s.track[i] & T_PRESENT) && ((s.track[i] & T_OWNER_MASK) >> T_OWNER_SHIFT) === co.id) tiles++;
    const cost = tiles * MAINT.tile + s.stations.filter((q) => q.owner === co.id).length * MAINT.station + s.trains.filter((q) => q.owner === co.id).length * MAINT.train;
    if (!s.sandbox) co.cash -= cost;
    co.history.push(co.month - cost);
    if (co.history.length > 24) co.history.shift();
    co.month = 0;
    if (co.id === 0) addNews(s, '📅', `Luna s-a încheiat: ${co.history[co.history.length - 1] >= 0 ? 'câștig' : 'pierdere'} de ${Math.abs(co.history[co.history.length - 1])} lei.`);
  }
}
