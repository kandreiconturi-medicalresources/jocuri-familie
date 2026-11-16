import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld, applyCommand, stepWorld, hashState, serialize, deserialize, standings, scenarioById, createScenarioWorld, evaluate,
  netWorth, ratingOf, interestOf, trainMaint, targetPrice, LOAN_TR, RATINGS, SHARES, MODELS,
} from '../games/trenuri/src/sim/index.js';
import { updatePrices } from '../games/trenuri/src/sim/expert/stocks.js';

const MONTH = 300;
const expert = (o = {}) => createWorld({ seed: 7, size: 'S', year: 1950, mode: 'expert', ...o });
const run = (s, n) => { for (let i = 0; i < n; i++) stepWorld(s); };
const cmd = (s, by, c) => applyCommand(s, { by, ...c });

test('expert cu 3 AI: același hash după 20.000 de pași, cu serializare la mijloc', () => {
  const a = expert({ ai: [0, 1, 2] }), b = expert({ ai: [0, 1, 2] });
  assert.equal(a.companies.length, 4);
  run(a, 20000);
  run(b, 10000);
  let c = deserialize(JSON.parse(JSON.stringify(serialize(b))));
  assert.equal(hashState(c), hashState(b));
  run(c, 10000);
  assert.equal(hashState(a), hashState(c));
  assert.deepEqual(a.companies.map((q) => [q.cash, q.px, q.mk, q.rep.y.length]), c.companies.map((q) => [q.cash, q.px, q.mk, q.rep.y.length]));
  assert.ok(a.stations.length >= 6 && a.trains.length >= 3, 'AI-urile au construit');
});

test('AI-ul construiește și face profit pe harta standard, cu aceleași reguli ca jucătorul', () => {
  const s = expert({ ai: [1] }), ai = s.companies[1];
  run(s, 3600 * 6);
  assert.ok(s.stations.filter((q) => q.owner === 1).length >= 2, 'gări');
  assert.ok(s.trains.filter((q) => q.owner === 1).length >= 1, 'trenuri');
  assert.ok(s.trains.every((t) => t.owner === 1) && s.companies[0].cash === 100000, 'jucătorul nu e atins');
  const years = ai.rep.y, inc = years.reduce((n, y) => n + y.inc, 0), cost = years.reduce((n, y) => n + y.cost, 0);
  assert.ok(years.length >= 5 && inc > 0 && inc > cost, `venit ${inc} / costuri ${cost}`);
  assert.ok(ai.rep.y.some((y) => y.profit > 0));
  assert.ok(!ai.dead && ai.cash > -5000);
});

test('împrumuturile: tranșe, dobândă după rating, rambursare', () => {
  const s = expert();
  assert.equal(ratingOf(s, 0), 0);
  assert.equal(cmd(s, 0, { type: 'takeLoan' }).ok, true);
  assert.deepEqual([s.companies[0].cash, s.companies[0].loan, s.companies[0].tr[0].r], [100000 + LOAN_TR, LOAN_TR, RATINGS[0].rate]);
  assert.equal(interestOf(s.companies[0]), (LOAN_TR * 50 / 12000) | 0);
  run(s, MONTH); // fără șine sau trenuri: doar dobânda
  assert.equal(s.companies[0].cash, 110000 - 41);
  // cu cash puțin, a doua tranșă are rating mai slab
  s.companies[0].cash = 5000;
  assert.equal(cmd(s, 0, { type: 'takeLoan' }).ok, true);
  assert.equal(s.companies[0].tr[1].r, RATINGS[3].rate);
  assert.equal(interestOf(s.companies[0]), 41 + 150);
  // rambursare: întâi tranșa cu dobânda mare; fără bani nu merge
  assert.equal(cmd(s, 0, { type: 'repayLoan' }).ok, true);
  assert.deepEqual([s.companies[0].loan, s.companies[0].cash, s.companies[0].tr[0].r], [LOAN_TR, 5000, 50]);
  s.companies[0].cash = 100;
  assert.deepEqual(cmd(s, 0, { type: 'repayLoan' }), { ok: false, err: 'bani' });
  // plafon de tranșe după rating
  s.companies[0].cash = 10 ** 7; s.companies[0].loan = 0; s.companies[0].tr = [];
  let n = 0;
  while (cmd(s, 0, { type: 'takeLoan' }).ok && n < 20) n++;
  assert.equal(n, RATINGS[0].max);
  // în modul simplu nu există
  assert.equal(cmd(createWorld({ seed: 7 }), 0, { type: 'takeLoan' }).err, 'expert');
});

test('întreținerea trenurilor crește cu vârsta', () => {
  const s = expert();
  const t = { model: 3, born: s.date.y * 12 + s.date.m };
  const m0 = trainMaint(s, t);
  assert.equal(m0, MODELS[3].maint);
  s.date.y += 2;
  assert.equal(trainMaint(s, t), (MODELS[3].maint * 148 / 100) | 0);
  s.date.y += 10;
  assert.equal(trainMaint(s, t), (MODELS[3].maint * 250 / 100) | 0);
});

test('prețul acțiunilor reacționează la profit și la datorii', () => {
  const s = expert({ ai: [] }), c = s.companies[0];
  for (let i = 0; i < 12; i++) updatePrices(s);
  const calm = c.px;
  assert.ok(calm >= 90 && calm <= 110, 'fără profit prețul stă pe loc: ' + calm);
  c.history = new Array(12).fill(6000);
  const hi = targetPrice(s, c);
  assert.ok(hi > calm + 100, `profitul ridică ținta: ${hi}`);
  for (let i = 0; i < 12; i++) updatePrices(s);
  assert.ok(c.px > calm + 80, `prețul urmează profitul: ${c.px}`);
  c.history = new Array(12).fill(-6000);
  for (let i = 0; i < 12; i++) updatePrices(s);
  assert.ok(c.px < calm - 20, `pierderea îl coboară: ${c.px}`);
});

