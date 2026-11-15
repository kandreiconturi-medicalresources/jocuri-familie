// Turbo Curse: simularea pură (fără Three/DOM): fizică, ture/checkpoint-uri, piste, boți.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCar, stepCar, NO_INPUT } from '../games/curse/src/sim/car.js';
import { createRace, stepRace, CHECKPOINTS } from '../games/curse/src/sim/race.js';
import { botControls, createBot } from '../games/curse/src/sim/ai.js';
import { createTrack, V_TOP } from '../games/curse/src/tracks/track.js';
import { TRACKS } from '../games/curse/src/tracks/tracks.js';
import { walk, isClosed, overlaps } from '../games/curse/src/tracks/layout.js';
import { ROAD_HALF } from '../games/curse/src/tracks/pieces.js';

const DT = 1 / 60;
const track0 = createTrack(TRACKS[0]);
const ctl = (o) => ({ ...NO_INPUT, ...o });
/** Începutul celei mai lungi drepte a pistei. */
function longestStraight(track) {
  let best = 0, bi = 0, run = 0;
  for (let i = 0; i < 2 * track.n; i++) {
    run = Math.abs(track.pts[i % track.n].k) < 1e-3 ? run + 1 : 0;
    if (run > best) { best = run; bi = (i - run + 2) % track.n; }
  }
  return bi;
}
const S0 = longestStraight(track0);
/** O mașină la începutul celei mai lungi drepte (fără cursă), cu viteza `v`. */
function onStraight(v = 0, track = track0) {
  const i0 = S0, p = track.pts[i0];
  const car = createCar('t', { x: p.x, z: p.z, angle: Math.atan2(p.tx, -p.tz), s: p.s, i: i0 }, track);
  car.vx = Math.sin(car.angle) * v; car.vz = -Math.cos(car.angle) * v;
  return car;
}
const run = (car, c, sec, track = track0) => { for (let i = 0; i < sec * 60; i++) stepCar(car, c, track, DT, true); return car; };

test('mașina accelerează și frânează', () => {
  const car = run(onStraight(), ctl({ throttle: 1 }), 3);
  assert.ok(car.speed > 20, 'viteza după 3 s: ' + car.speed);
  assert.ok(car.speed <= V_TOP + 0.5);
  run(car, ctl({ brake: 1 }), 2);
  assert.ok(car.speed < 1);
});

test('mașina virează (dreapta și stânga), mai puțin la viteză mare', () => {
  const r = run(onStraight(15), ctl({ throttle: 1, steer: 1 }), 0.6), a0 = onStraight(15).angle;
  assert.ok(r.angle - a0 > 0.5, 'dreapta');
  const l = run(onStraight(15), ctl({ throttle: 1, steer: -1 }), 0.6);
  assert.ok(l.angle - a0 < -0.5, 'stânga');
  const slow = run(onStraight(8), ctl({ steer: 1 }), 0.5), fast = run(onStraight(28), ctl({ throttle: 1, steer: 1 }), 0.5);
  assert.ok(slow.angle - a0 > fast.angle - a0, 'virajul scade cu viteza');
});

test('driftul derapează și umple nitro; nitro dă +40% viteză', () => {
  const a = onStraight(22), b = onStraight(22);
  run(a, ctl({ throttle: 1, steer: 1 }), 0.6);
  run(b, ctl({ throttle: 1, steer: 1, drift: true }), 0.6);
  assert.ok(b.drift > 0.9, 'drift activ');
  assert.ok(Math.abs(b.slip) > Math.abs(a.slip) * 2 + 1, `derapaj ${b.slip} vs ${a.slip}`);
  assert.ok(b.nitro > 0.15 && a.nitro < b.nitro, 'nitro umplut: ' + b.nitro);
  const long = onStraight(22);
  for (let i = 0; i < 4; i++) { run(long, ctl({ throttle: 1, steer: 1, drift: true }), 0.5); run(long, ctl({ throttle: 1, steer: -1, drift: true }), 0.5); }
  assert.ok(long.nitro > 0.3, 'nitro după drifturi: ' + long.nitro);
  const c = onStraight(25); c.nitro = 1;
  run(c, ctl({ throttle: 1, nitro: true }), 1.4);
  assert.ok(c.boost > 0 && c.speed > V_TOP * 1.2, 'nitro: ' + c.speed);
  run(c, ctl({ throttle: 1 }), 4);
  assert.equal(c.boost <= 0, true);
});

test('ieșirea de pe pistă încetinește', () => {
  const on = onStraight(0), off = onStraight(0);
  const nx = -off.vz, p = track0.pts[off.i];
  off.x += -p.tz * -9; off.z += p.tx * -9; // 9 m în stânga liniei (peste marginea de 5 m)
  void nx;
  run(on, ctl({ throttle: 1 }), 5); run(off, ctl({ throttle: 1 }), 5);
  assert.ok(off.off, 'e în afara pistei');
  assert.ok(off.speed < on.speed * 0.6, `iarbă ${off.speed} vs asfalt ${on.speed}`);
  assert.ok(ROAD_HALF < 5);
});

