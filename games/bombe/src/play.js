// Controlorul unei partide: local, gazdă (simulează și trimite snapshot-uri) sau client (trimite input, afișează).
import { rng } from '../../../shared/engine/rng.js';
import { createMatch, step, startRound } from './logic/match.js';
import { createPacker, applySnap } from './net/snap.js';

export const READY = 75;   // 2,5 s de „Pregătiți!” la fiecare rundă
const NEXT_ROUND = 100;    // pauză după rundă

/** cfg = { arenaId, players, seed, rules }; slots = { [playerId]: indexul intrării locale }; net = { rooms, you, hostId } sau null. */
export function createPlay({ input, cfg, slots, net, onEvents }) {
  const s = createMatch(cfg);
  let isHost = !net || net.host, ready = READY, rest = 0, n = 0, evBuf = [], lastSent = '', sentAt = 0, needAt = 0, wantFull = false;
  const packer = createPacker();
  const remote = {};

  const merged = slots && Object.keys(slots).length === 1; // un singur om: merge și WASD, și săgeți
  function localInput(slot) {
    const a = input.read(slot), b = merged ? input.read(slot ? 0 : 1) : null;
    const g = (k) => a[k] || (b && b[k]);
    return { dx: (g('right') ? 1 : 0) - (g('left') ? 1 : 0), dy: (g('down') ? 1 : 0) - (g('up') ? 1 : 0), bomb: !!g('a'), b: !!g('b') };
  }
  function locals() {
    const o = {};
    for (const id in slots) { const p = s.players.find((q) => q.id === id); if (p && p.alive) o[id] = localInput(slots[id]); }
    return o;
  }

  function sendInput(inp) {
    const key = inp.dx + ',' + inp.dy + ',' + inp.bomb + ',' + inp.b, now = performance.now();
    if (key === lastSent && now - sentAt < 200) return;
    lastSent = key; sentAt = now;
    net.rooms.send({ k: 'in', dx: inp.dx, dy: inp.dy, bomb: inp.bomb, b: inp.b });
  }

  function hostTick() {
    let ev = [];
    if (s.phase === 'play') {
      if (ready > 0) { ready--; if (ready === 0) onEvents([{ e: 'go' }]); else if (ready % 25 === 0) onEvents([{ e: 'count', n: Math.ceil(ready / 25) }]); } else ev = step(s, { ...remote, ...locals() });
    } else if (s.phase === 'round_end') {
      ev = step(s, {});
      if (++rest >= NEXT_ROUND) { rest = 0; startRound(s); ready = READY; }
    }
    if (ev.length) { onEvents(ev); evBuf.push(...ev); }
    if (net && ++n % 2 === 0) {
      net.rooms.send(packer.pack(s, evBuf, ready, wantFull));
      wantFull = false; evBuf = [];
    }
  }

  const api = {
    state: s,
    get ready() { return ready; },
    get isHost() { return isHost; },
    update() {
      if (isHost) hostTick();
      else {
        const ids = Object.keys(slots);
        if (ids.length) sendInput(localInput(slots[ids[0]]));
        if (s.need && performance.now() - needAt > 700) { needAt = performance.now(); net.rooms.send({ k: 'need' }); }
      }
    },
    /** Mesaje din cameră: input-ul clienților (la gazdă) sau snapshot-uri (la clienți). */
    onMsg(m) {
      const d = m.d;
      if (!d) return;
      if (isHost && d.k === 'in') remote[m.from] = { dx: d.dx | 0, dy: d.dy | 0, bomb: !!d.bomb, b: !!d.b };
      else if (isHost && d.k === 'need') wantFull = true;
      else if (!isHost && d.k === 'snap' && d.q > 0) {
        applySnap(s, d);
        if ('rd' in d) ready = d.rd | 0;
        if (d.ev && d.ev.length) onEvents(d.ev);
      }
    },
    /** Lista camerei s-a schimbat: cine a plecat devine bot; dacă am rămas gazdă, continuăm din ultimul snapshot. */
    setRoom(list) {
      const ids = list.map((p) => p.id);
      if (isHost) for (const p of s.players) if (!p.bot && !ids.includes(p.id)) { p.bot = true; p.level = 'easy'; delete remote[p.id]; }
      const host = list.find((p) => p.host);
      if (!isHost && host && host.id === net.you) {
        isHost = true; wantFull = true;
        s.rng = rng((s.seed + s.tick) >>> 0); s.brng = rng((s.seed ^ s.tick ^ 0x9e3779b9) >>> 0);
        for (const p of s.players) if (!p.bot && !ids.includes(p.id)) { p.bot = true; p.level = 'easy'; }
      }
    },
    rematch() { // doar gazda/local
      for (const p of s.players) { p.score = 0; p.bestB = 1; p.bestR = 2; }
      s.matchWinner = null; s.round = 0; startRound(s); ready = READY; rest = 0;
    },
  };
  return api;
}
