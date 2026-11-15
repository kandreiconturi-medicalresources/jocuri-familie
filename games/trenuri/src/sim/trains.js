// Trenuri: drum pe rețeaua de șine, accelerare/frânare, semnalizare, pane, oprire în gară.
import { createHeap, KEY } from './heap.js';
import { DX, DY, LEN, MODELS, DWELL, RETRY, TICKS_PER_DAY, YIELD_BASE, YIELD_LONG } from './consts.js';
import { addNews } from './news.js';
import { roll } from './rand.js';
import { mark, blocked } from './blocks.js';
import { unload, load } from './cargo.js';
export { capacity, tileDist } from './cargo.js';

/** Cel mai scurt drum pe șine între două plăci (indici), sau null. Dijkstra, ordine deterministă. */
export function findRail(s, a, b) {
  const { w, track } = s, n = w * s.h;
  const g = new Int32Array(n).fill(-1), prev = new Int32Array(n).fill(-1);
  const heap = createHeap();
  g[a] = 0; heap.push(a);
  while (heap.size) {
    const key = heap.pop(), cur = key % KEY;
    if (g[cur] * KEY + cur !== key) continue;
    if (cur === b) break;
    const x = cur % w, y = (cur / w) | 0, t = track[cur];
    for (let d = 0; d < 8; d++) {
      if (!((t >> d) & 1)) continue;
      const ni = (y + DY[d]) * w + x + DX[d], ng = g[cur] + LEN[d];
      if (g[ni] >= 0 && g[ni] <= ng) continue;
      g[ni] = ng; prev[ni] = cur;
      heap.push(ng * KEY + ni);
    }
  }
  if (g[b] < 0) return null;
  const path = [];
  for (let c = b; c !== -1; c = prev[c]) path.push(c);
  return path.reverse();
}

export const segLen = (w, p, k) => ((p[k] % w !== p[k + 1] % w) && (((p[k] / w) | 0) !== ((p[k + 1] / w) | 0)) ? 362 : 256);
const pathLen = (w, p) => { let L = 0; for (let k = 0; k + 1 < p.length; k++) L += segLen(w, p, k); return L; };

/** Viteza maximă reală: puterea locomotivei (prea multe vagoane = mai încet) și depoul de apă pentru abur. */
export function effVmax(s, t) {
  const m = MODELS[t.model];
  let v = m.vmax;
  if (t.cars > m.power) v = Math.max(m.vmax >> 1, ((v * m.power) / t.cars) | 0);
  if (m.smoke && t.route.some((id) => { const q = s.stations.find((r) => r.id === id); return q && q.up[0]; })) v += v >> 2;
  return v;
}

function depart(s, t) {
  const len = t.route.length;
  if (len < 2) { t.wait = RETRY; return; }
  const cur = t.route.indexOf(t.to);
  const at = cur >= 0 ? cur : t.at, nxt = (at + 1) % len;
  const A = s.stations.find((q) => q.id === t.to), B = s.stations.find((q) => q.id === t.route[nxt]);
  if (!A || !B || A.id === B.id) { t.wait = RETRY; return; }
  const p = findRail(s, A.y * s.w + A.x, B.y * s.w + B.x);
  if (!p) {
    t.wait = RETRY;
    if (!t.lost) { t.lost = 1; addNews(s, '🤔', `Trenul ${t.id} nu găsește drum de la ${A.name} la ${B.name}. Leagă-le cu șină!`); }
    return;
  }
  t.lost = 0;
  if (p.length > 1 && blocked(s, p[1])) { t.wait = 8; return; } // șina e ocupată: așteaptă în gară
  t.from = A.id; t.to = B.id; t.at = nxt;
  t.path = p; t.seg = 0; t.pos = 0; t.left = pathLen(s.w, p); t.speed = 0; t.state = 1; t.hold = 0;
}

function arrive(s, t) {
  const st = s.stations.find((q) => q.id === t.to);
  t.speed = 0; t.state = 2; t.wait = DWELL; t.hold = 0;
  if (!st) return;
  const earned = unload(s, t, st);
  load(s, t, st);
  if (earned > 0) addNews(s, '💰', `Trenul ${t.id} a adus ${earned} lei la ${st.name}.`);
}

/** Când așteaptă prea mult la intrarea în secțiune, trenul se întoarce la gara de unde a plecat. */
function reverse(s, t) {
  const L = segLen(s.w, t.path, t.seg), p = t.path.slice(0, t.seg + 2).reverse();
  t.pos = L - t.pos; t.path = p; t.seg = 0; t.left = pathLen(s.w, p) - t.pos;
  const f = t.from; t.from = t.to; t.to = f;
  t.speed = 0; t.hold = 0;
  addNews(s, '↩️', `Trenul ${t.id} a așteptat prea mult și se întoarce, ca să facă loc.`);
}
/** Cine cedează: față în față, se întoarce trenul care a mers mai puțin (la egalitate, id mai mare); din urmă, doar după o așteptare lungă. */
function shouldYield(s, t) {
  const n = t.path[t.seg + 2], me = t.path[t.seg + 1];
  const q = s.trains.find((o) => o !== t && o.state === 1 && o.path.indexOf(n) >= Math.max(0, o.seg - 9) && o.path.indexOf(n) <= o.seg + 1);
  if (!q) return t.hold >= YIELD_LONG;
  const qi = q.path.indexOf(n), mi = q.path.indexOf(me);
  if (mi > qi && qi >= 0) return t.seg < q.seg || (t.seg === q.seg && t.id > q.id); // vine spre mine: cedează cel care a mers mai puțin
  return t.hold >= YIELD_LONG;
}

function move(s, t) {
  const m = MODELS[t.model];
  if (t.state === 2) { // oprit în gară
    if (t.wait > 0) { t.wait--; return; }
    depart(s, t);
    return;
  }
  if (t.broken > 0) { t.broken--; t.speed = 0; return; }
  if (s.tick % TICKS_PER_DAY === 0 && roll(s, 2000) < 100 - m.rel) {
    t.broken = TICKS_PER_DAY; t.speed = 0;
    addNews(s, '🔧', `Trenul ${t.id} s-a stricat puțin. Mecanicii îl repară într-o zi!`);
    return;
  }
  const vm = effVmax(s, t);
  if (!(s.tick & 1)) { // 1 treaptă de viteză la 2 pași
    if (t.speed * (t.speed + 1) >= t.left) t.speed = Math.max(2, t.speed - 1);
    else if (t.speed < vm) t.speed++;
    else if (t.speed > vm) t.speed--;
  }
  const last = t.path.length - 2;
  let adv = Math.min(t.speed, t.left), stop = false;
  if (t.seg < last && blocked(s, t.path[t.seg + 2])) { // secțiunea următoare e ocupată
    const room = segLen(s.w, t.path, t.seg) - t.pos;
    if (adv >= room) { adv = room; stop = true; }
  }
  t.left -= adv; t.pos += adv;
  while (t.seg < last && t.pos >= segLen(s.w, t.path, t.seg) && !blocked(s, t.path[t.seg + 2])) { t.pos -= segLen(s.w, t.path, t.seg); t.seg++; stop = false; }
  if (stop || (t.seg < last && t.pos >= segLen(s.w, t.path, t.seg))) {
    t.speed = 0;
    if (adv === 0 && ++t.hold >= YIELD_BASE && shouldYield(s, t)) reverse(s, t);
    return;
  }
  t.hold = 0;
  if (t.left <= 0) { t.pos = segLen(s.w, t.path, last); arrive(s, t); }
}

export function stepTrain(s, t) {
  mark(s, t, -1);
  move(s, t);
  mark(s, t, 1);
}
