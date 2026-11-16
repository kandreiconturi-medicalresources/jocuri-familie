import test from 'node:test';
import assert from 'node:assert/strict';
import { createNetWorld, planTrack, applyCommand, hashState, serialize, deserialize, stepWorld, standings, companyValue, T_PRESENT } from '../games/trenuri/src/sim/index.js';
import { pack, unpack } from '../games/trenuri/src/net/pack.js';
import { createSaves, saveName } from '../games/trenuri/src/net/saves.js';
import { wire, unwire } from '../games/trenuri/src/net/wire.js';
import { createHub } from './trenuri-hub.js';

const PL = [{ id: 'a', name: 'Ana', color: '#ff6b6b' }, { id: 'b', name: 'Bob', color: '#4dabf7' }, { id: 'c', name: 'Cip', color: '#ffd23f' }];
const cfgOf = (mode, n = 3) => ({ mode, seed: 7, size: 'S', year: 1950, players: PL.slice(0, n) });

/** Pregătește un meci: n noduri cu aceeași lume (din cfg), gazda = 'a', viteză 4×. */
function setup(cfg, { latency = 0.1, raw = false } = {}) {
  const hub = createHub({ latency });
  const nodes = cfg.players.map((p) => hub.add(p.id, { world: createNetWorld(cfg), hostId: 'a', speed: 4, raw }));
  return { hub, nodes, host: nodes[0] };
}

/** Comenzi valide pregătite pe o lume de probă (aceeași hartă): 2 gări, șină, tren, pentru compania `by`. */
function script(cfg, by = 0) {
  const w = createNetWorld(cfg);
  let out = null;
  const near = (c) => {
    for (let r = 2; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = c.x + dx, y = c.y + dy, i = y * w.w + x;
      if (x > 2 && y > 2 && x < w.w - 3 && y < w.h - 3 && !w.occ[i] && !w.water[i] && w.height[i] > 3 && !w.roads[i] && !(w.track[i] & T_PRESENT)) return { x, y };
    }
    return null;
  };
  const cs = w.cities.slice().sort((p, q) => p.id - q.id);
  for (let i = 0; i < cs.length && !out; i++) {
    for (let j = i + 1; j < cs.length && !out; j++) {
      const a = near(cs[i]), b = near(cs[j]);
      const p = a && b && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 10 ? planTrack(w, [a.x, a.y], [b.x, b.y], by) : null;
      if (!p || p.cost > 40000) continue;
      const probe = createNetWorld(cfg);
      const sa = applyCommand(probe, { type: 'buildStation', by, x: a.x, y: a.y, size: 1 }), sb = applyCommand(probe, { type: 'buildStation', by, x: b.x, y: b.y, size: 1 });
      const t = applyCommand(probe, { type: 'buildTrack', by, path: p.path });
      if (!sa.ok || !sb.ok || !t.ok) continue;
      out = { stA: { type: 'buildStation', x: a.x, y: a.y, size: 1 }, stB: { type: 'buildStation', x: b.x, y: b.y, size: 1 }, track: { type: 'buildTrack', path: p.path }, train: { type: 'buyTrain', model: 3, kinds: [0, 0, 1], stationId: sa.id, route: [sa.id, sb.id] } };
    }
  }
  assert.ok(out, 'nu s-au găsit orașe potrivite');
  return out;
}

/** Oprește gazda, lasă mesajele să ajungă ca toți să fie la același pas; apoi repornește. */
async function settle(hub, host) {
  host.setSpeed(0);
  await hub.run(8);
  const ticks = [...hub.nodes.values()].map((n) => n.world.tick);
  assert.ok(ticks.every((t) => t === ticks[0]), 'pași diferiți: ' + ticks);
  const hs = [...hub.nodes.values()].map((n) => hashState(n.world));
  host.setSpeed(4);
  return hs;
}
/** Rulează până se îndeplinește condiția (compresia stării e asincronă, în timp real): fără timeout fix, doar o limită generoasă. */
async function until(hub, cond, maxSec = 300) {
  for (let t = 0; t < maxSec && !cond(); t += 0.05) { hub.step(0.05); await new Promise((r) => setTimeout(r, 1)); }
}
const same = (hs) => assert.ok(hs.every((h) => h === hs[0]), 'hash-uri diferite: ' + hs);

test('3 clienți, comenzi la pași diferiți: același hash după 5000 de pași', async () => {
  const cfg = cfgOf('coop'), c = script(cfg), { hub, nodes, host } = setup(cfg);
  const [a, b, cc] = nodes;
  await hub.run(2); a.submit(c.stA);
  await hub.run(1.3); b.submit(c.stB);
  await hub.run(1.7); cc.submit(c.track);
  await hub.run(1.1); b.submit(c.train);
  let k = 0;
  while (host.world.tick < 5000 && k++ < 4000) await hub.run(0.05);
  assert.ok(host.world.tick >= 5000);
  same(await settle(hub, host));
  const w = host.world;
  assert.equal(w.stations.length, 2);
  assert.equal(w.trains.length, 1);
  assert.ok(w.companies.length === 1 && nodes.every((n) => n.world.trains.length === 1));
  assert.ok(hub.maxLen <= 4096);
  assert.ok(w.companies[0].history.length > 5);
  assert.ok(nodes.every((n) => n.stats.resyncs === 0), 'nu trebuia nicio resincronizare');
});

