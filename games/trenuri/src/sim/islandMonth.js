// Lumea cu insule: crearea (AI, porturi AI, piață) și pasul lunar (piață, întreținerea vapoarelor, porturile AI,
// AI-urile în modul simplu). Apelat din createWorld și din `monthly` doar când există `s.islands`.
import { START_CASH, SHIP_MODELS, PROD } from './consts.js';
import { initCompany, AI_DEFS } from './expert/index.js';
import { aiMonth } from './expert/ai.js';
import { markIslands } from './islands.js';
import { initMarket, marketMonthly } from './market.js';
import { foundAiPorts, restockAi } from './ports.js';
import { addNews } from './news.js';

/** Înainte de deriveLayers: insulele primesc stăpâni (companiile în ordine), apoi se adaugă AI-urile (până la 8 companii). */
export function setupIslands(s, gen, ai) {
  for (let i = 0; i < ai.length && s.companies.length < 8; i++) {
    const id = s.companies.length, d = AI_DEFS[i % AI_DEFS.length];
    const co = { id, name: d.name, color: d.color, cash: START_CASH, loan: 0, history: [], month: 0, record: 0 };
    initCompany(co, Math.max(0, Math.min(2, ai[i] | 0)));
    s.companies.push(co);
  }
  s.islands = gen.islands;
  s.islands.forEach((q, k) => { q.owner = k < s.companies.length ? k : -1; });
  s.ships = [];
  markIslands(s);
}

/** După deriveLayers și creșterea orașelor: porturile AI (cu marfă de pornire) și prețurile. */
export function finishIslands(s) {
  foundAiPorts(s);
  restockAi(s, PROD * 4);
  initMarket(s);
  const me = s.islands.find((q) => q.owner === 0);
  if (me) addNews(s, '🏝️', `Insula ta e ${me.name}. Nu are toate resursele: deschide 🗺️ Insulele ca să vezi ce-ți lipsește și de unde îl aduci cu vaporul.`);
}

export function islandMonthly(s) {
  marketMonthly(s);
  restockAi(s, PROD);
  for (const sh of s.ships) {
    const co = s.companies[sh.owner];
    if (co && !s.sandbox) co.cash -= SHIP_MODELS[sh.model].maint;
  }
  if (s.mode !== 'expert') for (const co of s.companies) if (co.ai && !co.dead) aiMonth(s, co); // în expert le rulează expertMonthly
  if (s.date.m === 1 && s.companies.length > 1) addNews(s, '🏆', 'Un an nou pe insule! Vezi clasamentul în 🗺️ Insulele.');
}
