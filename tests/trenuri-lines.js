// Ajutor pentru teste: linii drepte între insule (poduri mari).
import { islandAt, WATER_H, DX, DY } from '../games/trenuri/src/sim/index.js';

/** O linie dreaptă de la insula a la insula b peste 3–12 plăci de apă, cu capete libere (prima din ordinea hărții). */
export function findLine(s, a, b, minN = 3, maxN = 12) {
  const q = s.islands[a];
  for (let y = q.y0; y <= q.y1; y++) for (let x = q.x0; x <= q.x1; x++) {
    if (islandAt(s, x, y) !== a || s.water[y * s.w + x] || s.occ[y * s.w + x]) continue;
    for (let d = 0; d < 8; d++) {
      let n = 0, cx = x + DX[d], cy = y + DY[d];
      while (cx >= 0 && cy >= 0 && cx < s.w && cy < s.h && s.water[cy * s.w + cx]) { n++; cx += DX[d]; cy += DY[d]; }
      if (n < minN || n > maxN || cx < 0 || cy < 0 || cx >= s.w || cy >= s.h) continue;
      const i = cy * s.w + cx;
      if (islandAt(s, cx, cy) === b && !s.occ[i] && s.height[i] > WATER_H) return { x0: x, y0: y, x1: cx, y1: cy, n };
    }
  }
  return null;
}