test('intrarea în timpul jocului: starea reconstruită e identică', async () => {
  const cfg = cfgOf('coop', 2), c = script(cfg), { hub, host } = setup(cfg);
  await hub.run(1); host.submit(c.stA); await hub.run(1); host.submit(c.stB); await hub.run(1); host.submit(c.track); await hub.run(1); host.submit(c.train);
  await hub.run(60);
  const late = hub.add('c', { world: null, hostId: 'a' });
  late.requestState();
  await until(hub, () => late.ready && !late.syncing);
  assert.ok(late.ready && !late.syncing, 'starea nu a ajuns');
  assert.equal(late.stats.resyncs, 1);
  await hub.run(30);
  same(await settle(hub, host));
  assert.equal(late.world.trains.length, 1);
  assert.equal(late.world.tick, host.world.tick);
});

test('o bucată de stare pierdută se retrimite', async () => {
  const cfg = cfgOf('coop', 2), { hub, host } = setup(cfg);
  await hub.run(20);
  let dropped = 0;
  hub.filter = (from, to, d) => d.k === 'sc' && d.i === 1 && !dropped && !!(dropped = 1);
  const late = hub.add('c', { world: null, hostId: 'a', raw: true });
  late.requestState();
  await until(hub, () => dropped && late.ready && !late.syncing);
  assert.equal(dropped, 1);
  assert.ok(late.ready && !late.syncing);
  hub.filter = null;
  await hub.run(10);
  same(await settle(hub, host));
});

test('plecarea gazdei: jocul continuă de la ultimul pas confirmat, cu același hash', async () => {
  const cfg = cfgOf('coop'), c = script(cfg), { hub, nodes, host } = setup(cfg);
  const [, b, cc] = nodes;
  await hub.run(1); host.submit(c.stA); await hub.run(1); b.submit(c.stB); await hub.run(1); cc.submit(c.track); await hub.run(40);
  const before = b.world.tick;
  hub.remove('a');
  b.setHost('b'); cc.setHost('b');
  await hub.run(2); cc.submit(c.train); await hub.run(60);
  assert.ok(b.world.tick > before + 200, 'jocul nu a continuat');
  same(await settle(hub, b));
  assert.equal(cc.world.trains.length, 1);
  assert.equal(cc.world.tick, b.world.tick);
});

test('desincronizarea forțată se repară', async () => {
  const cfg = cfgOf('coop'), { hub, nodes, host } = setup(cfg);
  await hub.run(10);
  nodes[2].world.companies[0].cash += 12345; // stricăm un client
  assert.notEqual(hashState(nodes[2].world), hashState(host.world));
  await hub.run(40);
  assert.ok(nodes[2].stats.resyncs >= 1, 'nu a cerut starea');
  await hub.run(10);
  same(await settle(hub, host));
  assert.equal(nodes[1].stats.resyncs, 0);
});

test('competitiv: fiecare cu compania lui; comenzile pe bunurile altuia sunt refuzate', async () => {
  const cfg = cfgOf('comp'), ca = script(cfg, 0), { hub, nodes, host } = setup(cfg);
  const [a, b] = nodes;
  await hub.run(1); a.submit(ca.stA); await hub.run(1); a.submit(ca.stB); await hub.run(1); a.submit(ca.track); await hub.run(3);
  const w = host.world;
  assert.equal(w.companies.length, 3);
  assert.deepEqual(w.stations.map((s) => s.owner), [0, 0]);
  const sid = w.stations[0].id, h0 = hashState(w), cash1 = w.companies[1].cash;
  // Bob încearcă să demoleze, să folosească gara și să construiască peste șina Anei
  b.submit({ type: 'removeStation', id: sid });
  b.submit({ type: 'removeTrack', x: ca.track.path[1][0], y: ca.track.path[1][1] });
  b.submit({ type: 'buyTrain', model: 0, kinds: [0], stationId: sid });
  b.submit({ type: 'buildTrack', path: ca.track.path });
  b.submit({ type: 'buildUpgrade', stationId: sid, kind: 0 });
  await hub.run(3);
  assert.equal(w.stations.length, 2);
  assert.equal(w.trains.length, 0);
  assert.equal(w.companies[1].cash, cash1, 'Bob nu a cheltuit nimic');
  assert.equal(w.stations[0].up[0], 0);
  // Ana își cumpără trenul; Bob nu-l poate vinde sau redirecționa
  a.submit(ca.train); await hub.run(3);
  const tid = w.trains[0].id;
  b.submit({ type: 'sellTrain', trainId: tid }); b.submit({ type: 'setRoute', trainId: tid, route: [sid] }); await hub.run(3);
  assert.equal(w.trains.length, 1);
  assert.equal(w.trains[0].route.length, 2);
  const st = standings(w);
  assert.equal(st.length, 3);
  assert.equal(st[0].value, Math.max(...st.map((q) => q.value)));
  assert.ok(companyValue(w, 0) > 0);
  same(await settle(hub, host));
  assert.notEqual(hashState(w), h0);
});

