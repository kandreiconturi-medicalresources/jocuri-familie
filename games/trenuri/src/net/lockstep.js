// Lockstep: gazda ordonează comenzile și le trimite cu pasul la care se aplică; toți rulează aceeași simulare.
// Mesaje (în `d` al camerei): c = comandă către gazdă · f = cadru de la gazdă {L, sp, c:[[q,at,pl,by,cmd]]} ·
// h = hash la fiecare 100 de pași · need = cere starea · sc/sa = bucăți de stare și confirmări (transfer.js).
// Regula: L = „toate comenzile cu at < L sunt cunoscute”; un nod face pasul t → t+1 doar dacă t < L.
// Fără timere: totul merge din update(dt), deci se poate testa în memorie.
import { stepWorld, applyCommand, hashState, serialize, deserialize, SIM_HZ } from '../sim/index.js';
import { wire, unwire, ALLOWED } from './wire.js';
import { createSender, createReceiver } from './transfer.js';
import { pack, unpack } from './pack.js';

export const DELAY = 3, HASH_EVERY = 100, FRAME_MS = 100, MAX_MSG = 3000;

export function createLockstep(o) {
  const { me, send, sendTo, onApplied = () => {}, onWorld = () => {}, onSpeed = () => {}, raw = false } = o;
  let s = o.world || null, hostId = o.hostId, speed = o.speed == null ? 1 : o.speed;
  let L = 0, Lsent = s ? s.tick + DELAY : 0, lastQ = 0, acc = 0, clock = 0, frameAt = -1e9, nextId = 1, lastInst = 0, epoch = 0; // epoch: crește când gazda încarcă o salvare
  let queue = [], log = [], outbox = [], rx = null, wait = !s;
  const hist = new Map(), pend = new Map(), tx = new Map(), packing = new Set();
  const isHost = () => hostId === me;
  const stats = { applied: 0, resyncs: 0, sentStates: 0 };

  const coOf = (pl) => { const m = s && s.net; return !m || m.mode !== 'comp' ? 0 : m.pl[pl]; };
  const lead = () => DELAY + 2 * Math.ceil((speed * SIM_HZ * FRAME_MS) / 1000);
  const push = (e) => { queue.push(e); log.push(e); if (log.length > 300) log.shift(); };

  function flush() {
    while (s && queue.length && queue[0].at <= s.tick) {
      const e = queue.shift();
      const r = applyCommand(s, { ...e.cmd, by: e.by });
      stats.applied++;
      onApplied(e, r);
    }
  }

  function afterStep() {
    if (s.tick % HASH_EVERY) return;
    const h = hashState(s), t = s.tick;
    if (isHost()) {
      hist.set(t, h); hist.delete(t - HASH_EVERY * 64);
      for (const [from, ch] of pend.get(t) || []) if (ch !== h) sendState(from);
      pend.delete(t);
    } else if (hostId) sendTo(hostId, { k: 'h', t, h, e: epoch });
  }

  // ---- gazda ----
  function schedule(pl, by, cmd) {
    const e = { q: ++lastQ, at: Math.max(Lsent, s.tick), pl, by, cmd };
    push(e); outbox.push(e);
  }
  function emit(newL) {
    if (newL > Lsent) Lsent = newL;
    const base = { k: 'f', L: Lsent, sp: speed, e: epoch };
    let cur = [], len = 0;
    for (const e of outbox) {
      const w = [e.q, e.at, e.pl, e.by, wire(e.cmd)], n = JSON.stringify(w).length;
      if (cur.length && len + n > MAX_MSG) { send({ ...base, c: cur }); cur = []; len = 0; }
      cur.push(w); len += n;
    }
    outbox = [];
    send({ ...base, c: cur });
    frameAt = clock;
  }
  function sendState(to) {
    if (!s || tx.has(to) || packing.has(to)) return;
    packing.add(to);
    const snap = { tick: s.tick, L: Lsent, q: lastQ, sp: speed, e: epoch, queue: queue.map((e) => [e.q, e.at, e.pl, e.by, wire(e.cmd)]), s: serialize(s) };
    pack(snap, { raw }).then((text) => {
      packing.delete(to);
      tx.set(to, createSender({ id: nextId++, text, send: (d) => sendTo(to, d), now: clock }));
      stats.sentStates++;
    }, () => packing.delete(to));
  }

  // ---- clientul ----
  function onFrame(d) {
    if (!isFinite(d.L) || !Array.isArray(d.c)) return;
    if (d.e > epoch) { epoch = d.e; wait = true; L = 0; } // gazda a încărcat o altă lume: aștept starea ei
    for (const w of d.c) {
      const q = w[0];
      if (q <= lastQ) continue;
      if (q !== lastQ + 1) need(); // lipsește o comandă: cere starea întreagă
      lastQ = q;
      push({ q, at: w[1], pl: w[2], by: w[3], cmd: unwire(w[4]) });
    }
    if (d.L > L) L = d.L;
    if (d.sp !== speed) { speed = d.sp; onSpeed(speed); }
  }
  function need(force) { if (hostId && hostId !== me && (force || !wait)) { wait = true; sendTo(hostId, { k: 'need' }); } }

  async function install(text, id) {
    let snap;
    try { snap = await unpack(text); } catch (e) { wait = false; return; }
    if (!rx || rx.id !== id) return;
    rx = null; lastInst = id;
    s = deserialize(snap.s); acc = 0;
    const map = (x) => ({ q: x[0], at: x[1], pl: x[2], by: x[3], cmd: unwire(x[4]) });
    queue = snap.queue.map(map).concat(log.filter((e) => e.q > snap.q));
    lastQ = Math.max(snap.q, lastQ); L = Math.max(L, snap.L); speed = snap.sp; Lsent = L; epoch = snap.e | 0;
    wait = false; stats.resyncs++;
    onSpeed(speed); onWorld(s);
  }

  function onChunk(d) {
    if (d.id <= lastInst || !(d.n > 0)) return;
    if (!rx || rx.id !== d.id) {
      if (rx && d.id < rx.id) return;
      rx = createReceiver({ id: d.id, n: d.n, ack: (have) => sendTo(hostId, { k: 'sa', id: d.id, have }) });
      wait = true;
    }
    const text = rx.push(d);
    if (text !== null) install(text, d.id);
  }

  function onMsg(m) {
    const d = m && m.d, from = m && m.from;
    if (!d || typeof d.k !== 'string') return;
    if (isHost()) {
      if (d.k === 'c' && s && d.cmd && ALLOWED.has(d.cmd.type)) { const by = coOf(from); if (by !== undefined) schedule(from, by, unwire(d.cmd)); }
      else if (d.k === 'h' && s && (d.e | 0) === epoch) {
        const hh = hist.get(d.t);
        if (hh === undefined) { if (d.t > s.tick) pend.set(d.t, (pend.get(d.t) || []).concat([[from, d.h]])); }
        else if (hh !== d.h) sendState(from);
      } else if (d.k === 'need') sendState(from);
      else if (d.k === 'sa') { const t = tx.get(from); if (t && t.id === d.id) { t.ack(d.have); if (t.done()) tx.delete(from); } }
    } else if (from === hostId) {
      if (d.k === 'f') onFrame(d);
      else if (d.k === 'sc') onChunk(d);
    }
  }

  /** Lista camerei s-a schimbat: dacă gazda a plecat și acum sunt eu, continui de la ultimul pas confirmat. */
  function setHost(id) {
    if (id === hostId) return;
    const was = isHost();
    hostId = id; rx = null; lastInst = 0; tx.clear(); packing.clear();
    if (!was && isHost() && s) { Lsent = Math.max(L, s.tick); outbox = []; wait = false; frameAt = -1e9; pend.clear(); }
    else if (!isHost() && s) wait = false;
  }

  return {
    get world() { return s; }, get L() { return Math.max(L, Lsent); }, get speed() { return speed; }, get ready() { return !!s; }, get alpha() { return Math.min(acc, 1); }, get syncing() { return wait; },
    get hostId() { return hostId; }, stats, onMsg, setHost, sendState, requestState: () => need(true),
    /** Comandă a jucătorului meu: la gazdă intră direct în coadă, la ceilalți pleacă spre gazdă. */
    submit(cmd) {
      if (!ALLOWED.has(cmd.type)) return { ok: false, err: 'drum' };
      const w = wire(cmd);
      if (JSON.stringify(w).length > MAX_MSG) return { ok: false, err: 'drum' };
      if (isHost()) { const by = coOf(me); if (by === undefined || !s) return { ok: false, err: 'proprietar' }; schedule(me, by, cmd); }
      else if (hostId) sendTo(hostId, { k: 'c', cmd: w });
      return { ok: true, cost: 0 };
    },
    /** Doar gazda: un jucător nou în competitiv primește o companie nouă. */
    join(pl, name, color) { if (isHost() && s && s.net && s.net.mode === 'comp' && s.net.pl[pl] === undefined) schedule(me, 0, { type: 'joinCompany', pl, name, color }); },
    /** Doar gazda, în jocul pe echipe (7.5): mută jucătorul `pl` în echipa companiei `co`. */
    assign(pl, co, name) { if (isHost() && s && s.net && s.net.team) schedule(me, 0, { type: 'setTeam', pl, co, name }); },
    /** Doar gazda: încarcă o altă lume (salvare) și o trimite tuturor din `ids`. */
    load(w, ids) {
      if (!isHost()) return;
      s = w; epoch++; queue = []; log = []; outbox = []; acc = 0; wait = false; Lsent = s.tick + DELAY;
      hist.clear(); pend.clear(); tx.clear(); packing.clear();
      emit(Lsent);
      for (const id of ids) if (id !== me) sendState(id);
    },
    setSpeed(v) { if (isHost()) { speed = v; if (s) emit(v ? s.tick + lead() : Lsent); } },
    /** Un pas al buclei jocului; `onStep()` după fiecare pas simulat. Întoarce numărul de pași. */
    update(dt, onStep = () => {}) {
      clock += dt * 1000;
      for (const [id, t] of tx) { t.pump(clock); if (t.done()) tx.delete(id); }
      if (!s) return 0;
      if (isHost() && ((speed > 0 && clock - frameAt >= FRAME_MS) || (outbox.length && clock - frameAt >= 40))) emit(speed > 0 ? s.tick + lead() : Lsent);
      flush();
      if (wait) return 0;
      const lim = isHost() ? Lsent : L, rate = speed || (s.tick < lim ? 1 : 0), behind = lim - s.tick > 2 * lead() ? 2 : 1;
      acc = Math.min(acc + dt * rate * SIM_HZ * behind, 12);
      let n = 0;
      while (acc >= 1 && s.tick < lim && n < 8) { flush(); stepWorld(s); afterStep(); onStep(); acc--; n++; }
      if (s.tick >= lim && acc > 2) acc = 2;
      return n;
    },
  };
}
