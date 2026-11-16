// Etapa 6.6: semnale cu rezervare de traseu, teren, gări cu peroane, fizică; determinism și lockstep.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNetWorld, hashState, serialize, deserialize, applyCommand, planTrack, stepWorld, signalAspect, MODELS, T_PRESENT, T_TUNNEL,
  maxPlatforms, SIG_ALT, SIG_REV,
} from '../games/trenuri/src/sim/index.js';
import { ok, run, flat, station, track, lane, buy, tile, watch, crossing } from './trenuri-sig-helpers.js';
import { hold, free } from '../games/trenuri/src/sim/reserve.js';
import { createHub } from './trenuri-hub.js';

test('semnale automate la macaze și la gări; cele manuale se pun cu 🚦', () => {
  const s = flat();
  const [a, b] = crossing(s);
  const auto = s.signals.filter((g) => g.auto);
  assert.ok(auto.length >= 8, 'automate: ' + auto.length); // 2 macaze × 3 intrări + 2 gări
  assert.ok(auto.some((g) => g.x === 12 && g.y === 20) && auto.some((g) => g.x === 32 && g.y === 20));
  const before = s.signals.length;
  const cash = s.companies[0].cash;
  ok(applyCommand(s, { type: 'placeSignal', by: 0, x: 9, y: 20, dir: 2, twoWay: true }));
  assert.equal(s.signals.length, before + 1);
  assert.ok(s.companies[0].cash < cash);
  assert.ok(!applyCommand(s, { type: 'placeSignal', by: 0, x: 9, y: 21, dir: 2 }).ok, 'fără șină');
  assert.ok(s.sgm[tile(s, 9, 20)] & 0x44, 'în ambele sensuri');
  ok(applyCommand(s, { type: 'setAutoSignals', by: 0, on: false }));
  assert.ok(s.signals.every((g) => !g.auto));
  ok(applyCommand(s, { type: 'setAutoSignals', by: 0, on: true }));
  assert.equal(s.signals.filter((g) => g.auto).length, auto.length);
  assert.ok(a && b);
});

test('două trenuri în sensuri opuse pe linie simplă cu încrucișare: nu se ating, nu se blochează', () => {
  const s = flat();
  const [a, b] = crossing(s);
  const t1 = buy(s, 3, a, [a, b]), t2 = buy(s, 3, b, [b, a]);
  const r = watch(s, [t1, t2], 5000);
  assert.equal(r.clash, 0, 'două trenuri pe aceeași placă');
  for (let k = 0; k < 2; k++) assert.ok(r.seen[k].has(a) && r.seen[k].has(b) && r.count[k] >= 6, `trenul ${k}: ${r.count[k]} sosiri`);
  assert.ok(!s.news.some((n) => /nu găsește drum/.test(n.text)));
});

test('patru trenuri pe o rețea cu 3 macazuri: zero coliziuni, toate livrează', () => {
  const s = flat();
  const A = station(s, 6, 30), D = station(s, 56, 30), B = station(s, 24, 22), C = station(s, 38, 38), E = station(s, 54, 22);
  track(s, [6, 30], [56, 30]);
  track(s, [16, 30], [24, 22]); track(s, [30, 30], [38, 38]); track(s, [46, 30], [54, 22]);
  const sw = []; for (let i = 0; i < s.track.length; i++) if ((s.track[i] & T_PRESENT) && [...Array(8).keys()].filter((d) => (s.track[i] >> d) & 1).length >= 3) sw.push(i);
  assert.equal(sw.length, 3, 'trei macazuri');
  const ts = [buy(s, 3, A, [A, D]), buy(s, 3, B, [B, E]), buy(s, 2, C, [C, A]), buy(s, 3, D, [D, B])];
  const r = watch(s, ts, 9000, (w, i) => { if (i % 10 === 0) for (const st of w.stations) st.waiting.pass = 90; });
  assert.equal(r.clash, 0, 'plăci ocupate de 2 trenuri');
  ts.forEach((t, k) => assert.ok(t.money > 0 && r.count[k] >= 3, `trenul ${t.id}: ${r.count[k]} sosiri, ${t.money} lei`));
});

