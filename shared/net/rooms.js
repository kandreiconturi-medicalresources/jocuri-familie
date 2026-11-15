// Client WebSocket pentru camere (vezi docs/SERVER.md). Reconectare simplă, cu reintrare în cameră.
import { BASE } from './api.js';
import { wsUrl } from './util.js';

/** Evenimente: 'open', 'close', 'room' ({code,players,you}), 'msg' ({from,d}), 'closed' ({reason}), 'error' ({code}). */
export function connectRooms() {
  const handlers = {};
  const queue = [];
  let ws = null, closed = false, tries = 0, timer = null, code = null;

  const emit = (ev, data) => (handlers[ev] || []).slice().forEach((cb) => { try { cb(data); } catch (e) { console.error(e); } });

  function raw(o) {
    const s = JSON.stringify(o);
    if (ws && ws.readyState === 1) ws.send(s); else queue.push(s);
  }

  function open() {
    ws = new WebSocket(wsUrl(BASE));
    ws.onopen = () => {
      tries = 0;
      if (code) raw({ t: 'join', code }); // după o cădere, reintră în aceeași cameră
      while (queue.length) ws.send(queue.shift());
      emit('open');
    };
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch (err) { return; }
      if (!m || typeof m.t !== 'string') return;
      if (m.t === 'room') { code = m.code; emit('room', m); }
      else if (m.t === 'closed') { code = null; emit('closed', m); }
      else if (m.t === 'error') { code = null; emit('error', m); }
      else if (m.t === 'msg') emit('msg', m);
    };
    ws.onclose = () => {
      emit('close');
      if (closed) return;
      timer = setTimeout(open, Math.min(5000, 500 * 2 ** tries++));
    };
    ws.onerror = () => { try { ws.close(); } catch (e) { /* ignorat */ } };
  }
  open();

  return {
    create(game) { code = null; raw({ t: 'create', game }); },
    join(c) { raw({ t: 'join', code: String(c || '').toUpperCase() }); },
    leave() { code = null; raw({ t: 'leave' }); },
    send(d) { raw({ t: 'msg', d }); },
    sendTo(id, d) { raw({ t: 'to', id, d }); },
    on(ev, cb) {
      (handlers[ev] = handlers[ev] || []).push(cb);
      return () => { handlers[ev] = (handlers[ev] || []).filter((f) => f !== cb); };
    },
    close() { closed = true; clearTimeout(timer); if (ws) try { ws.close(); } catch (e) { /* ignorat */ } },
  };
}
