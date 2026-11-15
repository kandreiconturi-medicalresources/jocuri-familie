// Generator pseudo-aleator determinist (mulberry32), același rezultat pe orice dispozitiv.

/** Text -> uint32 (FNV-1a). */
export function hashSeed(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** rng(seed) -> { next, int, pick, chance, range }. Seed poate fi număr sau text. */
export function rng(seed) {
  let a = (typeof seed === 'string' ? hashSeed(seed) : seed >>> 0) || 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)), // ambele capete incluse
    range: (lo, hi) => lo + next() * (hi - lo),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
  };
}
