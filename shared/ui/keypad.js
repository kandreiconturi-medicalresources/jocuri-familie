// Tastatură mare cu litere pentru codul camerei (cele 23 de litere pe care le folosește serverul) + afișajul celor 4 locuri.
import { h } from './dom.js';

export const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';

/** onChange(cod) la fiecare literă; onSubmit(cod) când sunt 4 litere sau se apasă „Intră”. Tastatura fizică merge și ea. */
export function createKeypad({ onChange, onSubmit }) {
  let code = '';
  const slots = Array.from({ length: 4 }, () => h('span', { class: 'slot' }));
  const display = h('div', { class: 'code small' }, slots);
  const keys = h('div', { class: 'keys' });
  const enter = h('button', { class: 'big key wide', onclick: () => submit() }, 'Intră ▶');

  function paint() {
    slots.forEach((s, i) => { s.textContent = code[i] || ''; s.classList.toggle('on', i === code.length); });
    enter.disabled = code.length < 4;
    onChange(code);
  }
  function type(ch) {
    if (code.length >= 4 || !CODE_LETTERS.includes(ch)) return;
    code += ch; paint();
    if (code.length === 4) submit();
  }
  function back() { code = code.slice(0, -1); paint(); }
  function submit() { if (code.length === 4) onSubmit(code); }

  for (const ch of CODE_LETTERS) keys.appendChild(h('button', { class: 'big key', onclick: () => type(ch) }, ch));
  keys.appendChild(h('button', { class: 'big key alt', onclick: back }, '⌫'));
  keys.appendChild(enter);

  const el = h('div', null, display, keys);
  return {
    el,
    reset() { code = ''; paint(); },
    /** Tastele fizice: se leagă doar cât ecranul de intrare e vizibil. */
    onKey(e) {
      if (e.key === 'Backspace') back();
      else if (e.key === 'Enter') submit();
      else if (e.key.length === 1) type(e.key.toUpperCase());
    },
  };
}
