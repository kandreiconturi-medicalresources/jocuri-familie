// Salvări vechi: gările mari de trecere cu intrări separate sau culoar, construite înainte de liniile independente (fără `st.ln`),
// primesc la încărcare liniile drepte prin gară (gratuit; casele din cale se mută). Scara de macaze veche rămâne (trecere între linii).
// Dacă locul nu permite (apă, șina altuia), gara rămâne ca înainte. Deterministă: toți jucătorii din rețea încarcă la fel.
import { thruPlan, claim } from './thru.js';
import { syncAuto } from './signals.js';

export function migrateLanes(s) {
  let any = false;
  for (const st of s.stations) {
    if (!st.thru || st.ln || !(st.sep || st.cor)) continue;
    const p = thruPlan(s, st.x, st.y, st.dir, st.platforms, st, st.owner, st.cor || st.sep);
    if (!p.ok || !p.lanesOk) continue;
    claim(s, st, p);
    any = true;
  }
  if (any) syncAuto(s);
  return any;
}
