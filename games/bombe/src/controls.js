// Taste, gamepad-uri și butoane tactile (cruce + bombă 💣 + al doilea buton 🧤 pe fiecare parte).
import { createInput } from '../../../shared/engine/input.js';
import { createTouchpad } from '../../../shared/ui/touchpad.js';

// `a` = pune bombă (de două ori repede: bombe în linie); `b` = aruncă bomba (mănușă) sau detonează (telecomandă).
export const KEYMAP = {
  players: [
    { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], a: ['Space'], b: ['KeyF', 'KeyE'] },
    { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], a: ['Enter'], b: ['ShiftRight', 'ControlRight'] },
    {}, {},
  ],
  start: ['Escape', 'KeyP'],
};

export const makeInput = () => createInput({ players: 4, keymap: KEYMAP }); // gamepad k -> jucătorul k (A/B = bombă, X/Y = al doilea buton)

/** n = câți jucători folosesc ecranul: 1 → crucea în stânga, butoanele în dreapta; 2 → câte un set pe fiecare parte. */
export function buildTouchpad(input, n) {
  const L = (player, btn, side, label) => ({ player, btn, side, label });
  const pad = (p, side) => [L(p, 'up', side, '▲'), L(p, 'left', side, '◀'), L(p, 'right', side, '▶'), L(p, 'down', side, '▼')];
  const acts = (p, side) => [L(p, 'b', side, '🧤'), L(p, 'a', side, '💣')];
  const layout = n === 1
    ? [...pad(0, 'left'), ...acts(0, 'right')]
    : [...pad(0, 'left'), ...acts(0, 'left'), ...pad(1, 'right'), ...acts(1, 'right')];
  const tp = createTouchpad(input, layout);
  const root = document.querySelector('.tp');
  if (root) root.classList.add(n === 1 ? 'one' : 'two');
  tp.show(false);
  return tp;
}
