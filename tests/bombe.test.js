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

test('snapshot: se pot reconstrui starea și rularea mai departe', () => {
  const s = createMatch({ arenaId: 6, players: [P('a'), P('b', true), P('c', true)], seed: 11 });
  for (let i = 0; i < 200; i++) step(s);
  const copy = createMatch({ arenaId: 6, players: [P('a'), P('b', true), P('c', true)], seed: 1 });
  applySnap(copy, JSON.parse(JSON.stringify(packSnap(s, true, []))));
  assert.equal(dump(copy), dump(s));
});

test('boții ușori nu se sinucid: 4 boți, 10 seed-uri, în medie peste 20 s', () => {
  let total = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const s = createMatch({ arenaId: seed % 8, players: [P('a', true), P('b', true), P('c', true), P('d', true)], seed, rules: { gentle: false, rounds: 1 } });
    let n = 0;
    while (s.phase === 'play' && n < ROUND_STEPS + 10) { step(s); n++; }
    total += n / 30;
  }
  const avg = total / 10;
  assert.ok(avg > 20, 'durata medie ' + avg.toFixed(1) + ' s');
  assert.ok(W === 15);
});

test('rețea: clientul trimite input, gazda simulează, iar snapshot-urile aduc clientul la aceeași stare', () => {
  const cfg = { arenaId: 2, players: [P('h'), P('c'), P('b1', true, 'mid')], seed: 5, rules: { gentle: true } };
  const toClient = [], toHost = [];
  const net = (you, out) => ({ you, host: you === 'h', rooms: { send: (d) => out.push({ from: you, d: JSON.parse(JSON.stringify(d)) }) } });
  const pad = { read: () => ({ left: true, right: false, up: false, down: false, a: false, b: false }) };
  const host = createPlay({ input: pad, cfg, slots: { h: 0 }, net: net('h', toClient), onEvents() {} });
  const client = createPlay({ input: pad, cfg, slots: { c: 0 }, net: net('c', toHost), onEvents() {} });
  const x0 = client.state.players[1].x;
  for (let i = 0; i < 400; i++) {
    host.update(); client.update();
    while (toHost.length) host.onMsg(toHost.shift());
    while (toClient.length) client.onMsg(toClient.shift());
  }
  assert.ok(host.state.players[1].x < x0 - 1, 'input-ul clientului a mișcat jucătorul la gazdă');
  assert.equal(dump(client.state), dump(host.state));
  // plecarea unui jucător: devine bot; gazda nouă preia din ultimul snapshot
  client.setRoom([{ id: 'c', host: true }]);
  assert.ok(client.isHost && client.state.players[0].bot);
  for (let i = 0; i < 30; i++) client.update();
  assert.ok(client.state.tick > host.state.tick - 5);
});
