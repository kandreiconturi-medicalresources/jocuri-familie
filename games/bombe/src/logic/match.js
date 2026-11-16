// Simularea meciului: pură, deterministă, 30 de pași/s. Aceeași stare + aceleași input-uri = același rezultat.
import { rng } from '../../../../shared/engine/rng.js';
import {
  W, FLAME_T, MATCH_STEPS, SHRINK_AT, SHRINK_EVERY, END_DELAY, RESPAWN,
  CORNERS, DIRS, makeRules, EMPTY, WALL, CRATE, BUSH, DOUBLE, idx, speedOf, bombAt, blastCells, lavaPhase, lavaAt, SPIRAL, HZ,
} from './rules.js';
import { placeBomb, lineBombs, throwBomb, remoteBlow, pickup, curses, dropBonuses } from './powers.js';
import { arenaById, buildArena } from './arenas.js';
import { botInput } from './bots.js';
import { moveAxis, resolvePass, slideStep } from './move.js';

export function createMatch({ arenaId = 0, players, seed = 1, rules = {} }) {
  const s = {
    arenaId, arena: arenaById(arenaId), seed, rules: makeRules(rules), mc: 0, bn: 0, phase: 'play', matchWinner: null,
    rng: rng(seed), brng: rng((seed ^ 0x9e3779b9) >>> 0),
    players: players.map((p, i) => ({
      id: p.id, name: p.name || 'Jucător', avatar: p.avatar || 'bear', color: p.color || '#ff6b6b', bot: !!p.bot, level: p.level || 'easy', corner: i, lives: 1, rt: 0, bestB: 1, bestR: 2,
    })),
  };
  startMatch(s);
  return s;
}

/** Începe (sau reia) meciul: arena nouă, toți cu vieți pline. */
export function startMatch(s) {
  s.mc++; s.matchWinner = null;
  const built = buildArena(s.arena, s.rng);
  Object.assign(s, built, { tick: 0, phase: 'play', endT: 0, bombs: [], flames: [], shrinkI: 0, gv: (s.gv || 0) + 1 });
  for (const p of s.players) { Object.assign(p, { lives: s.rules.lives, rt: 0, bestB: 1, bestR: 2 }); placeAt(s, p, CORNERS[p.corner % 4]); }
}

/** Jucătorul apare în celula [cx, cy] cu statisticile de bază. */
function placeAt(s, p, [cx, cy]) {
  Object.assign(p, {
    x: cx + 0.5, y: cy + 0.5, alive: true, rt: 0, bombs: s.bombs.filter((b) => b.o === p.id).length, maxBombs: 1, range: 2, spd: 0, kick: true, glove: false, remote: false,
    cu: 0, ce: 0, ci: 0, la: -99, bp2: false, bp: false, sdx: 0, sdy: 0, slide: 0, tp: 0, face: 2, mv: false,
  });
}

/** Celula de start; dacă arena s-a strâns peste ea, cea mai apropiată celulă liberă. */
function spawnCell(s, p) {
  const c = CORNERS[p.corner % 4];
  if (s.grid[idx(c[0], c[1])] === EMPTY) return c;
  let best = c, bd = 1e9;
  for (let i = 0; i < s.grid.length; i++) {
    const x = i % W, y = (i / W) | 0, d = Math.abs(x - c[0]) + Math.abs(y - c[1]);
    if (s.grid[i] === EMPTY && d < bd && !bombAt(s, x, y)) { bd = d; best = [x, y]; }
  }
  return best;
}

/** Revenirea se amână cât timp celula de start sau vecinii ei sunt în raza unei bombe/flăcări, sau altcineva stă lângă ea. */
function respawnSafe(s, c) {
  const near = [idx(c[0], c[1]), ...DIRS.map(([dx, dy]) => idx(c[0] + dx, c[1] + dy))];
  const bad = new Set(s.flames.map((f) => f.i));
  for (const b of s.bombs) for (const i of blastCells(s, b)) bad.add(i);
  if (near.some((i) => bad.has(i))) return false;
  return !s.players.some((q) => q.alive && Math.hypot(q.x - c[0] - 0.5, q.y - c[1] - 0.5) < 1.1);
}

