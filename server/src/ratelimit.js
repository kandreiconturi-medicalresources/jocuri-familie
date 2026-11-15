// Limitarea încercărilor de login: 5 eșecuri pe IP+utilizator → blocare 15 min.
// În plus, o limită largă pe IP (încercări pe mulți utilizatori). Totul în memorie, cu plafon de mărime.

const MAX_KEYS = 10000;

export function createLoginLimiter(cfg, { perIpFails = 30 } = {}) {
  const fails = new Map(); // cheie → { n, first, blockedUntil }

  function entry(key, now) {
    let e = fails.get(key);
    if (e && e.blockedUntil <= now && now - e.first > cfg.loginBlockMs) { fails.delete(key); e = null; }
    return e;
  }

  function isBlockedKey(key, now) {
    const e = entry(key, now);
    return !!e && e.blockedUntil > now;
  }

  function failKey(key, max, now) {
    let e = entry(key, now);
    if (!e) {
      if (fails.size >= MAX_KEYS) prune(now);
      if (fails.size >= MAX_KEYS) fails.delete(fails.keys().next().value);
      e = { n: 0, first: now, blockedUntil: 0 };
      fails.set(key, e);
    }
    e.n++;
    if (e.n >= max) e.blockedUntil = now + cfg.loginBlockMs;
  }

  function prune(now) {
    for (const [k, e] of fails) if (e.blockedUntil <= now && now - e.first > cfg.loginBlockMs) fails.delete(k);
  }

  const userKey = (ip, user) => `u\n${ip}\n${user}`;
  const ipKey = (ip) => `i\n${ip}`;

  return {
    isBlocked(ip, user) {
      const now = cfg.now();
      return isBlockedKey(userKey(ip, user), now) || isBlockedKey(ipKey(ip), now);
    },
    fail(ip, user) {
      const now = cfg.now();
      failKey(userKey(ip, user), cfg.loginMaxFails, now);
      failKey(ipKey(ip), perIpFails, now);
    },
    success(ip, user) {
      fails.delete(userKey(ip, user));
    },
    prune: () => prune(cfg.now()),
  };
}

/** Limită simplă pe fereastră de 1 s (folosită pentru mesajele WebSocket). */
export function perSecond(max) {
  let windowStart = 0, n = 0;
  return (now = Date.now()) => {
    if (now - windowStart >= 1000) { windowStart = now; n = 0; }
    n++;
    return n <= max;
  };
}
