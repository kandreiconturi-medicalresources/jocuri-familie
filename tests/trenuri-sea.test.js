import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, createNetWorld, hashState, serialize, deserialize, applyCommand, stepWorld, planTrack, islandAt, islandGoods, coastSpot, seaPath, priceOf, basePrice, portCap, MATS, PORT, SHIP_MODELS, INDUSTRIES, G, NG, ERR_TEXT } from '../games/trenuri/src/sim/index.js';
import { createHub } from './trenuri-hub.js';

const ok = (r) => { assert.ok(r.ok, r.err); return r; };
const run = (s, n) => { for (let i = 0; i < n; i++) stepWorld(s); };
const world = (seed = 6) => createWorld({ seed, size: 'S', map: 'islands', year: 1950, ai: [1] });
/** Portul meu pe insula 0 și portul AI de pe insula 1. */
function ports(s, by = 0) {
  const p = coastSpot(s, s.islands.findIndex((q) => q.owner === by));
  const mine = ok(applyCommand(s, { type: 'buildPort', by, x: p.x, y: p.y })).id;
  const ai = s.stations.find((q) => q.port && q.owner !== by && s.companies[q.owner].ai).id;
  return { mine: s.stations.find((q) => q.id === mine), ai: s.stations.find((q) => q.id === ai) };
}
const lacking = (s) => { const mine = islandGoods(s, 0), theirs = islandGoods(s, 1); for (let g = 2; g < NG; g++) if (!mine[g] && theirs[g]) return g; return -1; };
const until = (s, f, max = 20000) => { for (let i = 0; i < max && !f(); i++) stepWorld(s); assert.ok(f(), 'condiția nu s-a îndeplinit'); };

test('vecinii: unii aproape (pod posibil), alții departe; drum pe apă între porturi', () => {
  const s = createWorld({ seed: 2, size: 'S', map: 'islands', year: 1950, ai: [1, 1, 1] });
  const gapX = (a, b) => { const A = s.islands[a], B = s.islands[b], y = (Math.max(A.y0, B.y0) + Math.min(A.y1, B.y1)) >> 1; let land = 0, n = 0; for (let x = A.x0; x <= B.x1; x++) { if (!s.water[y * s.w + x]) { if (land === 2) break; land = 1; } else if (land) { n++; land = 2; } } return n; };
  const g = gapX(0, 1);
  assert.ok(g >= 5 && g <= 12, 'primii vecini sunt aproape: ' + g);
  assert.equal(applyCommand(s, { type: 'buildPort', by: 0, x: s.islands[0].x0 + 15, y: s.islands[0].y0 + 15 }).err, 'port', 'în mijlocul insulei nu e apă');
  const { mine, ai } = ports(s);
  const p = seaPath(s, mine.dock, ai.dock);
  assert.ok(p && p.length > 5);
  assert.equal(p[0], mine.dock); assert.equal(p[p.length - 1], ai.dock);
  for (let i = 0; i < p.length; i++) { assert.ok(s.water[p[i]]); if (i) assert.ok(Math.abs((p[i] % s.w) - (p[i - 1] % s.w)) <= 1 && Math.abs(((p[i] / s.w) | 0) - ((p[i - 1] / s.w) | 0)) <= 1); }
});

