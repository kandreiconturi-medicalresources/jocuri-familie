import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, createNetWorld, hashState, serialize, deserialize, applyCommand, stepWorld, islandAt, coastSpot, landPrice, parcelInfo, parcelsW, tileOwner, industryPrice, standings, ratingOf, BRIDGE, INDUSTRIES, WATER_H } from '../games/trenuri/src/sim/index.js';
import { near } from '../games/trenuri/src/sim/industry.js';
import { ALLOWED } from '../games/trenuri/src/net/wire.js';
import { createHub } from './trenuri-hub.js';
import { findLine } from './trenuri-lines.js';

const ok = (r) => { assert.ok(r.ok, r.err); return r; };
const run = (s, n) => { for (let i = 0; i < n; i++) stepWorld(s); };
const world = (seed = 6) => createWorld({ seed, size: 'S', map: 'islands', year: 1950, ai: [1] });
const free = (s, x, y) => x >= 0 && y >= 0 && x < s.w && y < s.h && !s.water[y * s.w + x] && s.height[y * s.w + x] > WATER_H && !s.occ[y * s.w + x] && s.stations.every((q) => q.x !== x || q.y !== y);

/** O parcelă din insula k cu toate cele 16 plăci libere și vecina din dreapta cu o placă liberă pe prima coloană. */
function parcelOn(s, k) {
  const q = s.islands[k];
  for (let py = q.y0 >> 2; py <= q.y1 >> 2; py++) for (let px = q.x0 >> 2; px < (q.x1 >> 2) - 1; px++) {
    let all = true;
    for (let y = py * 4; y < py * 4 + 4 && all; y++) for (let x = px * 4; x < px * 4 + 4; x++) if (islandAt(s, x, y) !== k || !free(s, x, y)) { all = false; break; }
    if (all && free(s, px * 4 + 4, py * 4 + 1) && islandAt(s, px * 4 + 4, py * 4 + 1) === k) return { px, py };
  }
  return null;
}

test('teren: banii merg la stăpânul insulei, pe parcela cumpărată se construiește, lângă ea nu', () => {
  const s = world(), me = s.companies[0], ai = s.companies[1];
  ai.ai.cool = 9999;
  const P = parcelOn(s, 1);
  assert.ok(P, 'insula AI are o parcelă liberă');
  const x = P.px * 4 + 3, y = P.py * 4 + 1, nx = P.px * 4 + 4;
  assert.equal(applyCommand(s, { type: 'buildStation', by: 0, x, y, size: 0 }).err, 'insula', 'înainte de cumpărare e refuzat');
  const info = parcelInfo(s, me, P.px, P.py), price = landPrice(s, P.px, P.py);
  assert.ok(info.ok && info.price === price && price > 0 && Number.isInteger(price));
  const m0 = me.cash, a0 = ai.cash;
  const r = ok(applyCommand(s, { type: 'buyLand', by: 0, px: P.px, py: P.py }));
  assert.equal(r.cost, price); assert.equal(m0 - me.cash, price); assert.equal(ai.cash - a0, price, 'banii merg la stăpânul insulei');
  assert.equal(tileOwner(s, x, y), 0); assert.equal(tileOwner(s, nx, y), 1);
  assert.equal(applyCommand(s, { type: 'buyLand', by: 0, px: P.px, py: P.py }).err, 'exista');
  ok(applyCommand(s, { type: 'buildStation', by: 0, x, y, size: 0 }));
  assert.equal(applyCommand(s, { type: 'buildStation', by: 0, x: nx, y, size: 0 }).err, 'insula', 'parcela de alături rămâne a lor');
  assert.equal(applyCommand(s, { type: 'buildTrack', by: 0, path: [[x, y], [nx, y]] }).err, 'insula');
  // stăpânul insulei nu mai construiește pe parcela vândută
  assert.equal(applyCommand(s, { type: 'buildStation', by: 1, x: P.px * 4 + 1, y: P.py * 4 + 2, size: 0 }).err, 'insula');
  // pe propria insulă nu e nimic de cumpărat
  assert.equal(applyCommand(s, { type: 'buyLand', by: 0, px: s.islands[0].x0 >> 2, py: (s.islands[0].y0 >> 2) + 3 }).err, 'exista');
  assert.ok(ALLOWED.has('buyLand') && ALLOWED.has('buyIndustry') && ALLOWED.has('setAutoRepay') && ALLOWED.has('buildBridge'));
});

