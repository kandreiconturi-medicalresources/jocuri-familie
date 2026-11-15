// Logica pură a co-op-ului în rețea (fără DOM și fără joc): gazdă, pachete de stare, interpolare, evenimente pe grilă.
import { SMALL, BIG } from '../physics.js';

export const INTERP_MS = 100, MAX_EXTRAP_MS = 100, TICK_MS = 1000 / 60;
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
const sgn = (v) => (v < 0 ? -1 : 1);

// ---------- gazdă, ordine, final de nivel ----------
/** Gazda = jucătorul marcat `host` de server (altfel primul din listă). */
export function chooseHost(players) {
  if (!players || !players.length) return null;
  return (players.find((p) => p.host) || players[0]).id;
}
export const amHost = (players, you) => chooseHost(players) === you;
/** Ordinea personajelor pe durata unui nivel: gazda = Bobo, apoi cum au intrat. */
export const startIds = (players) => players.map((p) => p.id);
export const arrivedAll = (arrived, present) => present.length > 0 && present.every((id) => arrived.has(id));

/** Hash mic al grilei: clienții compară nivelul primit de la gazdă cu al lor. */
export function levelHash(grid) {
  let h = 2166136261;
  for (const row of grid) {
    const s = Array.isArray(row) ? row.join('') : row;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  }
  return h >>> 0;
}

// ---------- ritmul trimiterilor (serverul acceptă 30 mesaje/s; rămânem sub 20) ----------
export const newPlan = () => ({ last: -99, lastP: -99, lastW: -99 });
/** Întoarce null sau { p, w, ev } = ce intră în mesajul de acum. Gazda trimite lumea la ~10/s, jucătorul la ~15/s. */
export function planSend(st, tick, host, hasEvents) {
  if (tick - st.last < 3) return null;
  const p = tick - st.lastP >= 4, w = host && tick - st.lastW >= 6;
  if (!p && !w && !hasEvents) return null;
  st.last = tick;
  if (p) st.lastP = tick;
  if (w) st.lastW = tick;
  return { p, w, ev: hasEvents };
}

// ---------- jucători ----------
export const FL = { GROUND: 1, BIG: 2, SHIELD: 4, WAND: 8, DEAD: 16, WATER: 32, HURT: 64, SHOOT: 128, LAND: 256, INV: 512 };

export function packPlayer(p) {
  const f = (p.onGround ? FL.GROUND : 0) | (p.big ? FL.BIG : 0) | (p.shield ? FL.SHIELD : 0) | (p.wand ? FL.WAND : 0)
    | (p.dead ? FL.DEAD : 0) | (p.inWater ? FL.WATER : 0) | (p.hurtT > 0 ? FL.HURT : 0) | (p.shootCd > 6 ? FL.SHOOT : 0)
    | (p.land > 0 ? FL.LAND : 0) | (p.inv > 0 ? FL.INV : 0);
  return [r1(p.x), r1(p.y), r2(p.vx), r2(p.vy), sgn(p.face), f, r1(p.walk || 0), p.hearts | 0];
}

export function unpackPlayer(a) {
  if (!Array.isArray(a) || a.length < 8) return null;
  return { x: num(a[0]), y: num(a[1]), vx: num(a[2]), vy: num(a[3]), face: sgn(a[4]), flags: num(a[5]) | 0, walk: num(a[6]), hearts: Math.max(0, Math.min(3, num(a[7]) | 0)) };
}

/** Pune starea (despachetată sau interpolată) pe corpul unui jucător de la distanță. `tick` face scăparea de după lovitură. */
export function applyPlayer(b, s, tick = 0) {
  const f = s.flags, big = !!(f & FL.BIG), d = big ? BIG : SMALL;
  b.x = s.x; b.y = s.y; b.vx = s.vx; b.vy = s.vy; b.face = s.face; b.walk = s.walk; b.hearts = s.hearts;
  b.w = d.w; b.h = d.h; b.big = big;
  b.onGround = !!(f & FL.GROUND); b.shield = !!(f & FL.SHIELD); b.wand = !!(f & FL.WAND); b.dead = !!(f & FL.DEAD);
  b.inWater = !!(f & FL.WATER); b.hurtT = f & FL.HURT ? 5 : 0; b.shootCd = f & FL.SHOOT ? 10 : 0; b.land = f & FL.LAND ? 4 : 0;
  b.inv = f & FL.INV ? 1 + ((tick >> 2) & 1) * 4 : 0;
}