test('competitiv: un jucător nou primește o companie; nu poate demola gara altuia', async () => {
  const cfg = cfgOf('comp', 2), c = script(cfg, 0), { hub, host } = setup(cfg);
  await hub.run(1); host.submit(c.stA); await hub.run(2);
  const late = hub.add('c', { world: null, hostId: 'a' });
  late.requestState(); host.join('c', 'Cip', '#ffd23f'); await hub.run(6);
  assert.equal(host.world.companies.length, 3);
  late.submit({ type: 'removeStation', id: host.world.stations[0].id });
  late.submit({ type: 'buildStation', x: c.stB.x, y: c.stB.y, size: 0 });
  await hub.run(4);
  assert.deepEqual(host.world.stations.map((s) => s.owner).sort(), [0, 2]);
  same(await settle(hub, host));
});

test('comenzile: traseul se codifică scurt și revine la fel', async () => {
  const c = script(cfgOf('coop')), w = wire(c.track);
  assert.deepEqual(unwire(JSON.parse(JSON.stringify(w))), c.track);
  assert.ok(JSON.stringify(w).length < JSON.stringify(c.track).length);
});

test('starea se împachetează (cu și fără compresie) și salvarea încape sub 1 MB', async () => {
  const w = createNetWorld({ ...cfgOf('coop'), size: 'L' }), o = serialize(w);
  const z = await pack(o), r = await pack(o, { raw: true });
  assert.ok(z.length < 1e6 && r.length < 1e6, `${z.length} / ${r.length}`);
  assert.ok(z.length < r.length);
  assert.deepEqual(await unpack(z), o);
  assert.deepEqual(await unpack(r), o);
});

test('gazda încarcă o salvare: toți primesc lumea nouă și rămân sincronizați', async () => {
  const cfg = cfgOf('coop'), c = script(cfg), { hub, nodes, host } = setup(cfg);
  await hub.run(1); host.submit(c.stA); await hub.run(1); host.submit(c.stB); await hub.run(1); host.submit(c.track); await hub.run(1); host.submit(c.train);
  await hub.run(30);
  const old = deserialize(serialize(host.world)); // „salvarea”
  await hub.run(60);
  const tickAfter = host.world.tick;
  assert.ok(tickAfter > old.tick + 100);
  old.net = { mode: 'coop', pl: {} };
  const t0 = old.tick;
  host.load(old, ['b', 'c']);
  // așteaptă condiția, nu un număr fix de pași (pe runner-ele lente transferul durează mai mult)
  await until(hub, () => nodes.every((n) => !n.syncing));
  assert.ok(nodes.every((n) => !n.syncing));
  assert.ok(nodes.every((n) => n.world.tick < tickAfter && n.world.tick >= t0));
  await hub.run(20);
  same(await settle(hub, host));
  assert.ok(nodes[2].world.tick < tickAfter, 'clientul a primit lumea încărcată');
});

test('salvările: 3 sloturi local și pe „server” (simulat), sub 1 MB, cu aceeași stare la încărcare', async () => {
  const mem = {}, store = { get: (k, d) => (k in mem ? JSON.parse(mem[k]) : d), set: (k, v) => { mem[k] = JSON.stringify(v); return true; }, remove: (k) => { delete mem[k]; } };
  const nas = {}, api = {
    listSaves: async () => Object.entries(nas).map(([slot, v]) => ({ slot: +slot, name: v.name, size: v.data.length, updatedAt: 1 })),
    loadSave: async (g, slot) => ({ slot, ...nas[slot] }), putSave: async (g, slot, name, data) => { nas[slot] = { name, data }; }, deleteSave: async (g, slot) => { delete nas[slot]; },
  };
  const w = createNetWorld({ ...cfgOf('coop'), size: 'M' });
  for (let i = 0; i < 300; i++) stepWorld(w);
  for (const [where, saves] of [['local', createSaves({ store, api: null })], ['nas', createSaves({ store, api })]]) {
    assert.deepEqual(await saves.list(), [null, null, null]);
    const bytes = await saves.save(2, saveName(w), w, 2);
    assert.ok(bytes < 1e6, where);
    const rows = await saves.list();
    assert.equal(rows[1].slot, 2); assert.equal(rows[0], null);
    const r = await saves.load(2);
    assert.equal(hashState(r.state), hashState(w)); assert.equal(r.speed, 2);
    await saves.remove(2);
    assert.deepEqual(await saves.list(), [null, null, null]);
    await assert.rejects(() => saves.load(2));
  }
});
