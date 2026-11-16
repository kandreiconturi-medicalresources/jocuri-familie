// Ordinele unui tren pe fiecare gară din rută: ce încarcă, ce descarcă și cât (vezi drops.js). Folosite de setOrders și buyTrain.
import { NG } from './goods.js';
import { validDrop, cleanDrop } from './drops.js';

const goodList = (l) => l == null || (Array.isArray(l) && l.every((g) => Number.isInteger(g) && g >= 0 && g < NG));

/** null (modul Automat) sau o listă de cel mult 8 ordine { load, unload, drop }. */
export const validOrders = (o) => o === null || (Array.isArray(o) && o.length <= 8 && o.every((x) => x && goodList(x.load) && goodList(x.unload) && validDrop(x.drop)));

export const cleanOrders = (o) => (o ? o.map((x) => ({ load: x.load ? x.load.slice() : null, unload: x.unload ? x.unload.slice() : null, drop: cleanDrop(x.drop) })) : null);
