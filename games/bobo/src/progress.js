// Progres salvat prin gameSave('bobo'): { unlocked (nr. de niveluri deschise), stars: {i: 0–3}, fruits: {i: n}, twoPlayers }.
import { gameSave, currentProfile } from '../../../shared/engine/profiles.js';
import { LEVEL_COUNT } from './levels/index.js';

export const playerName = () => { const p = currentProfile(); return p ? p.name : 'Oaspete'; };

export function loadProgress() {
  const s = gameSave('bobo');
  return {
    unlocked: Math.max(1, Math.min(LEVEL_COUNT, s.get('unlocked', 1))),
    stars: s.get('stars', {}) || {}, fruits: s.get('fruits', {}) || {}, twoPlayers: !!s.get('twoPlayers', false),
  };
}

/** Salvează rezultatul unui nivel; întoarce { newBest, unlocked }. */
export function saveResult(index, stars, fruits) {
  const s = gameSave('bobo'), pr = loadProgress();
  const oldStars = pr.stars[index] || 0;
  pr.stars[index] = Math.max(oldStars, stars);
  pr.fruits[index] = Math.max(pr.fruits[index] || 0, fruits);
  const unlocked = Math.max(pr.unlocked, Math.min(LEVEL_COUNT, index + 2));
  s.set('stars', pr.stars); s.set('fruits', pr.fruits); s.set('unlocked', unlocked);
  return { newBest: stars > oldStars, unlocked };
}

export const setTwoPlayers = (v) => gameSave('bobo').set('twoPlayers', !!v);

export function resetProgress() {
  const s = gameSave('bobo');
  s.remove('stars'); s.remove('fruits'); s.remove('unlocked');
}

export const totalStars = (pr) => Object.values(pr.stars).reduce((a, b) => a + b, 0);