test('teren: pe insula fără stăpân nu se vinde nimic; fără bani nu se cumpără', () => {
  const solo = createWorld({ seed: 6, size: 'S', map: 'islands', year: 1950, ai: [] }), k = solo.islands.findIndex((q) => q.owner < 0);
  const P = parcelOn(solo, k);
  assert.equal(applyCommand(solo, { type: 'buyLand', by: 0, px: P.px, py: P.py }).err, 'teren');
  const s = world(), Q = parcelOn(s, 1);
  s.companies[0].cash = 5;
  assert.equal(applyCommand(s, { type: 'buyLand', by: 0, px: Q.px, py: Q.py }).err, 'bani');
  assert.equal(s.land, undefined, 'stratul land apare abia la prima cumpărare');
});

test('pod mare spre insula altuia: doar pe teren propriu', () => {
  const s = world(), me = s.companies[0], L = findLine(s, 0, 1);
  assert.ok(L);
  const p = coastSpot(s, 0), pid = ok(applyCommand(s, { type: 'buildPort', by: 0, x: p.x, y: p.y })).id;
  s.stations.find((q) => q.id === pid).cargo[BRIDGE.steel] = 80;
  const cmd = { type: 'buildBridge', by: 0, x0: L.x0, y0: L.y0, x1: L.x1, y1: L.y1 };
  const c0 = me.cash;
  assert.equal(applyCommand(s, cmd).err, 'insula');
  assert.equal(me.cash, c0);
  const px = L.x1 >> 2, py = L.y1 >> 2;
  const bi = parcelInfo(s, me, px, py);
  assert.ok(bi.ok, bi.err);
  ok(applyCommand(s, { type: 'buyLand', by: 0, px, py }));
  ok(applyCommand(s, cmd));
  assert.ok(s.track[L.y1 * s.w + L.x1] & 0x4000);
});

test('industrie cumpărată: producția ajunge la gara cumpărătorului', () => {
  const s = world(), me = s.companies[0], ai = s.companies[1];
  ai.ai.cool = 9999;
  const o = s.industries.find((q) => islandAt(s, q.x, q.y) === 1 && INDUSTRIES[q.type].out >= 0 && !INDUSTRIES[q.type].in.length);
  assert.ok(o);
  const g = INDUSTRIES[o.type].out, px = o.x >> 2, py = o.y >> 2;
  me.cash = 500000;
  ok(applyCommand(s, { type: 'buyLand', by: 0, px, py }));
  let spot = null;
  for (let y = py * 4; y < py * 4 + 4 && !spot; y++) for (let x = px * 4; x < px * 4 + 4; x++) if (islandAt(s, x, y) === 1 && free(s, x, y) && near({ x, y, size: 0 }, o)) { spot = [x, y]; break; }
  assert.ok(spot, 'loc de gară lângă industrie, pe parcela mea');
  const mine = ok(applyCommand(s, { type: 'buildStation', by: 0, x: spot[0], y: spot[1], size: 0 })).id;
  // o gară a stăpânului, tot lângă industrie
  let sp2 = null;
  for (let y = o.y - 2; y <= o.y + 2 && !sp2; y++) for (let x = o.x - 2; x <= o.x + 2; x++) if (islandAt(s, x, y) === 1 && free(s, x, y) && tileOwner(s, x, y) === 1 && near({ x, y, size: 0 }, o)) { sp2 = [x, y]; break; }
  const theirs = sp2 ? ok(applyCommand(s, { type: 'buildStation', by: 1, x: sp2[0], y: sp2[1], size: 0 })).id : null;
  const price = industryPrice(o), m0 = me.cash, a0 = ai.cash;
  ok(applyCommand(s, { type: 'buyIndustry', by: 0, id: o.id }));
  assert.equal(m0 - me.cash, price); assert.equal(ai.cash - a0, price); assert.equal(o.buyer, 0);
  assert.equal(applyCommand(s, { type: 'buyIndustry', by: 0, id: o.id }).err, 'exista');
  assert.equal(applyCommand(s, { type: 'buyIndustry', by: 1, id: o.id }).err, 'exista');
  const st = s.stations.find((q) => q.id === mine), st2 = theirs ? s.stations.find((q) => q.id === theirs) : null;
  const had = st.cargo[g], had2 = st2 ? st2.cargo[g] : 0;
  run(s, 400);
  assert.ok(st.cargo[g] > had, 'marfa merge la gara cumpărătorului');
  if (st2) assert.equal(st2.cargo[g], had2, 'gara stăpânului nu mai primește nimic');
  assert.ok(standings(s).length === 2);
});

