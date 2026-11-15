// Trenuri: drum pe rețeaua de șine, accelerare/frânare, oprire în gară, încărcare, descărcare, venit.
import { createHeap, KEY } from './heap.js';
import { DX, DY, LEN, MODELS, DWELL, RETRY, RATE, CAP_PASS, CAP_MAIL, carKind } from './consts.js';
import { addNews } from './news.js';

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

export const capacity = (t) => {
  let c = [0, 0];
  for (let i = 0; i < t.cars; i++) c[carKind(i)] += carKind(i) ? CAP_MAIL : CAP_PASS;
  return c;
};
const loaded = (t, c) => t.load.reduce((n, b) => n + (b.c === c ? b.n : 0), 0);

/** Distanță în linie dreaptă în plăci (aproximare întreagă a diagonalei). */
export function tileDist(a, b) {
  const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
  return Math.max(dx, dy) + ((Math.min(dx, dy) * 3) >> 3);
}

function unload(s, t, st) {
  const co = s.companies[t.owner];
  let earned = 0, pass = 0;
  const keep = [];
  for (const b of t.load) {
    if (b.from === st.id) { keep.push(b); continue; }
    const src = s.stations.find((q) => q.id === b.from);
    const dist = src ? Math.max(1, tileDist(src, st)) : 1;
    const elapsed = s.tick - b.t, ref = (dist * 256) / 40 | 0;
    const ratio = (elapsed * 100) / Math.max(1, ref) | 0;
    const bonus = ratio <= 100 ? 150 : ratio <= 200 ? 125 : ratio <= 400 ? 100 : 70;
    earned += ((b.n * dist * RATE[b.c] * bonus) / 100) | 0;
    if (b.c === 0) pass += b.n;
  }
  t.load = keep;
  if (earned > 0) {
    co.cash += earned; t.money += earned; co.month += earned;
    if (st.cityId >= 0) s.cities[st.cityId].delivered += pass;
  }
  return earned;
}

function load(s, t, st) {
  const cap = capacity(t);
  const take = (c, key) => {
    const n = Math.min(cap[c] - loaded(t, c), st.waiting[key]);
    if (n > 0) { st.waiting[key] -= n; t.load.push({ c, n, from: st.id, t: s.tick }); }
  };
  take(0, 'pass'); take(1, 'mail');
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
  t.lost = 0; t.from = A.id; t.to = B.id; t.at = nxt;
  t.path = p; t.seg = 0; t.pos = 0; t.left = pathLen(s.w, p); t.speed = 0; t.state = 1;
}

function arrive(s, t) {
  const st = s.stations.find((q) => q.id === t.to);
  t.speed = 0; t.state = 2; t.wait = DWELL;
  if (!st) return;
  const earned = unload(s, t, st);
  load(s, t, st);
  if (earned > 0) addNews(s, '💰', `Trenul ${t.id} a adus ${earned} lei la ${st.name}.`);
}

export function stepTrain(s, t) {
  const m = MODELS[t.model];
  if (t.state === 2) { // oprit în gară
    if (t.wait > 0) { t.wait--; return; }
    depart(s, t);
    return;
  }
  // în mișcare: accelerează sau frânează (1 treaptă la 2 pași)
  if (!(s.tick & 1)) {
    if (t.speed * (t.speed + 1) >= t.left) t.speed = Math.max(2, t.speed - 1);
    else if (t.speed < m.vmax) t.speed++;
  }
  let adv = Math.min(t.speed, t.left);
  t.left -= adv; t.pos += adv;
  const last = t.path.length - 2;
  while (t.seg < last && t.pos >= segLen(s.w, t.path, t.seg)) { t.pos -= segLen(s.w, t.path, t.seg); t.seg++; }
  if (t.left <= 0) { t.pos = segLen(s.w, t.path, last); arrive(s, t); }
}
