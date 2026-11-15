// Generatorul de niveluri: determinist (seed = hashSeed('bobo-'+index)), lipește segmente din chunks/ cu legături plate.
import { LevelBuilder, GROUND_TOP } from './builder.js';
import { rng, hashSeed } from '../../../../shared/engine/rng.js';
import { WORLDS, LEVELS_PER_WORLD } from './worlds.js';
import { CHUNKS } from './chunks/index.js';
import { CHUNK_TOP } from './chunks/util.js';

const TOTAL = WORLDS.length * LEVELS_PER_WORLD;
const WALKERS = ['snail', 'ladybug', 'worm', 'mouse', 'slime_normal', 'slime_fire']; // se pot strivi
const FLYERS = ['bee', 'fly'];
const EXTRA = { bee: { range: 3 }, fly: { range: 2 }, fish: { range: 3 }, saw: { range: 3 } };
const NATIVE = new Set('.#LBGQCSgoh*^~ITXV='.split(''));
const SLOT = { H: 'H', R: 'R' };

/** Dificultatea țintă 1..5: crește în lume (num) și de la o lume la alta (index). */
export function targetDifficulty(meta) {
  const g = meta.index / (TOTAL - 1), wf = (meta.num - 1) / (LEVELS_PER_WORLD - 1);
  return Math.max(1, Math.min(5, 1 + 3.6 * g + 0.9 * wf));
}
/** Lățimea țintă: ~140 → ~280 coloane. */
export function targetWidth(index) { return Math.round(140 + 140 * index / (TOTAL - 1)); }

const hasSlot = (ch, s) => ch.rows.some((row) => row.includes(s));

function pickWeighted(r, list, t) {
  const w = list.map((ch) => Math.exp(-Math.abs(ch.difficulty - t + 0.2)));
  let x = r.next() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) { x -= w[i]; if (x <= 0) return list[i]; }
  return list[list.length - 1];
}

function chooseChunk(r, world, t, prev, slot) {
  const unlocked = new Set(world.enemies);
  const maxD = Math.floor(t + 0.4);
  const ok = (ch, strict) => ch.enemies.every((e) => unlocked.has(e)) && (!strict || ch.difficulty <= maxD)
    && (!slot || hasSlot(ch, slot));
  const mechs = world.mechanics;
  const mech = r.chance(0.5) ? mechs[mechs.length - 1] : r.pick(mechs);
  const tries = [
    [CHUNKS[mech], true],
    [mechs.flatMap((m) => CHUNKS[m]), true],
    [CHUNKS[mech], false],
    [mechs.flatMap((m) => CHUNKS[m]), false],
  ];
  for (const [pool, strict] of tries) {
    let list = pool.filter((ch) => ok(ch, strict));
    if (!list.length) continue;
    if (!strict) { const lo = Math.min(...list.map((c) => c.difficulty)); list = list.filter((c) => c.difficulty === lo); }
    const fresh = list.filter((c) => c.id !== prev);
    return pickWeighted(r, fresh.length ? fresh : list, t);
  }
  return CHUNKS.base[0];
}

function walkerFor(r, world) {
  const list = world.enemies.filter((e) => WALKERS.includes(e));
  return r.chance(0.4) ? list[list.length - 1] : r.pick(list);
}
function flyerFor(r, world) {
  const list = world.enemies.filter((e) => FLYERS.includes(e));
  return r.pick(list);
}

/** Pune un segment în builder la coloana x0. `st` = { star: 'H'|'R'|null, keep: probabilitatea inamicilor }. */
function placeChunk(b, ch, x0, r, world, st) {
  const runs = [];
  for (let i = 0; i < ch.rows.length; i++) {
    const row = ch.rows[i], y = CHUNK_TOP + i;
    for (let j = 0; j < row.length; j++) {
      const c = row[j], x = x0 + j;
      if (NATIVE.has(c)) { b.put(x, y, c); continue; }
      if (c === 'e' || c === 'a') {
        if (r.chance(st.keep)) {
          const type = c === 'e' ? walkerFor(r, world) : flyerFor(r, world);
          b.enemy(type, x, y, EXTRA[type] ? { ...EXTRA[type] } : {});
        }
      } else if (c >= '1' && c <= '4') {
        const type = ch.enemies[+c - 1];
        if (r.chance(st.keep)) b.enemy(type, x, y, EXTRA[type] ? { ...EXTRA[type] } : {});
        const near = [row[j - 1], row[j + 1]].find((n) => n === '~' || n === 'V');
        if (near) b.put(x, y, near);
      } else if (c === 'P') {
        let n = 1; while (row[j + n] === 'P') n++;
        runs.push({ tx: x, ty: y, w: n }); j += n - 1;
      } else if (SLOT[c]) {
        b.put(x, y, st.star === c ? '*' : 'o');
      }
    }
  }
  runs.forEach((run, k) => b.platforms.push({ ...run, ...ch.plats[k] }));
}

