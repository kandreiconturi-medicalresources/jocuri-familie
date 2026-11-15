// Canvas cu avatarul unui profil, clar și pe ecrane retina.
import { drawAvatar } from '../shared/engine/profiles.js';

export function avatarCanvas(avatar, color, size) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(size * dpr);
  c.style.width = c.style.height = size + 'px';
  c.className = 'avatar';
  c.setAttribute('aria-hidden', 'true');
  drawAvatar(c.getContext('2d'), avatar, c.width / 2, c.width / 2, c.width / 2 - 1, color);
  return c;
}