test('banca: împrumut în modul simplu, dobândă și rambursare automată', () => {
  const s = world(), me = s.companies[0];
  ok(applyCommand(s, { type: 'takeLoan', by: 0 })); ok(applyCommand(s, { type: 'takeLoan', by: 0 }));
  assert.equal(me.loan, 20000); assert.equal(me.tr.length, 2);
  assert.equal(ratingOf(s, 0), 0);
  assert.equal(applyCommand(s, { type: 'setAutoRepay', by: 0, pct: 51 }).err, 'drum');
  assert.equal(applyCommand(s, { type: 'setAutoRepay', by: 0, pct: 12.5 }).err, 'drum');
  ok(applyCommand(s, { type: 'setAutoRepay', by: 0, pct: 50 }));
  assert.equal(me.ar, 50);
  const m0 = s.date.m;
  while (s.date.m === m0) { me.month = 10000; stepWorld(s); }
  assert.ok(me.loan < 20000 - 4000, 'a plătit singură aproape jumătate din profit: ' + me.loan);
  assert.equal(me.tr.reduce((n, t) => n + t.p, 0), me.loan);
  assert.ok(s.news.some((n) => n.icon === '🏦'));
  const left = me.loan;
  ok(applyCommand(s, { type: 'setAutoRepay', by: 0, pct: 0 }));
  const m1 = s.date.m;
  while (s.date.m === m1) { me.month = 10000; stepWorld(s); }
  assert.equal(me.loan, left, 'cu 0% nu se mai plătește singură');
  ok(applyCommand(s, { type: 'repayLoan', by: 0 }));
  assert.ok(me.loan < left);
  // în lumea obișnuită, setAutoRepay nu există
  const n = createWorld({ seed: 3, size: 'S' });
  assert.equal(applyCommand(n, { type: 'setAutoRepay', by: 0, pct: 10 }).err, 'expert');
  assert.equal(applyCommand(n, { type: 'takeLoan', by: 0 }).err, 'expert');
});

test('clasament fără sfârșit: pragurile și noul lider apar o singură dată în ziar', () => {
  const s = world(), me = s.companies[0];
  const seen = { th5: new Set(), th1: new Set(), lead: new Set() };
  const scan = () => { for (const n of s.news) { if (/500\.000/.test(n.text)) seen.th5.add(n); if (/1\.000\.000/.test(n.text)) seen.th1.add(n); if (n.icon === '👑' && /Tu/.test(n.text)) seen.lead.add(n); } };
  const month = () => { const m = s.date.m; while (s.date.m === m) { stepWorld(s); scan(); } };
  month();
  assert.equal(seen.th5.size, 0);
  me.cash = 600000; month(); month();
  assert.equal(seen.th5.size, 1, 'pragul de 500.000 se anunță o dată');
  assert.ok(standings(s)[0].id === 0 && seen.lead.size === 1, 'și că ai ajuns lider');
  me.cash = 1500000; month(); month(); month();
  assert.equal(seen.th1.size, 1); assert.equal(seen.th5.size, 1);
  me.cash = 100; month(); me.cash = 1500000; month();
  assert.equal(seen.th1.size, 1, 'nu se repetă după ce a scăzut și a urcat din nou');
});

