// Timpul de joc: ziua și ora în fusul Europe/Bucharest, starea `time` și contorizarea prin heartbeat.

const MAX_PER_BEAT = 35;   // secunde adăugate cel mult la o bătaie
const NEW_SESSION_GAP = 120; // după o pauză mai lungă, prima bătaie începe o sesiune nouă (nu adaugă nimic)

const fmtCache = new Map();
function partsIn(ms, timeZone) {
  let f = fmtCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    fmtCache.set(timeZone, f);
  }
  const p = {};
  for (const { type, value } of f.formatToParts(new Date(ms))) p[type] = value;
  return p;
}

/** 'YYYY-MM-DD' și secunda din zi (0–86399), în fusul dat. */
export function localClock(ms, timeZone) {
  const p = partsIn(ms, timeZone);
  return { day: `${p.year}-${p.month}-${p.day}`, sec: (+p.hour) * 3600 + (+p.minute) * 60 + (+p.second) };
}

const hmToSec = (hm) => (hm ? (+hm.slice(0, 2)) * 3600 + (+hm.slice(3, 5)) * 60 : null);

/**
 * Intervalul orar permis. Întoarce { allowed, secLeft } unde secLeft = secunde până se închide intervalul
 * (null = nu se închide azi). from > to înseamnă interval peste miezul nopții (ex. 22:00–02:00).
 */
export function hoursWindow(fromHm, toHm, sec) {
  const from = hmToSec(fromHm), to = hmToSec(toHm);
  if (from === null && to === null) return { allowed: true, secLeft: null };
  if (from !== null && to !== null) {
    if (from === to) return { allowed: true, secLeft: null };
    if (from < to) return sec >= from && sec < to ? { allowed: true, secLeft: to - sec } : { allowed: false, secLeft: 0 };
    if (sec >= from) return { allowed: true, secLeft: 86400 - sec + to };
    return sec < to ? { allowed: true, secLeft: to - sec } : { allowed: false, secLeft: 0 };
  }
  if (from !== null) return sec >= from ? { allowed: true, secLeft: null } : { allowed: false, secLeft: 0 };
  return sec < to ? { allowed: true, secLeft: to - sec } : { allowed: false, secLeft: 0 };
}

export function createTime(db, cfg) {
  const clock = () => localClock(cfg.now(), cfg.timeZone);

  function usageToday(userId, day) {
    const r = db.s.usage.get(userId, day);
    return { seconds: r ? r.seconds : 0, bonus: r ? r.bonus_min : 0 };
  }

  /** Obiectul `time` din API pentru utilizatorul dat (rândul din DB). */
  function status(user) {
    const { day, sec } = clock();
    const u = usageToday(user.id, day);
    if (user.role === 'admin') {
      return { usedToday: u.seconds, minutesPerDay: null, bonusToday: 0, remainingSec: null, allowedNow: true, reason: null };
    }
    const limit = user.minutes_per_day;
    const left = limit === null ? null : Math.max(0, (limit + u.bonus) * 60 - u.seconds);
    const win = hoursWindow(user.from_hm, user.to_hm, sec);
    let reason = null;
    if (user.disabled) reason = 'disabled';
    else if (!win.allowed) reason = 'hours';
    else if (left !== null && left <= 0) reason = 'limit';
    let remainingSec = left;
    if (win.secLeft !== null) remainingSec = remainingSec === null ? win.secLeft : Math.min(remainingSec, win.secLeft);
    if (reason) remainingSec = 0;
    return { usedToday: u.seconds, minutesPerDay: limit, bonusToday: u.bonus, remainingSec, allowedNow: !reason, reason };
  }

  /**
   * O bătaie de inimă: adaugă timpul scurs de la bătaia anterioară a aceluiași utilizator (pe orice
   * dispozitiv), cel mult 35 s. Așa două dispozitive deschise nu dublează timpul.
   */
  function heartbeat(user) {
    const now = cfg.now();
    return db.tx(() => {
      const fresh = db.s.userById.get(user.id);
      const before = status(fresh);
      const last = fresh.last_beat;
      db.s.setBeat.run(now, fresh.id);
      if (!before.allowedNow) return before;
      const gap = last == null ? Infinity : (now - last) / 1000;
      const add = gap > NEW_SESSION_GAP || gap <= 0 ? 0 : Math.min(MAX_PER_BEAT, Math.round(gap));
      if (add > 0) db.s.addSeconds.run(fresh.id, clock().day, add);
      return status(fresh);
    });
  }

  /** Minute în plus doar azi (pot fi și negative, pentru corecturi); totalul rămâne între 0 și 600. */
  function addBonus(user, minutes) {
    const { day } = clock();
    const cur = usageToday(user.id, day).bonus;
    db.s.setBonus.run(user.id, day, Math.max(0, Math.min(600, cur + minutes)));
    return status(user);
  }

  return { status, heartbeat, addBonus, clock };
}