test('semnalul e roșu cât traseul e ținut și devine verde singur după eliberare', () => {
  const s = flat();
  const a = station(s, 8, 20), b = station(s, 30, 20);
  track(s, [8, 20], [30, 20]);
  ok(applyCommand(s, { type: 'placeSignal', by: 0, x: 17, y: 20, dir: 2, twoWay: false }));
  const sig = s.signals.find((g) => !g.auto && g.x === 17);
  assert.equal(signalAspect(s, sig.id), 1, 'liber = verde');
  const t = buy(s, 3, a, [a, b]);
  const dummy = { id: 999, rv: [] };
  hold(s, dummy, tile(s, 22, 20)); // altcineva ține capătul secțiunii
  let k = 0;
  while (!t.redAt && k++ < 600) stepWorld(s);
  assert.equal(t.redAt, tile(s, 17, 20) + 1, 'trenul așteaptă la semnal');
  assert.equal(signalAspect(s, sig.id), 0, 'roșu');
  assert.ok(t.speed === 0 && t.seg < t.path.indexOf(tile(s, 17, 20)));
  free(s, dummy, tile(s, 22, 20)); // traseul s-a eliberat
  while (t.state !== 2 && k++ < 2000) stepWorld(s);
  assert.equal(t.state, 2, 'a trecut');
  assert.equal(t.to, b);
  run(s, 200);
  assert.equal(signalAspect(s, sig.id), 1, 'verde după ce a trecut');
});

test('după timeout trenul alege alt fir; fără alternativă se întoarce', () => {
  const s = flat();
  const [a, b] = crossing(s);
  const t = buy(s, 3, a, [a, b]);
  let k = 0;
  while (!(t.state === 1 && t.path.includes(tile(s, 17, 20)) && t.seg >= 2) && k++ < 400) stepWorld(s);
  assert.ok(t.path.includes(tile(s, 17, 20)), 'pornește pe firul drept');
  const dummy = { id: 999, rv: [] };
  hold(s, dummy, tile(s, 17, 20)); // firul drept e rezervat de altcineva
  let hmax = 0;
  while (t.state !== 2 && k++ < 3000) { stepWorld(s); hmax = Math.max(hmax, t.hold); }
  assert.equal(t.to, b); assert.equal(t.state, 2, 'a ajuns');
  assert.ok(hmax >= SIG_ALT, 'a așteptat: ' + hmax);
  assert.ok(!t.path.includes(tile(s, 17, 20)) && t.path.includes(tile(s, 17, 19)), 'a luat firul de sus');
  // linie simplă, fără alt drum: se întoarce
  const s2 = flat();
  const a2 = station(s2, 8, 20), b2 = station(s2, 26, 20);
  track(s2, [8, 20], [26, 20]);
  const t2 = buy(s2, 3, a2, [a2, b2]);
  k = 0;
  while (!(t2.state === 1 && t2.seg >= 3) && k++ < 400) stepWorld(s2);
  hold(s2, { id: 999, rv: [] }, tile(s2, 20, 20));
  const dest = t2.to;
  for (k = 0; k < SIG_REV + 400 && t2.to === dest; k++) stepWorld(s2);
  assert.equal(t2.to, a2, 'se întoarce la gara de unde a plecat');
  assert.ok(s2.news.some((n) => /se întoarce/.test(n.text)));
});

// ——— teren ———
function wall(s, x0, x1, h = 15) { for (let y = 0; y < s.h; y++) for (let x = x0; x <= x1; x++) s.height[tile(s, x, y)] = h; }

test('levelTerrain: o șină care altfel nu se putea face; costul crește cu volumul', () => {
  const s = flat();
  wall(s, 30, 31, 14);
  assert.equal(planTrack(s, [20, 30], [40, 30], 0), null, 'zid peste toată harta');
  const p0 = planTrack(s, [20, 30], [40, 30], 0, { level: true });
  assert.ok(p0 && p0.level.length >= 2 && p0.levelCost > 0, 'propune nivelare');
  const small = ok(applyCommand(s, { type: 'levelTerrain', by: 0, x0: 30, y0: 30, x1: 31, y1: 30, h: 8 }));
  const bigW = flat(); wall(bigW, 30, 31, 14);
  const big = ok(applyCommand(bigW, { type: 'levelTerrain', by: 0, x0: 30, y0: 28, x1: 31, y1: 33, h: 8 }));
  assert.ok(big.cost > small.cost * 3, `${big.cost} vs ${small.cost}`);
  assert.equal(s.height[tile(s, 30, 30)], 8);
  const p1 = planTrack(s, [20, 30], [40, 30], 0);
  assert.ok(p1, 'după nivelare se poate');
  ok(applyCommand(s, { type: 'buildTrack', by: 0, path: p1.path }));
  assert.ok(!applyCommand(s, { type: 'levelTerrain', by: 0, x0: 0, y0: 0, x1: 40, y1: 40, h: 8 }).ok, 'prea mare');
  // propunerea „cu nivelare” se plătește odată cu șina
  const s2 = flat(); wall(s2, 30, 31, 14);
  const p2 = planTrack(s2, [20, 30], [40, 30], 0, { level: true }), cash = s2.companies[0].cash;
  assert.ok(!applyCommand(s2, { type: 'buildTrack', by: 0, path: p2.path }).ok, 'fără nivelare e refuzat');
  const r = ok(applyCommand(s2, { type: 'buildTrack', by: 0, path: p2.path, level: p2.level }));
  assert.equal(r.cost, p2.cost); assert.equal(cash - s2.companies[0].cash, p2.cost);
});