export function pushSample(buf, t, s, max = 12) {
  buf.push({ t, s });
  if (buf.length > max) buf.shift();
}

/** Starea la momentul t (ms): interpolare între eșantioane, mică extrapolare la capăt, salt direct la teleportări. */
export function sampleAt(buf, t) {
  const n = buf.length;
  if (!n) return null;
  const first = buf[0], last = buf[n - 1];
  if (t <= first.t) return { ...first.s };
  if (t >= last.t) {
    const s = { ...last.s }, dt = Math.min(t - last.t, MAX_EXTRAP_MS);
    if (!(s.flags & FL.DEAD)) s.x += s.vx * dt / TICK_MS;
    return s;
  }
  let i = 1;
  while (buf[i].t < t) i++;
  const a = buf[i - 1], b = buf[i], k = (t - a.t) / (b.t - a.t || 1);
  if (Math.abs(b.s.x - a.s.x) > 160 || Math.abs(b.s.y - a.s.y) > 160) return { ...b.s };
  const L = (u, v) => u + (v - u) * k;
  return { ...(k < 0.5 ? a.s : b.s), x: L(a.s.x, b.s.x), y: L(a.s.y, b.s.y), vx: L(a.s.vx, b.s.vx), vy: L(a.s.vy, b.s.vy), walk: L(a.s.walk, b.s.walk) };
}

// ---------- evenimente pe grilă ----------
const ITEM = { Q: 'bubble', C: 'grow', S: 'wand' };
/**
 * Aplică 'b' (cutie/cărămidă lovită: {id, c: placa veche, n: placa nouă}) sau 'p' (colectabil: {id, c}) pe grilă.
 * Întoarce o descriere pentru efecte sau null dacă nu se aplică (id greșit, placa nu mai e cea veche = deja luată).
 */
export function applyTileEvent(grid, width, ev) {
  if (!ev || !Number.isInteger(ev.id) || ev.id < 0 || typeof ev.c !== 'string') return null;
  const tx = ev.id % width, ty = Math.floor(ev.id / width), row = grid[ty];
  if (!row || row[tx] !== ev.c) return null;
  if (ev.e === 'b') {
    if (!'GQCSB'.includes(ev.c) || !['g', '.', 'B'].includes(ev.n)) return null;
    row[tx] = ev.n;
    return { kind: 'box', tx, ty, c: ev.c, n: ev.n, item: ITEM[ev.c] || null };
  }
  if (ev.e === 'p') {
    if (!'oh*'.includes(ev.c)) return null;
    row[tx] = '.';
    return { kind: 'pick', tx, ty, c: ev.c };
  }
  return null;
}

// ---------- inamici, boss, platforme (gazdă → clienți) ----------
export const E_STATES = ['idle', 'fall', 'rest', 'rise'];
export const B_STATES = ['sleep', 'fight', 'dive', 'rest', 'rise', 'dead'];

export function packEnemy(e) {
  return [e.id, r1(e.x), r1(e.y), r2(e.vx || 0), r2(e.vy || 0), sgn(e.dir), e.t | 0, Math.max(0, E_STATES.indexOf(e.state)), e.timer | 0,
    e.dead | 0, (e.knock ? 1 : 0) | (e.squashed ? 2 : 0) | (e.onGround ? 4 : 0)];
}

/** `e.pred` > 0 = clientul tocmai a lovit inamicul și așteaptă confirmarea gazdei: nu suprascriem starea de moarte. */
export function applyEnemy(e, a) {
  if (!Array.isArray(a) || a.length < 11) return false;
  e.nx = num(a[1]); e.ny = num(a[2]);
  if (Math.abs(e.nx - e.x) > 90 || Math.abs(e.ny - e.y) > 90) { e.x = e.nx; e.y = e.ny; }
  e.vx = num(a[3]); e.vy = num(a[4]); e.dir = sgn(a[5]); e.t = num(a[6]) | 0;
  e.state = E_STATES[a[7]] || 'idle'; e.timer = num(a[8]) | 0; e.onGround = !!(num(a[10]) & 4);
  if (!(e.pred > 0)) { e.dead = num(a[9]) | 0; e.knock = !!(a[10] & 1); e.squashed = !!(a[10] & 2); }
  return true;
}

