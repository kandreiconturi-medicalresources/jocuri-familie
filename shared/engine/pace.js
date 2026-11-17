// Ritmul desenării (7.8): plafon de cadre, desenare doar la schimbare, DPR și pași de simulare pe cadru.
// Totul aici e logică pură (testată în tests/pace.test.js); doar `detectPhone` citește ecranul.

/** Telefon sau tabletă: ecran tactil principal + latura mică ≤ 820 px, sau un agent de utilizator mobil (iPad nou se anunță ca Mac, dar are atingere). */
export function isPhoneLike({ coarse = false, touchPoints = 0, w = 1920, h = 1080, ua = '' }) {
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
  if (/Macintosh/.test(ua) && touchPoints > 1) return true;
  return coarse && Math.min(w, h) <= 820;
}

export function detectPhone() {
  try {
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    return isPhoneLike({ coarse, touchPoints: navigator.maxTouchPoints || 0, w: screen.width, h: screen.height, ua: navigator.userAgent || '' });
  } catch (e) { return false; }
}

/** Cadre pe secundă desenate: răcoros 24, telefon/tabletă 30, PC 60. */
export const capFps = ({ phone = false, cool = false }) => (cool ? 24 : phone ? 30 : 60);

/** Cel mai mare raport de pixeli: răcoros 1, telefon 1,25, altfel după calitate (2 / 1,5 / 1). */
export const dprCap = ({ phone = false, cool = false, quality = 2 }) => (cool ? 1 : phone ? 1.25 : quality >= 2 ? 2 : quality === 1 ? 1.5 : 1);

/** Pași de simulare la un apel de `update` (la 4× pe telefon un cadru lent nu se mai adună în spirală) și apeluri pe cadru. */
export const simStepCap = ({ phone = false }) => (phone ? 4 : 8);
export const loopStepCap = ({ phone = false }) => (phone ? 2 : 5);

/** Ritmul: `due(now)` spune dacă acest cadru de ecran trebuie desenat (la 30 fps pe un ecran de 60 Hz = fiecare al doilea). */
export function createPacer(cap = 60) {
  let period = 1000 / cap, next = 0;
  return {
    get cap() { return cap; },
    setCap(c) { cap = c; period = 1000 / c; },
    due(now) {
      if (now + 1.5 < next) return false; // 1,5 ms de toleranță pentru neregularitățile cadrelor
      next = Math.max(next + period, now + period * 0.5); // în urmă (după o pauză): nu desenăm în rafală
      return true;
    },
  };
}

/**
 * Trebuie desenat acest cadru? Da dacă ceva se mișcă (simularea merge, camera, rețea), dacă a fost o atingere recentă,
 * sau dacă a trecut `beatMs` de la ultimul desen (bătaie rară: apa, etichetele). Pe pauză cu camera nemișcată: nu.
 */
export function renderNeeded({ now, drawnAt, running = false, camMoved = false, wokeAt = -1e9, wakeMs = 700, beatMs = 1000 }) {
  return running || camMoved || now - wokeAt < wakeMs || now - drawnAt >= beatMs;
}
