import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseHost, amHost, startIds, arrivedAll, levelHash, newPlan, planSend, packPlayer, unpackPlayer, applyPlayer, pushSample, sampleAt,
  applyTileEvent, packEnemy, applyEnemy, pickEnemies, packBoss, applyBoss, packPlatform, applyPlatform, parseBundle, FL,
} from '../games/bobo/src/net/logic.js';
import { getLevel } from '../games/bobo/src/levels/index.js';
import { SMALL, BIG } from '../games/bobo/src/physics.js';

const room = (...ids) => ids.map((id, i) => ({ id, host: i === 0 }));

test('gazda: cea marcată de server; la plecarea ei urmează următorul', () => {
  const list = room('a', 'b', 'c');
  assert.equal(chooseHost(list), 'a');
  assert.ok(amHost(list, 'a') && !amHost(list, 'b'));
  const after = list.filter((p) => p.id !== 'a').map((p, i) => ({ ...p, host: i === 0 }));
  assert.equal(chooseHost(after), 'b');
  assert.equal(chooseHost([{ id: 'x' }, { id: 'y' }]), 'x'); // fără marcaj: primul
  assert.equal(chooseHost([]), null);
  assert.deepEqual(startIds(list), ['a', 'b', 'c']);
});

test('nivelul se termină când toți cei prezenți au ajuns', () => {
  const arrived = new Set(['a', 'b']);
  assert.ok(!arrivedAll(arrived, ['a', 'b', 'c']));
  assert.ok(arrivedAll(arrived, ['a', 'b']));
  assert.ok(arrivedAll(arrived, ['b'])); // c a plecat din cameră
  assert.ok(!arrivedAll(new Set(), []));
});

test('hash-ul nivelului: același nivel = același hash, niveluri diferite diferă', () => {
  assert.equal(levelHash(getLevel(20).grid), levelHash(getLevel(20).grid));
  assert.notEqual(levelHash(getLevel(20).grid), levelHash(getLevel(21).grid));
});

test('ritmul trimiterilor: sub 20 mesaje/s, jucătorul ~15/s, lumea ~10/s', () => {
  const st = newPlan();
  let sends = 0, pCount = 0, wCount = 0;
  for (let t = 0; t < 600; t++) {
    const r = planSend(st, t, true, t % 5 === 0); // evenimente la fiecare 5 cadre
    if (r) { sends++; if (r.p) pCount++; if (r.w) wCount++; }
  }
  assert.ok(sends <= 200, 'mesaje: ' + sends);
  assert.ok(pCount >= 100 && pCount <= 160, 'p: ' + pCount);
  assert.ok(wCount >= 70 && wCount <= 105, 'w: ' + wCount);
  const st2 = newPlan();
  let c = 0;
  for (let t = 0; t < 600; t++) if (planSend(st2, t, false, false)) c++;
  assert.ok(c >= 100 && c <= 155, 'client: ' + c);
});

test('starea jucătorului: împachetare, despachetare, aplicare (mare/mic)', () => {
  const p = { x: 123.456, y: 50.04, vx: 2.345, vy: -3, face: -1, onGround: true, big: true, shield: true, wand: false, dead: false, inWater: false,
    hurtT: 3, shootCd: 9, land: 0, inv: 5, walk: 3.33, hearts: 2 };
  const s = unpackPlayer(JSON.parse(JSON.stringify(packPlayer(p))));
  assert.equal(s.x, 123.5); assert.equal(s.face, -1); assert.equal(s.hearts, 2);
  const b = {};
  applyPlayer(b, s, 0);
  assert.equal(b.big, true); assert.equal(b.w, BIG.w); assert.equal(b.h, BIG.h);
  assert.ok(b.onGround && b.shield && !b.wand && b.hurtT > 0 && b.shootCd > 6 && b.inv > 0);
  applyPlayer(b, { ...s, flags: 0 }, 0);
  assert.equal(b.w, SMALL.w); assert.equal(b.inv, 0);
  assert.equal(unpackPlayer([1, 2]), null);
  assert.equal(unpackPlayer(null), null);
});

const S = (x, y, extra = {}) => ({ x, y, vx: 0, vy: 0, face: 1, flags: FL.GROUND, walk: 0, hearts: 3, ...extra });

test('interpolare: la mijloc, înainte de primul și extrapolare limitată', () => {
  const buf = [];
  pushSample(buf, 1000, S(100, 50));
  pushSample(buf, 1100, S(120, 60, { vx: 4 }));
  const mid = sampleAt(buf, 1050);
  assert.equal(mid.x, 110); assert.equal(mid.y, 55);
  assert.equal(sampleAt(buf, 900).x, 100);
  const ex = sampleAt(buf, 1100 + 50); // 50 ms ≈ 3 cadre × 4 px
  assert.ok(ex.x > 120 && ex.x < 135, 'x=' + ex.x);
  const far = sampleAt(buf, 5000);
  assert.ok(far.x <= 120 + 4 * 6.1, 'extrapolarea e limitată: ' + far.x);
  assert.equal(sampleAt([], 5), null);
});

test('interpolare: teleportarea (reapariție) sare direct, nu alunecă', () => {
  const buf = [];
  pushSample(buf, 0, S(100, 50));
  pushSample(buf, 100, S(900, 50));
  assert.equal(sampleAt(buf, 40).x, 900);
});

test('bufer: păstrează doar ultimele eșantioane', () => {
  const buf = [];
  for (let i = 0; i < 30; i++) pushSample(buf, i * 10, S(i, 0), 8);
  assert.equal(buf.length, 8);
  assert.equal(buf[0].s.x, 22);
});

const gridOf = (...rows) => rows.map((r) => r.split(''));

