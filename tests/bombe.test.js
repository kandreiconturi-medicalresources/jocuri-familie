import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, step, startMatch } from '../games/bombe/src/logic/match.js';
import { W, H, CORNERS, idx, MATCH_STEPS, SHRINK_AT, END_DELAY, RESPAWN, WALL, CRATE } from '../games/bombe/src/logic/rules.js';
import { ARENAS } from '../games/bombe/src/logic/arenas.js';
import { packSnap, applySnap } from '../games/bombe/src/net/snap.js';
import { createPlay } from '../games/bombe/src/play.js';
import { rng } from '../shared/engine/rng.js';

const P = (id, bot = false, level = 'easy') => ({ id, name: id, avatar: 'bear', color: '#f00', bot, level });
const dump = (s) => JSON.stringify({ g: [...s.grid], k: [...s.pick], p: s.players, b: s.bombs, f: s.flames, t: s.tick, ph: s.phase });

/** Arenă goală (fără lăzi), jucători mutați din calea exploziilor. */
function empty(rules = { lives: 3 }, ids = ['a', 'b'], arenaId = 0) {
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
    const s = createMatch({ arenaId: 3, players: [P('a'), P('b'), P('c', true, 'mid'), P('d', true, 'hard')], seed, rules: { lives: 3 } });
    const r = rng(99);
    for (let i = 0; i < 700; i++) step(s, { a: { dx: r.int(-1, 1), dy: r.int(-1, 1), bomb: r.chance(0.1) }, b: { dx: r.int(-1, 1), dy: 0, bomb: r.chance(0.05) } });
    return dump(s);
  };
  assert.equal(run(5), run(5));
  assert.notEqual(run(5), run(6));
});

test('grila 17x15: pereți fixi, colțuri libere, 8 arene', () => {
  assert.equal(ARENAS.length, 8);
  assert.deepEqual([W, H], [17, 15]);
  for (const a of ARENAS) {
    const s = createMatch({ arenaId: a.id, players: [P('a'), P('b')], seed: 3 });
    assert.equal(s.grid[idx(0, 5)], WALL);
    assert.equal(s.grid[idx(2, 2)], WALL);
    assert.equal(s.grid[idx(16, 14)], WALL);
    assert.equal(s.grid[idx(8, 8)], WALL);
    assert.notEqual(s.grid[idx(8, 7)], WALL);
    assert.deepEqual(CORNERS, [[1, 1], [15, 13], [15, 1], [1, 13]]);
    for (const [x, y] of [[1, 1], [2, 1], [1, 2], [15, 13], [14, 13], [15, 12], [15, 1], [1, 13]]) assert.notEqual(s.grid[idx(x, y)], CRATE);
  }
});

test('explozia e în cruce și e oprită de pereți', () => {
  const s = empty();
  at(s, 'a', 1, 1); at(s, 'b', 15, 13);
  bomb(s, 5, 6); // (4,6) și (6,6) sunt pereți
  step(s);
  assert.deepEqual([...flameCells(s)].sort((x, y) => x - y), [idx(5, 4), idx(5, 5), idx(5, 6), idx(5, 7), idx(5, 8)]);
  assert.equal(s.bombs.length, 0);
  assert.equal(s.players[0].bombs, 0);
});

test('explozie în lanț', () => {
  const s = empty();
  at(s, 'a', 15, 1); at(s, 'b', 15, 13);
  bomb(s, 1, 5, 'a', 1); bomb(s, 3, 5, 'b', 60);
  const ev = step(s);
  assert.equal(ev.filter((e) => e.e === 'explode').length, 2);
  assert.ok(flameCells(s).has(idx(5, 5)), 'a doua bombă a explodat imediat');
  assert.equal(s.bombs.length, 0);
});

test('lada se sparge, oprește flacăra și lasă bonus', () => {
  const s = empty();
  at(s, 'a', 15, 1); at(s, 'b', 15, 13);
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
  assert.ok(p.kick, 'șutul e al tuturor de la început');
  const ev = take(1); assert.ok(ev.some((e) => e.e === 'pickup'));
  assert.equal(s.pick[idx(3, 1)], 0);
});

test('flacăra distruge bonusul vechi, dar nu pe cel scăpat de lada spartă', () => {
  const s = empty();
  at(s, 'a', 15, 1); at(s, 'b', 15, 13);
  s.pick[idx(5, 7)] = 3;
  bomb(s, 5, 5, 'a', 1, 2);
  step(s);
  assert.equal(s.pick[idx(5, 7)], 0);
});

test('fără protecție: nici scut, nici invulnerabilitate; bomba proprie rănește', () => {
  const s = empty();
  const a = s.players[0];
  assert.ok(s.players.every((p) => p.shield === undefined && !p.inv));
  at(s, 'a', 5, 5); at(s, 'b', 15, 13);
  bomb(s, 5, 5, 'a', 1);
  const ev = step(s);
  assert.ok(!a.alive && a.lives === 2 && ev.some((e) => e.e === 'hit'));
});

