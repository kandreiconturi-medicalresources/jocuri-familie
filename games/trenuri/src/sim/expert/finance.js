// Mod expert, finanțe: rating, împrumuturi pe tranșe cu dobândă, întreținere completă, faliment.
import { MODELS, T_PRESENT, T_OWNER_MASK, T_OWNER_SHIFT } from '../consts.js';
import { companyValue } from '../value.js';
import { addNews } from '../news.js';
import { mark } from '../blocks.js';
import { RATINGS, EX_MAINT, LOAN_TR, BANKRUPT_MONTHS } from './consts.js';

const fail = (err) => ({ ok: false, err });
export const isEx = (s, c) => s.mode === 'expert' && !c.easy && !c.dead;
/** Împrumuturi: în expert (necontinuat simplu) și, din 7.4, în orice lume cu insule (compania are `tr`). */
export const loanOk = (s, c) => !c.dead && (s.islands ? !!c.tr : s.mode === 'expert' && !c.easy);

/** Indicele ratingului (0 = A … 3 = D): cât din active sunt datorii. */
export function ratingOf(s, id) {
  const co = s.companies[id], v = companyValue(s, id);
  const ratio = co.loan <= 0 ? 0 : v <= 0 ? 100 : Math.min(100, ((co.loan * 100) / (v + co.loan)) | 0);
  return RATINGS.findIndex((r) => ratio < r.below);
}

/** Dobânda lunară pe toate tranșele (întreg, rotunjit în jos pe tranșă). */
export const interestOf = (co) => co.tr.reduce((n, t) => n + ((t.p * t.r / 12000) | 0), 0);

const ageOf = (s, t) => s.date.y * 12 + s.date.m - (t.born === undefined ? s.date.y * 12 + s.date.m : t.born);
/** Întreținerea unui tren: crește cu vârsta (+2% pe lună, maxim +150%). */
export const trainMaint = (s, t) => (MODELS[t.model].maint * (100 + Math.min(EX_MAINT.ageMax, ageOf(s, t) * EX_MAINT.ageStep))) / 100 | 0;

/** Întreținerea lunară completă: { tiles, stations, trains, total }. Adaugă și costul pe fiecare tren (t.ym) pentru raport. */
export function maintOf(s, co, record = false) {
  let tiles = 0, up = 0, trains = 0;
  for (let i = 0; i < s.track.length; i++) { const v = s.track[i]; if ((v & T_PRESENT) && ((v & T_OWNER_MASK) >> T_OWNER_SHIFT) === co.id) tiles++; }
  const sts = s.stations.filter((q) => q.owner === co.id);
  for (const q of sts) up += q.up.reduce((n, u) => n + u, 0);
  for (const t of s.trains) if (t.owner === co.id) { const m = trainMaint(s, t); trains += m; if (record) t.ym = (t.ym | 0) + m; }
  const a = tiles * EX_MAINT.tile, b = sts.length * EX_MAINT.station + up * EX_MAINT.upgrade;
  return { tiles: a, stations: b, trains, total: a + b + trains };
}

/** Din `monthly`: plătește întreținerea și dobânda; întoarce costul total (pentru istoric). */
export function payMonthly(s, co) {
  const m = maintOf(s, co, true), int = interestOf(co);
  if (!s.sandbox) co.cash -= m.total + int;
  co.rep.mt += m.total; co.rep.int += int;
  return m.total + int;
}

function takeLoan(s, cmd, c) {
  if (!loanOk(s, c)) return fail('expert');
  const r = ratingOf(s, c.id);
  if (c.tr.length >= RATINGS[r].max) return fail('rating');
  c.cash += LOAN_TR; c.loan += LOAN_TR; c.tr.push({ p: LOAN_TR, r: RATINGS[r].rate });
  return { ok: true, cost: -LOAN_TR };
}

/** Rambursează tranșa cu dobânda cea mai mare (cea mai nouă, la egalitate). */
function repayLoan(s, cmd, c) {
  if (!loanOk(s, c)) return fail('expert');
  if (!c.tr.length) return fail('inexistent');
  let k = 0;
  for (let i = 0; i < c.tr.length; i++) if (c.tr[i].r >= c.tr[k].r) k = i;
  const p = c.tr[k].p;
  if (!s.sandbox && c.cash < p) return fail('bani');
  c.cash -= p; c.loan -= p; c.tr.splice(k, 1);
  return { ok: true, cost: p };
}

/** După faliment: compania continuă în modul simplu (datoriile se șterg, primește puțin cash). */
function continueSimple(s, cmd, c) {
  if (s.mode !== 'expert' || c.easy) return fail('expert');
  c.easy = 1; c.loan = 0; c.tr = []; c.neg = 0;
  if (c.cash < 30000) c.cash = 30000;
  if (s.over && s.over.co === c.id) s.over = null;
  if (s.companies.every((q) => q.ai || q.easy || q.dead)) s.mode = 'simple';
  addNews(s, '🎈', `${c.name} continuă în modul simplu. Împreună repornim!`);
  return { ok: true, cost: 0 };
}

/** O companie AI care a falimentat dispare: trenurile ei se retrag, acțiunile nu mai valorează nimic. */
export function dissolve(s, co) {
  for (const t of s.trains) if (t.owner === co.id) mark(s, t, -1);
  s.trains = s.trains.filter((t) => t.owner !== co.id);
  co.dead = 1; co.px = 0; co.cash = 0; co.loan = 0; co.tr = [];
  s.dirty.trains = true;
  addNews(s, '📉', `${co.name} a dat faliment și a ieșit din joc.`);
}

/** Lunar: câte luni la rând e cash-ul negativ; la 6, jucătorul vede ecranul de faliment, iar un AI iese din joc. */
export function checkBankrupt(s) {
  for (const co of s.companies) {
    if (!isEx(s, co)) continue;
    co.neg = co.cash < 0 ? co.neg + 1 : 0;
    if (co.neg === 3 && !co.ai) addNews(s, '⚠️', `Banii sunt pe minus de 3 luni. Încă 3 luni așa și jocul se oprește. Vinde un tren sau încasează!`);
    if (co.neg >= BANKRUPT_MONTHS) {
      if (co.ai) dissolve(s, co);
      else if (!s.over) { s.over = { co: co.id, tick: s.tick }; addNews(s, '📉', `${co.name} a rămas fără bani.`); }
    }
  }
}

export const LOAN_COMMANDS = { takeLoan, repayLoan, continueSimple };
