// Elemente dinamice: bombe, flăcări, bonusuri, benzi, teleportoare, lavă, personaje.
import { W, H, FLAME_T, FUSE, FLIGHT, BUSH, lavaPhase } from '../logic/rules.js';
import { drawSpr, hasFrame } from '../../../bobo/src/atlas.js';
import { drawAvatar } from '../../../../shared/engine/profiles.js';
import { T } from './arena.js';
import { drawBonusIcon } from './icons.js';

const TAU = Math.PI * 2;
const circle = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
const cx = (x) => x * T, cy = (y) => y * T;

export function drawBelts(c, s, now) {
  if (!s.arena.belts) return;
  const off = (now * 14) % T;
  for (const [x, y, d] of s.arena.belts) {
    c.save(); c.translate(cx(x) + T / 2, cy(y) + T / 2); c.rotate(d * Math.PI / 2);
    c.fillStyle = 'rgba(40,30,60,.28)'; c.fillRect(-T / 2, -T / 2, T, T);
    c.fillStyle = 'rgba(255,225,120,.85)';
    for (let k = -1; k < 2; k++) {
      const u = ((k * T / 2 + off) % T) - T / 2;
      c.beginPath(); c.moveTo(u + 6, 0); c.lineTo(u - 4, -9); c.lineTo(u - 4, 9); c.fill();
    }
    c.restore();
  }
}

export function drawPortals(c, s, now) {
  if (!s.arena.portals) return;
  for (const q of s.arena.portals) {
    for (const [x, y] of [[q[0], q[1]], [q[2], q[3]]]) {
      c.save(); c.translate(cx(x) + T / 2, cy(y) + T / 2);
      for (let k = 0; k < 3; k++) {
        c.rotate(now * (2 - k * 0.6)); c.strokeStyle = ['#7b2cff', '#4cc9f0', '#fff'][k]; c.lineWidth = 3;
        c.beginPath(); c.ellipse(0, 0, T * (0.42 - k * 0.1), T * (0.2 - k * 0.04), 0, 0, TAU); c.stroke();
      }
      c.restore();
    }
  }
}

export function drawLava(c, s, now) {
  if (!s.arena.lava) return;
  const ph = lavaPhase(s);
  for (const [x, y] of s.arena.lava) {
    const px = cx(x), py = cy(y), pulse = 0.5 + 0.5 * Math.sin(now * (ph === 1 ? 18 : 4));
    c.fillStyle = ph === 2 ? '#ff4d00' : ph === 1 ? `rgb(${160 + pulse * 90},60,10)` : '#4a1a12';
    c.fillRect(px + 2, py + 2, T - 4, T - 4);
    if (ph) { c.fillStyle = ph === 2 ? '#ffd23f' : 'rgba(255,200,60,.5)'; circle(c, px + T / 2, py + T / 2, T * (0.18 + 0.1 * pulse)); }
    c.strokeStyle = '#2a0a06'; c.lineWidth = 2; c.strokeRect(px + 2, py + 2, T - 4, T - 4);
  }
}

export function drawPickups(c, s, now) {
  for (let i = 0; i < s.pick.length; i++) {
    const k = s.pick[i];
    if (!k || s.grid[i] === BUSH) continue;
    const x = cx(i % W) + T / 2, y = cy((i / W) | 0) + T / 2 + Math.sin(now * 5 + i) * 2.5, r = T * 0.34;
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(0, r + 2, r * 0.8, 3, 0, 0, TAU); c.fill();
    drawBonusIcon(c, k, r);
    c.restore();
  }
}

export function drawBombs(c, s, now, pos) {
  const live = new Set();
  for (const b of s.bombs) {
    let q = pos.get(b.uid);
    if (!q) { q = { x: b.x, y: b.y }; pos.set(b.uid, q); }
    live.add(b.uid);
    let lift = 0;
    if (b.fl > 0) { // zboară de la (fx, fy) la (x, y), pe o curbă
      const u = 1 - b.fl / FLIGHT;
      q.x = b.fx + (b.x - b.fx) * u; q.y = b.fy + (b.y - b.fy) * u; lift = Math.sin(u * Math.PI) * T * 0.9;
    } else { q.x += (b.x - q.x) * 0.4; q.y += (b.y - q.y) * 0.4; }
    const k = 1 + 0.1 * Math.sin(now * (7 + (FUSE - b.t) * 0.2)) + (b.t < 12 ? 0.08 : 0);
    const w = T * 0.86 * k, x = cx(q.x) + T / 2, ys = cy(q.y) + T / 2 + 2, y = ys - lift;
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x, ys + T * 0.33, w * 0.4, 4, 0, 0, TAU); c.fill();
    const name = b.t < 28 && ((b.t >> 2) & 1) && hasFrame('tiles', 'bomb_active') ? 'bomb_active' : 'bomb';
    if (hasFrame('tiles', name)) drawSpr(c, 'tiles', name, x - w / 2, y - w / 2, w, w);
    else { c.fillStyle = '#222'; circle(c, x, y, w * 0.4); }
    c.fillStyle = (b.t >> 1) & 1 ? '#ffd23f' : '#ff5a1a'; circle(c, x + w * 0.28, y - w * 0.42, 3 + (b.t < 20 ? 1.5 : 0)); // scânteia fitilului
  }
  for (const u of pos.keys()) if (!live.has(u)) pos.delete(u);
}