test('viață pierdută: bonusuri lăsate pe hartă, revenire după ~2 s în colț, cu statistici de bază', () => {
  const s = empty(), a = s.players[0];
  for (const k of [1, 2, 2, 3]) { s.pick[idx(3, 1)] = k; at(s, 'a', 3, 1); step(s); }
  a.glove = true;
  at(s, 'a', 5, 5); at(s, 'b', 15, 13);
  bomb(s, 5, 5, 'a', 1);
  step(s);
  assert.ok(!a.alive && a.lives === 2);
  const drops = [...s.pick].filter(Boolean);
  assert.ok(drops.length >= 1 && drops.length <= 4, 'lasă câteva bonusuri: ' + drops.length);
  for (let i = 0; i < RESPAWN - 3; i++) step(s);
  assert.ok(!a.alive, 'încă nu a revenit');
  for (let i = 0; i < 20; i++) step(s);
  assert.ok(a.alive && a.lives === 2);
  assert.deepEqual([a.x, a.y], [1.5, 1.5]);
  assert.deepEqual([a.maxBombs, a.range, a.spd, a.glove, a.bombs], [1, 2, 0, false, 0]);
  assert.deepEqual([a.bestB, a.bestR], [2, 4], 'recordul pentru clasament rămâne');
  // fără invulnerabilitate: o flacără îl lovește imediat
  bomb(s, 3, 1, 'b', 1, 2);
  step(s);
  assert.ok(!a.alive && a.lives === 1);
});

test('revenirea se amână cât timp colțul sau vecinii lui sunt în raza unei bombe', () => {
  const s = empty(), a = s.players[0];
  at(s, 'b', 15, 13);
  a.alive = false; a.lives = 2; a.rt = 0;
  bomb(s, 3, 1, 'b', 200, 2); // atinge (2,1), vecina colțului
  for (let i = 0; i < 20; i++) step(s);
  assert.ok(!a.alive, 'amânat');
  s.bombs[0].t = 1;
  step(s);
  for (let i = 0; i < 30; i++) step(s); // flăcările se sting
  assert.ok(a.alive, 'a revenit după explozie');
});

test('la 0 vieți ieși; ultimul cu vieți câștigă meciul', () => {
  const s = empty({ lives: 1 });
  assert.equal(s.players[0].lives, 1);
  at(s, 'a', 15, 1); at(s, 'b', 5, 5);
  bomb(s, 5, 5, 'a', 1);
  let ev = [];
  for (let i = 0; i < END_DELAY + 3; i++) ev = ev.concat(step(s));
  assert.equal(s.phase, 'match_end'); assert.equal(s.matchWinner, 'a');
  assert.ok(ev.some((e) => e.e === 'out') && ev.some((e) => e.e === 'match' && e.winner === 'a'));
  assert.deepEqual(step(s), []);
  startMatch(s);
  assert.equal(s.mc, 2); assert.equal(s.phase, 'play'); assert.ok(s.players.every((p) => p.alive && p.lives === 1));

  const d = empty({ lives: 1 });
  at(d, 'a', 5, 5); at(d, 'b', 5, 4);
  bomb(d, 5, 5, 'a', 1);
  for (let i = 0; i < END_DELAY + 3; i++) step(d);
  assert.equal(d.phase, 'match_end'); assert.equal(d.matchWinner, null);
});

test('mai multe vieți: opțiunea 1/3/5, implicit 3', () => {
  const l = (rules) => createMatch({ players: [P('a'), P('b')], rules }).players[0].lives;
  assert.deepEqual([l(undefined), l({ lives: 1 }), l({ lives: 5 }), l({ lives: 4 })], [3, 1, 5, 3]);
});

test('timp scurs: arena se strânge (2 min); la 3 min câștigă cine are mai multe vieți, altfel egalitate', () => {
  const s = empty();
  at(s, 'a', 7, 6); at(s, 'b', 7, 7);
  s.tick = SHRINK_AT - 1;
  const blocks = () => [...s.grid].filter((g) => g === WALL).length;
  const before = blocks();
  for (let i = 0; i < 60; i++) step(s, { a: { dx: 0, dy: 0 } });
  assert.ok(blocks() > before);
  s.tick = MATCH_STEPS - 1;
  s.shrinkI = 9999;
  const t2 = empty(); at(t2, 'a', 15, 1); at(t2, 'b', 15, 13); t2.players[0].lives = 2; t2.tick = MATCH_STEPS - 1;
  step(s);
  assert.equal(s.phase, 'match_end'); assert.equal(s.matchWinner, null);
  step(t2);
  assert.equal(t2.phase, 'match_end'); assert.equal(t2.matchWinner, 'b');
});