export function generateLevel(meta) {
  const r = rng(hashSeed('bobo-' + meta.index));
  const world = WORLDS[meta.world];
  if (meta.isBoss) return bossArena(meta, world);
  const t = targetDifficulty(meta), target = targetWidth(meta.index);
  const keep = meta.index < 6 ? 0 : Math.min(1, 0.3 + (meta.index - 6) / 24);

  // 1) planul: segmente + legături, cu coordonate
  const plan = []; // { x, ch } | { x, flat, ... }
  const START = 12, END = 15;
  let x = START, prev = null, lastCp = 0, wantH = true, wantR = true;
  const checkpoints = [];
  const step = (ch, star) => {
    plan.push({ x, ch, star });
    x += ch.width; prev = ch.id;
    const len = 4 + r.int(0, 2);
    plan.push({ x, flat: len });
    if (x - lastCp >= 50) { checkpoints.push(x + 1); lastCp = x; }
    x += len;
  };
  while (x < target - END - 12) {
    let slot = null;
    if (wantH && x >= target * 0.25) slot = 'H';
    else if (wantR && x >= target * 0.55) slot = 'R';
    const ch = chooseChunk(r, world, t, prev, slot);
    const star = slot && hasSlot(ch, slot) ? slot : null;
    if (star === 'H') wantH = false;
    if (star === 'R') wantR = false;
    step(ch, star);
  }
  if (wantH) step(CHUNKS.base.find((c) => c.id === 'base-brickH'), 'H');
  if (wantR) step(CHUNKS.base.find((c) => c.id === 'base-gapR'), 'R');
  const width = x + END;

  // 2) construcția
  const b = new LevelBuilder(width);
  b.ground(0, START - 1);
  b.spawn = { tx: 3, ty: GROUND_TOP };
  b.put(10, 14, '*'); // steluța ușoară: pe drum, aproape de start
  b.row(6, 13, 3, 'o');
  const st = { star: null, keep };
  for (const p of plan) {
    if (p.ch) { st.star = p.star; placeChunk(b, p.ch, p.x, r, world, st); continue; }
    b.ground(p.x, p.x + p.flat - 1);
    decorate(b, p.x, p.flat, r, world, keep, meta);
  }
  b.ground(x, width - 1);
  b.row(x + 2, 14, 3, 'o');
  b.portal = { tx: width - 7, ty: GROUND_TOP };
  for (const cx of checkpoints) b.check(cx, GROUND_TOP);
  return b.build(meta);
}

/** Legătură plată: fructe, cutii, uneori o inimă sau un inamic. */
function decorate(b, x, len, r, world, keep, meta) {
  if (r.chance(0.5)) b.row(x, 13, len, 'o');
  if (r.chance(0.4)) b.put(x + 1, 11, r.pick(['G', 'G', 'Q', 'C', ...(meta.index > 10 ? ['S'] : [])]));
  if (r.chance(0.08)) b.put(x + len - 1, 12, 'h');
  if (meta.index > 8 && r.chance(keep * (0.1 + 0.1 * targetDifficulty(meta)))) b.enemy(walkerFor(r, world), x + 2, GROUND_TOP - 1);
}

/** Arenă de boss: lată 60 de coloane, fără gropi, cu platforme pentru ferit și bagheta la îndemână. */
function bossArena(meta, world) {
  const b = new LevelBuilder(60);
  b.ground(0, 59);
  b.spawn = { tx: 3, ty: GROUND_TOP };
  b.portal = { tx: 55, ty: GROUND_TOP };
  b.put(12, 14, '*');                         // ușoară
  b.row(20, 12, 4, '='); b.row(25, 9, 4, '='); b.row(30, 6, 4, '=');
  b.put(26, 8, '*');                          // sus
  b.put(31, 5, '*');                          // în vârf
  b.row(40, 12, 4, '='); b.row(45, 9, 4, '=');
  b.arc(14, 5, 12);
  b.put(8, 11, 'S'); b.put(50, 11, 'S'); b.put(30, 11, 'Q'); b.put(33, 11, 'G'); b.put(22, 10, 'h');
  b.boss = { type: world.boss.type, hp: world.boss.hp };
  return b.build(meta);
}
