// Clasament fără sfârșit (etapa 7.4): ziarul anunță cine conduce și pragurile de 100.000 / 500.000 / 1.000.000 lei, o dată pe companie.
import { THRESHOLDS } from './consts.js';
import { standings } from './value.js';
import { addNews } from './news.js';

const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Lunar și la crearea lumii (prima apelare doar notează starea de pornire, fără știri). */
export function leadersMonthly(s) {
  const st = standings(s);
  if (!st.length) return;
  for (const e of st) {
    const co = s.companies[e.id], crossed = THRESHOLDS.filter((t) => e.value >= t).length;
    if (co.th === undefined) { co.th = crossed; continue; }
    while (co.th < crossed) { addNews(s, '💎', `${co.name} valorează acum peste ${fmt(THRESHOLDS[co.th])} lei!`); co.th++; }
  }
  if (s.leader === undefined) s.leader = st[0].id;
  else if (st[0].id !== s.leader) {
    s.leader = st[0].id;
    if (st.length > 1) addNews(s, '👑', `${st[0].name} conduce acum clasamentul!`);
  }
}
