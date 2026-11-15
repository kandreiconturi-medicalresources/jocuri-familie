// Comenzi: tastatură (P1 săgeți/WASD + Space drift + Shift nitro; P2 IJKL + U/O), gamepad (A/RT accelerare,
// B/LT frână, X nitro), butoane tactile și volan prin înclinare.
import { createTouchpad } from '../../../shared/ui/touchpad.js';
import { unlockAudio } from '../../../shared/engine/audio.js';
import { isIOS } from '../../../shared/engine/screen.js';

const MAPS = [
  { left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], drift: ['Space'], nitro: ['ShiftLeft', 'ShiftRight'], reset: ['KeyR'] },
  { left: ['KeyJ'], right: ['KeyL'], up: ['KeyI'], down: ['KeyK'], drift: ['KeyU'], nitro: ['KeyO'], reset: ['KeyH'] },
];
const BLOCK = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export function createControls() {
  const down = {}, touch = {};
  let onStart = null;
  const kd = (e) => {
    if (BLOCK.has(e.code)) e.preventDefault();
    if (!e.repeat) { unlockAudio(); if ((e.code === 'Escape' || e.code === 'KeyP') && onStart) onStart(); }
    down[e.code] = true;
  };
  const ku = (e) => { down[e.code] = false; };
  const clear = () => { for (const k in down) down[k] = false; for (const k in touch) touch[k] = false; };
  addEventListener('keydown', kd); addEventListener('keyup', ku); addEventListener('blur', clear);
  const hit = (codes) => codes.some((c) => down[c]);
  const tilt = { on: false, v: 0 };
  const onTilt = (e) => {
    const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    const raw = ang === 90 ? e.beta : ang === -90 || ang === 270 ? -e.beta : e.gamma;
    tilt.v = Math.max(-1, Math.min(1, (raw || 0) / 28));
  };

  const pad = (i) => { try { return (navigator.getGamepads ? navigator.getGamepads() : [])[i] || null; } catch (e) { return null; } };
  const pb = (g, n) => !!(g && g.buttons[n] && g.buttons[n].pressed);

  return {
    /** Fiecare jucător cu tastatură; gamepad-ul k merge la jucătorul k. `auto` = accelerare automată. */
    read(i, auto) {
      const m = MAPS[i], g = pad(i), t = i === 0 ? touch : {};
      let steer = (hit(m.right) || t.right ? 1 : 0) - (hit(m.left) || t.left ? 1 : 0);
      if (g && Math.abs(g.axes[0] || 0) > 0.15) steer = g.axes[0];
      if (!steer && i === 0 && tilt.on) steer = Math.abs(tilt.v) > 0.06 ? tilt.v : 0;
      const brake = hit(m.down) || t.down || pb(g, 1) || pb(g, 6);
      const gas = hit(m.up) || auto || pb(g, 0) || pb(g, 7);
      return {
        steer, throttle: gas && !brake ? 1 : 0, brake: brake ? 1 : 0,
        drift: hit(m.drift) || !!t.drift || pb(g, 4) || pb(g, 5), nitro: hit(m.nitro) || !!t.nitro || pb(g, 2), reset: hit(m.reset) || pb(g, 3),
      };
    },
    setTouch: (_i, btn, on) => { touch[btn] = on; },
    onStart(fn) { onStart = fn; },
    clear,
    async enableTilt() {
      try {
        if (isIOS && window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission && (await DeviceOrientationEvent.requestPermission()) !== 'granted') return false;
        addEventListener('deviceorientation', onTilt); tilt.on = true; return true;
      } catch (e) { return false; }
    },
    disableTilt() { removeEventListener('deviceorientation', onTilt); tilt.on = false; tilt.v = 0; },
    get tiltOn() { return tilt.on; },
  };
}

/** Butoane tactile: ◀ ▶ la stânga; frână, drift, nitro la dreapta. */
export function buildTouchpad(controls) {
  const L = (btn, side, label) => ({ player: 0, btn, side, label });
  const tp = createTouchpad(controls, [L('left', 'left', '◀'), L('right', 'left', '▶'), L('down', 'right', 'STOP'), L('drift', 'right', 'DRIFT'), L('nitro', 'right', '🔥')]);
  const root = document.querySelector('.tp');
  if (root) root.classList.add('curse');
  tp.show(false);
  return tp;
}
