// Snapshot-uri: gazda trimite doar diferențele față de ce a trimis înainte (cu o stare întreagă la început, la runde noi și la 10 s).
// Clientul numără pașii singur (bombe, flăcări, zbor), așa că timpii nu se retrimit. `q` = numărul mesajului: dacă lipsește unul, clientul cere starea întreagă.
import { W, H } from '../logic/rules.js';

const HOT = ['x', 'y', 'alive', 'bombs', 'maxBombs', 'range', 'spd', 'kick', 'shield', 'inv', 'face', 'mv', 'score', 'glove', 'remote', 'cu', 'ce', 'bestB', 'bestR'];
const COLD = ['tp', 'slide', 'sdx', 'sdy', 'bp', 'bp2', 'la', 'ci']; // doar în starea întreagă (contează doar pentru o gazdă nouă)
const HEAD = ['ph', 'r', 'w', 'mw'];
export const FULL_EVERY = 150; // mesaje (10 s)
const MAX_LEN = 3800;

const enc = (a) => { let s = ''; for (let i = 0; i < a.length; i++) s += String.fromCharCode(48 + a[i]); return s; };
const dec = (str, a) => { for (let i = 0; i < a.length; i++) a[i] = Math.max(0, str.charCodeAt(i) - 48) || 0; };
const val = (p, f) => (f === 'x' || f === 'y' ? Math.round(p[f] * 1000) / 1000 : p[f]);

export function createPacker() {
  let prev = null, q = 0;
  const bkey = (s, b) => JSON.stringify([b.x, b.y, s.tick + b.t, b.r, b.dx, b.dy, b.o, b.pass.join(), b.fl > 0 ? s.tick + b.fl : 0, b.fx, b.fy]);
  return {
    /** `ready` = numărătoarea „Pregătiți!”; `force` = cere starea întreagă (de ex. un client a pierdut un mesaj). */
    pack(s, ev, ready = 0, force = false) {
      const ix = (id) => s.players.findIndex((p) => p.id === id);
      const full = force || !prev || prev.round !== s.round || s.tick < prev.tick || q % FULL_EVERY === 0;
      const tup = (b) => [b.uid, b.x, b.y, s.tick + b.t, b.r, b.dx, b.dy, ix(b.o), b.pass.map(ix), b.fl > 0 ? s.tick + b.fl : 0, b.fx, b.fy];
      const m = { k: 'snap', q: ++q, n: s.tick, ev: ev.slice(0, 20) };
      const rows = s.players.map((p) => HOT.map((f) => val(p, f)));
      const bk = new Map(s.bombs.map((b) => [b.uid, bkey(s, b)]));
      const fk = new Map(s.flames.map((f) => [f.i, s.tick + f.t + ':' + f.o]));
      const head = { ph: s.phase, r: s.round, w: s.winner, mw: s.matchWinner, rd: ready };
      if (full) {
        Object.assign(m, { full: 1, ...head, et: s.endT, si: s.shrinkI, bn: s.bn });
        m.p = s.players.map((p, i) => rows[i].concat(COLD.map((f) => p[f])));
        m.b = s.bombs.map(tup);
        m.f = s.flames.map((f) => [f.i, s.tick + f.t, f.o ? ix(f.o) : -1]);
        Object.assign(m, { g: enc(s.grid), pk: enc(s.pick), lt: enc(s.loot) });
      } else {
        for (const k in head) if (head[k] !== prev.head[k]) m[k] = head[k];
        const p = [];
        rows.forEach((row, i) => {
          const d = [i];
          row.forEach((v, k) => { if (v !== prev.rows[i][k]) d.push(k, v); });
          if (d.length > 1) p.push(d);
        });
        if (p.length) m.p = p;
        const b = s.bombs.filter((x) => prev.bk.get(x.uid) !== bk.get(x.uid)).map(tup);
        if (b.length) m.b = b;
        const rb = [...prev.bk.keys()].filter((u) => !bk.has(u));
        if (rb.length) m.rb = rb;
        const f = s.flames.filter((x) => prev.fk.get(x.i) !== fk.get(x.i)).map((x) => [x.i, s.tick + x.t, x.o ? ix(x.o) : -1]);
        if (f.length) m.f = f;
        const c = [];
        for (let i = 0; i < W * H; i++) if (s.grid[i] !== prev.grid[i] || s.pick[i] !== prev.pick[i] || s.loot[i] !== prev.loot[i]) c.push([i, s.grid[i], s.pick[i], s.loot[i]]);
        if (c.length) m.c = c;
      }
      if (JSON.stringify(m).length > MAX_LEN) m.ev = m.ev.slice(0, 4); // serverul primește cel mult 4 KB pe mesaj
      if (full && JSON.stringify(m).length > MAX_LEN) delete m.lt;
      prev = { round: s.round, tick: s.tick, head, rows, bk, fk, grid: s.grid.slice(), pick: s.pick.slice(), loot: s.loot.slice() };
      return m;
    },
  };
}