test('turele și checkpoint-urile nu se pot păcăli mergând înapoi sau teleportând', () => {
  const race = createRace({ track: track0, laps: 3, entries: [{ id: 'h', name: 'H', color: 'Red' }], seed: 3 });
  const car = race.byId.h;
  race.t = 0; race.phase = 'go';
  for (let i = 0; i < 60 * 12; i++) stepRace(race, { h: ctl({ brake: 1 }) }, DT); // marșarier în spatele liniei
  assert.equal(car.lap, 0); assert.equal(car.cp, 0); assert.ok(car.maxProg < 0);
  // teleportare la jumătatea pistei: nu dă progres
  const before = car.maxProg;
  const mid = track0.pts[Math.floor(track0.n / 2)];
  car.x = mid.x; car.z = mid.z;
  for (let i = 0; i < 30; i++) stepRace(race, { h: ctl({}) }, DT);
  assert.equal(car.lap, 0); assert.ok(car.maxProg < before + track0.length * 0.3, 'fără salt de progres');
  assert.equal(car.cp < CHECKPOINTS, true);
  // un tur drept: 8 checkpoint-uri, apoi tura 1; mersul înapoi peste linie nu mai adaugă nimic
  const r2 = createRace({ track: track0, laps: 3, entries: [{ id: 'h', name: 'H', color: 'Red', bot: true, level: 'hard' }], seed: 4 });
  const h = r2.byId.h;
  let steps = 0;
  while (h.lap < 1 && steps++ < 60 * 90) stepRace(r2, {}, DT);
  assert.equal(h.lap, 1); assert.equal(h.cp, CHECKPOINTS);
  const keep = { lap: h.lap, cp: h.cp, max: h.maxProg };
  h.bot = false; // acum îl conducem noi, înapoi
  for (let i = 0; i < 60 * 6; i++) stepRace(r2, { h: ctl({ brake: 1 }) }, DT);
  assert.equal(h.lap, keep.lap); assert.ok(h.cp <= keep.cp + 0 + 1);
  assert.ok(h.maxProg >= keep.max);
});

test('cele 8 piste: traseu închis, fără suprapuneri (în afară de pod), capătul se leagă de start', () => {
  assert.equal(TRACKS.length, 8);
  TRACKS.forEach((def, k) => {
    const w = walk(def.tokens);
    assert.ok(isClosed(w.end), def.id + ': capătul nu se leagă de start');
    assert.deepEqual(overlaps(w.placed), [], def.id + ': celule suprapuse');
    assert.ok(/^ss/.test(def.tokens), def.id + ': grila de start');
    const cells = new Map();
    w.placed.forEach((p) => p.cells.forEach(([x, z]) => cells.set(x + ',' + z, (cells.get(x + ',' + z) || 0) + 1)));
    const doubles = [...cells.values()].filter((v) => v > 1).length;
    assert.equal(doubles, def.tokens.includes('b') ? 1 : 0, def.id + ': podul traversează o singură dată');
    const t = createTrack(def);
    // linia centrală: ultimul punct se leagă de primul fără salt, cu aceeași direcție
    const a = t.pts[t.n - 1], b = t.pts[0];
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < t.ds * 1.5, def.id + ': salt la închidere');
    assert.ok(a.tx * b.tx + a.tz * b.tz > 0.99, def.id + ': direcție la închidere');
    // nicio suprapunere a liniei cu ea însăși (în afară de pod: acolo diferența de înălțime e mare)
    const gap = Math.ceil(30 / t.ds);
    for (let i = 0; i < t.n; i++) {
      for (let j = i + gap; j < t.n; j++) {
        if (t.n - (j - i) < gap) continue;
        const p = t.pts[i], q = t.pts[j];
        if (Math.hypot(p.x - q.x, p.z - q.z) < 2 * ROAD_HALF && Math.abs(p.y - q.y) < 3) assert.fail(def.id + ': drumul se suprapune la ' + i + ' / ' + j);
      }
    }
    if (k > 0) assert.ok(t.length > 500, def.id + ' lungime');
  });
  const pod = createTrack(TRACKS.find((d) => d.id === 'pod'));
  assert.ok(Math.max(...pod.pts.map((p) => p.y)) > 4, 'podul are înălțime');
});

test('4 boți termină 3 ture pe fiecare pistă, fără să rămână blocați', () => {
  for (const def of TRACKS) {
    const track = createTrack(def);
    const race = createRace({ track, laps: 3, seed: 11, entries: ['easy', 'mid', 'hard', 'hard'].map((level, i) => ({ id: 'b' + i, name: 'B' + i, color: 'Red', bot: true, level })) });
    const still = { b0: 0, b1: 0, b2: 0, b3: 0 };
    let worst = 0, n = 0;
    while (!race.done && n < 60 * 60 * 6) {
      stepRace(race, {}, DT); n++;
      if (race.t < 5) continue;
      for (const c of race.cars) {
        still[c.id] = Math.abs(c.speed) < 1.2 && !c.finished ? still[c.id] + DT : 0;
        worst = Math.max(worst, still[c.id]);
      }
    }
    assert.ok(race.done, def.id + ': cursa nu s-a terminat în 6 minute');
    assert.ok(race.cars.every((c) => c.finished && c.lap === 3), def.id + ': nu au terminat toți');
    assert.ok(worst < 2.5, `${def.id}: blocat ${worst.toFixed(1)} s`);
    assert.deepEqual(race.order.slice().sort(), ['b0', 'b1', 'b2', 'b3']);
  }
});

test('boții au caractere diferite și comenzi valide', () => {
  const a = createBot('easy', () => 0.3), b = createBot('hard', () => 0.3);
  assert.ok(a.skill < b.skill);
  const car = onStraight(10);
  const c = botControls(b, car, track0, 0);
  assert.ok(Math.abs(c.steer) <= 1 && (c.throttle === 0 || c.throttle === 1));
});
