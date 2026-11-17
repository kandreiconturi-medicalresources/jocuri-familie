import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, applyCommand, stepWorld, hashState, serialize, deserialize, islandGoods, islandOfCo, coastSpot, T_PRESENT, T_OWNER_MASK, T_OWNER_SHIFT } from '../games/trenuri/src/sim/index.js';

const ok = (r) => { assert.ok(r.ok, r.err); return r; };
const MONTH = 300;
const world = (ai = [1, 1], seed = 3) => createWorld({ seed, size: 'S', map: 'islands', year: 1950, ai });
const homePort = (s, id) => s.stations.find((q) => q.port && q.owner === id && islandOfCo(s, id) >= 0);
const target = (sh) => (sh.route[1] && sh.route[1].l ? sh.route[1].l[0] : -1);

/** Scoate portul primit la start de AI-ul `id` (ca să-l construiască singur); derivatele se refac la deserializare. */
function dropPort(s, id) {
  const st = s.stations.find((q) => q.port && q.owner === id);
  s.track[st.y * s.w + st.x] = 0;
  s.stations = s.stations.filter((q) => q !== st);
  return deserialize(serialize(s));
}

test('AI-ul își face port și vapor, apoi chiar aduce acasă marfa care-i lipsește', () => {
  let s = world();
  s = dropPort(s, 1);
  assert.ok(!homePort(s, 1));
  const home = islandOfCo(s, 1), can = islandGoods(s, home);
  let port = null, ship = null, delivered = 0, prev = null;
  for (let t = 0; t < 30 * MONTH && !delivered; t++) {
    stepWorld(s);
    port = port || homePort(s, 1);
    const sh = s.ships.find((q) => q.owner === 1);
    if (sh && !ship) ship = sh;
    if (sh && port) {
      const g = target(sh), had = prev && prev.id === sh.id ? prev.n : 0, n = (sh.load.find((b) => b.c === g) || { n: 0 }).n;
      if (had > 0 && n === 0 && sh.state === 1 && sh.dest === port.id) delivered = had;
      prev = { id: sh.id, n };
    }
  }
  assert.ok(port, 'a construit portul');
  assert.equal(s.islands[home].owner, 1);
  assert.ok(ship, 'a cumpărat un vapor');
  assert.ok(!can[target(ship)], 'vaporul aduce ceva ce insula nu face');
  assert.ok(delivered > 0, 'a descărcat acasă marfa adusă');
  assert.ok(s.ships.filter((q) => q.owner === 1).length <= 2, 'echilibrat: cel mult 2 vapoare');
});

test('AI-ul nu atinge bunurile altora', () => {
  const s = world([2, 2, 1], 5);
  const p = coastSpot(s, 0);
  const pid = ok(applyCommand(s, { type: 'buildPort', by: 0, x: p.x, y: p.y })).id;
  const sid = ok(applyCommand(s, { type: 'buyShip', by: 0, portId: pid, model: 2 })).id;
  const mine = () => {
    let tiles = 0;
    for (let i = 0; i < s.track.length; i++) if ((s.track[i] & T_PRESENT) && ((s.track[i] & T_OWNER_MASK) >> T_OWNER_SHIFT) === 0) tiles++;
    return JSON.stringify([s.stations.filter((q) => q.owner === 0).map((q) => q.id), s.ships.filter((q) => q.owner === 0).map((q) => q.id), s.trains.filter((q) => q.owner === 0).length, tiles]);
  };
  const before = mine();
  const aiShips = new Set();
  for (let t = 0; t < 40 * MONTH; t++) { stepWorld(s); for (const q of s.ships) if (q.owner) aiShips.add(q.owner + ':' + q.id); }
  assert.equal(mine(), before, 'portul, vaporul și șinele mele sunt neatinse');
  assert.ok(s.ships.some((q) => q.id === sid && q.owner === 0));
  assert.ok(aiShips.size >= 2, 'AI-urile au cumpărat vapoare: ' + [...aiShips]);
  for (const c of s.companies) if (c.ai) assert.ok(s.ships.filter((q) => q.owner === c.id).every((q) => q.route.every((r) => s.stations.some((st) => st.id === r.p && st.port))));
});

test('determinism: 3 AI pe mare, 20.000 de pași, cu serializare la mijloc', () => {
  const a = world([0, 1, 2], 7), b = world([0, 1, 2], 7);
  for (let i = 0; i < 20000; i++) stepWorld(a);
  for (let i = 0; i < 10000; i++) stepWorld(b);
  const c = deserialize(JSON.parse(JSON.stringify(serialize(b))));
  for (let i = 0; i < 10000; i++) stepWorld(c);
  assert.equal(hashState(c), hashState(a));
  assert.equal(JSON.stringify(c.companies.map((q) => q.ai && q.ai.sea)), JSON.stringify(a.companies.map((q) => q.ai && q.ai.sea)));
  assert.ok(a.ships.length >= 2, 'vapoare AI: ' + a.ships.length);
});
