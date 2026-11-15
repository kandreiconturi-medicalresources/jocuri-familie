// Segmente făcute de mână. Textul are rândurile de sus în jos, terminate la rândul 16 (ultimele 2 = teren, rândurile 15 și 16);
// rândurile lipsă de sus sunt completate cu gol. Un segment are 11 rânduri (rândurile 6..16 ale nivelului).
//
// Caractere în plus față de legenda din tiles.js (le transformă generatorul):
//   e = inamic care umblă (ales după lume)   a = inamic zburător (bee/fly)
//   1..4 = enemies[0..3] din meta (tip exact)  P = platformă mobilă (o serie de P = lățimea; parametri în `plats`)
//   H = loc pentru steluța ascunsă/sus        R = loc pentru steluța riscantă (altfel devin căpșuni)
export const CHUNK_ROWS = 11;
export const CHUNK_TOP = 6;
/** Greșelile de format ale segmentelor (verificate de teste), ca să le vezi pe toate odată. */
export const CHUNK_ERRORS = [];

export function chunk(id, mechanic, difficulty, enemies, text, plats = []) {
  const lines = text.split('\n').map((s) => s.trim()).filter(Boolean);
  const width = lines[lines.length - 1].length;
  if (lines.length > CHUNK_ROWS) CHUNK_ERRORS.push(`${id}: prea multe rânduri`);
  lines.forEach((l, i) => { if (l.length !== width) CHUNK_ERRORS.push(`${id}: rândul ${i} are ${l.length}, nu ${width}`); });
  const rows = Array(Math.max(0, CHUNK_ROWS - lines.length)).fill('.'.repeat(width)).concat(lines)
    .map((l) => l.padEnd(width, '.').slice(0, width));
  return { id, mechanic, difficulty, enemies, rows, width, plats };
}