test('clearArea taie pădure; tunelul trece prin deal; trenul îl folosește', () => {
  const s = flat();
  for (let x = 10; x < 14; x++) s.forest[tile(s, x, 12)] = 1;
  const c = ok(applyCommand(s, { type: 'clearArea', by: 0, x0: 10, y0: 12, x1: 13, y1: 12 }));
  assert.ok(c.cost > 0 && s.forest[tile(s, 11, 12)] === 0);
  assert.ok(!applyCommand(s, { type: 'clearArea', by: 0, x0: 10, y0: 12, x1: 13, y1: 12 }).ok, 'nimic de tăiat');
  wall(s, 30, 33, 14);
  const a = station(s, 20, 30), b = station(s, 44, 30);
  assert.equal(planTrack(s, [20, 30], [44, 30], 0), null);
  assert.ok(!applyCommand(s, { type: 'buildTunnel', by: 0, x0: 29, y0: 30, x1: 38, y1: 30 }).ok, 'prea lung');
  assert.ok(!applyCommand(s, { type: 'buildTunnel', by: 0, x0: 29, y0: 30, x1: 34, y1: 31 }).ok, 'nu e linie dreaptă');
  const t = ok(applyCommand(s, { type: 'buildTunnel', by: 0, x0: 29, y0: 30, x1: 34, y1: 30 }));
  assert.ok(t.cost >= 4 * 700);
  assert.ok(s.track[tile(s, 31, 30)] & T_TUNNEL && !(s.track[tile(s, 29, 30)] & T_TUNNEL));
  track(s, [20, 30], [29, 30]); track(s, [34, 30], [44, 30]);
  const tr = buy(s, 3, a, [a, b]);
  const r = watch(s, [tr], 3000);
  assert.ok(r.seen[0].has(a) && r.seen[0].has(b) && r.count[0] >= 3, 'trece prin tunel: ' + r.count[0]);
});

// ——— gări ———
test('upgradeStation respectă limita după oraș și producție', () => {
  const s = flat();
  const c = s.cities[0]; c.x = 30; c.y = 26; c.level = 0;
  const sid = station(s, 30, 28), st = s.stations.find((q) => q.id === sid);
  assert.equal(st.cityId, c.id);
  assert.equal(st.platforms, 1);
  assert.equal(maxPlatforms(s, st), 2, 'sat → 2');
  const cost = ok(applyCommand(s, { type: 'upgradeStation', by: 0, id: st.id })).cost;
  assert.ok(cost > 0 && st.platforms === 2);
  assert.equal(applyCommand(s, { type: 'upgradeStation', by: 0, id: st.id }).err, 'limita');
  c.level = 1; assert.equal(maxPlatforms(s, st), 3);
  ok(applyCommand(s, { type: 'upgradeStation', by: 0, id: st.id }));
  c.level = 2; ok(applyCommand(s, { type: 'upgradeStation', by: 0, id: st.id }));
  assert.equal(st.platforms, 4);
  assert.equal(applyCommand(s, { type: 'upgradeStation', by: 0, id: st.id }).err, 'limita');
  // fără oraș: contează producția din rază
  const fid = station(s, 50, 50), far = s.stations.find((q) => q.id === fid);
  assert.equal(far.cityId, -1);
  assert.equal(applyCommand(s, { type: 'upgradeStation', by: 0, id: far.id }).err, 'limita', 'fără oraș și fără industrii');
  for (let k = 0; k < 3; k++) { s.industries.push({ id: k, type: 0, x: 49 + k, y: 51, name: 'f', in: [], out: [], made: 0, boost: 0 }); }
  assert.equal(maxPlatforms(s, far), 4, 'producție mare → 4');
  ok(applyCommand(s, { type: 'upgradeStation', by: 0, id: far.id }));
  s.companies[0].cash = 10;
  assert.equal(applyCommand(s, { type: 'upgradeStation', by: 0, id: far.id }).err, 'bani');
});

