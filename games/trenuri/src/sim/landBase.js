// Parcelele 4×4 (etapa 7.4), partea fără dependențe: cine stăpânește o placă. `s.land[parcelă] = proprietar + 1`
// (0 = încă stăpânul insulei); stratul apare abia la prima cumpărare.
export const parcelsW = (s) => (s.w + 3) >> 2;
export const parcelId = (s, x, y) => (y >> 2) * parcelsW(s) + (x >> 2);
/** Stăpânul plăcii: id-ul companiei, -1 insulă fără stăpân, -2 marea. */
export function tileOwner(s, x, y) {
  if (!s.isl || x < 0 || y < 0 || x >= s.w || y >= s.h) return -2;
  const k = s.isl[y * s.w + x] - 1;
  if (k < 0) return -2;
  const v = s.land ? s.land[parcelId(s, x, y)] : 0;
  return v ? v - 1 : s.islands[k].owner;
}
