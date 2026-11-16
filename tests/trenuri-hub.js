// Ajutor pentru teste: o „cameră” în memorie (fără rețea) cu latență, ca serverul real: relay cu `from`, mesaje ≤ 4 KB, ≤ 30/s.
import { createLockstep } from '../games/trenuri/src/net/lockstep.js';

export function createHub({ latency = 0.1 } = {}) {
  let time = 0;
  const nodes = new Map(), q = [], sent = new Map();
  const hub = {
    nodes, filter: null, maxLen: 0, ids: () => [...nodes.keys()],
    deliver(from, to, d) {
      const len = JSON.stringify({ t: 'msg', d }).length;
      if (len > 4096) throw new Error('mesaj peste 4 KB: ' + len + ' (' + d.k + ')');
      hub.maxLen = Math.max(hub.maxLen, len);
      const w = sent.get(from) || [];
      w.push(time); while (w[0] < time - 1) w.shift(); sent.set(from, w);
      if (w.length > 30) throw new Error('peste 30 mesaje/s de la ' + from);
      if (hub.filter && hub.filter(from, to, d)) return;
      q.push({ due: time + latency, from, to, d });
    },
    /** Adaugă un nod; `world` null = intră în timpul jocului. */
    add(id, { world, hostId, speed, raw }) {
      const node = createLockstep({
        me: id, world, hostId, speed, raw,
        send: (d) => { for (const k of nodes.keys()) if (k !== id) hub.deliver(id, k, d); },
        sendTo: (to, d) => hub.deliver(id, to, d),
      });
      nodes.set(id, node);
      return node;
    },
    remove(id) { nodes.delete(id); },
    step(dt) {
      time += dt;
      while (q.length && q[0].due <= time) { const m = q.shift(); const n = nodes.get(m.to); if (n) n.onMsg({ from: m.from, d: m.d }); }
      for (const n of nodes.values()) n.update(dt);
    },
    /** Asincron: lasă promisiunile (compresia stării) să se rezolve între pași. */
    async run(sec, dt = 0.05) { for (let i = 0; i < Math.round(sec / dt); i++) { hub.step(dt); await new Promise((r) => setImmediate(r)); } },
    get time() { return time; },
  };
  return hub;
}