test('vaporul cumpără din portul AI (bani la el) și descarcă în depozitul tău', () => {
  const s = world(), { mine, ai } = ports(s), g = lacking(s);
  assert.ok(g >= 2, 'există o marfă pe care n-o ai');
  assert.ok(ai.cargo[g] > 0, 'portul AI are marfă de pornire');
  const me = s.companies[0], aiCo = s.companies[ai.owner], p = priceOf(s, 1, g);
  aiCo.ai.cool = 9999; // AI-ul nu construiește în timpul testului: banii lui se schimbă doar din comerț
  assert.ok(priceOf(s, 0, g) > basePrice(g) && p > 0, 'ce lipsește la tine e scump la tine');
  const id = ok(applyCommand(s, { type: 'buyShip', by: 0, portId: mine.id, model: 1, route: [{ p: ai.id, a: 'load', g: [g] }, { p: mine.id, a: 'sell' }] })).id;
  const cash0 = me.cash, ai0 = aiCo.cash, stock0 = ai.cargo[g];
  until(s, () => mine.cargo[g] > 0);
  const n = mine.cargo[g];
  assert.equal(stock0 - ai.cargo[g] >= n || n > 0, true);
  assert.ok(aiCo.cash > ai0, 'AI-ul a primit bani (marfă + taxa de port)');
  assert.ok(me.cash < cash0, 'ai plătit marfa');
  assert.ok(s.ships.find((q) => q.id === id).money < 0);
  assert.equal(applyCommand(s, { type: 'sellShip', by: 1, shipId: id }).err, 'proprietar');
});

test('vânzare pe bani la portul altuia și schimb pe marfă', () => {
  const s = world(), { mine, ai } = ports(s), mineCan = islandGoods(s, 0);
  const theirs = islandGoods(s, 1), g = [...Array(NG).keys()].find((x) => x >= 2 && mineCan[x] && !theirs[x]), w = lacking(s);
  assert.ok(g >= 2, 'o marfă care lor le lipsește');
  mine.cargo[g] = 120; s.companies[ai.owner].ai.cool = 9999;
  const me = s.companies[0], cash0 = me.cash, price = priceOf(s, 1, g);
  const sid0 = ok(applyCommand(s, { type: 'buyShip', by: 0, portId: mine.id, model: 1, route: [{ p: mine.id, a: 'load', g: [g] }, { p: ai.id, a: 'sell' }] })).id;
  assert.equal(mine.cargo[g], 0, 'a încărcat tot');
  const before = ai.cargo[g];
  until(s, () => ai.cargo[g] > before);
  assert.equal(ai.cargo[g] - before, 120);
  const sold = s.ships.find((q) => q.id === sid0).money;
  assert.ok(sold >= ((120 * price * 2) / 3 | 0) && sold <= 120 * price * 2, 'vândut pe bani la prețul pieței: ' + sold);
  assert.ok(me.cash > cash0 - SHIP_MODELS[1].price, 'banii au venit la tine');

  const t = world(), P = ports(t);
  t.companies[P.ai.owner].ai.cool = 9999; P.ai.cargo[w] = 300; // fără trenuri AI care să golească depozitul
  P.mine.cargo[g] = 100;
  const sid = ok(applyCommand(t, { type: 'buyShip', by: 0, portId: P.mine.id, model: 1, route: [{ p: P.mine.id, a: 'load', g: [g] }, { p: P.ai.id, a: 'swap', w }] })).id;
  const sh = t.ships.find((q) => q.id === sid);
  until(t, () => sh.load.some((b) => b.c === w));
  const got = sh.load.find((b) => b.c === w).n;
  assert.ok(got > 0, 'a luat marfă la schimb');
  assert.ok(got <= Math.ceil((100 * basePrice(g) * 3) / Math.max(1, (basePrice(w) / 3) | 0)) && got <= SHIP_MODELS[1].cap);
  assert.ok(sh.money >= 0, 'schimbul s-a plătit din vânzare, nu din cash');
  assert.ok(!sh.load.some((b) => b.c === g), 'marfa ta s-a vândut');
  // „l”: după descărcarea în portul tău, vaporul încarcă și marfa de export din depozit
  P.mine.cargo[g] = 40;
  ok(applyCommand(t, { type: 'setShipRoute', by: 0, shipId: sid, route: [{ p: P.mine.id, a: 'sell', l: [g] }, { p: P.ai.id, a: 'sell' }] }));
  until(t, () => sh.dest === P.mine.id && sh.state === 1);
  assert.ok(!sh.load.some((b) => b.c === w) && P.mine.cargo[w] >= got, 'marfa adusă e în depozitul tău');
  assert.ok(sh.load.some((b) => b.c === g && b.n === 40), 'și a luat exportul');
  assert.equal(applyCommand(t, { type: 'setShipRoute', by: 0, shipId: sid, route: [{ p: 999, a: 'sell' }] }).err, 'vapor');
});