test('bursa: cumperi, vinzi, răscumperi și preiei o companie AI cu peste 50%', () => {
  const s = expert({ ai: [1, 1] });
  run(s, 3600 * 3);
  const me = s.companies[0], ai = s.companies[1], px = ai.px;
  assert.equal(netWorth(s, 0), me.pw + 500 * me.px);
  assert.equal(cmd(s, 0, { type: 'buyShares', co: 1, n: 10 }).ok, true);
  assert.deepEqual([me.pw, ai.sh[0], ai.mk], [20000 - px * 10, 10, 600 - 10]);
  assert.equal(cmd(s, 0, { type: 'sellShares', co: 1, n: 4 }).ok, true);
  assert.equal(ai.sh[0], 6);
  // răscumpărare la compania ta
  assert.equal(cmd(s, 0, { type: 'buyShares', co: 0, n: 50 }).ok, true);
  assert.equal(me.sh[0], 550);
  assert.equal(cmd(s, 0, { type: 'sellShares', co: 0, n: 700 }).err, 'actiuni');
  // fără bani personali
  me.pw = 10;
  assert.equal(cmd(s, 0, { type: 'buyShares', co: 1, n: 5 }).err, 'bani');
  // preluarea cere peste 50%
  me.pw = 10 ** 8;
  assert.equal(cmd(s, 0, { type: 'takeover', co: 1 }).err, 'actiuni');
  assert.equal(cmd(s, 0, { type: 'takeover', co: 0 }).err, 'actiuni', 'nu-ți preiei propria companie');
  assert.equal(cmd(s, 0, { type: 'buyShares', co: 1, n: ai.mk }).ok, true);
  assert.ok(ai.sh[0] > SHARES / 2);
  const stations = s.stations.filter((q) => q.owner === 1).length, trains = s.trains.filter((q) => q.owner === 1).length, cash = me.cash;
  assert.ok(stations > 0 && trains > 0);
  assert.equal(cmd(s, 0, { type: 'takeover', co: 1 }).ok, true);
  assert.ok(ai.dead);
  assert.equal(s.stations.filter((q) => q.owner === 0).length, stations);
  assert.equal(s.trains.filter((q) => q.owner === 0).length, trains);
  assert.ok(me.cash !== cash || ai.cash === 0);
  assert.ok(!standings(s).some((q) => q.id === 1));
  const h = hashState(s), r = deserialize(JSON.parse(JSON.stringify(serialize(s))));
  assert.equal(hashState(r), h);
  run(s, 2000); run(r, 2000);
  assert.equal(hashState(r), hashState(s));
});

test('dividendele merg la acționari în ianuarie', () => {
  const s = expert({ ai: [] }), c = s.companies[0];
  c.history = new Array(12).fill(5000); c.cash = 200000;
  s.date.m = 12; s.date.d = 30;
  const pw = c.pw, cash = c.cash;
  s.tick = 3599; run(s, 1);
  assert.equal(s.date.m, 1);
  const gain = c.pw - pw;
  assert.ok(gain > 0 && gain % 500 === 0 && gain / 500 <= (5000 * 12 * 30 / 100 / SHARES) | 0, `pw ${c.pw}`);
  assert.ok(c.cash < cash);
});

test('falimentul: 6 luni la rând pe minus, apoi se poate continua în modul simplu', () => {
  const s = expert({ ai: [] }), c = s.companies[0];
  c.cash = -5000;
  run(s, MONTH * 5 + 5);
  assert.equal(s.over, null);
  assert.ok(c.neg >= 5);
  run(s, MONTH);
  assert.deepEqual(s.over && s.over.co, 0);
  const h = hashState(s);
  assert.equal(hashState(deserialize(JSON.parse(JSON.stringify(serialize(s))))), h);
  c.loan = 20000; c.tr = [{ p: 20000, r: 180 }];
  assert.equal(cmd(s, 0, { type: 'continueSimple' }).ok, true);
  assert.equal(s.over, null);
  assert.equal(s.mode, 'simple');
  assert.ok(c.cash >= 30000 && c.loan === 0);
  run(s, MONTH * 3);
  assert.ok(c.cash >= 30000, 'nu mai plătește dobândă');
});

test('un AI falimentat iese din joc; cash pozitiv resetează numărătoarea', () => {
  const s = expert({ ai: [0] }), ai = s.companies[1];
  ai.cash = -50; ai.ai.cool = 99;
  run(s, MONTH * 3);
  assert.ok(ai.neg >= 2);
  ai.cash = 1000;
  run(s, MONTH);
  assert.equal(ai.neg, 0);
  ai.cash = -90000;
  run(s, MONTH * 7);
  assert.ok(ai.dead);
});

test('scenarii expert: variantă cu AI, avere netă și medalii', () => {
  const sc = scenarioById('carbune-x'), s = createScenarioWorld(sc);
  assert.ok(sc.expert && s.mode === 'expert' && s.companies.length === 3 && s.scn.id === 'carbune-x');
  assert.ok(scenarioById('retea-x').goals.some((g) => g.k === 'nw'));
  const nw = () => evaluate(s, sc).goals.find((g) => g.goal.k === 'nw');
  assert.equal(nw().tier, 0);
  s.companies[0].pw = 80000;
  assert.equal(nw().tier, 2);
  s.companies[0].pw = 400000;
  assert.equal(nw().tier, 3);
  run(s, 900);
  assert.equal(standings(s).length, 3);
});
