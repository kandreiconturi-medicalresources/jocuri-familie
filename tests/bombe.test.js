import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, step, startRound } from '../games/bombe/src/logic/match.js';
import { W, idx, ROUND_STEPS, SHRINK_AT, END_DELAY, WALL, CRATE } from '../games/bombe/src/logic/rules.js';
import { ARENAS } from '../games/bombe/src/logic/arenas.js';
import { packSnap, applySnap } from '../games/bombe/src/net/snap.js';
import { createPlay } from '../games/bombe/src/play.js';
import { rng } from '../shared/engine/rng.js';

const P = (id, bot = false, level = 'easy') => ({ id, name: id, avatar: 'bear', color: '#f00', bot, level });
const dump = (s) => JSON.stringify({ g: [...s.grid], k: [...s.pick], p: s.players, b: s.bombs, f: s.flames, t: s.tick, ph: s.phase });

/** Arenă goală (fără lăzi), jucători mutați din calea exploziilor. */
function empty(rules = { gentle: false, rounds: 3 }, ids = ['a', 'b'], arenaId = 0) {
  const s = createMatch({ arenaId, players: ids.map((i) => P(i)), seed: 7, rules });
  for (let i = 0; i < s.grid.length; i++) if (s.grid[i] === CRATE) s.grid[i] = 0;
  s.loot.fill(0); s.pick.fill(0);
  return s;
}
const bomb = (s, x, y, o = 'a', t = 1, r = 2) => { s.bombs.push({ x, y, o, t, r, dx: 0, dy: 0, mt: 0, pass: [] }); s.players.find((p) => p.id === o).bombs++; };
const flameCells = (s) => new Set(s.flames.map((f) => f.i));
const at = (s, id, x, y) => { const p = s.players.find((q) => q.id === id); p.x = x + 0.5; p.y = y + 0.5; return p; };

test('determinism: același seed și aceleași input-uri dau aceeași stare', () => {
  const run = (seed) => {
    const s = createMatch({ arenaId: 3, players: [P('a'), P('b'), P('c', true, 'mid'), P('d', true, 'hard')], seed, rules: { gentle: false } });
    const r = rng(99);
    for (let i = 0; i < 700; i++) step(s, { a: { dx: r.int(-1, 1), dy: r.int(-1, 1), bomb: r.chance(0.1) }, b: { dx: r.int(-1, 1), dy: 0, bomb: r.chance(0.05) } });
    return dump(s);
  };
  assert.equal(run(5), run(5));
  assert.notEqual(run(5), run(6));
});

test('grila: pereți fixi, colțuri libere, 8 arene', () => {
  assert.equal(ARENAS.length, 8);
  for (const a of ARENAS) {
    const s = createMatch({ arenaId: a.id, players: [P('a'), P('b')], seed: 3 });
    assert.equal(s.grid[idx(0, 5)], WALL);
    assert.equal(s.grid[idx(2, 2)], WALL);
    for (const [x, y] of [[1, 1], [2, 1], [1, 2], [13, 11], [12, 11], [13, 10]]) assert.notEqual(s.grid[idx(x, y)], CRATE);
  }
});

test('explozia e în cruce și e oprită de pereți', () => {
  const s = empty();
  at(s, 'a', 1, 1); at(s, 'b', 13, 11);
  bomb(s, 5, 6); // (4,6) și (6,6) sunt pereți
  step(s);
  assert.deepEqual([...flameCells(s)].sort((x, y) => x - y), [idx(5, 4), idx(5, 5), idx(5, 6), idx(5, 7), idx(5, 8)]);
  assert.equal(s.bombs.length, 0);
  assert.equal(s.players[0].bombs, 0);
});

test('explozie în lanț', () => {
  const s = empty();
  at(s, 'a', 13, 1); at(s, 'b', 13, 11);
  bomb(s, 1, 5, 'a', 1); bomb(s, 3, 5, 'b', 60);
  const ev = step(s);
  assert.equal(ev.filter((e) => e.e === 'explode').length, 2);
  assert.ok(flameCells(s).has(idx(5, 5)), 'a doua bombă a explodat imediat');
  assert.equal(s.bombs.length, 0);
});

test('lada se sparge, oprește flacăra și lasă bonus', () => {
  const s = empty();
  at(s, 'a', 13, 1); at(s, 'b', 13, 11);
  s.grid[idx(5, 4)] = CRATE; s.loot[idx(5, 4)] = 2;
  bomb(s, 5, 5, 'a', 1, 3);
  const ev = step(s);
  assert.equal(s.grid[idx(5, 4)], 0);
  assert.ok(flameCells(s).has(idx(5, 4)) && !flameCells(s).has(idx(5, 3)));
  assert.ok(ev.some((e) => e.e === 'crate' && e.x === 5 && e.y === 4));
  assert.equal(s.pick[idx(5, 4)], 2);
});

