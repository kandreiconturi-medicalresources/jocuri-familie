// Lockstep cu modul expert și AI-uri: toate nodurile rămân sincronizate (refolosește camera în memorie din trenuri-hub.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNetWorld, hashState, standings } from '../games/trenuri/src/sim/index.js';
import { ALLOWED } from '../games/trenuri/src/net/wire.js';
import { createHub } from './trenuri-hub.js';

const PL = [{ id: 'a', name: 'Ana', color: '#ff6b6b' }, { id: 'b', name: 'Bob', color: '#4dabf7' }, { id: 'c', name: 'Cip', color: '#ffd23f' }];
const cfgOf = (mode, n = 3) => ({ mode, seed: 7, size: 'S', year: 1950, expert: true, ai: [0, 2], players: PL.slice(0, n) });

function setup(cfg, { latency = 0.1 } = {}) {
  const hub = createHub({ latency });
  const nodes = cfg.players.map((p) => hub.add(p.id, { world: createNetWorld(cfg), hostId: 'a', speed: 4 }));
  return { hub, nodes, host: nodes[0] };
}
async function settle(hub, host) {
  host.setSpeed(0);
  await hub.run(8);
  const ticks = [...hub.nodes.values()].map((n) => n.world.tick);
  assert.ok(ticks.every((t) => t === ticks[0]), 'pași diferiți: ' + ticks);
  const hs = [...hub.nodes.values()].map((n) => hashState(n.world));
  host.setSpeed(4);
  return hs;
}
const same = (hs) => assert.ok(hs.every((h) => h === hs[0]), 'hash-uri diferite: ' + hs);

test('comenzile modului expert sunt permise în rețea', () => {
  for (const t of ['takeLoan', 'repayLoan', 'buyShares', 'sellShares', 'takeover', 'continueSimple']) assert.ok(ALLOWED.has(t), t);
});

test('expert competitiv cu 3 jucători și 2 AI: sincron după 6000 de pași, fără resincronizări', async () => {
  const cfg = cfgOf('comp'), { hub, nodes, host } = setup(cfg);
  const [a, b, c] = nodes;
  assert.equal(host.world.companies.length, 5);
  await hub.run(2); a.submit({ type: 'takeLoan' });
  await hub.run(1.3); b.submit({ type: 'buyShares', co: 0, n: 20 });
  await hub.run(1.1); c.submit({ type: 'buyShares', co: 3, n: 30 }); c.submit({ type: 'takeLoan' });
  await hub.run(1.7); a.submit({ type: 'sellShares', co: 1, n: 5 }); // nu are: refuzat la fel peste tot
  let k = 0;
  while (host.world.tick < 6000 && k++ < 6000) await hub.run(0.05);
  assert.ok(host.world.tick >= 6000);
  same(await settle(hub, host));
  const w = host.world;
  assert.equal(w.companies[0].loan, 10000);
  assert.equal(w.companies[1].sh[0], 0, 'vânzarea fără acțiuni e refuzată');
  assert.equal(w.companies[0].sh[1], 20);
  assert.ok(w.stations.some((s) => s.owner >= 3) && w.trains.some((t) => t.owner >= 3), 'AI-urile construiesc în rețea');
  assert.equal(standings(w).length, 5);
  assert.ok(nodes.every((n) => n.stats.resyncs === 0), 'nu trebuia nicio resincronizare');
  assert.ok(hub.maxLen <= 4096);
});

test('expert: cine intră în timpul jocului primește starea întreagă (cu AI) identică', async () => {
  const cfg = cfgOf('coop', 2), { hub, host } = setup(cfg);
  await hub.run(60);
  const late = hub.add('c', { world: null, hostId: 'a' });
  late.requestState();
  await hub.run(8);
  assert.ok(late.ready && !late.syncing, 'starea nu a ajuns');
  await hub.run(30);
  same(await settle(hub, host));
  assert.equal(late.world.mode, 'expert');
  assert.equal(late.world.companies.length, 3);
});

test('expert: desincronizarea forțată într-o acțiune se repară', async () => {
  const cfg = cfgOf('coop'), { hub, nodes, host } = setup(cfg);
  await hub.run(10);
  nodes[2].world.companies[0].pw += 777;
  assert.notEqual(hashState(nodes[2].world), hashState(host.world));
  await hub.run(40);
  assert.ok(nodes[2].stats.resyncs >= 1);
  await hub.run(10);
  same(await settle(hub, host));
});