function script(s) {
  const P = parcelOn(s, 1);
  s.companies[0].cash = 400000;
  ok(applyCommand(s, { type: 'buyLand', by: 0, px: P.px, py: P.py }));
  ok(applyCommand(s, { type: 'takeLoan', by: 0 }));
  ok(applyCommand(s, { type: 'setAutoRepay', by: 0, pct: 30 }));
  ok(applyCommand(s, { type: 'buildStation', by: 0, x: P.px * 4 + 2, y: P.py * 4 + 2, size: 0 }));
}
test('determinism: serializare la mijloc cu teren și bancă', () => {
  const a = world(), b = world();
  script(a); script(b);
  run(a, 700); run(b, 700);
  const c = deserialize(serialize(b));
  assert.ok(c.land instanceof Uint8Array && c.land.length === parcelsW(c) * ((c.h + 3) >> 2));
  assert.equal(hashState(c), hashState(b));
  run(a, 1500); run(c, 1500);
  assert.equal(hashState(a), hashState(c));
});

test('lockstep cu 3 noduri: teren, pod mare și bancă, hash-uri identice', async () => {
  const PL = [{ id: 'a', name: 'Ana', color: '#ff6b6b' }, { id: 'b', name: 'Bob', color: '#4dabf7' }, { id: 'c', name: 'Cip', color: '#ffd23f' }];
  const cfg = { mode: 'comp', seed: 9, size: 'S', year: 1950, map: 'islands', ai: [1], players: PL };
  const mk = () => {
    const w = createNetWorld(cfg), p = coastSpot(w, 0), id = ok(applyCommand(w, { type: 'buildPort', by: 0, x: p.x, y: p.y })).id;
    w.stations.find((q) => q.id === id).cargo[BRIDGE.steel] = 60; // oțelul podului, la fel pe toate nodurile
    return w;
  };
  const probe = mk();
  let L = null, k = 1;
  for (; k < probe.islands.length && !L; k++) L = findLine(probe, 0, k);
  k--;
  assert.ok(L, 'insula mea are un vecin în linie dreaptă');
  const px = L.x1 >> 2, py = L.y1 >> 2, Q = parcelOn(probe, 0);
  assert.ok(Q);
  const hub = createHub({ latency: 0.1 });
  const nodes = PL.map((p) => hub.add(p.id, { world: mk(), hostId: 'a', speed: 4, raw: false }));
  const [n1, n2, n3] = nodes;
  await hub.run(1); n1.submit({ type: 'buyLand', px, py });
  await hub.run(0.5); n1.submit({ type: 'buildBridge', x0: L.x0, y0: L.y0, x1: L.x1, y1: L.y1 });
  await hub.run(0.5); n2.submit({ type: 'takeLoan' });
  await hub.run(0.5); n2.submit({ type: 'setAutoRepay', pct: 25 });
  await hub.run(0.5); n3.submit({ type: 'buyLand', px: Q.px, py: Q.py });
  let n = 0;
  while (n1.world.tick < 2500 && n++ < 4000) await hub.run(0.05);
  n1.setSpeed(0); await hub.run(8);
  assert.ok(n1.world.land, 'teren cumpărat în rețea');
  assert.ok(n1.world.track[L.y1 * n1.world.w + L.x1] & 0x4000, 'podul mare există pe toate nodurile');
  assert.equal(n2.world.companies[1].ar, 25);
  const hs = nodes.map((q) => hashState(q.world));
  assert.ok(hs.every((h) => h === hs[0]), 'hash-uri diferite: ' + hs);
});