test('două trenuri încarcă deodată pe 2 peroane; cu un singur peron al doilea așteaptă', () => {
  const peak = (platforms) => {
    const s = flat();
    s.cities[0].x = 30; s.cities[0].y = 26; s.cities[0].level = 1;
    const a = station(s, 10, 30), c = station(s, 30, 30), b = station(s, 50, 30);
    track(s, [10, 30], [50, 30]);
    const st = s.stations.find((q) => q.id === c);
    while (st.platforms < platforms) ok(applyCommand(s, { type: 'upgradeStation', by: 0, id: st.id }));
    const t1 = buy(s, 3, a, [a, c]), t2 = buy(s, 3, b, [b, c]);
    let top = 0;
    const r = watch(s, [t1, t2], 1500, (w, i) => { if (i % 10 === 0) st.waiting.pass = 100; top = Math.max(top, w.trains.filter((q) => q.state === 2 && q.to === c).length); });
    assert.ok(t1.money > 0 && t2.money > 0 && r.clash === 0, `${t1.money}/${t2.money}`);
    return top;
  };
  assert.equal(peak(1), 1);
  assert.equal(peak(2), 2);
});

// ——— fizică ———
test('trenul greu urcă rampa mai încet', () => {
  const trip = (cars, loaded, ramp) => {
    const s = flat();
    if (ramp) for (let x = 10; x < 16; x++) for (let y = 0; y < s.h; y++) s.height[tile(s, x, y)] = 4 + 2 * (x - 10);
    if (ramp) for (let x = 16; x < s.w; x++) for (let y = 0; y < s.h; y++) s.height[tile(s, x, y)] = 14;
    const a = station(s, 10, 20), b = station(s, 30, 20);
    track(s, [10, 20], [30, 20]);
    const t = buy(s, 1, a, [a, b], Array(cars).fill(2));
    if (loaded) t.load = Array.from({ length: cars }, () => ({ c: 2, n: 20, from: a, t: 0 }));
    let n = 0;
    while (!(t.state === 2 && t.to === b) && n < 3000) { stepWorld(s); n++; }
    return n;
  };
  const light = [trip(1, false, false), trip(1, false, true)], heavy = [trip(5, true, false), trip(5, true, true)];
  assert.ok(heavy[0] > light[0], 'și pe plat e mai încet la demaraj');
  assert.ok(heavy[1] - heavy[0] > light[1] - light[0], `rampa costă mai mult trenul greu: ${heavy} vs ${light}`);
  assert.ok(MODELS.length > 0);
});

// ——— determinism și lockstep ———
function scenario(s) {
  const a = station(s, 8, 20), b = station(s, 26, 20);
  track(s, [8, 20], [26, 20]);
  lane(s, [[14, 20], [15, 19], [16, 19], [17, 19], [18, 19], [19, 19], [20, 20]]);
  ok(applyCommand(s, { type: 'placeSignal', by: 0, x: 11, y: 20, dir: 2, twoWay: true }));
  buy(s, 3, a, [a, b]); buy(s, 2, b, [b, a]); buy(s, 3, a, [a, b]);
}
test('determinism: același hash, și după serializare în mijloc (cu semnale și rezervări)', () => {
  const go = (save) => {
    let s = flat(); scenario(s);
    for (let i = 0; i < 4000; i++) {
      if (save && i === 1777) s = deserialize(JSON.parse(JSON.stringify(serialize(s))));
      if (i % 10 === 0) for (const st of s.stations) st.waiting.pass = 50;
      stepWorld(s);
    }
    return s;
  };
  const x = go(false), y = go(true), z = go(false);
  assert.equal(hashState(x), hashState(z));
  assert.equal(hashState(x), hashState(y));
  assert.ok(x.trains.every((t) => t.money > 0));
  assert.deepEqual([...y.resv], [...x.resv]);
});

