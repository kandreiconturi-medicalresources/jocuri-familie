// Crearea lumii, hash de stare și (de)serializare compactă (array-uri tipate în base64).
import { hashSeed } from '../../../../shared/engine/rng.js';
import { SIZES, START_CASH, SANDBOX_CASH } from './consts.js';
import { generateMap } from './mapgen.js';
import { deriveLayers } from './roads.js';
import { growBuildings, levelOf } from './growth.js';
import { placeIndustries } from './indgen.js';
import { NG } from './goods.js';
import { initExpert } from './expert/init.js';
import { hashExpert } from './expert/hash.js';
import { syncAuto } from './signals.js';

/** Statistici pentru obiectivele scenariilor: marfă predată (cerută), venit total, niveluri câștigate de orașe. */
export const newStats = () => ({ del: new Array(NG).fill(0), earn: 0, up: 0 });

export function createWorld({ seed = 1, size = 'S', mode = 'simple', sandbox = false, year = 1840, ai = [], players = [{ id: 0, name: 'Tu', color: '#ff6b6b' }] } = {}) {
  const n = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
  const w = SIZES[size] || SIZES.S, h = w;
  const m = generateMap(n, size, w, h);
  const s = {
    version: 2, tick: 0, rng: (n ^ 0xa5a5a5a5) >>> 0, seed: n, size, mode, sandbox: !!sandbox, w, h,
    height: m.height, water: m.water, forest: m.forest, cities: m.cities, industries: placeIndustries(n, size, w, h, m.height, m.water, m.forest, m.cities),
    track: new Uint16Array(w * h), stations: [], trains: [], signals: [], sigId: 1, depots: [],
    companies: players.map((p, i) => ({ id: i, name: p.name, color: p.color, cash: sandbox ? SANDBOX_CASH : START_CASH, loan: 0, history: [], month: 0, record: 0 })),
    date: { y: year, m: 1, d: 1 }, news: [], stats: newStats(), nextId: 1, dirty: { track: true, forest: true, cities: true, stations: true, industries: true },
  };
  if (mode === 'expert') { initExpert(s, ai); s.over = null; }
  deriveLayers(s);
  for (const c of s.cities) { c.got = new Array(NG).fill(0); c.prev = new Array(NG).fill(0); c.level = levelOf(c.pop); growBuildings(s, c, 99); }
  s.news.push({ tick: 0, icon: '🚂', text: 'Bun venit! Leagă două orașe cu o cale ferată.' });
  s.news.push({ tick: 0, icon: '🏭', text: 'Pe hartă sunt ferme, păduri și mine. Ce produc ele poate hrăni orașele!' });
  return s;
}

function fnv(h, v) { return Math.imul((h ^ (v & 255)) >>> 0, 0x01000193) >>> 0; }
function num(h, v) { v |= 0; h = fnv(h, v); h = fnv(h, v >> 8); h = fnv(h, v >> 16); return fnv(h, v >> 24); }
function arr(h, a) { for (let i = 0; i < a.length; i++) h = fnv(h, a[i]); return h; }

function hashDepotTrain(h, t) {
  h = num(num(num(h, t.dead | 0), t.dq | 0), (t.toDepot | 0) * 7 + (t.cpl | 0) + (t.resc | 0) * 3);
  return t.tow ? num(h, t.tow.targetId * 9 + (t.tow.ph === 'haul' ? 1 : 0)) : h;
}
const PH = { lift: 1, repair: 2, lower: 3 };
function hashDepot(h, d) {
  h = arr(num(num(h, d.id), d.x * 256 + d.y), d.queue);
  for (const j of d.jobs) h = num(num(h, j.trainId * 4 + PH[j.phase]), j.t * 8 + j.lane);
  return h;
}

/** Hash doar al hărții generate (teren, apă, păduri, orașe). */
export function hashMap(s) {
  let h = 0x811c9dc5;
  h = arr(arr(arr(h, s.height), s.water), s.forest);
  for (const c of s.cities) { h = num(num(num(h, c.x), c.y), c.pop); h = arr(h, c.name.split('').map((ch) => ch.charCodeAt(0))); }
  return h >>> 0;
}

