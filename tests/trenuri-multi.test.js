// Gara mare de trecere cu linii independente (`st.ln`): fiecare linie are peronul ei, deci n trenuri pe n șine opresc deodată
// și pleacă fără să rezerve plăci ale altor linii; toate peroanele sunt aceeași gară. Plus culoarul, intrarea comună și salvările vechi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, hashState, serialize, deserialize, applyCommand, stepWorld } from '../games/trenuri/src/sim/index.js';
import { corInfo } from '../games/trenuri/src/sim/corridor.js';
import { frameOf } from '../games/trenuri/src/sim/terminal.js';
import { platsOf, laneOfTile, FAN_AT } from '../games/trenuri/src/sim/laneGeo.js';
import { deriveLayers } from '../games/trenuri/src/sim/roads.js';

const ok = (r) => { assert.ok(r.ok, r.err); return r; };
const cmd = (s, c) => applyCommand(s, { by: 0, ...c });
/** Lume plată; orașul 0 la (40,30) cu câteva case. */
function world() {
  const s = createWorld({ seed: 4, size: 'M', year: 1960 });
  s.height.fill(8); s.water.fill(0); s.forest.fill(0); s.industries.length = 0;
  s.cities.forEach((c, i) => { c.x = 2 + i * 3; c.y = 90; c.buildings = []; });
  const c = s.cities[0];
  c.x = 40; c.y = 30; c.pop = 900;
  for (const [x, y] of [[39, 38], [40, 38], [41, 38], [38, 39], [42, 39]]) c.buildings.push([x, y, 2, 0]);
  deriveLayers(s);
  s.companies[0].cash = 5000000;
  return s;
}
const lineTo = (x0, y0, x1) => { const p = []; for (let x = x0; x <= x1; x++) p.push([x, y0]); return p; };
const feed = (s) => { if (s.tick % 10 === 0) for (const q of s.stations) q.waiting.pass = 100; };
/** Capătul de est al liniei de pe rândul y (cea mai îndepărtată placă de șină de la x0 încolo). */
const eastEnd = (s, y, x0) => { for (let x = s.w - 1; x > x0; x--) if (s.track[y * s.w + x] & 0x4000) return [x, y]; return null; };

/** n șine separate: fiecare capăt de est al gării T primește o linie dreaptă spre o gară mică proprie și un tren [mică, T]. */
function feeders(s, st) {
  const f = frameOf(st.dir), out = [];
  for (let k = 0; k < st.platforms; k++) {
    const y = st.y + f.cy * k, [x] = eastEnd(s, y, st.x);
    ok(cmd(s, { type: 'buildTrack', path: lineTo(x, y, x + 10) }));
    const r = ok(cmd(s, { type: 'buildStation', x: x + 10, y, size: 0 })).id;
    const id = ok(cmd(s, { type: 'buyTrain', model: 3, kinds: [0, 1], stationId: r, route: [r, st.id] })).id;
    out.push({ k, r, t: s.trains.find((q) => q.id === id), visits: 0 });
  }
  return out;
}
/** Rulează și verifică: toate opresc deodată, fiecare pe peronul liniei lui, niciun tren nu ține plăci de pe alt rând al gării. */
function runLanes(s, st, fs, ticks = 2500) {
  let most = 0, plats = null, wrong = 0;
  const T = st.id;
  for (let i = 0; i < ticks; i++) {
    feed(s); stepWorld(s);
    const here = fs.filter((q) => q.t.state === 2 && q.t.to === T);
    for (const q of fs) {
      if (q.t.state === 2 && q.t.to === T && !q.in) { q.in = 1; q.visits++; } else if (q.t.state !== 2 || q.t.to !== T) q.in = 0;
      for (const j of q.t.rv) { const k = laneOfTile(s, st, j), x = j % s.w; if (Math.abs(x - st.x) < 20 && k !== q.k) wrong++; }
    }
    if (here.length > most) { most = here.length; plats = here.map((q) => q.t.path[q.t.path.length - 1]); }
  }
  return { most, plats, wrong };
}