/** Inamicii cei mai apropiați de vreun jucător (xs), cât încap în `maxChars` de JSON (mesajul maxim e 4 KB). */
export function pickEnemies(list, xs, range = 1000, maxChars = 2600) {
  const scored = [];
  for (const e of list) {
    let d = Infinity;
    for (const x of xs) d = Math.min(d, Math.abs(e.x - x));
    if (d < range) scored.push([d, e]);
  }
  scored.sort((u, v) => u[0] - v[0]);
  const out = [];
  let len = 2;
  for (const [, e] of scored) {
    const a = packEnemy(e), l = JSON.stringify(a).length + 1;
    if (len + l > maxChars) break;
    len += l; out.push(a);
  }
  return out;
}

export function packBoss(b) {
  if (!b) return 0;
  return [r1(b.x), r1(b.y), r2(b.vx || 0), r2(b.vy || 0), sgn(b.dir), b.hp | 0, b.inv | 0, Math.max(0, B_STATES.indexOf(b.state)), b.timer | 0,
    b.t | 0, b.dead | 0, (b.onGround ? 1 : 0) | (b.air ? 2 : 0), r2(b.mul || 1), r1(b.tx || 0), (b.waves || []).slice(0, 8).map((w) => [r1(w.x), r1(w.y), r2(w.vx), w.t | 0])];
}

/** Aplică starea boss-ului. Întoarce true dacă tocmai s-a trezit. */
export function applyBoss(b, a) {
  if (!Array.isArray(a) || a.length < 15) return false;
  const was = b.state;
  b.nx = num(a[0]); b.ny = num(a[1]);
  if (Math.abs(b.nx - b.x) > 120 || Math.abs(b.ny - b.y) > 120) { b.x = b.nx; b.y = b.ny; }
  b.vx = num(a[2]); b.vy = num(a[3]); b.dir = sgn(a[4]); b.face = b.dir; b.hp = num(a[5]) | 0; b.inv = num(a[6]) | 0;
  b.state = B_STATES[a[7]] || 'fight'; b.timer = num(a[8]) | 0; b.t = num(a[9]) | 0; b.dead = num(a[10]) | 0;
  b.onGround = !!(num(a[11]) & 1); b.air = !!(num(a[11]) & 2); b.mul = num(a[12], 1); b.tx = num(a[13]);
  b.waves = (Array.isArray(a[14]) ? a[14] : []).map((w) => ({ x: num(w[0]), y: num(w[1]), vx: num(w[2]), t: num(w[3]) | 0 }));
  return was === 'sleep' && b.state !== 'sleep';
}

export const packPlatform = (p) => [r1(p.s), p.dir < 0 ? -1 : 1, p.wait | 0];
/** Clientul își simulează singur platformele; corectăm doar când s-a abătut. */
export function applyPlatform(p, a) {
  if (!Array.isArray(a)) return;
  const s = num(a[0]), dir = sgn(a[1]);
  if (Math.abs(p.s - s) > 4 || p.dir !== dir) { p.s = Math.max(0, Math.min(p.len, s)); p.dir = dir; p.wait = num(a[2]) | 0; }
}

/** Valideaza un mesaj primit: { p, w, ev } cu tipurile corecte (conținutul vine de la alt dispozitiv, deci nu ne bazăm pe el). */
export function parseBundle(d) {
  if (!d || typeof d !== 'object') return null;
  const ev = Array.isArray(d.ev) ? d.ev.filter((e) => e && typeof e.e === 'string').slice(0, 24) : [];
  return { p: Array.isArray(d.p) ? d.p : null, w: d.w && typeof d.w === 'object' ? d.w : null, ev };
}
