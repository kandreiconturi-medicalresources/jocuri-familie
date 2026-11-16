import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, step } from '../games/bombe/src/logic/match.js';
import { createPacker, packSnap, applySnap } from '../games/bombe/src/net/snap.js';
import { createPlay } from '../games/bombe/src/play.js';

const P = (id, bot = false, level = 'easy') => ({ id, name: id, avatar: 'bear', color: '#f00', bot, level });
const json = (x) => JSON.parse(JSON.stringify(x));
// starea afișată: pozițiile sunt rotunjite la 1/1000 în snapshot; `mt` (cronometrul de alunecare) nu se trimite
const dump = (s) => JSON.stringify({
  g: [...s.grid], k: [...s.pick], l: [...s.loot], t: s.tick, ph: s.phase, r: s.mc,
  p: s.players.map((p) => ({ x: Math.round(p.x * 1000), y: Math.round(p.y * 1000), a: p.alive, b: p.bombs, mb: p.maxBombs, r: p.range, k: p.kick, lv: p.lives, rt: p.rt, cu: p.cu, gl: p.glove, re: p.remote, bb: p.bestB })),
  b: s.bombs.map((b) => [b.uid, b.x, b.y, b.t, b.o, b.dx, b.dy, b.fl, b.pass.join()]).sort(),
  f: s.flames.map((f) => [f.i, f.t, f.o]).sort((a, b) => a[0] - b[0]),
});

test('snapshot întreg: starea se reconstruiește și încape în 4 KB', () => {
  const s = createMatch({ arenaId: 6, players: [P('a'), P('b', true), P('c', true)], seed: 11 });
  for (let i = 0; i < 200; i++) step(s);
  const copy = createMatch({ arenaId: 6, players: [P('a'), P('b', true), P('c', true)], seed: 1 });
  const m = json(packSnap(s, true, []));
  assert.ok(JSON.stringify(m).length < 3800);
  applySnap(copy, m);
  assert.equal(dump(copy), dump(s));
});

test('snapshot diferențial: mici, aduc clientul la aceeași stare și cer starea întreagă dacă se pierde un mesaj', () => {
  const ps = () => [P('a', true, 'hard'), P('b', true, 'hard'), P('c', true, 'mid'), P('d', true, 'mid')];
  const s = createMatch({ arenaId: 0, players: ps(), seed: 9, rules: { lives: 3 } });
  const c = createMatch({ arenaId: 0, players: ps(), seed: 1 });
  const pk = createPacker();
  let bytes = 0, msgs = 0, maxLen = 0, fulls = 0;
  for (let i = 1; i <= 900; i++) {
    step(s);
    if (i % 2) continue;
    const m = pk.pack(s, [], 0), len = JSON.stringify(m).length;
    if (m.full) fulls++; else { bytes += len; msgs++; }
    maxLen = Math.max(maxLen, len);
    applySnap(c, json(m));
    assert.equal(dump(c), dump(s), 'diferă la pasul ' + i);
  }
  assert.ok(maxLen < 3800, 'mesaj mare: ' + maxLen);
  assert.ok(bytes / msgs < 400, 'diferențele ar trebui să fie mici: ' + Math.round(bytes / msgs) + ' B în medie');
  assert.ok(fulls >= 1 && fulls <= 4);
  // mesaj pierdut -> clientul observă și așteaptă starea întreagă
  step(s); step(s); pk.pack(s, [], 0);
  step(s); step(s);
  applySnap(c, json(pk.pack(s, [], 0)));
  assert.ok(c.need);
  step(s); step(s);
  applySnap(c, json(pk.pack(s, [], 0, true)));
  assert.ok(!c.need);
  assert.equal(dump(c), dump(s));
});

test('rețea: clientul trimite input, gazda simulează, iar snapshot-urile aduc clientul la aceeași stare', () => {
  const cfg = { arenaId: 2, players: [P('h'), P('c'), P('b1', true, 'mid')], seed: 5, rules: { lives: 3 } };
  const toClient = [], toHost = [];
  const net = (you, out) => ({ you, host: you === 'h', rooms: { send: (d) => out.push({ from: you, d: json(d) }) } });
  const pad = { read: () => ({ left: true, right: false, up: false, down: false, a: false, b: true }) };
  const host = createPlay({ input: pad, cfg, slots: { h: 0 }, net: net('h', toClient), onEvents() {} });
  const client = createPlay({ input: pad, cfg, slots: { c: 0 }, net: net('c', toHost), onEvents() {} });
  let sawB = false;
  const x0 = client.state.players[1].x;
  for (let i = 0; i < 400; i++) {
    host.update(); client.update();
    while (toHost.length) { const m = toHost.shift(); sawB = sawB || m.d.b === true; host.onMsg(m); }
    while (toClient.length) client.onMsg(toClient.shift());
  }
  assert.ok(host.state.players[1].x < x0 - 1, 'input-ul clientului a mișcat jucătorul la gazdă');
  assert.equal(dump(client.state), dump(host.state));
  // al doilea buton ajunge la gazdă
  assert.ok(sawB);
  // plecarea gazdei: clientul devine gazdă și continuă din ultimul snapshot; cine a plecat devine bot
  client.setRoom([{ id: 'c', host: true }]);
  assert.ok(client.isHost && client.state.players[0].bot);
  for (let i = 0; i < 30; i++) client.update();
  assert.ok(client.state.tick > host.state.tick - 5);
});
