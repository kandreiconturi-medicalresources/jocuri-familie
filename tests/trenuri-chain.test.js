import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, applyCommand, planTrack, stepWorld, INDUSTRIES, NG } from '../games/trenuri/src/sim/index.js';

const ok = (r) => { assert.ok(r.ok, r.err); return r; };
const T = Object.fromEntries(INDUSTRIES.map((t, i) => [t.key, i]));
function flat() {
  const s = createWorld({ seed: 4, size: 'S', year: 1950 });
  s.height.fill(8); s.water.fill(0); s.forest.fill(0); s.occ.fill(0); s.roads.fill(0);
  s.industries.length = 0;
  return s;
}
function addInd(s, key, x, y) {
  const o = { id: s.industries.length, type: T[key], x, y, name: key, in: new Array(NG).fill(0), out: new Array(NG).fill(0), made: 0, boost: 0 };
  s.industries.push(o); s.occ[y * s.w + x] = 1;
  return o;
}
const stn = (s, x, y, size = 0) => ok(applyCommand(s, { type: 'buildStation', by: 0, x, y, size })).id;
const track = (s, ax, bx, y) => ok(applyCommand(s, { type: 'buildTrack', by: 0, path: planTrack(s, [ax, y], [bx, y], 0).path }));
const buy = (s, model, at, route, kinds) => {
  const t = ok(applyCommand(s, { type: 'buyTrain', by: 0, model, stationId: at, kinds }));
  ok(applyCommand(s, { type: 'setRoute', by: 0, trainId: t.id, route }));
  return s.trains.find((q) => q.id === t.id);
};

test('lanț complet: fermă → fabrică de mâncare → oraș; orașul primește mâncare și se vede în statistică', () => {
  const s = flat();
  addInd(s, 'ferma', 10, 30);
  const fab = addInd(s, 'fabmanc', 32, 30);
  const c = s.cities[0]; c.x = 50; c.y = 30; c.level = 0; c.pop = 300;
  const a = stn(s, 12, 30), b = stn(s, 30, 30), d = stn(s, 50, 30, 1);
  track(s, 12, 30, 30); track(s, 30, 50, 30);
  buy(s, 3, a, [a, b], [2, 2, 2]);
  const food = buy(s, 3, b, [b, d], [6, 6, 6]);
  const sawFood = () => s.trains.some((t) => t.load.some((q) => q.c === 3));
  let seen = false;
  for (let i = 0; i < 9000; i++) { stepWorld(s); if (sawFood()) seen = true; }
  assert.ok(fab.made > 0, 'fabrica a produs');
  assert.ok(seen, 'trenul a încărcat mâncare');
  assert.ok(s.stats.del[3] > 0, 'statistica de livrări are mâncare');
  assert.ok(c.got[3] > 0 || (c.prev && c.prev[3] > 0), 'orașul a primit mâncare');
  assert.ok(food.money > 0);
});

test('sfaturi: marfa fabricii așteaptă în gară și explică de ce nu pleacă', async () => {
  const { industryAdvice } = await import('../games/trenuri/src/sim/advice.js');
  const s = flat();
  const fab = addInd(s, 'fabmanc', 32, 30);
  const c = s.cities[0]; c.x = 50; c.y = 30; c.level = 0; c.pop = 300;
  const b = stn(s, 30, 30), d = stn(s, 50, 30, 1);
  track(s, 30, 50, 30);
  fab.out[3] = 40; fab.made = 100;
  for (let i = 0; i < 12; i++) stepWorld(s);
  const st = s.stations.find((q) => q.id === b);
  assert.ok(st.cargo[3] > 0, 'marfa a trecut în gară');
  let adv = industryAdvice(s, fab);
  assert.ok(!adv.ok && adv.lines.some((l) => /niciun tren/.test(l)), adv.lines.join('|'));
  buy(s, 3, b, [b, d], [0, 0, 1]); // vagoane greșite
  adv = industryAdvice(s, fab);
  assert.ok(adv.lines.some((l) => /nu are vagoane/.test(l)), adv.lines.join('|'));
});

test('planificator: sursa fără materii nu e recomandată și arată lanțul', async () => {
  const { rankOptions } = await import('../games/trenuri/src/sim/planner.js');
  const s = flat();
  const farm = addInd(s, 'ferma', 10, 30), f1 = addInd(s, 'fabmanc', 32, 30), f2 = addInd(s, 'fabmanc', 20, 40);
  f2.in[2] = 50; f2.out[3] = 30; // a doua fabrică produce
  const c = s.cities[0]; c.x = 50; c.y = 30; c.level = 0; c.pop = 300;
  const r = rankOptions(s, { fixed: c, g: 3, owner: 0, cash: 100000, year: 1950 });
  assert.equal(r.length, 2);
  assert.equal(r[0].o, f2, 'cea care produce e prima');
  assert.equal(r[1].o, f1); assert.ok(r[1].chain && r[1].chain.from === farm && r[1].chain.g === 2);
  assert.equal(r[0].chain, null);
});

test('industriile cu același nume primesc numere diferite', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const s = createWorld({ seed, size: 'L' });
    assert.equal(new Set(s.industries.map((o) => o.name)).size, s.industries.length, 'seed ' + seed);
  }
});