test('depozitul portului hrănește o fabrică prin tren', () => {
  const s = world(), { mine } = ports(s);
  const fab = s.industries.find((o) => islandAt(s, o.x, o.y) === 0 && INDUSTRIES[o.type].in.length);
  const g = INDUSTRIES[fab.type].in[0];
  let st = null;
  for (let d = 2; d <= 3 && !st; d++) for (const [x, y] of [[fab.x + d, fab.y], [fab.x - d, fab.y], [fab.x, fab.y + d], [fab.x, fab.y - d]]) {
    const r = applyCommand(s, { type: 'buildStation', by: 0, x, y, size: 1 });
    if (r.ok) { st = s.stations.find((q) => q.id === r.id); break; }
  }
  assert.ok(st, 'gară lângă fabrică');
  const plan = planTrack(s, [mine.x, mine.y], [st.x, st.y], 0, { level: true });
  assert.ok(plan, 'șină port → fabrică');
  ok(applyCommand(s, { type: 'buildTrack', by: 0, path: plan.path, level: plan.level }));
  mine.cargo[g] = 200;
  const in0 = fab.in[g] + fab.made;
  ok(applyCommand(s, { type: 'buyTrain', by: 0, model: 3, stationId: mine.id, route: [mine.id, st.id] }));
  until(s, () => fab.in[g] + fab.made > in0, 30000);
  assert.ok(mine.cargo[g] < 200, 'trenul a luat din depozit');
});

test('materiale: al doilea port și al doilea vapor cer marfă din depozit, consumată la construcție', () => {
  const s = world(), { mine } = ports(s);
  const p2 = (() => { const q = s.islands[0]; for (let y = q.y1; y >= q.y0; y--) for (let x = q.x1; x >= q.x0; x--) { const i = y * s.w + x; if (!s.water[i] && !s.occ[i] && !s.roads[i] && !s.track[i] && (s.water[i + 1] || s.water[i + s.w])) return { x, y }; } return null; })();
  const r = applyCommand(s, { type: 'buildPort', by: 0, x: p2.x, y: p2.y });
  assert.equal(r.err, 'material'); assert.ok(ERR_TEXT.material);
  assert.match(r.text, /Îți lipsesc 20 t cherestea/);
  assert.ok(s.news.some((n) => n.icon === '🧱'));
  for (const [g, n] of MATS.port) mine.cargo[g] = n + 3;
  ok(applyCommand(s, { type: 'buildPort', by: 0, x: p2.x, y: p2.y }));
  for (const [g] of MATS.port) assert.equal(mine.cargo[g], 3, 'materiale consumate');
  ok(applyCommand(s, { type: 'buyShip', by: 0, portId: mine.id, model: 0 }));
  assert.equal(applyCommand(s, { type: 'buyShip', by: 0, portId: mine.id, model: 0 }).err, 'material', 'al doilea vapor');
  mine.cargo[G.cherestea] = 15;
  ok(applyCommand(s, { type: 'buyShip', by: 0, portId: mine.id, model: 0 }));
  assert.equal(mine.cargo[G.cherestea], 0);
  assert.equal(applyCommand(s, { type: 'upgradeStation', by: 0, id: mine.id }).err, 'material', 'peronul nou cere materiale');
  assert.equal(portCap(mine), PORT.cap);
});

