// Aplică pe joc ce vine din rețea: starea lumii de la gazdă (inamici, boss, platforme) și evenimentele celorlalți.
import { TS } from '../tiles.js';
import { sfx } from '../../../../shared/engine/audio.js';
import { killEnemy } from '../enemies.js';
import { hitBoss, waveHits, bodyHits } from '../boss.js';
import { applyTileEvent, applyEnemy, applyBoss, applyPlatform } from './logic.js';


/** Starea lumii de la gazdă: { e: [inamici], b: boss|0, p: [platforme] }. */
export function applyWorld(g, w) {
  if (Array.isArray(w.e)) {
    const byId = new Map();
    for (const e of g.enemies) byId.set(e.id, e);
    for (const a of w.e) { const e = Array.isArray(a) && byId.get(a[0]); if (e) applyEnemy(e, a); }
  }
  if (Array.isArray(w.p)) w.p.forEach((a, i) => { if (g.platforms[i]) applyPlatform(g.platforms[i], a); });
  if (w.b === 0 && g.boss) { // boss-ul a fost înfrânt la gazdă
    g.boss = null; g.bossDown = true; g.shake = 8; sfx('check');
    g.particles.sparkle(g.level.portal.tx * TS + 16, g.level.portal.ty * TS - 40, 20);
  } else if (Array.isArray(w.b) && g.boss) {
    if (applyBoss(g.boss, w.b)) g.bossIntro = 90;
  }
}

/** Un inamic pe un client: se mișcă lin spre ultima poziție primită; animația și numărătorile merg local. */
export function stepEnemy(e) {
  e.t++;
  if (e.pred > 0) e.pred--;
  if (e.nx !== undefined) { e.x += (e.nx - e.x) * 0.45; e.y += (e.ny - e.y) * 0.45; }
  if (e.knock) e.rot += 0.25 * (e.vx > 0 ? 1 : -1);
  else if (e.dead > 0) e.dead--;
}

/** Boss-ul pe un client: doar afișare lină + verificarea loviturilor jucătorului local. */
export function stepBoss(g) {
  const b = g.boss;
  if (!b) return;
  b.t++;
  if (b.inv > 0) b.inv--;
  if (b.nx !== undefined) { b.x += (b.nx - b.x) * 0.45; b.y += (b.ny - b.y) * 0.45; }
  for (let i = b.waves.length - 1; i >= 0; i--) {
    const w = b.waves[i]; w.x += w.vx; w.t++;
    if (w.t > 100) b.waves.splice(i, 1);
  }
  waveHits(g, b);
  if (b.state !== 'sleep' && !b.dead) bodyHits(g, b);
}

/** Efectele unui eveniment de grilă deja aplicat (vezi applyTileEvent). */
function tileEffects(g, d) {
  const lv = g.level, P = g.particles, x = d.tx * TS + TS / 2;
  if (d.kind === 'pick') {
    if (d.c === 'o') g.fruits++;
    else if (d.c === '*') g.starSet.add(d.tx + ',' + d.ty);
    if (d.c !== 'h') sfx('fruit');
    P.sparkle(x, d.ty * TS + 16, 4);
    return;
  }
  lv.fx.bump[d.ty * lv.width + d.tx] = 8;
  if (d.c === 'G') { g.fruits++; sfx('fruit'); P.sparkle(x, d.ty * TS - 8, 5); }
  else if (d.item) {
    sfx('bump');
    g.items.push({ kind: d.item, x, y: d.ty * TS + 16, ty0: d.ty * TS - 16, t: 0, rise: 22, id: d.ty * lv.width + d.tx });
  } else if (d.n === '.') { sfx('break'); P.burst(x, d.ty * TS + 16, '#b0703a', 10); }
  else sfx('bump');
}

/** Evenimentul `ev` de la jucătorul `from` (obiectul lui de joc). `net` dă gazda și evidența sosirilor. */
export function handleEvent(g, ev, from, net) {
  switch (ev.e) {
    case 'b': case 'p': {
      const d = applyTileEvent(g.level.grid, g.level.width, ev);
      if (d) tileEffects(g, d);
      break;
    }
    case 'i': { const it = g.items.find((o) => o.id === ev.id); if (it) { it.gone = true; g.particles.sparkle(it.x, it.y, 6); } break; }
    case 'c': g.activateCp(ev.i | 0); break;
    case 's':
      if (from && typeof ev.x === 'number' && typeof ev.vx === 'number') g.bullets.push({ x: ev.x, y: ev.y, vx: ev.vx, t: 0, owner: from.i, vis: true });
      break;
    case 'f': if (from) g.particles.sparkle(from.x + from.w / 2, from.y, 10); break;
    case 'k': // doar gazda: un client a lovit un inamic sau boss-ul
      if (!net.host) break;
      if (ev.id === -1) hitBoss(g);
      else { const e = g.enemies.find((o) => o.id === ev.id); if (e && (ev.how === 'stomp' || ev.how === 'knock')) killEnemy(g, e, ev.how); }
      break;
    default: break;
  }
}

/** Jucătorii de la distanță care stau pe un bloc care se prăbușește îl pornesc și pe ecranul meu. */
export function feedCrumbs(g, remotes) {
  const lv = g.level;
  for (const r of remotes) {
    if (r.dead || !r.onGround) continue;
    const tx = Math.floor((r.x + r.w / 2) / TS), ty = Math.floor((r.y + r.h + 1) / TS);
    if (lv.grid[ty] && lv.grid[ty][tx] === 'X') { const k = ty * lv.width + tx; lv.fx.crumb[k] = (lv.fx.crumb[k] || 0) + 2; }
  }
}