const PL = [{ id: 'a', name: 'Ana', color: '#ff6b6b' }, { id: 'b', name: 'Bob', color: '#4dabf7' }, { id: 'c', name: 'Cip', color: '#ffd23f' }];
const cfg = { mode: 'coop', seed: 7, size: 'S', year: 1950, players: PL };

/** Gări lângă două orașe, șină, tren; plus semnal, a doua gară cu peron în plus, nivelare și al doilea tren în sens opus. */
function netScript() {
  const w = createNetWorld(cfg);
  const near = (c) => {
    for (let r = 2; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = c.x + dx, y = c.y + dy, i = y * w.w + x;
      if (x > 2 && y > 2 && x < w.w - 3 && y < w.h - 3 && !w.occ[i] && !w.water[i] && w.height[i] > 3 && !w.roads[i] && !(w.track[i] & T_PRESENT)) return { x, y };
    }
    return null;
  };
  const cs = w.cities.slice().sort((p, q) => p.id - q.id);
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
    const a = near(cs[i]), b = near(cs[j]);
    const p = a && b && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 10 ? planTrack(w, [a.x, a.y], [b.x, b.y], 0) : null;
    if (!p || p.cost > 40000 || p.path.length < 8) continue;
    const probe = createNetWorld(cfg);
    const sa = applyCommand(probe, { type: 'buildStation', by: 0, x: a.x, y: a.y, size: 1 }), sb = applyCommand(probe, { type: 'buildStation', by: 0, x: b.x, y: b.y, size: 1 });
    if (!sa.ok || !sb.ok || !applyCommand(probe, { type: 'buildTrack', by: 0, path: p.path }).ok) continue;
    const mid = p.path[(p.path.length / 2) | 0], prev = p.path[(p.path.length / 2 | 0) - 1];
    const dir = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]].findIndex(([dx, dy]) => dx === mid[0] - prev[0] && dy === mid[1] - prev[1]);
    return {
      stA: { type: 'buildStation', x: a.x, y: a.y, size: 1 }, stB: { type: 'buildStation', x: b.x, y: b.y, size: 1 }, track: { type: 'buildTrack', path: p.path },
      sig: { type: 'placeSignal', x: mid[0], y: mid[1], dir, twoWay: true }, up: { type: 'upgradeStation', id: sa.id },
      lvl: { type: 'levelTerrain', x0: a.x, y0: a.y + 1, x1: a.x + 1, y1: a.y + 2, h: w.height[a.y * w.w + a.x] },
      t1: { type: 'buyTrain', model: 3, kinds: [0, 0, 1], stationId: sa.id, route: [sa.id, sb.id] }, t2: { type: 'buyTrain', model: 2, kinds: [0, 1], stationId: sb.id, route: [sb.id, sa.id] },
    };
  }
  assert.ok(false, 'nu s-au găsit orașe potrivite');
}

test('lockstep: 3 noduri cu semnale, peroane, nivelare și trenuri opuse rămân cu același hash', async () => {
  const c = netScript(), hub = createHub({ latency: 0.1 });
  const nodes = PL.map((p) => hub.add(p.id, { world: createNetWorld(cfg), hostId: 'a', speed: 4 }));
  const [a, b, cc] = nodes, host = a;
  await hub.run(1); a.submit(c.stA); await hub.run(1); b.submit(c.stB); await hub.run(1.5); cc.submit(c.track);
  await hub.run(1.2); a.submit(c.sig); await hub.run(1); b.submit(c.lvl); await hub.run(1); cc.submit(c.up); await hub.run(1.1); a.submit(c.t1); await hub.run(0.7); b.submit(c.t2);
  let k = 0;
  while (host.world.tick < 3000 && k++ < 4000) await hub.run(0.05);
  assert.ok(host.world.tick >= 3000);
  host.setSpeed(0); await hub.run(8);
  const ticks = nodes.map((n) => n.world.tick);
  assert.ok(ticks.every((t) => t === ticks[0]), 'pași diferiți: ' + ticks);
  const hs = nodes.map((n) => hashState(n.world));
  assert.ok(hs.every((h) => h === hs[0]), 'hash-uri diferite: ' + hs);
  const w = host.world;
  assert.equal(w.trains.length, 2);
  assert.ok(w.signals.some((g) => !g.auto), 'semnal manual');
  assert.ok(w.trains.every((t) => t.money > 0), 'ambele trenuri au livrat');
  assert.ok(nodes.every((n) => n.stats.resyncs === 0), 'fără resincronizări');
  assert.ok(hub.maxLen <= 4096);
});
