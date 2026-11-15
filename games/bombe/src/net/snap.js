// Snapshot-uri: gazda împachetează starea, ceilalți o aplică. Grila se trimite întreagă doar când s-a schimbat (gv).
import { W, H } from '../logic/rules.js';

const PF = ['x', 'y', 'alive', 'bombs', 'maxBombs', 'range', 'spd', 'kick', 'shield', 'inv', 'face', 'mv', 'score', 'tp', 'slide', 'sdx', 'sdy', 'bp'];
const enc = (a) => { let s = ''; for (let i = 0; i < a.length; i++) s += String.fromCharCode(48 + a[i]); return s; };
const dec = (str, a) => { for (let i = 0; i < a.length; i++) a[i] = Math.max(0, str.charCodeAt(i) - 48) || 0; };

/** `withGrid` = include grila, bonusurile și lada ascunsă (la început, la schimbare și la 2 s). */
export function packSnap(s, withGrid, ev) {
  const ix = (id) => s.players.findIndex((p) => p.id === id);
  const m = {
    k: 'snap', n: s.tick, ph: s.phase, r: s.round, w: s.winner, mw: s.matchWinner, et: s.endT, si: s.shrinkI, gv: s.gv, bn: s.bn,
    p: s.players.map((p) => PF.map((f) => p[f])),
    b: s.bombs.map((b) => [b.x, b.y, b.t, b.r, b.dx, b.dy, ix(b.o), b.mt, b.pass.map(ix), b.uid]),
    f: s.flames.map((f) => [f.i, f.t, f.o ? ix(f.o) : -1]),
    ev: ev.slice(0, 20),
  };
  if (withGrid) { m.g = enc(s.grid); m.pk = enc(s.pick); m.lt = enc(s.loot); }
  return m;
}

export function applySnap(s, m) {
  const id = (i) => (i >= 0 && s.players[i] ? s.players[i].id : '');
  s.tick = m.n; s.phase = m.ph; s.round = m.r; s.winner = m.w; s.matchWinner = m.mw; s.endT = m.et; s.shrinkI = m.si; s.bn = m.bn;
  m.p.forEach((row, i) => { const p = s.players[i]; if (p) PF.forEach((f, k) => { p[f] = row[k]; }); });
  s.bombs = m.b.map((b) => ({ x: b[0], y: b[1], o: id(b[6]), t: b[2], r: b[3], dx: b[4], dy: b[5], mt: b[7], pass: b[8].map(id), uid: b[9] }));
  s.flames = m.f.map((f) => ({ i: f[0], t: f[1], o: id(f[2]) }));
  if (m.g) {
    if (m.g.length === W * H) { dec(m.g, s.grid); dec(m.pk, s.pick); dec(m.lt, s.loot); }
    s.gv = m.gv;
  } else if (m.gv !== s.gv) s.need = true; // am pierdut o schimbare de grilă: așteptăm snapshot întreg
  return s;
}