test('cutii: placa nouă se aplică o singură dată, ca grila să rămână identică', () => {
  const g = gridOf('....', '.GQ.', '.B..');
  const w = 4;
  const d = applyTileEvent(g, w, { e: 'b', id: 5, c: 'G', n: 'g' });
  assert.equal(d.kind, 'box'); assert.equal(g[1][1], 'g'); assert.equal(d.item, null);
  assert.equal(applyTileEvent(g, w, { e: 'b', id: 5, c: 'G', n: 'g' }), null); // două lovituri în același timp: a doua nu mai face nimic
  const q = applyTileEvent(g, w, { e: 'b', id: 6, c: 'Q', n: 'g' });
  assert.equal(q.item, 'bubble'); assert.equal(g[1][2], 'g');
  const br = applyTileEvent(g, w, { e: 'b', id: 9, c: 'B', n: '.' });
  assert.equal(br.n, '.'); assert.equal(g[2][1], '.');
});

test('colectabile: dispar la toți; evenimente greșite sunt ignorate', () => {
  const g = gridOf('o*h.', '####');
  assert.equal(applyTileEvent(g, 4, { e: 'p', id: 0, c: 'o' }).c, 'o');
  assert.equal(g[0][0], '.');
  assert.equal(applyTileEvent(g, 4, { e: 'p', id: 0, c: 'o' }), null);
  assert.equal(applyTileEvent(g, 4, { e: 'p', id: 1, c: 'o' }), null); // altă placă decât cea anunțată
  assert.equal(applyTileEvent(g, 4, { e: 'p', id: 4, c: '#' }), null); // terenul nu se colectează
  assert.equal(applyTileEvent(g, 4, { e: 'p', id: 99, c: 'o' }), null);
  assert.equal(applyTileEvent(g, 4, { e: 'p', id: -1, c: 'o' }), null);
  assert.equal(applyTileEvent(g, 4, { e: 'b', id: 4, c: '#', n: '.' }), null);
  assert.equal(applyTileEvent(g, 4, { e: 'b', id: 1, c: '*', n: '.' }), null);
  assert.equal(applyTileEvent(g, 4, { e: 'x', id: 1, c: '*' }), null);
});

test('inamici: pachet, aplicare, predicție și selecție după distanță', () => {
  const e = { id: 7, x: 100, y: 200, vx: 0.5, vy: 0, dir: -1, t: 33, state: 'fall', timer: 5, dead: 0, knock: false, squashed: false, onGround: true };
  const a = JSON.parse(JSON.stringify(packEnemy(e)));
  const c = { id: 7, x: 98, y: 200, pred: 0 };
  assert.ok(applyEnemy(c, a));
  assert.equal(c.nx, 100); assert.equal(c.x, 98); // se apropie lin, nu sare
  assert.equal(c.state, 'fall'); assert.equal(c.dir, -1); assert.equal(c.onGround, true);
  applyEnemy(c, packEnemy({ ...e, x: 700 }));
  assert.equal(c.x, 700); // salt mare = poziție directă
  const dead = packEnemy({ ...e, dead: 20, squashed: true });
  const c2 = { id: 7, x: 100, y: 200, pred: 5, dead: 34, squashed: true, knock: false };
  applyEnemy(c2, packEnemy({ ...e, dead: 0 }));
  assert.equal(c2.dead, 34); // predicția clientului nu e suprascrisă până la confirmare
  c2.pred = 0; applyEnemy(c2, dead);
  assert.equal(c2.dead, 20);
  assert.equal(applyEnemy({}, [1, 2]), false);

  const list = Array.from({ length: 200 }, (_, i) => ({ id: i, x: i * 40, y: 0, dir: 1, t: 0, state: 'idle', timer: 0, dead: 0 }));
  const picked = pickEnemies(list, [0], 1000);
  assert.ok(picked.length > 0 && picked.length <= 26);
  assert.ok(JSON.stringify(picked).length < 3000);
  assert.equal(picked[0][0], 0);
  assert.equal(pickEnemies(list, [100000], 1000).length, 0);
});

test('boss și platforme: stare dusă la clienți, trezirea e semnalată', () => {
  const b = { x: 500, y: 300, vx: 1, vy: 0, dir: -1, hp: 3, inv: 10, state: 'fight', timer: 40, t: 99, dead: 0, onGround: true, air: false, mul: 1.3, tx: 0,
    waves: [{ x: 10, y: 20, vx: 3.4, t: 5 }] };
  const c = { x: 490, y: 300, state: 'sleep', waves: [] };
  assert.equal(applyBoss(c, JSON.parse(JSON.stringify(packBoss(b)))), true);
  assert.equal(c.hp, 3); assert.equal(c.state, 'fight'); assert.equal(c.waves.length, 1); assert.equal(c.face, -1);
  assert.equal(applyBoss(c, packBoss(b)), false);
  assert.equal(packBoss(null), 0);
  const p = { s: 10, dir: 1, wait: 0, len: 100 };
  applyPlatform(p, packPlatform({ s: 12, dir: 1, wait: 0 }));
  assert.equal(p.s, 10); // abatere mică: nu corectăm
  applyPlatform(p, packPlatform({ s: 40, dir: -1, wait: 3 }));
  assert.equal(p.s, 40); assert.equal(p.dir, -1); assert.equal(p.wait, 3);
});

test('mesaje primite: structura e validată', () => {
  assert.equal(parseBundle(null), null);
  assert.equal(parseBundle('x'), null);
  const d = parseBundle({ p: [1], ev: [{ e: 'b' }, 5, null, { x: 1 }] });
  assert.deepEqual(d.p, [1]); assert.equal(d.ev.length, 1); assert.equal(d.w, null);
  assert.equal(parseBundle({ ev: Array.from({ length: 100 }, () => ({ e: 's' })) }).ev.length, 24);
});
