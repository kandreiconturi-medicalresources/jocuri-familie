// Modelele Ultra (mașini, felinare, specii în plus) se încarcă abia la prima pornire a graficii Ultra: telefoanele nu le descarcă niciodată.
import { loadModels } from './models.js';
import { ULTRA_MODELS } from './props.js';
import { ultraOn } from './look.js';

let ready = false, loading = false;
/** Ultra pornit și modelele lui încărcate. */
export const ultraFull = () => ready && ultraOn();
/** Cere încărcarea (o singură dată); onReady se cheamă după ce modelele sunt gata. */
export function ensureUltra(onReady) {
  if (ready || loading || !ultraOn()) return;
  loading = true;
  loadModels(ULTRA_MODELS).then(() => { ready = true; onReady(); });
}