test('mișcare: pereții blochează; bomba pusă nu te blochează, dar după ce ieși devine perete', () => {
  const s = empty();
  at(s, 'a', 1, 1); at(s, 'b', 15, 13);
  for (let i = 0; i < 40; i++) step(s, { a: { dx: 0, dy: -1 } });
  assert.ok(s.players[0].y > 1.3);
  step(s, { a: { dx: 0, dy: 0, bomb: true } });
  assert.equal(s.bombs.length, 1);
  for (let i = 0; i < 12; i++) step(s, { a: { dx: 1, dy: 0 } });
  const x1 = s.players[0].x;
  for (let i = 0; i < 12; i++) step(s, { a: { dx: -1, dy: 0 } });
  assert.ok(s.players[0].x > 2.3 && x1 > 2.3, 'bomba blochează întoarcerea');
});

const NO = { lives: 3 };
const hold = (s, id, n, inp) => { for (let i = 0; i < n; i++) step(s, { [id]: inp }); };
const tap = (s, id, inp) => { step(s, { [id]: inp }); step(s, { [id]: { ...inp, bomb: false, b: false } }); };

test('șut pentru toți de la început: mergând în bombă o împingi și alunecă până la obstacol', () => {
  const s = empty(NO);
  assert.ok(s.players.every((p) => p.kick));
  at(s, 'a', 2, 1); at(s, 'b', 15, 13);
  bomb(s, 3, 1, 'a', 300);
  hold(s, 'a', 70, { dx: 1, dy: 0 });
  assert.equal(s.bombs[0].x, 15, 'alunecă până la zidul din dreapta');
  assert.ok(s.players[0].x < 14.5);
  const r = empty(NO);
  at(r, 'a', 1, 2); at(r, 'b', 15, 13);
  bomb(r, 1, 3, 'a', 300);
  hold(r, 'a', 50, { dx: 0, dy: 1 });
  assert.ok(r.bombs[0].y > 3, 'și pe verticală');
});

test('bonusuri: maxim 8 bombe și rază 8; mănușa și telecomanda se iau', () => {
  const s = empty(NO), p = s.players[0];
  for (let i = 0; i < 12; i++) { s.pick[idx(3, 1)] = 1; at(s, 'a', 3, 1); step(s); s.pick[idx(3, 1)] = 2; at(s, 'a', 3, 1); step(s); }
  assert.equal(p.maxBombs, 8); assert.equal(p.range, 8); assert.equal(p.bestB, 8); assert.equal(p.bestR, 8);
  for (const k of [6, 7]) { s.pick[idx(3, 1)] = k; at(s, 'a', 3, 1); step(s); }
  assert.ok(p.glove && p.remote);
});

test('lăzile lasă bonus în ~40% din cazuri; „Ciudățel” există dar e rar; fără scut și fără șut ca bonus', () => {
  let crates = 0, loot = 0, curse = 0, banned = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const s = createMatch({ arenaId: 0, players: [P('a'), P('b')], seed, rules: NO });
    for (let i = 0; i < s.grid.length; i++) if (s.grid[i] === CRATE) { crates++; if (s.loot[i]) { loot++; if (s.loot[i] === 8) curse++; if (s.loot[i] === 5 || s.loot[i] === 4) banned++; } }
  }
  assert.ok(Math.abs(loot / crates - 0.4) < 0.05, 'loot ' + (loot / crates).toFixed(2));
  assert.ok(curse > 0 && curse / loot < 0.1);
  assert.equal(banned, 0);
});

test('aruncare: mănușa trimite bomba 3 plăci peste obstacole și ricoșează la margine', () => {
  const s = empty(NO);
  at(s, 'a', 4, 1); at(s, 'b', 15, 13);
  s.players[0].glove = true; s.players[0].face = 1;
  bomb(s, 4, 1, 'a', 200);
  tap(s, 'a', { dx: 0, dy: 0, b: true });
  assert.equal(s.bombs[0].x, 7, 'zboară peste plăci');
  assert.ok(s.bombs[0].fl > 0);
  for (let i = 0; i < 14; i++) step(s);
  assert.equal(s.bombs[0].fl, 0);
  // lângă margine: ricoșează înapoi (x=15 +3 -> 18 -> 14)
  const e = empty(NO);
  at(e, 'a', 15, 1); at(e, 'b', 15, 13);
  e.players[0].glove = true; e.players[0].face = 1;
  bomb(e, 15, 1, 'a', 200);
  tap(e, 'a', { dx: 0, dy: 0, b: true });
  assert.equal(e.bombs[0].x, 14, 'a ricoșat');
  assert.equal(e.bombs.length, 1);
});