test('bonusurile se iau și au efect', () => {
  const s = empty();
  const p = s.players[0];
  const take = (kind) => { s.pick[idx(3, 1)] = kind; at(s, 'a', 3, 1); return step(s); };
  take(1); assert.equal(p.maxBombs, 2);
  take(2); assert.equal(p.range, 3);
  take(3); assert.equal(p.spd, 1);
  const ev = take(4); assert.ok(p.kick && ev.some((e) => e.e === 'pickup'));
  take(5); assert.equal(p.shield, 1);
  assert.equal(s.pick[idx(3, 1)], 0);
});

test('flacăra distruge bonusul vechi, dar nu pe cel scăpat de lada spartă', () => {
  const s = empty();
  at(s, 'a', 13, 1); at(s, 'b', 13, 11);
  s.pick[idx(5, 7)] = 3;
  bomb(s, 5, 5, 'a', 1, 2);
  step(s);
  assert.equal(s.pick[idx(5, 7)], 0);
});

test('modul blând: scut la start și bomba proprie nu rănește', () => {
  const s = empty({ gentle: true, rounds: 3 });
  assert.equal(s.players[0].shield, 1);
  const a = s.players[0], b = s.players[1];
  a.shield = 0; a.inv = 0; b.shield = 0; b.inv = 0;
  at(s, 'a', 5, 5); at(s, 'b', 13, 11);
  bomb(s, 5, 5, 'a', 1);
  step(s);
  assert.ok(a.alive, 'bomba proprie nu-l rănește');
  at(s, 'b', 5, 5); bomb(s, 5, 5, 'a', 1);
  step(s);
  assert.ok(!b.alive, 'bomba altcuiva rănește');
});

test('modul normal: bomba proprie rănește; scutul iartă o atingere', () => {
  const s = empty({ gentle: false, rounds: 3 });
  const a = s.players[0];
  a.shield = 1; a.inv = 0;
  at(s, 'a', 5, 5); at(s, 'b', 13, 11);
  bomb(s, 5, 5, 'a', 1);
  const ev = step(s);
  assert.ok(a.alive && a.shield === 0 && a.inv > 0 && ev.some((e) => e.e === 'shield'));
  bomb(s, 5, 5, 'a', 1);
  for (let i = 0; i < 60; i++) step(s); // ies din invulnerabilitate
  a.inv = 0; bomb(s, 5, 5, 'a', 1);
  step(s);
  assert.ok(!a.alive);
});

test('final de rundă: ultimul rămas câștigă; la egalitate nimeni', () => {
  const s = empty({ gentle: false, rounds: 3 });
  at(s, 'a', 13, 1); at(s, 'b', 5, 5);
  bomb(s, 5, 5, 'a', 1);
  let ev = [];
  for (let i = 0; i < END_DELAY + 3; i++) ev = ev.concat(step(s));
  assert.equal(s.phase, 'round_end');
  assert.equal(s.winner, 'a');
  assert.equal(s.players[0].score, 1);
  assert.ok(ev.some((e) => e.e === 'out') && ev.some((e) => e.e === 'round'));
  startRound(s);
  assert.equal(s.round, 2); assert.equal(s.phase, 'play'); assert.ok(s.players.every((p) => p.alive));

  const d = empty({ gentle: false, rounds: 3 });
  at(d, 'a', 5, 5); at(d, 'b', 5, 4);
  bomb(d, 5, 5, 'a', 1);
  for (let i = 0; i < END_DELAY + 3; i++) step(d);
  assert.equal(d.phase, 'round_end'); assert.equal(d.winner, null);
  assert.deepEqual(d.players.map((p) => p.score), [0, 0]);
});

test('final de meci: primul la N runde', () => {
  const s = empty({ gentle: false, rounds: 1 });
  at(s, 'a', 13, 1); at(s, 'b', 5, 5);
  bomb(s, 5, 5, 'a', 1);
  let ev = [];
  for (let i = 0; i < END_DELAY + 3; i++) ev = ev.concat(step(s));
  assert.equal(s.phase, 'match_end');
  assert.equal(s.matchWinner, 'a');
  assert.ok(ev.some((e) => e.e === 'match'));
  assert.deepEqual(step(s), []);
});

test('timp scurs: arena se strânge, iar la 2 minute runda se termină fără câștigător', () => {
  const s = empty({ gentle: false, rounds: 3 });
  at(s, 'a', 7, 6); at(s, 'b', 7, 7);
  s.tick = SHRINK_AT - 1;
  const blocks = () => [...s.grid].filter((g) => g === WALL).length;
  const before = blocks();
  for (let i = 0; i < 60; i++) step(s, { a: { dx: 0, dy: 0 } });
  assert.ok(blocks() > before);
  s.tick = ROUND_STEPS - 1;
  s.shrinkI = 9999;
  step(s);
  assert.equal(s.phase, 'round_end'); assert.equal(s.winner, null);
});

