// Stilul grafic ales de jucător: 'classic' (desenat în cod, implicit) sau 'modern' (sprite-uri Kenney). Se salvează cu gameSave.
import { gameSave } from '../../../../shared/engine/profiles.js';

let cur = null;
export const STYLES = ['classic', 'modern'];

export function gfxStyle() {
  if (!cur) {
    let v = 'classic';
    try { v = gameSave('bobo').get('gfx', 'classic'); } catch (e) { /* fără profil încă */ }
    cur = STYLES.includes(v) ? v : 'classic';
  }
  return cur;
}

export function setGfxStyle(v) {
  if (!STYLES.includes(v)) return;
  cur = v;
  try { gameSave('bobo').set('gfx', v); } catch (e) { /* nu se salvează */ }
}
