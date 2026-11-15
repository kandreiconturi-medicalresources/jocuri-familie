// Sesiunea de joc în rețea: trimite starea mea, aplică ce primesc, alege gazda, hotărăște când se termină nivelul.
import {
  chooseHost, arrivedAll, newPlan, planSend, packPlayer, unpackPlayer, applyPlayer, pushSample, sampleAt, INTERP_MS,
  pickEnemies, packBoss, packPlatform, parseBundle,
} from './logic.js';
import { applyWorld, stepEnemy, stepBoss, handleEvent, feedCrumbs } from './remote.js';

const WORLD_RANGE = 1000;

/**
 * opts: { rooms, you, ids (ordinea personajelor), players (lista curentă din cameră), onArrived(n, total, host), onLeft() }
 * Obiectul întors e `g.net` din joc.
 */
export function createNet(opts) {
  const { rooms, you, ids } = opts;
  const names = {};
  for (const p of opts.players) names[p.id] = String(p.name || '').slice(0, 10);
  let g = null, tick = 0, host = false, hostId = null, present = ids.slice();
  let selfArrived = false, ended = false;
  const arrived = new Set(), bufs = {}, plan = newPlan();
  let pending = [];

  const body = (id) => g && g.players.find((p) => p.i === ids.indexOf(id));
  const remotes = () => g.players.filter((p) => p !== g.local);

  function send(d) { rooms.send(d); }

  function flush(force) {
    if (!g) return;
    const hasEv = pending.length > 0;
    const pl = force ? { p: false, w: false, ev: hasEv } : planSend(plan, tick, host, hasEv);
    if (!pl) return;
    const d = {};
    if (pl.p) d.p = packPlayer(g.local);
    if (pl.w) {
      d.w = { e: pickEnemies(g.enemies, g.players.filter((p) => !p.dead).map((p) => p.x), WORLD_RANGE), b: packBoss(g.boss), p: g.platforms.map(packPlatform) };
    }
    if (pl.ev) { d.ev = pending.slice(0, 24); pending = pending.slice(24); }
    send(d);
  }

  function checkEnd() {
    if (!host || ended || !arrivedAll(arrived, present)) return;
    endLevel(true);
  }
  function endLevel(broadcast) {
    if (ended) return;
    ended = true;
    if (broadcast) { pending.push({ e: 'end' }); flush(true); }
    if (opts.onArrived) opts.onArrived(0, 0, false);
    g.finishLevel();
  }

  const net = {
    ids,
    get host() { return host; },
    bind(game) {
      g = game;
      g.local = g.players[ids.indexOf(you)];
      g.sim = [g.local];
      g.players.forEach((p) => { p.name = names[ids[p.i]] || ''; });
      this.setRoom(opts.players);
    },
    emit(ev) { pending.push(ev); },
    hit(id, how) { pending.push({ e: 'k', id, how }); },
    stepEnemy,
    stepBoss() { stepBoss(g); },
    /** Jucătorul local a ajuns la portal. */
    arrive() {
      if (selfArrived) return;
      selfArrived = true; arrived.add(you);
      pending.push({ e: 'f' });
      g.say(host ? 'Ai ajuns! Așteaptă pe ceilalți sau apasă „Gata”.' : 'Ai ajuns! Așteptăm și ceilalți…', 99999);
      if (opts.onArrived) opts.onArrived(arrived.size, present.length, host);
      checkEnd();
    },
    /** Gazda termină nivelul pentru toți (butonul „Gata”). */
    forceEnd() { if (host && g && !ended) endLevel(true); },
    /** Lista de jucători din cameră s-a schimbat: gazdă nouă, plecați scoși din joc. */
    setRoom(players) {
      hostId = chooseHost(players);
      host = hostId === you;
      present = ids.filter((id) => players.some((p) => p.id === id));
      if (!g) return;
      for (const id of ids) {
        if (present.includes(id)) continue;
        const p = body(id);
        if (p && p !== g.local) g.players.splice(g.players.indexOf(p), 1);
        delete bufs[id]; arrived.delete(id);
      }
      if (opts.onArrived && arrived.size && !ended) opts.onArrived(arrived.size, present.length, host);
      checkEnd();
    },
    /** Un mesaj `msg` primit prin cameră. */
    handle(m) {
      if (!g || ended) return;
      const d = parseBundle(m.d), from = body(m.from);
      if (!d || !from || from === g.local) return;
      const now = performance.now();
      if (d.p) { const s = unpackPlayer(d.p); if (s) pushSample(bufs[m.from] || (bufs[m.from] = []), now, s); }
      if (d.w && m.from === hostId && !host) applyWorld(g, d.w);
      for (const ev of d.ev) {
        if (ev.e === 'f') arrived.add(m.from);
        if (ev.e === 'end' && m.from === hostId) { endLevel(false); return; }
        handleEvent(g, ev, from, net);
      }
      if (d.ev.some((e) => e.e === 'f')) { if (opts.onArrived) opts.onArrived(arrived.size, present.length, host); checkEnd(); }
    },
    /** Pe fiecare pas de joc: jucătorii de la distanță, trimiterea stării. */
    tick() {
      tick++;
      const t = performance.now() - INTERP_MS;
      for (const r of remotes()) {
        const s = sampleAt(bufs[ids[r.i]] || [], t);
        if (s) applyPlayer(r, s, tick);
      }
      feedCrumbs(g, remotes());
      flush(false);
    },
    destroy() { g = null; },
  };
  return net;
}
