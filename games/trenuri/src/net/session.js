// Sesiune în rețea: leagă lockstep-ul de camera serverului (shared/net/rooms.js) și de lista jucătorilor.
// Gazda trimite „start” cu configurația oricui intră în timpul jocului; ceilalți îi cer starea întreagă.
import { createLockstep } from './lockstep.js';
import { createNetWorld } from '../sim/index.js';

/** o = { rooms, you, cfg, hostId, late, players, onApplied, onWorld, onSpeed }. */
export function createNetSession(o) {
  const { rooms, you, cfg } = o;
  let known = new Set((o.players || []).map((p) => p.id)), players = o.players || [];
  const node = createLockstep({
    me: you, hostId: o.hostId, world: o.late ? null : createNetWorld(cfg), speed: 1,
    send: (d) => rooms.send(d), sendTo: (id, d) => rooms.sendTo(id, d),
    onApplied: o.onApplied, onWorld: o.onWorld, onSpeed: o.onSpeed,
  });
  if (o.late) node.requestState();
  const off = rooms.on('msg', (m) => node.onMsg(m));

  return {
    node, cfg, get players() { return players; },
    /** Lista camerei s-a schimbat (jucători noi, plecări, gazdă nouă). */
    setRoom(list) {
      players = list;
      const host = list.find((p) => p.host);
      if (host) node.setHost(host.id);
      if (node.isHost()) {
        for (const p of list) {
          if (p.id === you || known.has(p.id)) continue;
          rooms.sendTo(p.id, { k: 'start', cfg, late: true }); // intră în timpul jocului: primește configurația, apoi starea
          if (cfg.mode === 'comp') node.join(p.id, p.name, p.color);
        }
      }
      known = new Set(list.map((p) => p.id));
    },
    close() { off(); },
  };
}
