// „Cum se joacă”: comenzi, mecanici și legenda bonusurilor (iconițele sunt desenate, nu emoji).
import { h } from '../../../../shared/ui/dom.js';
import { bonusLegend } from '../render/icons.js';

export const makeHelp = () => h('details', null, h('summary', null, '❓ Cum se joacă'),
  h('div', null, 'Pune bombe 💣, sparge lăzile și fugi din calea flăcărilor! Ai vieți (inimioare): când ești lovit pierzi una, lași câteva bonusuri pe arenă și revii după 2 secunde în colțul tău. Bombele tale te rănesc și pe tine! Ultimul cu vieți câștigă.'),
  h('div', null, 'Jucătorul 1: ', h('kbd', null, 'W A S D'), ' + ', h('kbd', null, 'Spațiu'), ' (bombă) · ', h('kbd', null, 'F'), ' (butonul 2)'),
  h('div', null, 'Jucătorul 2: ', h('kbd', null, '← ↑ ↓ →'), ' + ', h('kbd', null, 'Enter'), ' (bombă) · ', h('kbd', null, 'Shift dreapta'), ' (butonul 2)'),
  h('div', null, 'Gamepad: A/B = bombă, X/Y = butonul 2. Pe ecran tactil: crucea, 💣 și 🧤 (butonul 2). Cu 3–4 jucători folosiți manete.'),
  h('div', null, 'Apasă 💣 de două ori repede și pui toate bombele tale într-o linie, în direcția în care privești.'),
  h('div', null, 'Șut (toți de la început): mergi spre o bombă și o împingi, iar ea alunecă până se lovește de ceva. Mănușa o aruncă 3 plăci; telecomanda o face să explodeze acum.'),
  h('div', null, 'Bonusurile căzute în flăcări dispar. Dacă timpul se termină, câștigă cine are mai multe vieți.'),
  bonusLegend(h));