function respawns(s, ev) {
  for (const p of s.players) {
    if (p.alive || p.lives <= 0) continue;
    if (p.rt > 0) p.rt--;
    const c = p.rt <= 0 && spawnCell(s, p);
    if (c && respawnSafe(s, c)) { placeAt(s, p, c); ev.push({ e: 'respawn', id: p.id, x: p.x, y: p.y }); }
  }
}

const withLives = (s) => s.players.filter((p) => p.lives > 0);

function movePlayer(s, p, inp, ev) {
  const sp = speedOf(p) / HZ;
  let dx = inp.dx | 0, dy = inp.dy | 0;
  if (dx && dy) dy = 0; // doar pe o axă odată (culoar)
  p.mv = !!(dx || dy);
  if (p.mv) { p.face = dx > 0 ? 1 : dx < 0 ? 3 : dy > 0 ? 2 : 0; p.sdx = dx; p.sdy = dy; p.slide = s.arena.ice ? 9 : 0; }
  else if (p.slide > 0) { p.slide--; slideStep(s, p, p.sdx, p.sdy, sp * 0.7); }
  if (dx || dy) moveAxis(s, p, dx, dy, sp);
  if (s.arena.belts) {
    const b = s.belts[idx(Math.floor(p.x), Math.floor(p.y))];
    if (b) moveAxis(s, p, DIRS[b - 1][0], DIRS[b - 1][1], 1.3 / HZ);
  }
  const pr = s.arena.portals;
  if (pr && p.tp > 0) p.tp--;
  else if (pr) {
    const cx = Math.floor(p.x), cy = Math.floor(p.y);
    for (const q of pr) {
      if (q[0] === cx && q[1] === cy && Math.abs(p.x - cx - 0.5) < 0.3 && Math.abs(p.y - cy - 0.5) < 0.3) {
        p.x = q[2] + 0.5; p.y = q[3] + 0.5; p.tp = 24; ev.push({ e: 'tele', x: q[2], y: q[3] }); break;
      }
    }
  }
}

function explode(s, ev) {
  const queue = s.bombs.filter((b) => b.t <= 0);
  const spawn = [];
  while (queue.length) {
    const b = queue.shift();
    const k = s.bombs.indexOf(b);
    if (k < 0) continue;
    s.bombs.splice(k, 1);
    const o = s.players.find((q) => q.id === b.o);
    if (o) o.bombs = Math.max(0, o.bombs - 1);
    ev.push({ e: 'explode', x: b.x, y: b.y });
    for (const i of blastCells(s, b)) {
      const f = s.flames.find((q) => q.i === i);
      if (f) { f.t = FLAME_T; if (f.o !== b.o) f.o = ''; } else s.flames.push({ i, t: FLAME_T, o: b.o });
      const g = s.grid[i], x = i % W, y = (i / W) | 0;
      if (g === CRATE || g === BUSH) {
        s.grid[i] = EMPTY; s.gv++;
        if (g === CRATE) { ev.push({ e: 'crate', x, y, loot: s.loot[i] }); if (s.loot[i]) spawn.push(i); } else ev.push({ e: 'bush', x, y });
      } else if (s.pick[i]) { s.pick[i] = 0; s.gv++; }
      const ob = bombAt(s, x, y);
      if (ob && ob !== b && ob.t > 0) { ob.t = 0; queue.push(ob); }
    }
  }
  for (const i of spawn) { s.pick[i] = s.loot[i]; s.loot[i] = 0; s.gv++; }
}

/** Lovit: pierzi o viață și lași câteva bonusuri; la 0 vieți ieși. */
function kill(s, p, ev) {
  p.alive = false; p.lives--; p.rt = RESPAWN;
  ev.push({ e: 'hit', id: p.id, x: p.x, y: p.y });
  if (p.lives <= 0) ev.push({ e: 'out', id: p.id });
  dropBonuses(s, p);
}