test('mișcare: pereții blochează; bomba pusă nu te blochează, dar după ce ieși devine perete', () => {
  const s = empty();
  at(s, 'a', 1, 1); at(s, 'b', 13, 11);
  for (let i = 0; i < 40; i++) step(s, { a: { dx: 0, dy: -1 } });
  assert.ok(s.players[0].y > 1.3);
  step(s, { a: { dx: 0, dy: 0, bomb: true } });
  assert.equal(s.bombs.length, 1);
  for (let i = 0; i < 12; i++) step(s, { a: { dx: 1, dy: 0 } });
  const x1 = s.players[0].x;
  for (let i = 0; i < 12; i++) step(s, { a: { dx: -1, dy: 0 } });
  assert.ok(s.players[0].x > 2.3 && x1 > 2.3, 'bomba blochează întoarcerea');
});

const NO = { gentle: false, rounds: 3, kickAll: false };
const hold = (s, id, n, inp) => { for (let i = 0; i < n; i++) step(s, { [id]: inp }); };
const tap = (s, id, inp) => { step(s, { [id]: inp }); step(s, { [id]: { ...inp, bomb: false, b: false } }); };

test('șut: mergând în bombă o împingi și alunecă până la obstacol; fără șut nu se mișcă', () => {
  const s = empty(NO);
  at(s, 'a', 2, 1); at(s, 'b', 13, 11);
  bomb(s, 3, 1, 'a', 300);
  hold(s, 'a', 20, { dx: 1, dy: 0 });
  assert.equal(s.bombs[0].x, 3, 'fără șut bomba rămâne');
  s.players[0].kick = true;
  hold(s, 'a', 60, { dx: 1, dy: 0 });
  assert.equal(s.bombs[0].x, 13, 'alunecă până la zidul din dreapta');
  assert.ok(s.players[0].x < 12.5);
  const g = empty({ gentle: true, rounds: 3 });
  assert.ok(g.players.every((p) => p.kick) && g.rules.kickAll, 'în modul blând toți pot șuta');
  assert.ok(!empty(NO).players[0].kick);
});

test('bonusuri: maxim 8 bombe și rază 8; scutul, mănușa și telecomanda se iau', () => {
  const s = empty(NO), p = s.players[0];
  for (let i = 0; i < 12; i++) { s.pick[idx(3, 1)] = 1; at(s, 'a', 3, 1); step(s); s.pick[idx(3, 1)] = 2; at(s, 'a', 3, 1); step(s); }
  assert.equal(p.maxBombs, 8); assert.equal(p.range, 8); assert.equal(p.bestB, 8); assert.equal(p.bestR, 8);
  for (const k of [6, 7]) { s.pick[idx(3, 1)] = k; at(s, 'a', 3, 1); step(s); }
  assert.ok(p.glove && p.remote);
});

test('lăzile lasă bonus în ~40% din cazuri, iar „Ciudățel” e rar și lipsește în modul blând', () => {
  let crates = 0, loot = 0, curse = 0, curseGentle = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const s = createMatch({ arenaId: 0, players: [P('a'), P('b')], seed, rules: NO });
    for (let i = 0; i < s.grid.length; i++) if (s.grid[i] === CRATE) { crates++; if (s.loot[i]) { loot++; if (s.loot[i] === 8) curse++; } }
    const g = createMatch({ arenaId: 0, players: [P('a'), P('b')], seed, rules: { gentle: true } });
    curseGentle += g.loot.filter((k) => k === 8).length;
  }
  assert.ok(Math.abs(loot / crates - 0.4) < 0.05, 'loot ' + (loot / crates).toFixed(2));
  assert.ok(curse > 0 && curse / loot < 0.1);
  assert.equal(curseGentle, 0);
});

test('aruncare: mănușa trimite bomba 3 plăci peste obstacole și ricoșează la margine', () => {
  const s = empty(NO);
  at(s, 'a', 4, 1); at(s, 'b', 13, 11);
  s.players[0].glove = true; s.players[0].face = 1;
  bomb(s, 4, 1, 'a', 200);
  tap(s, 'a', { dx: 0, dy: 0, b: true });
  assert.equal(s.bombs[0].x, 7, 'zboară peste plăci');
  assert.ok(s.bombs[0].fl > 0);
  for (let i = 0; i < 14; i++) step(s);
  assert.equal(s.bombs[0].fl, 0);
  // lângă margine: ricoșează înapoi (x=13 +3 -> 16 -> 12)
  const e = empty(NO);
  at(e, 'a', 13, 1); at(e, 'b', 13, 11);
  e.players[0].glove = true; e.players[0].face = 1;
  bomb(e, 13, 1, 'a', 200);
  tap(e, 'a', { dx: 0, dy: 0, b: true });
  assert.equal(e.bombs[0].x, 12, 'a ricoșat');
  assert.equal(e.bombs.length, 1);
});

