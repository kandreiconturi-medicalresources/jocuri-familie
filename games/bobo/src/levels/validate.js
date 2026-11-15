// Validator de niveluri: structură + accesibilitate prin căutare peste stări de joc,
// folosind chiar `stepPlayer` din physics.js (macro-uri de input: mers, sărituri, înot).
import { stepPlayer, makeBody, SMALL } from '../physics.js';
import { TS, ROWS, isSolid } from '../tiles.js';

const VALID = new Set('.#LBGQCSgoh*^~ITXV='.split(''));
const MAXF = 150;      // cadre maxime pe un macro
const MAX_NODES = 60000;
const KG = 4, KY = 3;  // rezoluția stărilor: 16 px pe x, 8 px pe y
const GROUND = 0, WATER = 1, SPRING = 2;

/** Grila cu platformele mobile ca plăci `=` pe tot traseul. */
function paint(level) {
  const rows = level.grid.map((r) => (typeof r === 'string' ? r.split('') : r.slice()));
  for (const p of level.platforms || []) {
    const x0 = Math.min(p.tx, p.tx + p.dx), x1 = Math.max(p.tx, p.tx + p.dx) + p.w - 1;
    const y0 = Math.min(p.ty, p.ty + p.dy), y1 = Math.max(p.ty, p.ty + p.dy);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (rows[y] && rows[y][x] === '.') rows[y][x] = '=';
  }
  return rows.map((r) => r.join(''));
}

function checkStructure(level, errors) {
  const { width, grid } = level;
  if (level.rows !== ROWS) errors.push(`rows=${level.rows}`);
  if (!Array.isArray(grid) || grid.length !== ROWS) { errors.push('grila nu are 17 rânduri'); return false; }
  for (let y = 0; y < ROWS; y++) {
    if (grid[y].length !== width) { errors.push(`rândul ${y} are lățimea ${grid[y].length}, nu ${width}`); return false; }
  }
  let stars = 0;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < width; x++) {
    const c = grid[y][x];
    if (!VALID.has(c)) { errors.push(`caracter invalid '${c}' la ${x},${y}`); return false; }
    if (c === '*') stars++;
  }
  if (stars !== 3) errors.push(`${stars} steluțe în loc de 3`);
  if (level.isBoss) {
    if (!level.boss) errors.push('nivel de boss fără boss');
    if (width < 50 || width > 80) errors.push(`arena de boss are lățimea ${width}`);
    for (let x = 0; x < width; x++) if (!isSolid(grid[15][x])) errors.push(`groapă în arena de boss la ${x}`);
  } else {
    if (level.boss) errors.push('boss într-un nivel obișnuit');
    if (width < 120 || width > 320) errors.push(`lățime neașteptată ${width}`);
  }
  const onTerrain = (p, what) => {
    const inb = p && p.tx >= 0 && p.tx < width && p.ty >= 1 && p.ty < ROWS;
    if (!inb) { errors.push(`${what} în afara grilei`); return; }
    const s = grid[p.ty][p.tx], a = grid[p.ty - 1][p.tx];
    if (!isSolid(s)) errors.push(`${what} nu e pe teren (${p.tx},${p.ty}='${s}')`);
    if (isSolid(a) || a === '^' || a === 'V') errors.push(`${what} are ceva în loc (${p.tx},${p.ty - 1}='${a}')`);
  };
  onTerrain(level.spawn, 'spawn');
  onTerrain(level.portal, 'portalul');
  (level.checkpoints || []).forEach((c, i) => onTerrain(c, `checkpoint ${i}`));
  return true;
}

export function validateLevel(level) {
  const errors = [];
  if (!checkStructure(level, errors)) return { ok: false, errors };
  const info = reach(level, errors);
  return { ok: errors.length === 0, errors, ...info };
}

