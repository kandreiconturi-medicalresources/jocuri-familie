// Geometria „culoarului prin oraș” (gara de trecere extinsă): o fâșie de n linii paralele care traversează tot orașul.
// Fâșia = rândurile 0..n-1 (linia principală e rândul 0, pe partea `dir`) + câte o placă de margine pe fiecare latură (rândurile -1 și n),
// de-a lungul lui -E..+E. Totul se deduce din gară (x, y, dir, platforms = n, cor = E): nimic în plus în stare.
import { frameOf } from './terminal.js';

export const COR_MIN = 2, COR_MAX = 5;
/** Lungimea minimă (jumătate): evantaiul începe la 5 plăci și are n-1 rânduri, plus 2 plăci drepte la capăt. */
export const corMinHalf = (n) => n + 6;

/** Plăcile fâșiei (rândurile -1..n). `rows` = true: doar rândurile liniilor 0..n-1. În hartă sau nu (cine folosește verifică). */
export function corTiles(x, y, dir, n, E, rows = false) {
  const f = frameOf(dir), out = [];
  for (let c = rows ? 0 : -1; c <= (rows ? n - 1 : n); c++) for (let a = -E; a <= E; a++) out.push([x + f.ax * a + f.cx * c, y + f.ay * a + f.cy * c]);
  return out;
}

/** Strat derivat: fâșia e păstrată liberă (orașul nu construiește), drumurile de pe linii dispar. */
export function markCor(s, st) {
  const inb = ([x, y]) => x >= 0 && y >= 0 && x < s.w && y < s.h;
  for (const t of corTiles(st.x, st.y, st.dir, st.platforms, st.cor).filter(inb)) s.keep[t[1] * s.w + t[0]] = 1;
  for (const t of corTiles(st.x, st.y, st.dir, st.platforms, st.cor, true).filter(inb)) s.roads[t[1] * s.w + t[0]] = 0;
}
