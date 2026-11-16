// Hash-ul câmpurilor modului expert (se adaugă la hashState doar când s.mode === 'expert').
const fnv = (h, v) => Math.imul((h ^ (v & 255)) >>> 0, 0x01000193) >>> 0;
const num = (h, v) => { v |= 0; h = fnv(h, v); h = fnv(h, v >> 8); h = fnv(h, v >> 16); return fnv(h, v >> 24); };

export function hashExpert(s, h) {
  for (const c of s.companies) {
    h = num(num(num(num(h, c.pw), c.px), c.mk), c.neg + c.dead * 64 + c.easy * 128);
    for (const v of c.sh) h = num(h, v);
    for (const t of c.tr) h = num(num(h, t.p), t.r);
    h = num(num(num(h, c.rep.inc), c.rep.mt), c.rep.y.length);
    if (c.ai) h = num(num(num(h, c.ai.cool), c.ai.done.length), c.ai.bad.length);
  }
  return num(h, s.over ? s.over.co + 1 : 0);
}
