// Input unificat: tastatură + gamepad + atingere -> { left, right, up, down, a, b, start }.
import { unlockAudio } from './audio.js';

export const BUTTONS = ['left', 'right', 'up', 'down', 'a', 'b', 'start'];

export const DEFAULT_KEYMAP = {
  players: [
    { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], a: ['Space'], b: ['KeyF'] },
    {
      left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
      a: ['Enter', 'ArrowUp'], b: ['ArrowDown', 'ShiftRight'],
    },
  ],
  start: ['Escape', 'KeyP'], // pentru oricine
};

const BLOCK = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

function padState(g) {
  if (!g) return null;
  const ax = g.axes[0] || 0, ay = g.axes[1] || 0;
  const p = (n) => !!(g.buttons[n] && g.buttons[n].pressed);
  return {
    left: ax < -0.4 || p(14), right: ax > 0.4 || p(15),
    up: ay < -0.5 || p(12), down: ay > 0.5 || p(13),
    a: p(0) || p(1), b: p(2) || p(3), start: p(9),
  };
}

function getPad(i) {
  try {
    const l = navigator.getGamepads ? navigator.getGamepads() : [];
    return padState(l[i]);
  } catch (e) {
    return null;
  }
}

export function createInput({ players = 2, keymap = DEFAULT_KEYMAP } = {}) {
  const down = {};
  const touch = Array.from({ length: players }, () => ({}));

  const onKey = (v) => (e) => {
    if (v && BLOCK.has(e.code) && !/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) {
      e.preventDefault();
    }
    down[e.code] = v;
    if (v && !e.repeat) unlockAudio();
  };
  const clear = () => {
    for (const k in down) down[k] = false;
    touch.forEach((t) => { for (const k in t) t[k] = false; });
  };
  const onKd = onKey(true), onKu = onKey(false);
  const onVis = () => { if (document.hidden) clear(); };
  addEventListener('keydown', onKd);
  addEventListener('keyup', onKu);
  addEventListener('blur', clear); // tastele se resetează la blur
  document.addEventListener('visibilitychange', onVis);

  const keyHit = (codes) => !!codes && codes.some((c) => down[c]);

  function read(i) {
    const km = (keymap.players && keymap.players[i]) || {};
    const t = touch[i] || {};
    const pad = getPad(i);
    const out = {};
    for (const b of BUTTONS) {
      out[b] = keyHit(km[b]) || !!t[b] || !!(pad && pad[b]);
    }
    out.start = out.start || keyHit(keymap.start);
    return out;
  }

  return {
    read,
    setTouch(i, btn, isDown) { if (touch[i]) touch[i][btn] = !!isDown; },
    clear,
    any(btn) {
      for (let i = 0; i < players; i++) if (read(i)[btn]) return true;
      return false;
    },
    destroy() { // scoate ascultătorii (la ieșirea din joc)
      removeEventListener('keydown', onKd);
      removeEventListener('keyup', onKu);
      removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', onVis);
    },
  };
}