test('telecomandă: butonul 2 face bombele proprii să explodeze', () => {
  const s = empty(NO);
  at(s, 'a', 1, 1); at(s, 'b', 15, 13);
  bomb(s, 5, 5, 'a', 200); bomb(s, 9, 5, 'b', 200);
  tap(s, 'a', { dx: 0, dy: 0, b: true });
  assert.equal(s.bombs.length, 2, 'fără bonus nu se întâmplă nimic');
  s.players[0].remote = true;
  tap(s, 'a', { dx: 0, dy: 0, b: true });
  assert.equal(s.bombs.length, 1); assert.equal(s.bombs[0].o, 'b');
});

test('linie de bombe: dublu-apăsare pune toate bombele disponibile în direcția privirii', () => {
  const s = empty(NO), p = s.players[0];
  at(s, 'a', 3, 1); at(s, 'b', 15, 13);
  p.maxBombs = 4; p.face = 1;
  tap(s, 'a', { dx: 0, dy: 0, bomb: true });
  assert.equal(s.bombs.length, 1);
  tap(s, 'a', { dx: 0, dy: 0, bomb: true });
  assert.deepEqual(s.bombs.map((b) => b.x).sort((x, y) => x - y), [3, 4, 5, 6]);
  assert.ok(s.bombs.every((b) => b.y === 1) && p.bombs === 4);
});

test('Ciudățel: mers invers 10 s, se transmite prin atingere, trece', () => {
  const s = empty(NO), a = s.players[0], b = s.players[1];
  at(s, 'a', 3, 1); at(s, 'b', 3, 1); b.y = 1.5; b.x = 6.5;
  s.pick[idx(3, 1)] = 8; a.x = 3.5; a.y = 1.5;
  step(s);
  assert.ok(a.cu >= 1 && a.cu <= 3 && a.ce - s.tick === 300);
  a.cu = 1; const x0 = a.x;
  hold(s, 'a', 6, { dx: 1, dy: 0 });
  assert.ok(a.x < x0 - 0.3, 'mers invers');
  b.x = a.x + 0.3; b.y = a.y;
  step(s);
  assert.equal(b.cu, 1); assert.equal(b.ce, a.ce);
  s.tick = a.ce;
  step(s);
  assert.ok(!a.cu && !b.cu);
  const sl = empty(NO); sl.players[0].cu = 3; sl.players[0].ce = 999; at(sl, 'a', 1, 1);
  hold(sl, 'a', 30, { dx: 1, dy: 0 });
  assert.ok(sl.players[0].x < 3, 'viteză foarte mică');
  const au = empty(NO); at(au, 'a', 1, 1); au.players[0].cu = 2; au.players[0].ce = 999;
  hold(au, 'a', 12, { dx: 0, dy: 0 });
  assert.ok(au.bombs.length >= 1, 'bombe care se pun singure');
});


test('bonusurile căzute în flăcări dispar, iar cele ale unui jucător lovit se împrăștie (cel mult 4)', () => {
  const s = empty(NO), a = s.players[0];
  a.maxBombs = 4; a.range = 4; a.spd = 2; a.glove = true;
  at(s, 'a', 5, 5); at(s, 'b', 15, 13);
  s.pick[idx(5, 6)] = 6;
  bomb(s, 5, 5, 'a', 1);
  step(s);
  assert.ok(!a.alive); assert.equal(s.pick[idx(5, 6)], 0, 'bonusul din flăcări a dispărut');
  const left = [...s.pick].filter(Boolean);
  assert.equal(left.length, 4, 'cel mult 4 bonusuri sunt pe arenă');
  assert.ok(s.pick.every((k, i) => !k || s.grid[i] === 0));
});

test('meci nou: statisticile pentru clasament se resetează', () => {
  const s = empty(), a = s.players[0];
  for (const k of [1, 2, 2]) { s.pick[idx(3, 1)] = k; at(s, 'a', 3, 1); step(s); }
  assert.deepEqual([a.bestB, a.bestR], [2, 4]);
  startMatch(s);
  assert.deepEqual([a.maxBombs, a.bestB, a.bestR, a.lives], [1, 1, 2, 3]);
});

test('boți: meci complet cu 4 boți pe toate arenele ajunge la final', () => {
  for (const a of ARENAS) {
    const s = createMatch({ arenaId: a.id, players: [P('a', true, 'hard'), P('b', true, 'hard'), P('c', true, 'mid'), P('d', true, 'easy')], seed: 20 + a.id });
    for (let i = 0; i <= MATCH_STEPS && s.phase === 'play'; i++) step(s);
    assert.equal(s.phase, 'match_end', a.name);
    assert.ok(s.players.some((p) => p.lives < 3), 'boții se lovesc între ei: ' + a.name);
  }
});
