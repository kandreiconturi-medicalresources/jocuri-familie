// Fizica jucătorului și a corpurilor, la pas fix 60 Hz (constantele vin din jocul original).
// Fără efecte vizuale sau sunet: întoarce evenimente; o folosesc jocul ȘI validatorul de niveluri.
import { TS, ROWS, isSolid, isOneWay } from './tiles.js';

export const ACC = 0.5, MAX = 4.2, GRAV = 0.55, JUMP = -12.4, MAXF = 12;
export const SPRING_JUMP = JUMP * 1.45;
export const SMALL = { w: 22, h: 28 }, BIG = { w: 28, h: 40 };

/** Placa de la (tx,ty); în afara grilei: perete lateral la stânga/dreapta, gol sus/jos. */
export function tileAt(level, tx, ty) {
  if (tx < 0 || tx >= level.width) return 'L';
  if (ty < 0 || ty >= ROWS) return '.';
  return level.grid[ty][tx];
}
const solidAt = (lv, tx, ty) => isSolid(tileAt(lv, tx, ty));

export function makeBody(x, y, w = SMALL.w, h = SMALL.h) {
  return { x, y, w, h, vx: 0, vy: 0, onGround: false, hitWall: false, groundTile: '.', inWater: false,
    face: 1, coyote: 0, jumpBuf: 0, prevJump: false };
}

export function moveX(o, lv) {
  o.x += o.vx; o.hitWall = false;
  const y0 = Math.floor(o.y / TS), y1 = Math.floor((o.y + o.h - 1) / TS);
  if (o.vx > 0) {
    const tx = Math.floor((o.x + o.w - 1) / TS);
    for (let ty = y0; ty <= y1; ty++) if (solidAt(lv, tx, ty)) { o.x = tx * TS - o.w; o.vx = 0; o.hitWall = true; break; }
  } else if (o.vx < 0) {
    const tx = Math.floor(o.x / TS);
    for (let ty = y0; ty <= y1; ty++) if (solidAt(lv, tx, ty)) { o.x = (tx + 1) * TS; o.vx = 0; o.hitWall = true; break; }
  }
}

/** Mișcare verticală. Întoarce {tx,ty} dacă a lovit cu capul o placă (pentru cutii/cărămizi). */
export function moveY(o, lv) {
  const prevBottom = o.y + o.h;
  o.y += o.vy; o.onGround = false; o.groundTile = '.';
  const x0 = Math.floor(o.x / TS), x1 = Math.floor((o.x + o.w - 1) / TS);
  if (o.vy > 0) {
    const ty = Math.floor((o.y + o.h - 1) / TS);
    for (let tx = x0; tx <= x1; tx++) {
      const c = tileAt(lv, tx, ty);
      if (isSolid(c) || (isOneWay(c) && prevBottom <= ty * TS + 0.5)) {
        o.y = ty * TS - o.h; o.vy = 0; o.onGround = true; o.groundTile = c; o.groundX = tx; o.groundY = ty; break;
      }
    }
  } else if (o.vy < 0) {
    const ty = Math.floor(o.y / TS), mid = Math.floor((o.x + o.w / 2) / TS);
    let hit = -1;
    if (solidAt(lv, mid, ty)) hit = mid; else for (let tx = x0; tx <= x1; tx++) if (solidAt(lv, tx, ty)) { hit = tx; break; }
    if (hit >= 0) { o.y = (ty + 1) * TS; o.vy = 0; return { tx: hit, ty }; }
  }
  return null;
}

export function overlapsSolid(o, lv) {
  for (let ty = Math.floor(o.y / TS); ty <= Math.floor((o.y + o.h - 1) / TS); ty++)
    for (let tx = Math.floor(o.x / TS); tx <= Math.floor((o.x + o.w - 1) / TS); tx++) if (solidAt(lv, tx, ty)) return true;
  return false;
}

function bodyInWater(o, lv) {
  const tx = Math.floor((o.x + o.w / 2) / TS), ty = Math.floor((o.y + o.h / 2) / TS);
  return tileAt(lv, tx, ty) === '~';
}

/**
 * Un pas de fizică pentru jucător. `inp` = { left, right, jump }.
 * Întoarce evenimente: { jumped, swam, landed (viteza de impact), bump: {tx,ty}|null, sprung }.
 */
export function stepPlayer(p, inp, lv) {
  const ev = { jumped: false, swam: false, landed: 0, bump: null, sprung: false };
  const onIce = p.onGround && p.groundTile === 'I';
  const acc = onIce ? ACC * 0.25 : ACC;
  p.inWater = bodyInWater(p, lv);

  if (inp.left && !inp.right) { p.vx -= acc; p.face = -1; }
  else if (inp.right && !inp.left) { p.vx += acc; p.face = 1; }
  else p.vx *= p.onGround ? (onIce ? 0.985 : 0.72) : 0.94;
  if (Math.abs(p.vx) < 0.05) p.vx = 0;
  const max = p.inWater ? MAX * 0.6 : MAX;
  p.vx = Math.max(-max, Math.min(max, p.vx));

  const pressed = inp.jump && !p.prevJump; p.prevJump = inp.jump;
  if (pressed) p.jumpBuf = 7; else if (p.jumpBuf > 0) p.jumpBuf--;
  p.coyote = p.onGround ? 6 : Math.max(0, p.coyote - 1);

  if (p.inWater) {
    if (pressed) { p.vy = -4.6; ev.swam = true; p.jumpBuf = 0; }
    p.vy += GRAV * 0.3; p.vy = Math.min(p.vy, 2.2);
  } else {
    if (p.jumpBuf > 0 && p.coyote > 0) { p.vy = JUMP; p.jumpBuf = 0; p.coyote = 0; p.onGround = false; ev.jumped = true; }
    p.vy += GRAV; if (!inp.jump && p.vy < 0) p.vy += GRAV * 1.2;
    p.vy = Math.min(p.vy, MAXF);
  }

  const wasGround = p.onGround, preVy = p.vy;
  moveX(p, lv);
  ev.bump = moveY(p, lv);
  if (p.onGround && p.groundTile === 'T') { p.vy = SPRING_JUMP; p.onGround = false; p.coyote = 0; p.jumpBuf = 0; ev.sprung = true; }
  if (!wasGround && p.onGround) ev.landed = preVy;
  return ev;
}

/** Placa sub centrul corpului (pt. țepi/lavă/colectabile se verifică separat în joc). */
export function tilesTouched(o, lv, fn) {
  for (let ty = Math.floor(o.y / TS); ty <= Math.floor((o.y + o.h - 1) / TS); ty++)
    for (let tx = Math.floor(o.x / TS); tx <= Math.floor((o.x + o.w - 1) / TS); tx++) fn(tileAt(lv, tx, ty), tx, ty);
}