/** Hash FNV al câmpurilor relevante din starea jocului (uint32). */
export function hashState(s) {
  let h = hashMap(s);
  h = num(num(num(h, s.tick), s.rng), s.nextId);
  for (let i = 0; i < s.track.length; i++) h = fnv(fnv(h, s.track[i]), s.track[i] >> 8);
  for (const c of s.cities) { h = num(num(num(h, c.pop), c.level), c.buildings.length); h = arr(h, c.got); }
  for (const o of s.industries) { h = num(num(num(h, o.type), o.x * 256 + o.y), o.boost); h = arr(arr(h, o.in), o.out); }
  for (const t of s.stations) { h = num(num(num(num(h, t.id), t.x * 256 + t.y), t.waiting.pass), t.waiting.mail); h = num(num(num(h, t.owner), t.size), t.platforms | 0); h = arr(arr(h, t.cargo), t.up); if (t.big) h = num(h, 500 + t.dir); }
  for (const t of s.trains) {
    h = num(num(num(num(h, t.id), t.seg), t.pos), t.speed); h = num(num(num(h, t.left), t.state), t.money);
    h = num(num(num(h, t.to), t.at), t.wait); h = num(num(h, t.hold), t.broken); h = arr(h, t.kinds);
    if (t.paused) h = num(h, 77);
    if (t.nk) h = arr(num(h, 91), t.nk);
    h = num(h, (t.rv ? t.rv.length : 0) + (t.redAt | 0) * 64); if (t.rv) h = arr(h, t.rv);
    if (t.rel !== undefined) h = num(h, t.rel);
    if (t.dead || t.state === 3 || t.toDepot || t.tow) h = hashDepotTrain(h, t);
    for (const b of t.load) h = num(num(num(h, b.c), b.n), b.from);
    for (const r of t.route) h = num(h, r);
  }
  for (const d of s.depots) h = hashDepot(h, d);
  if (s.autoBlock) h = num(h, s.autoBlock);
  for (const g of s.signals) h = num(num(h, g.id * 8 + g.dir + (g.twoWay ? 4096 : 0)), g.x * 256 + g.y);
  for (const c of s.companies) h = num(num(num(h, c.cash), c.loan), c.history.length);
  h = num(num(num(h, s.date.y), s.date.m), s.date.d);
  if (s.mode === 'expert') h = hashExpert(s, h);
  return h >>> 0;
}

function b64(a) {
  const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  let s = '';
  for (let i = 0; i < u.length; i += 0x4000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x4000));
  return btoa(s);
}
function unb64(str, Type) {
  const s = atob(str), u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return new Type(u.buffer);
}
const BIG = ['height', 'water', 'forest', 'track'];
const DERIVED = ['roads', 'occ', 'dirty', 'blk', 'stm', 'sgm', 'resv', 'pocc'];

/** Obiect JSON simplu (poate merge în localStorage). */
export function serialize(s) {
  const o = {};
  for (const k of Object.keys(s).sort()) {
    if (DERIVED.includes(k)) continue;
    o[k] = BIG.includes(k) ? b64(s[k]) : s[k];
  }
  return JSON.parse(JSON.stringify(o));
}

export function deserialize(o) {
  const s = JSON.parse(JSON.stringify(o));
  s.height = unb64(o.height, Uint8Array); s.water = unb64(o.water, Uint8Array); s.forest = unb64(o.forest, Uint8Array);
  s.track = unb64(o.track, Uint16Array);
  if (!s.stats) s.stats = newStats();
  s.dirty = { track: true, forest: true, cities: true, stations: true, industries: true, terrain: true, signals: true };
  if (!s.signals) { s.signals = []; s.sigId = 1; }
  if (!s.depots) s.depots = [];
  deriveLayers(s);
  if (!o.signals) syncAuto(s); // salvare veche: semnalele automate apar singure
  return s;
}
