import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld, hashState, serialize, deserialize, applyCommand, planTrack, stepWorld, deliver, availableModels, MODELS, INDUSTRIES, NG, CITY_LEVELS,
} from '../games/trenuri/src/sim/index.js';

const ok = (r) => { assert.ok(r.ok, r.err); return r; };
const T = Object.fromEntries(INDUSTRIES.map((t, i) => [t.key, i]));

/** Lume plată cu oraș la distanță; industriile se pun de mână. */
function flat(year = 1950) {
  const s = createWorld({ seed: 4, size: 'S', year });
  s.height.fill(8); s.water.fill(0); s.forest.fill(0); s.occ.fill(0); s.roads.fill(0);
  s.industries.length = 0;
  return s;
}
function addInd(s, key, x, y) {
  const o = { id: s.industries.length, type: T[key], x, y, name: key, in: new Array(NG).fill(0), out: new Array(NG).fill(0), made: 0, boost: 0 };
  s.industries.push(o); s.occ[y * s.w + x] = 1;
  return o;
}
/** Două gări pe aceeași linie dreaptă, legate cu șină. */
function line(s, ax, bx, y) {
  const a = ok(applyCommand(s, { type: 'buildStation', by: 0, x: ax, y, size: 0 })).id;
  const b = ok(applyCommand(s, { type: 'buildStation', by: 0, x: bx, y, size: 0 })).id;
  ok(applyCommand(s, { type: 'buildTrack', by: 0, path: planTrack(s, [ax, y], [bx, y], 0).path }));
  return [a, b];
}
const buy = (s, model, at, route, kinds) => {
  const t = ok(applyCommand(s, { type: 'buyTrain', by: 0, model, stationId: at, kinds }));
  ok(applyCommand(s, { type: 'setRoute', by: 0, trainId: t.id, route }));
  return s.trains.find((q) => q.id === t.id);
};

test('industriile sunt puse cu seed, lângă resurse', () => {
  const a = createWorld({ seed: 7, size: 'M' }), b = createWorld({ seed: 7, size: 'M' });
  assert.deepEqual(a.industries, b.industries);
  assert.ok(INDUSTRIES.every((t, i) => a.industries.some((o) => o.type === i)), 'toate tipurile există');
  for (const o of a.industries.filter((q) => INDUSTRIES[q.type].place === 'forest')) assert.ok(a.height[o.y * a.w + o.x] > 3);
});

test('lanț: cărbune dus la oțelărie face oțel', () => {
  const s = flat();
  const mine = addInd(s, 'mincarb', 10, 40), steel = addInd(s, 'otelarie', 40, 40);
  mine.out[6] = 60; steel.in[7] = 60; // minereul îl avem deja
  const [a, b] = line(s, 12, 38, 40);
  buy(s, 3, a, [a, b], [3, 3, 3]);
  for (let i = 0; i < 3000; i++) stepWorld(s);
  assert.ok(steel.made > 0, 'oțelăria a produs');
  const stB = s.stations.find((q) => q.id === b);
  assert.ok(steel.out[8] + stB.cargo[8] > 0, 'oțelul e gata de dus');
  assert.ok(s.companies[0].cash > 0 && s.trains[0].money > 0);
});

test('prelucrătoarele produc doar din ce primesc', () => {
  const s = flat();
  const steel = addInd(s, 'otelarie', 40, 40);
  for (let i = 0; i < 3000; i++) stepWorld(s);
  assert.equal(steel.made, 0);
  steel.in[6] = 5; steel.in[7] = 3;
  for (let i = 0; i < 20; i++) stepWorld(s);
  assert.equal(steel.out[8] + 0, 3); assert.equal(steel.in[6], 2);
});

test('marfă la o destinație care n-o cere: plată mică și explicație', () => {
  const s = flat();
  const mine = addInd(s, 'mincarb', 10, 40);
  mine.out[6] = 60;
  const [a, b] = line(s, 12, 38, 40);
  s.stations.find((q) => q.id === b).cargo[6] = 0;
  const t = buy(s, 3, a, [a, b], [3, 3, 3]);
  t.orders = [{ load: [6] }, { unload: [6] }];
  while (t.money === 0 && s.tick < 3000) stepWorld(s);
  assert.ok(t.money > 0 && t.money <= 1200, 'puțini bani: ' + t.money); // plata întreagă ar fi ~4700
  assert.ok(s.news.some((n) => /nu cere/.test(n.text)));
});

test('un oraș aprovizionat crește până la nivelul următor în câteva luni', () => {
  const s = flat();
  const c = s.cities[0];
  c.pop = 300; c.level = 0;
  const st = s.stations[ok(applyCommand(s, { type: 'buildStation', by: 0, x: c.x, y: c.y, size: 1 })).id && s.stations.length - 1];
  let months = 0;
  const feed = (...gs) => { for (const g of gs) assert.ok(deliver(s, st, g, 200)); for (let i = 0; i < 300; i++) stepWorld(s); months++; };
  while (c.level < 1 && months < 24) feed(3, 5);
  assert.equal(c.level, 1); assert.ok(c.pop >= CITY_LEVELS[1] && months <= 12, 'luni: ' + months);
  months = 0;
  while (c.level < 2 && months < 40) feed(3, 5, 9, 11);
  assert.equal(c.level, 2, 'metropolă după ' + months + ' luni');
  assert.ok(c.buildings.length > 30);
});

