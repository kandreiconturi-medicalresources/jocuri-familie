// Lipire magnetică: capetele traseului se prind de gări, capete de linie și șina proprie din apropiere.
import { T_PRESENT, T_OWNER_MASK, T_OWNER_SHIFT } from '../sim/consts.js';

/** Cea mai bună țintă la cel mult `r` plăci de t: gară (cea mai bună), capăt de linie, orice șină proprie. */
export function snapTarget(s, t, by = 0, r = 2) {
  if (!t) return null;
  let best = null, bs = 1e9;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = t.x + dx, y = t.y + dy;
    if (x < 0 || y < 0 || x >= s.w || y >= s.h) continue;
    const v = s.track[y * s.w + x];
    if (!(v & T_PRESENT) || ((v & T_OWNER_MASK) >> T_OWNER_SHIFT) !== by) continue;
    const links = (v & 0xff).toString(2).replace(/0/g, '').length, st = s.stations.some((q) => q.x === x && q.y === y);
    const d = dx * dx + dy * dy, score = d - (st ? 4 : links === 1 ? 2.5 : 0);
    if (score < bs) { bs = score; best = { x, y, kind: st ? 'station' : links === 1 ? 'end' : 'track' }; }
  }
  return best;
}
