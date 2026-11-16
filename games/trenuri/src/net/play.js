// Meciul în rețea văzut din joc: comenzile jucătorului pleacă prin lockstep, lumea se schimbă la intrare/resincronizare/încărcare,
// iar „Compania mea” (viewer.co) și cutiuța cu jucători/clasament se țin la zi.
import { ERR_TEXT, viewer } from '../sim/index.js';
import { createNetSession } from './session.js';
import { createNetHud } from '../ui/netHud.js';

/** hooks = { root, hint(text, warn), sfx(name), setWorld(state, opts), setSpeedUi(v), onStop() }. */
export function createNetPlay(hooks) {
  let sess = null, you = null, uiT = 0;
  const hud = createNetHud(hooks.root, (pl, co, name) => { if (sess && node().isHost()) node().assign(pl, co, name); });
  const node = () => sess.node;
  const coFor = (s) => (!s.net || s.net.mode !== 'comp' ? 0 : s.net.pl[you]);

  /** Mapare jucători → companii după încărcarea unei salvări: coop = o companie; competitiv = în ordinea camerei. */
  function fixNet(s, players) {
    if (!s.net || (s.net.mode !== 'comp' && s.net.mode !== 'coop')) s.net = { mode: 'coop', pl: {} };
    const old = s.net.pl || {};
    s.net.pl = {};
    if (s.net.team) { // 7.5: pe echipe, cine era deja într-o echipă rămâne acolo; ceilalți intră în prima echipă a oamenilor
      const first = s.companies.findIndex((c) => !c.ai && !c.dead);
      if (!s.net.nm) s.net.nm = {};
      players.forEach((p) => { const k = old[p.id]; s.net.pl[p.id] = k !== undefined && k < s.companies.length ? k : Math.max(0, first); s.net.nm[p.id] = String(p.name || 'Jucător').slice(0, 14); });
    } else if (s.net.mode === 'comp') players.forEach((p, i) => { if (i < s.companies.length) s.net.pl[p.id] = i; });
    return s;
  }

  const api = {
    get active() { return !!sess; },
    get host() { return !!sess && node().isHost(); },
    get alpha() { return sess ? node().alpha : 1; },
    start(o) {
      api.stop(true);
      you = o.you;
      sess = createNetSession({
        ...o,
        onApplied: (e, r) => { if (e.pl !== you) return; if (hooks.onResult) hooks.onResult(e, r); if (r.ok) hooks.sfx('build'); else { hooks.sfx('nope'); hooks.hint(ERR_TEXT[r.err] || 'Nu merge asta.', true); } },
        onWorld: (w) => { viewer.co = coFor(w) || 0; hooks.setWorld(w, { kind: 'net', keep: true, resync: true }); },
        onSpeed: (v) => hooks.setSpeedUi(v),
      });
      const w = node().world;
      if (w) { viewer.co = coFor(w) || 0; hooks.setWorld(w, { kind: 'net', keep: true }); hooks.setSpeedUi(1); }
      else hooks.hint('⏳ Intru în joc… aștept harta de la gazdă.', false, 8000);
      return api;
    },
    stop(quiet) {
      if (!sess) return;
      sess.close(); sess = null; hud.hide(); viewer.co = 0;
      if (!quiet) hooks.onStop();
    },
    setRoom(list) { if (sess) sess.setRoom(list); },
    submit(cmd) { return node().submit(cmd); },
    setSpeed(v) {
      if (!node().isHost()) { hooks.hint('Viteza o alege gazda 👑', false, 2500); return; }
      node().setSpeed(v); hooks.setSpeedUi(v);
    },
    /** Gazda încarcă o salvare și o trimite tuturor. */
    load({ state, speed }) {
      if (!sess || !node().isHost()) return;
      fixNet(state, sess.players);
      viewer.co = coFor(state) || 0;
      node().load(state, sess.players.map((p) => p.id));
      node().setSpeed(speed);
      hooks.setWorld(state, { kind: 'net', keep: true, resync: true });
      hooks.setSpeedUi(speed);
    },
    /** Din bucla jocului: pași de simulare + cutiuța. Întoarce true dacă rulează în rețea. */
    update(dt, onStep) {
      if (!sess) return false;
      const n = node(), s = n.world;
      n.update(dt, onStep);
      if (s) {
        const c = coFor(s);
        viewer.co = c === undefined ? 0 : c;
        uiT += dt;
        if (uiT > 0.5) { uiT = 0; hud.update(s, sess.players, viewer.co, n.syncing, n.isHost()); }
      }
      return true;
    },
  };
  return api;
}
