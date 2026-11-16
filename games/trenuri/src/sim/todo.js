// „De făcut”: lista de lucruri noi de rezolvat pe hartă (pură; o folosesc marcajele și panoul). Nu intră în hash.
import { INDUSTRIES, GOODS, CITY_GOODS } from './goods.js';
import { near } from './industry.js';
import { tileDist } from './cargo.js';
import { STATION_RADIUS } from './consts.js';
import { evaluate } from './scenarios/goals.js';
import { scenarioById } from './scenarios/index.js';

const MAX_ITEMS = 14;
const low = (g) => GOODS[g].name.toLowerCase();
const cityHasStation = (s, c) => s.stations.some((st) => Math.max(Math.abs(c.x - st.x), Math.abs(c.y - st.y)) <= STATION_RADIUS[st.size] + 2);

export function computeTodos(s, co = 0) {
  const out = [];
  for (const t of s.trains) {
    if (t.owner === co && t.dead && t.state === 1) {
      const i = t.path[Math.min(t.seg, t.path.length - 1)];
      out.push({ id: 'dead:' + t.id, kind: 'train', icon: '❗', x: i % s.w, y: (i / s.w) | 0, text: t.resc ? `Trenul ${t.id} e defect pe traseu. Remorca vine!` : `Trenul ${t.id} s-a defectat pe traseu și blochează linia. Trimite remorcă (🚑)!`, ref: { type: 'train', id: t.id } });
      continue;
    }
    if (t.tow || t.owner !== co || !(t.route.length < 2 || t.lost)) continue;
    const st = s.stations.find((q) => q.id === t.to) || s.stations.find((q) => q.id === t.route[0]);
    const i = t.state === 1 && t.path.length ? t.path[Math.min(t.seg, t.path.length - 1)] : null;
    const x = i === null ? (st ? st.x : 0) : i % s.w, y = i === null ? (st ? st.y : 0) : (i / s.w) | 0;
    out.push({ id: 'train:' + t.id, kind: 'train', icon: '❗', x, y, text: t.route.length < 2 ? `Trenul ${t.id} nu are rută.` : `Trenul ${t.id} nu găsește drum. Leagă gările cu șină!`, ref: { type: 'train', id: t.id } });
  }
  if (s.scn && !s.scn.done) {
    const sc = scenarioById(s.scn.id), ev = sc ? evaluate(s, sc) : null;
    for (const r of ev ? ev.goals : []) {
      if (r.tier >= 3) continue;
      const k = r.goal.k, a = r.goal.a;
      let pick = null, text = '';
      if (k === 'del') { pick = s.industries.find((o) => INDUSTRIES[o.type].out === a && !s.stations.some((st) => near(st, o))) || s.industries.find((o) => INDUSTRIES[o.type].out === a); text = `Obiectiv: du ${low(a)}.`; }
      else if (k === 'lvl' || k === 'ups') { pick = s.cities.slice().sort((p, q) => q.pop - p.pop).find((c) => c.level < (k === 'lvl' ? a : 2)); text = pick ? `Obiectiv: ${pick.name} trebuie să crească.` : ''; }
      else if (k === 'served') { pick = s.cities.find((c) => !cityHasStation(s, c)); text = pick ? `Obiectiv: leagă ${pick.name} cu un tren.` : ''; }
      if (pick) out.push({ id: 'goal:' + k + ':' + pick.x, kind: 'goal', icon: '🎯', x: pick.x, y: pick.y, text: text || 'Obiectiv de scenariu.', ref: pick.pop !== undefined ? { type: 'city', id: pick.id } : { type: 'industry', id: pick.id } });
    }
  }
  for (const c of s.cities) {
    if (!cityHasStation(s, c)) continue;
    for (const g of CITY_GOODS[c.level]) {
      if (c.got[g] > 0 || c.prev[g] > 0) continue;
      const src = s.industries.filter((o) => INDUSTRIES[o.type].out === g).sort((p, q) => tileDist(c, p) - tileDist(c, q))[0];
      if (!src || tileDist(c, src) > 32) continue;
      out.push({ id: 'city:' + c.id, kind: 'city', icon: '🏙️', x: c.x, y: c.y, text: `${c.name} cere ${low(g)}. ${src.name} e la ${tileDist(c, src)} plăci.`, ref: { type: 'city', id: c.id } });
      break;
    }
  }
  for (const st of s.stations) {
    if (st.owner !== co) continue;
    let n = 0;
    for (let g = 2; g < st.cargo.length; g++) n += st.cargo[g];
    if (n >= 20 && !s.trains.some((t) => t.route.length > 1 && t.route.includes(st.id))) out.push({ id: 'cargo:' + st.id, kind: 'cargo', icon: '📦', x: st.x, y: st.y, text: `La ${st.name} se adună marfă (${n}), dar niciun tren nu oprește acolo.`, ref: { type: 'station', id: st.id } });
  }
  for (const o of s.industries) {
    const fresh = s.news.some((n) => n.icon === '🏗️' && n.text.includes(o.name));
    if (fresh && !s.stations.some((st) => near(st, o))) out.push({ id: 'ind:' + o.id, kind: 'industry', icon: '🏭', x: o.x, y: o.y, text: `Industrie nouă: ${o.name}. Pune o gară lângă ea!`, ref: { type: 'industry', id: o.id } });
  }
  return out.slice(0, MAX_ITEMS);
}
