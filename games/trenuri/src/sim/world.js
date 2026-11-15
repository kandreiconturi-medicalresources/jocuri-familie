// Crearea lumii, hash de stare și (de)serializare compactă (array-uri tipate în base64).
import { hashSeed } from '../../../../shared/engine/rng.js';
import { SIZES, START_CASH, SANDBOX_CASH } from './consts.js';
import { generateMap } from './mapgen.js';
import { deriveLayers } from './roads.js';
import { growBuildings, levelOf } from './growth.js';

export function createWorld({ seed = 1, size = 'S', mode = 'simple', sandbox = false, players = [{ id: 0, name: 'Tu', color: '#ff6b6b' }] } = {}) {
  const n = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
  const w = SIZES[size] || SIZES.S, h = w;
  const m = generateMap(n, size, w, h);
  const s = {
    version: 1, tick: 0, rng: (n ^ 0xa5a5a5a5) >>> 0, seed: n, size, mode, sandbox: !!sandbox, w, h,
    height: m.height, water: m.water, forest: m.forest, cities: m.cities, industries: [],
    track: new Uint16Array(w * h), stations: [], trains: [],
    companies: players.map((p, i) => ({ id: i, name: p.name, color: p.color, cash: sandbox ? SANDBOX_CASH : START_CASH, loan: 0, history: [], month: 0 })),
    date: { y: 1950, m: 1, d: 1 }, news: [], nextId: 1, dirty: { track: true, forest: true, cities: true, stations: true },
  };
  deriveLayers(s);
  for (const c of s.cities) { c.level = levelOf(c.pop); growBuildings(s, c, 99); }
  s.news.push({ tick: 0, icon: '🚂', text: 'Bun venit! Leagă două orașe cu o cale ferată.' });
  return s;
}

function fnv(h, v) { return Math.imul((h ^ (v & 255)) >>> 0, 0x01000193) >>> 0; }
function num(h, v) { v |= 0; h = fnv(h, v); h = fnv(h, v >> 8); h = fnv(h, v >> 16); return fnv(h, v >> 24); }
function arr(h, a) { for (let i = 0; i < a.length; i++) h = fnv(h, a[i]); return h; }

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
  for (const c of s.cities) { h = num(num(num(h, c.pop), c.level), c.buildings.length); }
  for (const t of s.stations) { h = num(num(num(num(h, t.id), t.x * 256 + t.y), t.waiting.pass), t.waiting.mail); h = num(num(h, t.owner), t.size); }
  for (const t of s.trains) {
    h = num(num(num(num(h, t.id), t.seg), t.pos), t.speed); h = num(num(num(h, t.left), t.state), t.money);
    h = num(num(num(h, t.to), t.at), t.wait);
    for (const b of t.load) h = num(num(num(h, b.c), b.n), b.from);
    for (const r of t.route) h = num(h, r);
  }
  for (const c of s.companies) h = num(num(num(h, c.cash), c.loan), c.history.length);
  h = num(num(num(h, s.date.y), s.date.m), s.date.d);
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
const DERIVED = ['roads', 'occ', 'dirty'];

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
  s.dirty = { track: true, forest: true, cities: true, stations: true };
  deriveLayers(s);
  return s;
}
