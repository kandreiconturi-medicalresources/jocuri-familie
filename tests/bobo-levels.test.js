import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLevel, levelMeta, LEVEL_COUNT, WORLDS, LEVELS_PER_WORLD } from '../games/bobo/src/levels/index.js';
import { CLASSIC } from '../games/bobo/src/levels/classic.js';
import { validateLevel } from '../games/bobo/src/levels/validate.js';
import { CHUNKS, CHUNK_ERRORS } from '../games/bobo/src/levels/chunks/index.js';
import { targetWidth } from '../games/bobo/src/levels/generator.js';
import { LevelBuilder } from '../games/bobo/src/levels/builder.js';

test('150 de niveluri, 10 lumi × 15', () => {
  assert.equal(LEVEL_COUNT, 150);
  assert.equal(WORLDS.length, 10);
  assert.equal(LEVELS_PER_WORLD, 15);
});

test('lumile: mecanici și inamici cumulative, boss cu 3–6 viață', () => {
  WORLDS.forEach((w, i) => {
    assert.ok(w.key && w.name && w.terrain, `lumea ${i}`);
    assert.equal(w.mechanics.length, i + 1);
    assert.ok(w.boss.type && w.boss.hp >= 3 && w.boss.hp <= 6);
    if (i) {
      for (const m of WORLDS[i - 1].mechanics) assert.ok(w.mechanics.includes(m));
      for (const e of WORLDS[i - 1].enemies) assert.ok(w.enemies.includes(e));
      assert.ok(w.enemies.length > WORLDS[i - 1].enemies.length);
    }
    for (const m of w.mechanics) assert.ok(CHUNKS[m], `segmente pentru ${m}`);
  });
});

test('toate cele 150 de niveluri trec validatorul, repede', () => {
  const t0 = Date.now();
  const bad = [];
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const r = validateLevel(getLevel(i));
    if (!r.ok) bad.push(`#${i}: ${r.errors.slice(0, 3).join('; ')}`);
  }
  const ms = Date.now() - t0;
  assert.deepEqual(bad, []);
  assert.ok(ms < 20000, `validarea a durat ${ms} ms`);
});

test('același index dă același nivel', () => {
  for (let i = 0; i < LEVEL_COUNT; i += 7) assert.deepEqual(getLevel(i), getLevel(i));
});

test('getLevel dă copii independente', () => {
  for (const i of [0, 3, 40, 149]) {
    const a = getLevel(i), b = getLevel(i);
    assert.notEqual(a.grid, b.grid);
    assert.notEqual(a.grid[3], b.grid[3]);
    a.grid[15][2] = '.'; a.enemies.push({ type: 'x' }); a.checkpoints.length = 0; a.spawn.tx = 99;
    assert.deepEqual(getLevel(i), b);
    assert.equal(getLevel(i).grid[15][2], '#');
  }
});

test('nivelurile 1–3 sunt cele clasice', () => {
  [170, 185, 195].forEach((w, i) => {
    const lv = getLevel(i);
    assert.equal(lv.width, w);
    assert.deepEqual(lv, CLASSIC[i]().build(levelMeta(i)));
  });
  assert.ok(getLevel(3).width < 170 || getLevel(3).width >= 140);
});

test('format: meta, grilă, steluțe, boss', () => {
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const lv = getLevel(i), m = levelMeta(i);
    assert.equal(lv.index, i);
    assert.equal(lv.world, m.world);
    assert.equal(lv.num, m.num);
    assert.equal(lv.theme, WORLDS[m.world].key);
    assert.equal(lv.grid.length, 17);
    assert.ok(lv.grid.every((r) => r.length === lv.width));
    assert.equal(lv.isBoss, lv.num === 15);
    if (lv.isBoss) {
      assert.deepEqual(lv.boss, WORLDS[lv.world].boss);
      assert.ok(lv.width >= 55 && lv.width <= 65);
      assert.ok(lv.grid[15].every((c) => c === '#'), 'fără gropi');
    } else {
      assert.equal(lv.boss, null);
    }
  }
});

test('lățimea crește de la ~140 la ~280', () => {
  assert.equal(targetWidth(0), 140);
  assert.equal(targetWidth(149), 280);
  const w = (i) => getLevel(i).width;
  assert.ok(w(3) >= 130 && w(3) <= 175, `w(3)=${w(3)}`);
  assert.ok(w(148) >= 255 && w(148) <= 320, `w(148)=${w(148)}`);
  assert.ok(w(100) > w(20));
});

test('checkpoint-uri la ~60 de coloane', () => {
  for (let i = 3; i < LEVEL_COUNT; i++) {
    const lv = getLevel(i);
    if (lv.isBoss) continue;
    const xs = [0, ...lv.checkpoints.map((c) => c.tx), lv.portal.tx];
    for (let k = 1; k < xs.length; k++) assert.ok(xs[k] - xs[k - 1] <= 95, `nivelul ${i}: salt de ${xs[k] - xs[k - 1]}`);
    assert.ok(lv.checkpoints.length >= 1);
  }
});