test('prețuri lunare: ce prisosește se ieftinește, ce lipsește e scump; port pe insula altuia refuzat', () => {
  const s = world(), { mine, ai } = ports(s), g = lacking(s);
  assert.ok(priceOf(s, 0, g) > basePrice(g), 'pe insula ta lipsește → scump');
  const p0 = priceOf(s, 0, g);
  mine.cargo[g] = portCap(mine);
  run(s, 10 * 30 * 3);
  assert.ok(priceOf(s, 0, g) < p0, 'cu depozitul plin prețul scade');
  for (const row of s.market) for (let x = 2; x < NG; x++) assert.ok(Number.isInteger(row[x]) && row[x] >= 1 && row[x] <= basePrice(x) * 3);
  const sp = coastSpot(s, 1);
  assert.equal(applyCommand(s, { type: 'buildPort', by: 0, x: sp.x, y: sp.y }).err, 'insula');
  assert.equal(applyCommand(s, { type: 'removeStation', by: 0, id: mine.id }).ok, true, 'portul fără vapoare se poate demola');
  assert.ok(ai.port);
});

function script(s) {
  const { mine, ai } = ports(s), g = lacking(s);
  mine.cargo[G.cherestea] = 50;
  ok(applyCommand(s, { type: 'buyShip', by: 0, portId: mine.id, model: 1, route: [{ p: mine.id, a: 'load', g: [G.cherestea] }, { p: ai.id, a: 'swap', w: g }] }));
}

test('determinism: serializare la mijloc, aceleași hash-uri', () => {
  const a = world(), b = world();
  script(a); script(b);
  run(a, 1500); run(b, 1500);
  const c = deserialize(serialize(b));
  assert.equal(hashState(c), hashState(b));
  run(a, 4000); run(c, 4000);
  assert.equal(hashState(a), hashState(c));
  assert.ok(a.ships[0].money !== 0 || a.ships[0].load.length, 'vaporul a făcut comerț');
});

test('lockstep cu 3 noduri: port, vapor și rută, hash-uri identice', async () => {
  const PL = [{ id: 'a', name: 'Ana', color: '#ff6b6b' }, { id: 'b', name: 'Bob', color: '#4dabf7' }, { id: 'c', name: 'Cip', color: '#ffd23f' }];
  const cfg = { mode: 'comp', seed: 9, size: 'S', year: 1950, map: 'islands', ai: [1], players: PL };
  const probe = createNetWorld(cfg), spA = coastSpot(probe, 0), spB = coastSpot(probe, 1);
  const pa = ok(applyCommand(probe, { type: 'buildPort', by: 0, x: spA.x, y: spA.y })).id;
  const pb = ok(applyCommand(probe, { type: 'buildPort', by: 1, x: spB.x, y: spB.y })).id;
  const hub = createHub({ latency: 0.1 });
  const nodes = PL.map((p) => hub.add(p.id, { world: createNetWorld(cfg), hostId: 'a', speed: 4, raw: false }));
  const [n1, n2, n3] = nodes;
  await hub.run(1); n1.submit({ type: 'buildPort', x: spA.x, y: spA.y });
  await hub.run(0.5); n2.submit({ type: 'buildPort', x: spB.x, y: spB.y });
  await hub.run(0.5); n3.submit({ type: 'buildPort', x: spA.x + 1, y: spA.y }); // refuzat: insula Anei
  await hub.run(0.5); n1.submit({ type: 'buyShip', portId: pa, model: 1, route: [{ p: pa, a: 'load', g: [] }, { p: pb, a: 'sell' }] });
  let k = 0;
  while (n1.world.tick < 3000 && k++ < 5000) await hub.run(0.05);
  n1.setSpeed(0); await hub.run(8);
  assert.equal(n1.world.ships.length, 1, 'vaporul există');
  assert.equal(n1.world.stations.filter((q) => q.port).length, 3, '2 porturi noi + portul AI');
  const hs = nodes.map((n) => hashState(n.world));
  assert.ok(hs.every((h) => h === hs[0]), 'hash-uri diferite: ' + hs);
});