export function drawFlames(c, s, now) {
  if (!s.flames.length) return;
  const m = new Uint8Array(W * H);
  for (const f of s.flames) m[f.i] = 1;
  for (const f of s.flames) {
    const age = FLAME_T - f.t, grow = Math.min(1, (age + 2) / 4) * Math.min(1, f.t / 4), fl = 1 + 0.09 * Math.sin(now * 38 + f.i * 1.7);
    const x = cx(f.i % W) + T / 2, y = cy((f.i / W) | 0) + T / 2, R = T * 0.5 * grow * fl;
    c.fillStyle = '#ff6a14';
    if (f.i % W < W - 1 && m[f.i + 1]) c.fillRect(x, y - R * 0.8, T, R * 1.6);
    if (f.i + W < W * H && m[f.i + W]) c.fillRect(x - R * 0.8, y, R * 1.6, T);
    circle(c, x, y, R);
    c.fillStyle = '#ffc12e'; circle(c, x, y, R * 0.68);
    c.fillStyle = '#fff6c0'; circle(c, x + Math.sin(now * 20 + f.i) * 2, y, R * 0.34);
  }
}

const avCache = new Map();
function avatarImg(p, r, scale) {
  const k = p.avatar + p.color + r + '@' + scale;
  let a = avCache.get(k);
  if (!a) {
    a = document.createElement('canvas');
    a.width = a.height = Math.ceil(2.2 * r * scale);
    const c = a.getContext('2d'); c.scale(scale, scale);
    drawAvatar(c, p.avatar, 1.1 * r, 1.1 * r, r, p.color);
    avCache.set(k, a);
  }
  return a;
}

/** Poziția afișată (netezită) a unui jucător; `rp` ține starea de randare per jucător. */
export function drawPlayers(c, s, now, rp, scale) {
  const order = s.players.map((p, i) => i).filter((i) => s.players[i].alive).sort((a, b) => s.players[a].y - s.players[b].y);
  for (const i of order) {
    const p = s.players[i];
    let q = rp[i];
    if (!q || Math.abs(p.x - q.x) + Math.abs(p.y - q.y) > 1.6) q = rp[i] = { x: p.x, y: p.y, walk: 0 };
    const dx = p.x - q.x, dy = p.y - q.y;
    q.x += dx * 0.5; q.y += dy * 0.5;
    q.walk += Math.hypot(dx, dy) > 0.01 ? 0.5 : -q.walk * 0.3;
    const x = cx(q.x), y = cy(q.y), r = T * 0.4, bob = Math.abs(Math.sin(q.walk)) * 3;
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x, y + T * 0.34, T * 0.34, 5, 0, 0, TAU); c.fill();
    c.fillStyle = p.color; // corp mic + picioare
    const sw = Math.sin(q.walk * 2) * 4;
    c.beginPath(); c.ellipse(x - 7 + sw, y + T * 0.3, 6, 4.5, 0, 0, TAU); c.ellipse(x + 7 - sw, y + T * 0.3, 6, 4.5, 0, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(x, y + T * 0.12 - bob * 0.4, T * 0.27, T * 0.22, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.stroke();
    const img = avatarImg(p, Math.round(r), scale), sz = img.width / scale;
    c.drawImage(img, x - sz / 2, y - T * 0.2 - sz / 2 - bob, sz, sz);
    if (p.cu) { // „Ciudățel”: aură mov care pulsează și spirala deasupra capului
      const left = Math.max(0, p.ce - s.tick), pulse = 0.5 + 0.5 * Math.sin(now * 10);
      c.fillStyle = `rgba(150,60,220,${0.2 + 0.18 * pulse})`; circle(c, x, y - 2 - bob / 2, T * 0.58);
      c.save(); c.translate(x + T * 0.42, y - T * 0.6 - bob); drawBonusIcon(c, 8, 9); c.restore();
      if (left < 90 && (left >> 3) & 1) { c.fillStyle = 'rgba(255,255,255,.35)'; circle(c, x, y - 2 - bob / 2, T * 0.58); }
    }
    c.globalAlpha = 1;
    c.fillStyle = p.color; c.strokeStyle = '#fff'; c.lineWidth = 2; // marcaj sus: numărul jucătorului
    c.beginPath(); c.arc(x, y - T * 0.78 - bob, 8, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.font = '800 11px "Baloo 2", "Arial Rounded MT Bold", sans-serif'; c.textAlign = 'center'; c.fillText(String(i + 1), x, y - T * 0.78 - bob + 4);
  }
}