test('primele niveluri generate sunt foarte ușoare: gropi scurte, fără inamici', () => {
  for (let i = 3; i < 9; i++) {
    const lv = getLevel(i);
    if (lv.isBoss) continue;
    assert.equal(lv.enemies.length, 0, `nivelul ${i}`);
    let run = 0, max = 0;
    for (let x = 0; x < lv.width; x++) { run = lv.grid[15][x] === '.' ? run + 1 : 0; max = Math.max(max, run); }
    assert.ok(max <= 3, `nivelul ${i}: groapă de ${max}`);
    for (const row of lv.grid) assert.ok(![...row].some((c) => '^V~'.includes(c)), 'fără pericole noi');
  }
});

test('mecanicile apar doar de la lumea lor', () => {
  const need = { '=': 1, X: 3, '~': 4, '^': 5, I: 6, T: 7, V: 9 };
  for (let i = 3; i < LEVEL_COUNT; i++) {
    const lv = getLevel(i);
    if (lv.isBoss) continue;
    const s = new Set(lv.grid.flatMap((r) => [...r]));
    for (const [c, w] of Object.entries(need)) if (c !== '=' && s.has(c)) assert.ok(lv.world >= w, `${c} în lumea ${lv.world}`);
    if (lv.world < 2) assert.equal(lv.platforms.length, 0);
    const allowed = new Set(WORLDS[lv.world].enemies);
    for (const e of lv.enemies) assert.ok(allowed.has(e.type), `${e.type} în lumea ${lv.world}`);
  }
});

test('mecanica nouă a lumii apare des', () => {
  const sym = { 3: 'X', 4: '~', 5: '^', 6: 'I', 7: 'T', 9: 'V' };
  for (const [w, c] of Object.entries(sym)) {
    let with_ = 0;
    for (let n = 3; n < 14; n++) if (getLevel(w * 15 + n).grid.some((r) => r.includes(c))) with_++;
    assert.ok(with_ >= 9, `lumea ${w}: ${with_}/11 niveluri cu '${c}'`);
  }
  let moving = 0;
  for (let n = 0; n < 14; n++) if (getLevel(30 + n).platforms.length) moving++;
  assert.ok(moving >= 11);
});

test('biblioteca de segmente: format și margini plate', () => {
  assert.deepEqual(CHUNK_ERRORS, []);
  const ids = new Set();
  for (const [mech, list] of Object.entries(CHUNKS)) {
    assert.ok(list.length >= 6, `${mech}: ${list.length} segmente`);
    assert.ok(list.some((c) => c.difficulty === 1), `${mech}: fără segment ușor`);
    for (const ch of list) {
      assert.ok(!ids.has(ch.id), `id dublu ${ch.id}`); ids.add(ch.id);
      assert.equal(ch.mechanic, mech);
      assert.ok(ch.difficulty >= 1 && ch.difficulty <= 5);
      assert.equal(ch.rows.length, 11);
      assert.ok(ch.rows.every((r) => r.length === ch.width));
      for (const col of [0, 1, ch.width - 2, ch.width - 1]) {
        assert.equal(ch.rows[9][col], '#', `${ch.id}: teren la rândul 15, coloana ${col}`);
        assert.equal(ch.rows[10][col], '#', `${ch.id}: teren la rândul 16, coloana ${col}`);
        for (let y = 0; y < 9; y++) assert.ok('.o'.includes(ch.rows[y][col]), `${ch.id}: ceva pe marginea ${col},${y}`);
      }
      const runs = ch.rows.join('\n').match(/P+/g) || [];
      assert.equal(runs.length, ch.plats.length, `${ch.id}: platforme`);
    }
  }
});

test('validatorul respinge niveluri imposibile', () => {
  const meta = levelMeta(40);
  const mk = (fn) => {
    const b = new LevelBuilder(150);
    fn(b);
    b.put(30, 11, '*'); b.put(31, 11, '*'); b.put(32, 11, '*');
    b.portal.tx = 140;
    return b.build(meta);
  };
  assert.ok(validateLevel(mk((b) => b.ground(0, 149))).ok);
  assert.ok(!validateLevel(mk((b) => { b.ground(0, 59); b.ground(70, 149); })).ok, 'groapă de 10');
  assert.ok(!validateLevel(mk((b) => { b.ground(0, 149); b.put(60, 14, 'L'); b.put(60, 13, 'L'); b.put(60, 12, 'L'); b.put(60, 11, 'L'); b.put(60, 10, 'L'); b.put(60, 9, 'L'); })).ok, 'zid de 6');
  assert.ok(!validateLevel(mk((b) => { b.ground(0, 149); b.put(31, 11, '.'); b.put(31, 1, '*'); })).ok, 'steluță în cer');
  assert.ok(!validateLevel(mk((b) => { b.ground(0, 149); b.row(50, 14, 14, '^'); })).ok, 'țepi pe 14 coloane');
  assert.ok(!validateLevel(mk((b) => { b.ground(0, 149); b.put(33, 11, '*'); })).ok, '4 steluțe');
});
