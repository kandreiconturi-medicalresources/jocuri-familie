// Mod expert: câmpurile în plus ale companiilor (acțiuni, avere personală, împrumuturi, raport) și companiile AI.
import { START_CASH } from '../consts.js';
import { SHARES, PW_START, MAX_CO, AI_DEFS } from './consts.js';
import { NG } from '../goods.js';

/** Pune pe o companie câmpurile modului expert. `ai` = null pentru un jucător, altfel nivelul (0–2). */
export function initCompany(co, ai = null) {
  co.tr = []; co.neg = 0; co.dead = 0; co.easy = 0; co.px = 100; co.vh = [];
  co.pw = ai === null ? PW_START : 0;
  co.sh = new Array(MAX_CO).fill(0);
  co.sh[co.id] = ai === null ? SHARES / 2 : 400;
  co.mk = SHARES - co.sh[co.id];
  co.rep = { inc: 0, mt: 0, int: 0, g: new Array(NG).fill(0), y: [] };
  co.ai = ai === null ? null : { lv: ai, cool: 1, done: [], bad: [] };
}

/** Din createWorld: toate companiile devin expert, apoi se adaugă concurenții AI (1–3). */
export function initExpert(s, ai = []) {
  for (const c of s.companies) initCompany(c);
  for (let i = 0; i < Math.min(3, ai.length) && s.companies.length < MAX_CO; i++) {
    const id = s.companies.length, d = AI_DEFS[i];
    const co = { id, name: d.name, color: d.color, cash: START_CASH, loan: 0, history: [], month: 0, record: 0 };
    initCompany(co, Math.max(0, Math.min(2, ai[i] | 0)));
    s.companies.push(co);
  }
}