test('telecomandă: butonul 2 face bombele proprii să explodeze', () => {
  const s = empty(NO);
  at(s, 'a', 1, 1); at(s, 'b', 13, 11);
  bomb(s, 5, 5, 'a', 200); bomb(s, 9, 5, 'b', 200);
  tap(s, 'a', { dx: 0, dy: 0, b: true });
  assert.equal(s.bombs.length, 2, 'fără bonus nu se întâmplă nimic');
  s.players[0].remote = true;
  tap(s, 'a', { dx: 0, dy: 0, b: true });
  assert.equal(s.bombs.length, 1); assert.equal(s.bombs[0].o, 'b');
});

test('linie de bombe: dublu-apăsare pune toate bombele disponibile în direcția privirii', () => {
  const s = empty(NO), p = s.players[0];
  at(s, 'a', 3, 1); at(s, 'b', 13, 11);
  p.maxBombs = 4; p.face = 1;
  tap(s, 'a', { dx: 0, dy: 0, bomb: true });
  assert.equal(s.bombs.length, 1);
  tap(s, 'a', { dx: 0, dy: 0, bomb: true });
  assert.deepEqual(s.bombs.map((b) => b.x).sort((x, y) => x - y), [3, 4, 5, 6]);
  assert.ok(s.bombs.every((b) => b.y === 1) && p.bombs === 4);
});

test('Ciudățel: mers invers 10 s, se transmite prin atingere, trece; în modul blând nu există', () => {
  const s = empty(NO), a = s.players[0], b = s.players[1];
  at(s, 'a', 3, 1); at(s, 'b', 3, 1); b.y = 1.5; b.x = 6.5;
  s.pick[idx(3, 1)] = 8; a.x = 3.5; a.y = 1.5;
  step(s);
  assert.ok(a.cu >= 1 && a.cu <= 3 && a.ce - s.tick === 300);
  a.cu = 1; const x0 = a.x;
  hold(s, 'a', 6, { dx: 1, dy: 0 });
  assert.ok(a.x < x0 - 0.3, 'mers invers');
  b.x = a.x + 0.3; b.y = a.y; b.inv = 0;
  step(s);
  assert.equal(b.cu, 1); assert.equal(b.ce, a.ce);
  s.tick = a.ce;
  step(s);
  assert.ok(!a.cu && !b.cu);
  const g = empty({ gentle: true, rounds: 3 });
  g.pick[idx(3, 1)] = 8; at(g, 'a', 3, 1); step(g);
  assert.ok(!g.players[0].cu, 'modul blând: fără bonus negativ');
  const sl = empty(NO); sl.players[0].cu = 3; sl.players[0].ce = 999; at(sl, 'a', 1, 1);
  hold(sl, 'a', 30, { dx: 1, dy: 0 });
  assert.ok(sl.players[0].x < 3, 'viteză foarte mică');
  const au = empty(NO); at(au, 'a', 1, 1); au.players[0].cu = 2; au.players[0].ce = 999;
  hold(au, 'a', 12, { dx: 0, dy: 0 });
  assert.ok(au.bombs.length >= 1, 'bombe care se pun singure');
});


test('bonusurile căzute în flăcări dispar, iar cele ale unui jucător eliminat se împrăștie', () => {
  const s = empty(NO), a = s.players[0];
  a.maxBombs = 4; a.range = 4; a.spd = 2; a.glove = true; a.shield = 0; a.inv = 0;
  at(s, 'a', 5, 5); at(s, 'b', 13, 11);
  s.pick[idx(5, 6)] = 6;
  bomb(s, 5, 5, 'a', 1);
  step(s);
  assert.ok(!a.alive); assert.equal(s.pick[idx(5, 6)], 0, 'bonusul din flăcări a dispărut');
  const left = [...s.pick].filter(Boolean);
  assert.equal(left.length, 3 + 2 + 2 + 1, 'toate bonusurile lui sunt pe arenă');
  assert.ok(s.pick.every((k, i) => !k || s.grid[i] === 0));
});

test('final de meci: se păstrează câte bombe și ce rază a avut fiecare', () => {
  const s = empty({ gentle: false, rounds: 1 }), a = s.players[0];
  for (const k of [1, 2, 2]) { s.pick[idx(3, 1)] = k; at(s, 'a', 3, 1); step(s); }
  startRound(s);
  assert.deepEqual([a.maxBombs, a.bestB, a.bestR], [1, 2, 4]);
});