test('gară de trecere cu 5 linii separate: 5 trenuri pe 5 șine opresc simultan, fiecare pe peronul lui, și pleacă fără blocaj', () => {
  const s = world();
  const id = ok(cmd(s, { type: 'buildThru', x: 40, y: 36, n: 5, dir: 0 })).id, st = s.stations.find((q) => q.id === id);
  assert.equal(st.ln, 1, 'liniile independente');
  const P = platsOf(s, st);
  assert.equal(new Set(P).size, 5);
  assert.ok(P.every((i) => s.stm[i] && s.stAt[i] === id + 1), 'fiecare peron e un loc al aceleiași gări');
  const fs = feeders(s, st);
  const r = runLanes(s, st, fs);
  assert.equal(r.most, 5, 'toate 5 oprite în gară deodată');
  assert.equal(new Set(r.plats).size, 5, 'pe 5 peroane diferite');
  assert.deepEqual([...r.plats].sort((a, b) => a - b), [...P].sort((a, b) => a - b));
  assert.equal(r.wrong, 0, 'niciun tren nu rezervă plăci ale altei linii');
  assert.ok(fs.every((q) => q.visits >= 3), 'au venit de mai multe ori, nimic nu s-a blocat: ' + fs.map((q) => q.visits));
  assert.ok(fs.every((q) => q.t.money > 0), 'toate au câștigat');
});

test('tren pe linia 2 nu rezervă nicio placă a liniei 1; pasagerii de pe orice peron sunt ai aceleiași gări', () => {
  const s = world();
  const id = ok(cmd(s, { type: 'buildThru', x: 40, y: 36, n: 3, dir: 0 })).id, st = s.stations.find((q) => q.id === id);
  const fs = feeders(s, st), P = platsOf(s, st), lane1 = new Set();
  for (let a = -FAN_AT - 1; a <= FAN_AT + 1; a++) lane1.add((st.y - 1) * s.w + st.x + a);
  let seen = 0, loads = 0;
  for (let i = 0; i < 1500; i++) {
    feed(s); stepWorld(s);
    const t2 = fs[2].t;
    assert.ok(!t2.rv.some((j) => lane1.has(j)), 'trenul liniei 2 ține o placă a liniei 1');
    for (const q of fs) if (q.t.state === 2 && q.t.to === id) {
      seen |= 1 << P.indexOf(q.t.path[q.t.path.length - 1]);
      for (const b of q.t.load) if (b.from === id) loads |= 1 << q.k;
    }
  }
  assert.equal(seen, 7, 'trenurile au stat pe toate cele 3 peroane');
  assert.equal(loads, 7, 'pasagerii luați de pe fiecare peron vin din aceeași gară (from = id-ul gării)');
  assert.ok(fs.every((q) => q.t.route.includes(id)));
});

test('culoarul cu 5 linii: 5 trenuri opresc deodată în singura gară și pleacă independent', () => {
  const s = world(), c = s.cities[0];
  const info = corInfo(s, 0, 0, 'h', 'centru', 5);
  assert.ok(info.ok, info.err);
  const id = ok(cmd(s, { type: 'buildCorridor', city: 0, axis: 'h', side: 'centru', n: 5, dir: info.dir })).id, st = s.stations.find((q) => q.id === id);
  assert.equal(st.ln, 1); assert.ok(st.cor > 0);
  void c;
  const fs = feeders(s, st);
  const r = runLanes(s, st, fs, 3000);
  assert.equal(r.most, 5, 'toate 5 oprite în gara culoarului deodată');
  assert.equal(new Set(r.plats).size, 5);
  assert.equal(r.wrong, 0);
  assert.ok(fs.every((q) => q.visits >= 2 && q.t.money > 0), 'fără blocaj: ' + fs.map((q) => q.visits));
});

