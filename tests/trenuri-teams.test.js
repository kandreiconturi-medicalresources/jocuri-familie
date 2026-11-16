import test from 'node:test';
import assert from 'node:assert/strict';
import { createNetWorld, applyCommand, hashState, standings, coastSpot, dockOf, normTeams, teamMembers, T_PRESENT } from '../games/trenuri/src/sim/index.js';
import { createHub } from './trenuri-hub.js';

const ok = (r) => { assert.ok(r.ok, r.err); return r; };
const PL = [{ id: 'a', name: 'Ana', color: '#ff6b6b' }, { id: 'b', name: 'Bob', color: '#4dabf7' }, { id: 'c', name: 'Cip', color: '#ffd23f' }];
const cfg = { mode: 'comp', seed: 9, size: 'S', year: 1950, map: 'islands', ai: [1], teams: [['a', 'b'], ['c']], players: PL };

/** O placă de coastă liberă pe insula k, alta decât `not`. */
function coast(s, k, not) {
  const q = s.islands[k];
  for (let y = q.y0 + 2; y <= q.y1 - 2; y++) for (let x = q.x0 + 2; x <= q.x1 - 2; x++) {
    const i = y * s.w + x;
    if (s.water[i] || s.occ[i] || s.roads[i] || (s.track[i] & T_PRESENT) || dockOf(s, x, y) < 0) continue;
    if (not && Math.abs(not.x - x) + Math.abs(not.y - y) < 4) continue;
    return { x, y };
  }
  return null;
}

test('echipele: o companie și o insulă pe echipă, numele membrilor în clasament', () => {
  const s = createNetWorld(cfg);
  assert.equal(s.net.mode, 'comp'); assert.equal(s.net.team, 1);
  assert.equal(s.net.pl.a, 0); assert.equal(s.net.pl.b, 0); assert.equal(s.net.pl.c, 1);
  assert.equal(s.companies.length, 3, '2 echipe + 1 AI');
  assert.equal(s.companies[0].name, 'Echipa Vulpilor'); assert.equal(s.companies[0].color, '#ff6b6b');
  assert.ok(s.companies[2].ai);
  assert.deepEqual(s.islands.slice(0, 3).map((q) => q.owner), [0, 1, 2]);
  assert.deepEqual(teamMembers(s, 0), ['Ana', 'Bob']);
  const st = standings(s);
  assert.deepEqual(st.find((r) => r.id === 1).mem, ['Cip']);
  assert.deepEqual(st.find((r) => r.id === 2).mem, [], 'AI-ul n-are membri');
  // fără `teams` rămâne ca înainte: o companie per jucător, fără `mem`
  const o = createNetWorld({ ...cfg, teams: undefined });
  assert.equal(o.net.team, undefined); assert.equal(o.net.pl.b, 1); assert.equal(o.companies.length, 4);
  assert.equal(standings(o)[0].mem, undefined);
  assert.equal(hashState(createNetWorld({ ...cfg, teams: undefined })), hashState(o), 'aceeași lume fără echipe');
});

test('normTeams: jucători necunoscuți scoși, fiecare o dată, cei uitați primesc echipa lor', () => {
  assert.deepEqual(normTeams([['a', 'x', 'a'], [], ['b', 'a']], PL), [['a'], ['b'], ['c']]);
  assert.deepEqual(normTeams('nu', PL), [['a'], ['b'], ['c']]);
  assert.deepEqual(normTeams([['a', 'b', 'c']], PL), [['a', 'b', 'c']]);
});

test('setTeam: doar spre o companie de oameni, mută jucătorul și îi ține numele', () => {
  const s = createNetWorld(cfg);
  assert.equal(applyCommand(s, { type: 'setTeam', by: 0, pl: 'c', co: 2 }).ok, false, 'nu la un AI');
  assert.equal(applyCommand(s, { type: 'setTeam', by: 0, pl: 'c', co: 1 }).ok, false, 'e deja acolo');
  ok(applyCommand(s, { type: 'setTeam', by: 0, pl: 'c', co: 0 }));
  assert.deepEqual(teamMembers(s, 0), ['Ana', 'Bob', 'Cip']);
  ok(applyCommand(s, { type: 'joinCompany', by: 0, pl: 'd', name: 'Dan', color: '#51cf66' }));
  assert.equal(s.net.pl.d, 3); assert.deepEqual(teamMembers(s, 3), ['Dan']);
  assert.equal(s.companies[3].name, 'Dan', 'jucătorul intrat târziu are compania lui (insulă doar dacă mai e una liberă)');
});

test('lockstep cu 3 noduri: doi jucători comandă aceeași companie, cealaltă echipă e refuzată, hash-uri identice', async () => {
  const probe = createNetWorld(cfg), p1 = coastSpot(probe, 0), p2 = coast(probe, 0, p1), p3 = coastSpot(probe, 1);
  assert.ok(p1 && p2 && p3);
  const hub = createHub({ latency: 0.1 });
  const nodes = PL.map((p) => hub.add(p.id, { world: createNetWorld(cfg), hostId: 'a', speed: 4, raw: false }));
  const [n1, n2, n3] = nodes;
  await hub.run(0.5); n1.submit({ type: 'buildPort', x: p1.x, y: p1.y });
  await hub.run(1);
  const port = n1.world.stations.find((q) => q.port && q.owner === 0);
  assert.ok(port, 'Ana a construit portul echipei');
  n2.submit({ type: 'buyShip', portId: port.id, model: 2 }); // Bob, aceeași echipă
  n3.submit({ type: 'buildPort', x: p2.x, y: p2.y }); // Cip: insula celeilalte echipe
  n3.submit({ type: 'buildPort', x: p3.x, y: p3.y }); // Cip: insula lui
  await hub.run(1.5);
  const w = n3.world, ship = w.ships.find((q) => q.owner === 0);
  assert.ok(ship, 'Bob a cumpărat vaporul echipei');
  assert.ok(!w.stations.some((q) => q.x === p2.x && q.y === p2.y), 'Cip nu construiește pe insula Vulpilor');
  assert.ok(w.stations.some((q) => q.x === p3.x && q.y === p3.y && q.owner === 1), 'Cip are portul lui');
  n3.submit({ type: 'sellShip', shipId: ship.id });
  await hub.run(1);
  assert.ok(n1.world.ships.some((q) => q.id === ship.id), 'Cip nu poate vinde vaporul altei echipe');
  n1.assign('c', 0, 'Cip'); // gazda îl mută pe Cip la Vulpi
  await hub.run(1);
  assert.equal(n2.world.net.pl.c, 0);
  n3.submit({ type: 'sellShip', shipId: ship.id });
  let n = 0;
  while (n1.world.tick < 2000 && n++ < 4000) await hub.run(0.05);
  n1.setSpeed(0); await hub.run(8);
  assert.ok(!n1.world.ships.some((q) => q.id === ship.id), 'acum e în echipă și poate vinde');
  const hs = nodes.map((q) => hashState(q.world));
  assert.ok(hs.every((h) => h === hs[0]), 'hash-uri diferite: ' + hs);
  assert.deepEqual(nodes.map((q) => JSON.stringify(q.world.net.pl)), new Array(3).fill(JSON.stringify(n1.world.net.pl)));
});