/** Compatibil: o stare întreagă, fără memorie între apeluri. */
export const packSnap = (s, full, ev, ready = 0) => createPacker().pack(s, ev, ready, true);

export function applySnap(s, m) {
  const id = (i) => (i >= 0 && s.players[i] ? s.players[i].id : '');
  const bomb = (b) => ({ x: b[1], y: b[2], o: id(b[7]), t: b[3] - m.n, r: b[4], dx: b[5], dy: b[6], mt: 0, pass: b[8].map(id), uid: b[0], fl: Math.max(0, b[9] - m.n), fx: b[10], fy: b[11] });
  const flame = (f) => ({ i: f[0], t: f[1] - m.n, o: id(f[2]) });
  if (m.full) {
    s.q = m.q; s.need = false;
    Object.assign(s, { phase: m.ph, round: m.r, winner: m.w, matchWinner: m.mw, endT: m.et, shrinkI: m.si, bn: m.bn, tick: m.n, gv: (s.gv || 0) + 1 });
    m.p.forEach((row, i) => { const p = s.players[i]; if (p) HOT.concat(COLD).forEach((f, k) => { p[f] = row[k]; }); });
    s.bombs = m.b.map(bomb); s.flames = m.f.map(flame);
    dec(m.g, s.grid); dec(m.pk, s.pick); if (m.lt) dec(m.lt, s.loot);
    return s;
  }
  if (m.q !== s.q + 1) { s.need = true; return s; } // am pierdut un mesaj: așteptăm starea întreagă
  const dn = Math.max(0, m.n - s.tick);
  s.q = m.q; s.tick = m.n;
  for (const k of HEAD) if (k in m) s[{ ph: 'phase', r: 'round', w: 'winner', mw: 'matchWinner' }[k]] = m[k];
  for (const d of m.p || []) {
    const p = s.players[d[0]];
    if (p) for (let k = 1; k < d.length; k += 2) p[HOT[d[k]]] = d[k + 1];
  }
  const gone = new Set(m.rb || []);
  const upd = new Map((m.b || []).map((b) => [b[0], bomb(b)]));
  s.bombs = s.bombs.filter((b) => !gone.has(b.uid) && !upd.has(b.uid)).map((b) => { b.t -= dn; if (b.fl > 0) b.fl = Math.max(0, b.fl - dn); return b; }).concat([...upd.values()]);
  const nf = new Map((m.f || []).map((f) => [f[0], flame(f)]));
  s.flames = s.flames.filter((f) => !nf.has(f.i)).map((f) => { f.t -= dn; return f; }).concat([...nf.values()]).filter((f) => f.t > 0);
  if (m.c) {
    for (const [i, g, pk, lt] of m.c) { s.grid[i] = g; s.pick[i] = pk; s.loot[i] = lt; }
    s.gv++;
  }
  return s;
}
