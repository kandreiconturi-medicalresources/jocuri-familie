import test from 'node:test';
import assert from 'node:assert/strict';
import { findLine } from './trenuri-lines.js';
import { createWorld, hashState, serialize, deserialize, applyCommand, stepWorld, islandAt, coastSpot, bridgeInfo, bridgeCost, bridgeSteel, companyValue, T_BRIDGE, T_BIGBR, T_PRESENT, BRIDGE, WATER_H, DX, DY } from '../games/trenuri/src/sim/index.js';

const ok = (r) => { assert.ok(r.ok, r.err); return r; };
const run = (s, n) => { for (let i = 0; i < n; i++) stepWorld(s); };
/** Un jucător singur: insula lui + una fără stăpân, la distanță mică. */
const solo = (seed = 6) => createWorld({ seed, size: 'S', map: 'islands', year: 1950, ai: [] });

test('pod mare: se construiește cu oțel din port, costă pătratic, trenul trece peste el', () => {
  const s = solo(), me = s.companies[0], k = s.islands.findIndex((q) => q.owner < 0);
  assert.ok(k > 0, 'există o insulă fără stăpân');
  const L = findLine(s, 0, k);
  assert.ok(L, 'două insule apropiate pot fi legate în linie dreaptă');
  const cmd = { type: 'buildBridge', by: 0, x0: L.x0, y0: L.y0, x1: L.x1, y1: L.y1 };
  // fără oțel în port: refuzat, cu explicație
  const p = coastSpot(s, 0), pid = ok(applyCommand(s, { type: 'buildPort', by: 0, x: p.x, y: p.y })).id, port = s.stations.find((q) => q.id === pid);
  const no = applyCommand(s, cmd);
  assert.equal(no.err, 'material'); assert.ok(no.text && /oțel/i.test(no.text));
  port.cargo[BRIDGE.steel] = 40;
  const info = bridgeInfo(s, me, cmd), cash0 = me.cash;
  assert.ok(info.ok); assert.equal(info.n, L.n);
  assert.equal(bridgeCost(L.n), BRIDGE.base * L.n + BRIDGE.sq * L.n * L.n);
  assert.ok(bridgeCost(2 * L.n) > 2 * bridgeCost(L.n) - 10 * BRIDGE.base * L.n, 'cost pătratic');
  const r = ok(applyCommand(s, cmd));
  assert.equal(cash0 - me.cash, r.cost); assert.equal(r.cost, info.cost);
  assert.equal(port.cargo[BRIDGE.steel], 40 - bridgeSteel(L.n), 'oțelul din port a fost consumat');
  const dx = Math.sign(L.x1 - L.x0), dy = Math.sign(L.y1 - L.y0), mid = [];
  for (let i = 1; i <= L.n; i++) { const t = s.track[(L.y0 + dy * i) * s.w + L.x0 + dx * i]; assert.ok((t & T_PRESENT) && (t & T_BRIDGE) && (t & T_BIGBR)); mid.push((L.y0 + dy * i) * s.w + L.x0 + dx * i); }
  assert.ok(s.track[L.y0 * s.w + L.x0] & T_PRESENT, 'capătul e legat de șină');
  // gări la capete, tren pe pod
  const A = ok(applyCommand(s, { type: 'buildStation', by: 0, x: L.x0, y: L.y0, size: 0 })).id, B = ok(applyCommand(s, { type: 'buildStation', by: 0, x: L.x1, y: L.y1, size: 0 })).id;
  ok(applyCommand(s, { type: 'buyTrain', by: 0, model: 3, stationId: A, kinds: [0, 1], route: [A, B] }));
  const seen = new Set();
  for (let i = 0; i < 4000; i++) { stepWorld(s); const t = s.trains[0]; if (t.path.length) seen.add(t.path[t.seg]); }
  assert.ok(mid.every((i) => seen.has(i)), 'trenul a trecut peste tot podul');
  assert.ok(seen.has(L.y1 * s.w + L.x1) && seen.has(L.y0 * s.w + L.x0), 'și între cele două gări');
  assert.ok(companyValue(s, 0) > 0);
});

test('pod mare: prea lung, nedrept sau fără capete pe uscat e refuzat', () => {
  const s = solo(), me = s.companies[0], L = findLine(s, 0, s.islands.findIndex((q) => q.owner < 0));
  const base = { type: 'buildBridge', by: 0 };
  assert.equal(applyCommand(s, { ...base, x0: L.x0, y0: L.y0, x1: L.x1 + 3, y1: L.y1 + (L.y1 === L.y0 ? 1 : 0) }).err, 'pod', 'nu e dreaptă/diagonală exactă');
  assert.equal(applyCommand(s, { ...base, x0: 3, y0: 3, x1: 3, y1: 3 }).err, 'pod');
  assert.equal(applyCommand(s, { ...base, x0: 1.5, y0: 3, x1: 9, y1: 3 }).err, 'pod');
  const water = [...s.water.keys()].find((i) => s.water[i] && i % s.w < s.w - 40 && s.water[i + 35]);
  assert.equal(bridgeInfo(s, me, { x0: water % s.w, y0: (water / s.w) | 0, x1: (water % s.w) + 33, y1: (water / s.w) | 0 }).err, 'apa', 'peste 30 de plăci');
  assert.equal(bridgeInfo(s, me, { x0: water % s.w, y0: (water / s.w) | 0, x1: (water % s.w) + 5, y1: (water / s.w) | 0 }).err, 'teren', 'capătul în apă');
  // MAX_BRIDGE rămâne pentru șina obișnuită: un traseu cu 9 plăci de apă e refuzat de buildTrack
  const path = []; for (let i = 0; i <= L.n + 1; i++) path.push([L.x0 + Math.sign(L.x1 - L.x0) * i, L.y0 + Math.sign(L.y1 - L.y0) * i]);
  if (L.n > 8) assert.equal(applyCommand(s, { type: 'buildTrack', by: 0, path }).err, 'apa');
  const before = me.cash;
  assert.equal(applyCommand(s, { ...base, x0: L.x0, y0: L.y0, x1: L.x1, y1: L.y1 }).err, 'material', 'fără port nu există oțel');
  assert.equal(me.cash, before);
});

test('pod mare: determinism cu serializare la mijloc', () => {
  const a = solo(), b = solo();
  for (const s of [a, b]) {
    const L = findLine(s, 0, 1), p = coastSpot(s, 0);
    const pid = ok(applyCommand(s, { type: 'buildPort', by: 0, x: p.x, y: p.y })).id, port = s.stations.find((q) => q.id === pid);
    port.cargo[BRIDGE.steel] = 60;
    ok(applyCommand(s, { type: 'buildBridge', by: 0, x0: L.x0, y0: L.y0, x1: L.x1, y1: L.y1 }));
  }
  run(a, 600); run(b, 600);
  const c = deserialize(serialize(b));
  assert.equal(hashState(c), hashState(b));
  run(a, 1500); run(c, 1500);
  assert.equal(hashState(a), hashState(c));
});
