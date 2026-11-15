// Taste, gamepad-uri și butoane tactile (cruce + bombă pe fiecare parte).
import { createInput } from '../../../shared/engine/input.js';
import { createTouchpad } from '../../../shared/ui/touchpad.js';

export const KEYMAP = {
  players: [
    { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], a: ['Space', 'KeyF'] },
    { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], a: ['Enter', 'ShiftRight'] },
    {}, {},
  ],
  start: ['Escape', 'KeyP'],
};

export const makeInput = () => createInput({ players: 4, keymap: KEYMAP }); // gamepad k -> jucătorul k

/** n = câți jucători folosesc ecranul: 1 → crucea în stânga, bomba în dreapta; 2 → câte un set pe fiecare parte. */
export function buildTouchpad(input, n) {
  const L = (player, btn, side, label) => ({ player, btn, side, label });
  const set = (p, side) => [L(p, 'up', side, '▲'), L(p, 'left', side, '◀'), L(p, 'right', side, '▶'), L(p, 'down', side, '▼'), L(p, 'a', side, '💣')];
  const layout = n === 1
    ? [L(0, 'up', 'left', '▲'), L(0, 'left', 'left', '◀'), L(0, 'right', 'left', '▶'), L(0, 'down', 'left', '▼'), L(0, 'a', 'right', '💣')]
    : [...set(0, 'left'), ...set(1, 'right')];
  const tp = createTouchpad(input, layout);
  const root = document.querySelector('.tp');
  if (root) root.classList.add(n === 1 ? 'one' : 'two');
  tp.show(false);
  return tp;
}
