// Unealta Șină: trei moduri. „Desen liber” (implicit): traseul urmează mâna; „Punct cu punct”: atingi punctele;
// „Drum automat”: A* între puncte (autoTool.js). Podurile, nivelarea, tunelul și defrișarea vin singure (trackDraw.js).
import { createTrackDraw } from './trackDraw.js';
import { createAutoTool } from './autoTool.js';

const MODES = [['free', '✏️ Desen liber', 'urmează mâna'], ['points', '📍 Punct cu punct', 'atingi punctele'], ['auto', '🧭 Drum automat', 'între 2 puncte']];

export function createTrackTool(c) {
  let mode = 'free', tmode = 'pan'; // tmode: pe touch, „Mut harta” sau „Desenez șină”
  const isTouch = () => (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
  const env = Object.create(c);
  env.refresh = () => api.refresh();
  const free = createTrackDraw(env), pts = createTrackDraw(env, { points: true }), auto = createAutoTool(c);
  const cur = () => (mode === 'free' ? free : mode === 'points' ? pts : auto);
  const drawing = () => mode !== 'auto';

  const api = {
    paint: () => cur().paint(),
    refresh() { cur().paint(); c.bar(); },
    reset() { free.reset(); pts.reset(); auto.reset(); api.refresh(); },
    build: () => cur().build(),
    undo: () => cur().undo(),
    isActive: () => cur().isActive(),
    wantsDrag: () => mode !== 'points',
    touchMode: () => tmode,
    /** Al doilea deget în timpul desenului: anulare curată, fără bucăți de șină. */
    dragAbort() { if (drawing()) cur().cancel(); else cur().dragCancel(); },
    tap: (t) => cur().tap(t),
    dragStart: (t) => cur().dragStart(t),
    dragMove: (t, m) => cur().dragMove(t, m),
    dragFlush: () => { if (drawing()) cur().dragFlush(); },
    dragEnd: (t, moved) => cur().dragEnd(t, moved),
    /** Gest întrerupt (alt deget, ieșire din ecran): urma rămâne, jucătorul o poate construi sau continua. */
    dragCancel: () => (drawing() ? cur().dragEnd(null, true) : cur().dragCancel()),
    hover: (t) => cur().hover(t),
    /** Clic dreapta: anulează traseul în lucru. Întoarce true dacă a anulat ceva. */
    rightClick() {
      if (!cur().isActive()) return false;
      if (drawing()) cur().cancel(); else cur().reset();
      return true;
    },
    key(k) {
      if (!drawing()) return cur().key(k);
      if (k === 'Escape') { if (!cur().isActive()) return false; cur().cancel(); return true; }
      if (k === 'Enter' && cur().pending()) { cur().build(); return true; }
      if (k === 'Backspace' && cur().isActive()) { cur().undo(); return true; }
      return false;
    },
    bar() {
      const items = MODES.map(([id, label, small]) => ({ label, small, on: mode === id, fn: () => { if (mode === id) return; cur().reset(); mode = id; api.refresh(); } }));
      if (isTouch()) items.unshift({ label: tmode === 'pan' ? '✋ Mut harta' : '✏️ Desenez șină', small: 'atinge ca să schimbi', on: tmode === 'draw', fn: () => { tmode = tmode === 'pan' ? 'draw' : 'pan'; c.hud().hint(tmode === 'pan' ? 'Un deget mută harta. Desenezi din capătul unei șine sau cu apăsare lungă.' : 'Un deget desenează mereu. Cu două degete muți harta.', false, 4000); c.bar(); } });
      items.push(...cur().bar());
      if (drawing() && !cur().isActive()) items.push({ label: '🛤️🛤️ Șină paralelă', fn: () => c.switchTool('parallel') });
      return items;
    },
  };
  return api;
}
