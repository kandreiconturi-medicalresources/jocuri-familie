// Boți: fug din raza bombelor, sparg lăzi, iau bonusuri și atacă moderat. 3 niveluri: easy, mid, hard.
import { W, H, HZ, FUSE, DIRS, WALL, CRATE, idx, speedOf, bombAt, blastCells, lavaAt } from './rules.js';

const N = W * H, INF = 9999;
const dist = new Int16Array(N), prev = new Int16Array(N), queue = new Int16Array(N);

const LEVEL = {
  easy: { idle: 0.18, bomb: 0.06, pick: 5, hunt: 0 },
  mid: { idle: 0.04, bomb: 0.25, pick: 9, hunt: 0.4 },
  hard: { idle: 0, bomb: 1, pick: 14, hunt: 1 },
};

/** Pentru fiecare celulă: în câți pași o lovește o flacără (INF = sigură). Explozii în lanț incluse. */
export function dangerMap(s, extra) {
  const d = new Int16Array(N).fill(INF);
  const bs = extra ? [...s.bombs, extra] : s.bombs;
  const t = bs.map((b) => b.t);
  const cells = bs.map((b) => blastCells(extra ? { ...s, bombs: bs } : s, b));
  for (let pass = 0; pass < 3; pass++) {
    bs.forEach((b, k) => {
      for (const i of cells[k]) {
        if (t[k] < d[i]) d[i] = t[k];
        const o = bs.findIndex((q) => q.x === i % W && q.y === ((i / W) | 0));
        if (o >= 0 && t[k] < t[o]) t[o] = t[k];
      }
    });
  }
  for (const f of s.flames) d[f.i] = 0;
  return d;
}

function walkable(s, i, startI) {
  const g = s.grid[i];
  if (g === WALL || g === CRATE) return false;
  if (i !== startI && bombAt(s, i % W, (i / W) | 0)) return false;
  return !lavaAt(s, i % W, (i / W) | 0);
}

/** BFS cu timp: nu intră într-o celulă dacă ar ajunge acolo când e deja periculoasă. */
function bfs(s, from, D, stepT) {
  dist.fill(-1);
  let qh = 0, qt = 0;
  dist[from] = 0; prev[from] = -1; queue[qt++] = from;
  while (qh < qt) {
    const c = queue[qh++], cx = c % W, cy = (c / W) | 0;
    for (const [dx, dy] of DIRS) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const n = idx(x, y);
      if (dist[n] >= 0 || !walkable(s, n, from)) continue;
      if ((dist[c] + 1) * stepT >= D[n] - 3) continue;
      dist[n] = dist[c] + 1; prev[n] = c; queue[qt++] = n;
    }
  }
}

const firstStep = (from, to) => { let c = to; while (prev[c] !== from) c = prev[c]; return c; };

function nearest(pred, maxD) {
  let best = -1, bd = INF;
  for (let i = 0; i < N; i++) if (dist[i] > 0 && dist[i] <= maxD && dist[i] < bd && pred(i)) { bd = dist[i]; best = i; }
  return best;
}

/** Direcția spre mijlocul celulei vecine `to`; întâi se aliniază pe culoar. */
function toward(p, from, to) {
  const tx = (to % W) + 0.5, ty = ((to / W) | 0) + 0.5;
  const fx = (from % W) + 0.5, fy = ((from / W) | 0) + 0.5;
  if (to % W !== from % W) { // mișcare orizontală
    if (Math.abs(p.y - fy) > 0.14) return { dx: 0, dy: Math.sign(fy - p.y) };
    return { dx: Math.sign(tx - p.x), dy: 0 };
  }
  if (Math.abs(p.x - fx) > 0.14) return { dx: Math.sign(fx - p.x), dy: 0 };
  return { dx: 0, dy: Math.sign(ty - p.y) };
}

function canEscape(s, p, from, stepT) {
  const b = { x: from % W, y: (from / W) | 0, o: p.id, t: FUSE, r: p.range, pass: [p.id] };
  const D = dangerMap(s, b);
  bfs({ ...s, bombs: [...s.bombs, b] }, from, D, stepT);
  return nearest((i) => D[i] === INF, 12) >= 0;
}

export function botInput(s, id, r) {
  const p = s.players.find((q) => q.id === id);
  const L = LEVEL[p.level] || LEVEL.easy;
  const none = { dx: 0, dy: 0, bomb: false };
  const from = idx(Math.floor(p.x), Math.floor(p.y));
  const stepT = HZ / speedOf(p);
  const D = dangerMap(s);
  const here = D[from];
  const go = (to) => ({ ...toward(p, from, firstStep(from, to)), bomb: false });
  bfs(s, from, D, stepT);

  if (here < 45) { // fuge spre cea mai apropiată celulă sigură
    const safe = nearest((i) => D[i] === INF, 30);
    if (safe >= 0) return go(safe);
    const far = nearest((i) => D[i] > here + 6, 30);
    return far >= 0 ? go(far) : none;
  }
  if (r.chance(L.idle)) return none;

  const cx = from % W, cy = (from / W) | 0;
  const nearCrate = DIRS.some(([dx, dy]) => s.grid[idx(cx + dx, cy + dy)] === CRATE);
  const enemy = s.players.find((q) => q !== p && q.alive && Math.abs(Math.floor(q.x) - cx) + Math.abs(Math.floor(q.y) - cy) <= 2);
  const want = nearCrate ? r.chance(L.bomb) : (enemy && r.chance(L.hunt));
  const drop = want && p.bombs < p.maxBombs && !bombAt(s, cx, cy) && canEscape(s, p, from, stepT);
  bfs(s, from, D, stepT); // canEscape a rescris tablourile
  if (drop) return { dx: 0, dy: 0, bomb: true };
  const pk = nearest((i) => s.pick[i] > 0 && D[i] === INF && !(s.grid[i] === 3 && p.level === 'easy'), L.pick);
  if (pk >= 0) return go(pk);
  const spot = nearest((i) => D[i] === INF && DIRS.some(([dx, dy]) => s.grid[idx((i % W) + dx, ((i / W) | 0) + dy)] === CRATE), 40);
  if (spot >= 0) return go(spot);
  if (L.hunt > 0) {
    const foes = s.players.filter((q) => q !== p && q.alive).map((q) => idx(Math.floor(q.x), Math.floor(q.y)));
    const t = nearest((i) => D[i] === INF && foes.some((f) => Math.abs(f % W - i % W) + Math.abs(((f / W) | 0) - ((i / W) | 0)) <= 1), 60);
    if (t >= 0) return go(t);
  }
  const opts = DIRS.map(([dx, dy]) => idx(cx + dx, cy + dy)).filter((i) => dist[i] > 0 && D[i] === INF);
  return opts.length ? go(r.pick(opts)) : none;
}
