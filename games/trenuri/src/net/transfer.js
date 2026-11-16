// Trimiterea stării întregi pe bucăți ≤ 3 KB (serverul taie la 4 KB/mesaj), cu confirmare și reluare.
// Gazdă: createSender → pump(ms). Client: createReceiver → push(m) întoarce textul complet când s-au primit toate bucățile.
export const CHUNK = 3000, WINDOW = 6, RATE = 0.02, RESEND_MS = 1500; // RATE: bucăți pe ms (20/s; serverul taie la 30 mesaje/s)

export function createSender({ id, text, send, now }) {
  const n = Math.ceil(text.length / CHUNK) || 1;
  let base = 0, sent = 0, tokens = 3, last = now, progress = now;
  return {
    id, n,
    done: () => base >= n,
    ack(have) { if (have > base) { base = have; progress = last; } if (sent < base) sent = base; },
    pump(nowMs) {
      tokens = Math.min(6, tokens + (nowMs - last) * RATE); last = nowMs;
      if (base < n && sent > base && nowMs - progress > RESEND_MS) { sent = base; progress = nowMs; } // lipsește o confirmare: reia de la ultima primită
      while (sent < n && sent - base < WINDOW && tokens >= 1) {
        tokens--;
        send({ k: 'sc', id, i: sent, n, d: text.slice(sent * CHUNK, (sent + 1) * CHUNK) });
        sent++;
      }
    },
  };
}

export function createReceiver({ id, n, ack }) {
  const parts = new Array(n).fill(null);
  let have = 0;
  return {
    id,
    /** m = {k:'sc', id, i, n, d}. Întoarce textul întreg când e complet, altfel null. */
    push(m) {
      if (m.id !== id || !Number.isInteger(m.i) || m.i < 0 || m.i >= n || typeof m.d !== 'string') return null;
      parts[m.i] = m.d;
      while (have < n && parts[have] !== null) have++;
      if (have === n || have % 3 === 0 || m.i > have) ack(have); // gol sau grup terminat: spune gazdei până unde ai tot
      return have === n ? parts.join('') : null;
    },
  };
}