function moveBombs(s) {
  for (const b of s.bombs) {
    if (b.fl > 0) b.fl--;
    if (!b.dx && !b.dy) continue;
    if (++b.mt < 3) continue;
    b.mt = 0;
    const nx = b.x + b.dx, ny = b.y + b.dy, g = s.grid[idx(nx, ny)];
    const hitP = s.players.some((q) => q.alive && Math.floor(q.x) === nx && Math.floor(q.y) === ny);
    if (g === WALL || g === CRATE || bombAt(s, nx, ny) || hitP || lavaAt(s, nx, ny)) { b.dx = 0; b.dy = 0; } else { b.x = nx; b.y = ny; }
  }
}

function shrink(s, ev) {
  if (s.tick < SHRINK_AT || (s.tick - SHRINK_AT) % SHRINK_EVERY) return;
  while (s.shrinkI < SPIRAL.length && s.grid[SPIRAL[s.shrinkI]] === WALL) s.shrinkI++;
  if (s.shrinkI >= SPIRAL.length) return;
  const i = SPIRAL[s.shrinkI++], x = i % W, y = (i / W) | 0;
  s.grid[i] = WALL; s.pick[i] = 0; s.gv++;
  s.bombs = s.bombs.filter((b) => !(b.x === x && b.y === y));
  for (const p of s.players) {
    if (p.alive && Math.floor(p.x) === x && Math.floor(p.y) === y) kill(s, p, ev);
  }
  ev.push({ e: 'block', x, y });
}

/** Câștigă cine are cele mai multe vieți; la egalitate nu câștigă nimeni. */
function finishMatch(s, ev) {
  const top = Math.max(...s.players.map((p) => p.lives)), best = s.players.filter((p) => p.lives === top);
  s.matchWinner = top > 0 && best.length === 1 ? best[0].id : null;
  s.phase = 'match_end';
  ev.push({ e: 'match', winner: s.matchWinner });
}

/** Un pas de simulare. `inputs` = { [id]: { dx, dy, bomb } }. Întoarce lista de evenimente. */
export function step(s, inputs = {}) {
  const ev = [];
  if (s.phase === 'match_end') return ev;
  s.tick++;
  respawns(s, ev);
  for (const p of s.players) {
    if (!p.alive) continue;
    let inp = (p.bot && !inputs[p.id]) ? botInput(s, p.id, s.brng) : (inputs[p.id] || {});
    if (p.cu === 1) inp = { ...inp, dx: -(inp.dx | 0), dy: -(inp.dy | 0) }; // „Ciudățel”: mers invers
    movePlayer(s, p, inp, ev);
    if (inp.bomb && (p.bot || !p.bp)) {
      if (!p.bot && s.tick - p.la <= DOUBLE && lineBombs(s, p, ev)) p.la = -99;
      else { placeBomb(s, p, ev); p.la = s.tick; }
    } else if (p.cu === 2 && s.tick % 8 === 0) placeBomb(s, p, ev); // „Ciudățel”: bombe care se pun singure
    p.bp = !!inp.bomb;
    if (inp.b && !p.bp2 && !(p.glove && throwBomb(s, p, ev)) && p.remote) remoteBlow(s, p);
    p.bp2 = !!inp.b;
  }
  resolvePass(s);
  curses(s, ev);
  moveBombs(s);
  for (const b of s.bombs) b.t--;
  explode(s, ev);
  for (let k = s.flames.length - 1; k >= 0; k--) if (--s.flames[k].t <= 0) s.flames.splice(k, 1);
  const lava = s.arena.lava && lavaPhase(s) === 2;
  for (const p of s.players) {
    if (!p.alive) continue;
    const cx = Math.floor(p.x), cy = Math.floor(p.y), i = idx(cx, cy);
    pickup(s, p, ev);
    if (lava && lavaAt(s, cx, cy)) { kill(s, p, ev); continue; }
    for (const f of s.flames) {
      if (f.i === i) { kill(s, p, ev); break; }
    }
  }
  shrink(s, ev);
  if (!s.endT && withLives(s).length <= 1) s.endT = END_DELAY;
  if ((s.endT > 0 && --s.endT === 0) || s.tick >= MATCH_STEPS) finishMatch(s, ev);
  return ev;
}