test('determinism: serializare la mijloc cu 5 trenuri pe linii separate', () => {
  const mk = (n) => { const s = world(); const id = ok(cmd(s, { type: 'buildThru', x: 40, y: 36, n: 5, dir: 0 })).id; feeders(s, s.stations.find((q) => q.id === id)); for (let i = 0; i < n; i++) { feed(s); stepWorld(s); } return s; };
  const full = mk(1400), half = mk(500);
  const s2 = deserialize(JSON.parse(JSON.stringify(serialize(half))));
  assert.equal(hashState(s2), hashState(half));
  assert.ok(!('stAt' in serialize(half)), 'stratul peroanelor nu se salvează (se refac la încărcare)');
  for (let i = 500; i < 1400; i++) { feed(s2); stepWorld(s2); }
  assert.equal(hashState(s2), hashState(full));
});

test('intrarea comună (join) merge ca înainte: o placă de gară cu n peroane', () => {
  const s = world();
  const id = ok(cmd(s, { type: 'buildThru', x: 40, y: 36, n: 4, dir: 0, join: true })).id, st = s.stations.find((q) => q.id === id), i0 = 36 * s.w + 40;
  assert.ok(!st.ln && !st.sep);
  assert.deepEqual(platsOf(s, st), [i0]);
  assert.ok(!s.stAt.some((v) => v === id + 1), 'fără peroane separate');
  ok(cmd(s, { type: 'buildTrack', path: lineTo(20, 36, 70) }));
  const a = ok(cmd(s, { type: 'buildStation', x: 20, y: 36, size: 1 })).id, b = ok(cmd(s, { type: 'buildStation', x: 70, y: 36, size: 1 })).id;
  const trs = [a, b, a, b].map((r) => { const tid = ok(cmd(s, { type: 'buyTrain', model: 3, kinds: [0], stationId: r, route: [r, id] })).id; return s.trains.find((t) => t.id === tid); });
  let most = 0;
  for (let i = 0; i < 2500; i++) {
    feed(s); stepWorld(s);
    most = Math.max(most, s.pocc[i0]);
    for (const t of trs) if (t.state === 2 && t.to === id) assert.equal(t.path[t.path.length - 1], i0, 'oprește pe placa gării');
  }
  assert.ok(most >= 2 && most <= 4, 'mai multe trenuri pe placa gării, cel mult 4: ' + most);
  assert.ok(trs.every((t) => t.money > 0));
});

test('salvare veche (intrări separate fără linii independente) primește liniile la încărcare', () => {
  const s = world();
  const id = ok(cmd(s, { type: 'buildThru', x: 40, y: 36, n: 4, dir: 0 })).id, st = s.stations.find((q) => q.id === id);
  const track = Uint16Array.from(s.track), f = frameOf(0), w = s.w;
  const old = JSON.parse(JSON.stringify(serialize(s))), o = deserialize(old);
  const ost = o.stations.find((q) => q.id === id);
  for (let k = 1; k < 4; k++) for (const e of [-1, 1]) { // scoate liniile drepte din gară: ca înainte, liniile se strâng în linia principală
    for (let a = 0; a < FAN_AT + k; a++) o.track[(st.y + f.cy * k) * w + st.x + e * a] = 0;
    o.track[(st.y + f.cy * k) * w + st.x + e * (FAN_AT + k)] &= ~(1 << (e > 0 ? 6 : 2));
  }
  delete ost.ln;
  const back = deserialize(JSON.parse(JSON.stringify(serialize(o))));
  const bst = back.stations.find((q) => q.id === id);
  assert.equal(bst.ln, 1, 'gara are acum liniile independente');
  assert.ok(back.track.every((v, i) => v === track[i]), 'aceeași șină ca la gara nouă');
  assert.equal(hashState(back), hashState(s));
  const fs = feeders(back, bst);
  assert.equal(runLanes(back, bst, fs, 1500).most, 4, 'după încărcare 4 trenuri opresc deodată');
});