/** Întoarce `reachedX` (cea mai din dreapta coloană atinsă) pentru depanare. */
function reach(level, errors) {
  const W = level.width, rows = paint(level);
  const lv = { width: W, grid: rows };
  const names = [], tmap = new Int16Array(W * ROWS);
  const addTarget = (tx, ty, name) => { names.push(name); tmap[ty * W + tx] = names.length; };
  addTarget(level.portal.tx, level.portal.ty - 1, 'portal');
  level.checkpoints.forEach((c, i) => addTarget(c.tx, c.ty - 1, `checkpoint ${i} (${c.tx},${c.ty})`));
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < W; x++) if (rows[y][x] === '*') addTarget(x, y, `steluță (${x},${y})`);
  const found = new Uint8Array(names.length + 1);
  let remaining = names.length;

  const inp = { left: false, right: false, jump: false };
  const hits = [];
  let sprung = false;

  const probe = (p) => {
    if (p.y > ROWS * TS) return 1;
    const tx0 = Math.floor(p.x / TS), tx1 = Math.floor((p.x + p.w - 1) / TS);
    const ty0 = Math.floor(p.y / TS), ty1 = Math.floor((p.y + p.h - 1) / TS);
    for (let ty = ty0; ty <= ty1; ty++) {
      if (ty < 0 || ty >= ROWS) continue;
      const row = rows[ty];
      for (let tx = tx0; tx <= tx1; tx++) {
        const c = row[tx];
        if (c === '^' || c === 'V') return 1;
        const id = tmap[ty * W + tx];
        if (id) hits.push(id);
      }
    }
    return 0;
  };
  const adv = (p, dir, jump) => {
    inp.left = dir < 0; inp.right = dir > 0; inp.jump = jump;
    if (stepPlayer(p, inp, lv).sprung) sprung = true;
    return probe(p);
  };
  const copy = (s, d) => {
    d.x = s.x; d.y = s.y; d.vx = s.vx; d.vy = s.vy; d.onGround = s.onGround; d.hitWall = s.hitWall;
    d.groundTile = s.groundTile; d.inWater = s.inWater; d.face = s.face; d.coyote = s.coyote;
    d.jumpBuf = s.jumpBuf; d.prevJump = s.prevJump;
  };
  const inWaterNow = (p) => {
    const ty = Math.floor((p.y + p.h / 2) / TS), tx = Math.floor((p.x + p.w / 2) / TS);
    return ty >= 0 && ty < ROWS && rows[ty][tx] === '~';
  };

  const seen = new Set();
  const stack = [];
  let nodes = 0, maxX = 0;
  const w = makeBody(0, 0);

  /** Încheie un macro: acceptă starea ca nod nou (dacă e nevăzută) și validează țintele atinse. */
  const accept = (p, kind) => {
    for (const id of hits) if (!found[id]) { found[id] = 1; remaining--; }
    const key = kind * 1e7 + (Math.max(0, p.x) >> KG) * 100 + (Math.max(0, p.y) >> KY);
    if (seen.has(key)) return;
    seen.add(key); nodes++; if (p.x > maxX) maxX = p.x;
    stack.push({ s: Object.assign({}, p), kind });
  };
  const begin = (src) => { copy(src, w); hits.length = 0; sprung = false; return w; };
  const finish = (p, landed) => {
    if (sprung) return accept(p, SPRING);
    if (landed || p.onGround) return accept(p, GROUND);
    if (inWaterNow(p)) return accept(p, WATER);
  };

  const walk = (src, dir, n) => {
    const p = begin(src);
    for (let f = 0; f < n; f++) { if (adv(p, dir, false)) return; if (sprung) return finish(p); }
    for (let f = 0; f < 80 && !p.onGround; f++) { if (adv(p, dir, false)) return; if (sprung) return finish(p); }
    if (p.onGround) finish(p, true);
  };
  // mode: -1 = fugă până la marginea terenului, altfel numărul de cadre de elan
  const jump = (src, dir, mode, hold, air) => {
    const p = begin(src);
    if (mode < 0) {
      let f = 0;
      for (; f < 45; f++) { if (adv(p, dir, false)) return; if (sprung) return finish(p); if (!p.onGround) break; }
      if (f >= 45) return;
    } else for (let f = 0; f < mode; f++) { if (adv(p, dir, false)) return; if (sprung) return finish(p); }
    let airborne = false;
    for (let f = 0; f < MAXF; f++) {
      if (adv(p, air, f < hold)) return;
      if (sprung) return finish(p);
      if (!p.onGround) airborne = true; else if (airborne) return finish(p, true);
    }
    finish(p);
  };
  const fly = (src, dir, hold, drift) => { // din starea de după o trambulină; direcția se ține `drift` cadre
    const p = begin(src);
    p.prevJump = hold > 0; // butonul de săritură e ținut deja apăsat (altfel o apăsare nouă taie săritura trambulinei)
    for (let f = 0; f < MAXF; f++) {
      if (adv(p, f < drift ? dir : 0, f < hold)) return;
      if (sprung) return finish(p);
      if (p.onGround) return finish(p, true);
    }
    finish(p);
  };
  const swim = (src, dir, period) => {
    const p = begin(src);
    for (let f = 0; f < 45; f++) { if (adv(p, dir, f % period === 0)) return; if (sprung) return finish(p); }
    finish(p);
  };

  // pornire: spawn, lăsat să cadă pe teren
  const sp = makeBody(level.spawn.tx * TS + (TS - SMALL.w) / 2, level.spawn.ty * TS - SMALL.h);
  hits.length = 0;
  for (let f = 0; f < 6; f++) adv(sp, 0, false);
  accept(sp, GROUND);

  while (stack.length && remaining > 0 && nodes < MAX_NODES) {
    const { s, kind } = stack.pop();
    if (kind === SPRING) {
      fly(s, 0, 40, 0);
      for (const d of [-1, 1]) for (const dr of [10, 20, 35, 999]) { fly(s, d, 40, dr); fly(s, d, 0, dr); }
    } else {
      for (const d of [-1, 1]) {
        walk(s, d, 6); walk(s, d, 16);
        for (const h of [7, 14, 40]) { jump(s, d, -1, h, d); jump(s, d, 8, h, d); jump(s, d, 0, h, d); }
      }
      for (const h of [7, 14, 40]) jump(s, 1, 0, h, 0);
      if (kind === WATER || inWaterNow(s)) for (const d of [-1, 0, 1]) for (const per of [7, 11, 17]) swim(s, d, per);
    }
  }
  if (remaining > 0) {
    for (let i = 0; i < names.length; i++) if (!found[i + 1]) errors.push(`inaccesibil: ${names[i]}`);
    if (nodes >= MAX_NODES) errors.push('căutarea a depășit bugetul de stări');
  }
  return { reachedX: Math.floor(maxX / TS), nodes };
}
