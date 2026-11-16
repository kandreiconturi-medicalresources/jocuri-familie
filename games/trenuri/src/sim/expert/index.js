// Mod expert: pasul lunar (după economia de bază) și tabela de comenzi noi. Modul simplu nu trece pe aici.
import { checkBankrupt, LOAN_COMMANDS } from './finance.js';
import { updatePrices, payDividends, STOCK_COMMANDS } from './stocks.js';
import { closeYear } from './report.js';
import { aiMonth } from './ai.js';

export * from './consts.js';
export { initExpert, initCompany } from './init.js';
export { ratingOf, interestOf, maintOf, trainMaint, isEx } from './finance.js';
export { netWorth, stakePct, isMajor, profit12, targetPrice } from './stocks.js';
export { recordIncome } from './report.js';

export const EXPERT_COMMANDS = { ...LOAN_COMMANDS, ...STOCK_COMMANDS };
export const EXPERT_ALLOWED = Object.keys(EXPERT_COMMANDS);

/** Apelat din `monthly` după ce întreținerea și dobânzile au fost plătite. */
export function expertMonthly(s) {
  checkBankrupt(s);
  updatePrices(s);
  if (s.date.m === 1) { payDividends(s); closeYear(s); }
  for (const co of s.companies) if (co.ai && !co.dead && s.mode === 'expert') aiMonth(s, co);
}