test('locomotivele apar după an și apare un articol în ziar', () => {
  assert.deepEqual(availableModels(1840).map((m) => m.key), ['mic']);
  assert.equal(availableModels(1900).length, 3);
  assert.equal(availableModels(1950).length, 4);
  const s = createWorld({ seed: 2, size: 'S', year: 1950 });
  const st = ok(applyCommand(s, { type: 'buildStation', by: 0, x: s.cities[0].x, y: s.cities[0].y, size: 0 })).id;
  const el = MODELS.findIndex((m) => m.key === 'electric');
  assert.equal(applyCommand(s, { type: 'buyTrain', by: 0, model: el, stationId: st }).err, 'epoca');
  while (s.date.y < 1952) stepWorld(s);
  assert.ok(s.news.some((n) => /nouă locomotivă a fost inventată/.test(n.text) && /Electric/.test(n.text)));
  ok(applyCommand(s, { type: 'buyTrain', by: 0, model: el, stationId: st }));
  assert.equal(applyCommand(createWorld({ seed: 2, year: 1840 }), { type: 'buyTrain', by: 0, model: 3, stationId: 1 }).err, 'epoca');
});

function arrivals(s, trains, ticks) {
  const seen = trains.map(() => new Set()), count = trains.map(() => 0), was = trains.map((t) => t.state);
  let maxBlk = 0;
  for (let i = 0; i < ticks; i++) {
    stepWorld(s);
    trains.forEach((t, k) => { if (t.state === 2 && was[k] !== 2) { seen[k].add(t.to); count[k]++; } was[k] = t.state; });
    for (let j = 0; j < s.blk.length; j += 7) maxBlk = Math.max(maxBlk, s.blk[j]);
  }
  return { seen, count, maxBlk };
}

test('semnalizare: două trenuri pe aceeași linie, în sensuri opuse, nu se blochează', () => {
  const s = flat();
  const [a, b] = line(s, 10, 30, 20);
  const t1 = buy(s, 3, a, [a, b]), t2 = buy(s, 3, b, [b, a]);
  const r = arrivals(s, [t1, t2], 12000);
  for (let k = 0; k < 2; k++) assert.ok(r.seen[k].has(a) && r.seen[k].has(b) && r.count[k] >= 4, `trenul ${k}: ${r.count[k]} sosiri`);
  assert.ok(r.maxBlk <= 1, 'două trenuri n-au intrat în aceeași secțiune');
  assert.ok(s.news.some((n) => /se întoarce/.test(n.text)), 'unul a cedat');
});

test('semnalizare: patru trenuri pe o linie cu trei gări nu se blochează permanent', () => {
  const s = flat();
  const [a, b] = line(s, 10, 25, 20), c = ok(applyCommand(s, { type: 'buildStation', by: 0, x: 40, y: 20, size: 0 })).id;
  ok(applyCommand(s, { type: 'buildTrack', by: 0, path: planTrack(s, [25, 20], [40, 20], 0).path }));
  const ts = [buy(s, 3, a, [a, c]), buy(s, 2, c, [c, a]), buy(s, 3, b, [b, a]), buy(s, 1, b, [b, c])];
  const r = arrivals(s, ts, 24000);
  r.count.forEach((n, k) => assert.ok(n >= 3, `trenul ${k}: ${n} sosiri`));
  assert.ok(r.maxBlk <= 1);
});

test('semnalizare: același sens, al doilea așteaptă', () => {
  const s = flat();
  const [a, b] = line(s, 10, 40, 20);
  const t1 = buy(s, 3, a, [a, b]), t2 = buy(s, 1, a, [a, b]);
  const r = arrivals(s, [t1, t2], 9000);
  assert.ok(r.count[0] >= 3 && r.count[1] >= 3 && r.maxBlk <= 1, JSON.stringify(r.count));
});

test('hash identic după serializare și deserializare, cu lanț și trenuri', () => {
  const run = (save) => {
    let s = flat();
    const mine = addInd(s, 'mincarb', 10, 40), steel = addInd(s, 'otelarie', 40, 40);
    mine.out[6] = 80; steel.in[7] = 80;
    const [a, b] = line(s, 12, 38, 40);
    buy(s, 3, a, [a, b], [3, 3, 3]); buy(s, 2, b, [b, a], [3, 3]);
    for (let i = 0; i < 5000; i++) {
      if (save && i === 2345) s = deserialize(JSON.parse(JSON.stringify(serialize(s))));
      stepWorld(s);
    }
    return s;
  };
  const x = run(false), y = run(true), z = run(false);
  assert.equal(hashState(x), hashState(z));
  assert.equal(hashState(x), hashState(y));
  assert.ok(x.industries.find((o) => o.type === T.otelarie).made > 0);
});
