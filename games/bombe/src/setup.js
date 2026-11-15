// Alegerile din meniu -> configurația unui meci (jucători, boți, arenă, reguli).
import { AVATARS, PROFILE_COLORS, currentProfile, gameSave } from '../../../shared/engine/profiles.js';
import { rng } from '../../../shared/engine/rng.js';

const NAMES = { bear: 'Ursulețul', bunny: 'Iepurașul', fox: 'Vulpița', cat: 'Pisicuța', panda: 'Panda', frog: 'Broscuța', owl: 'Bufnița', pig: 'Purcelușul' };
const DEFAULTS = { humans: 1, bots: 2, level: 'easy', arena: 0, rounds: 3, gentle: true };

export function loadSetup() {
  let v = null;
  try { v = gameSave('bombe').get('setup', null); } catch (e) { v = null; }
  return { ...DEFAULTS, ...(v || {}) };
}
export function saveSetup(st) { try { gameSave('bombe').set('setup', st); } catch (e) { /* fără salvare */ } }

/** Corectează numerele ca să fie 2–4 jucători în total. */
export function fixCounts(st) {
  st.humans = Math.max(1, Math.min(4, st.humans));
  st.bots = Math.max(0, Math.min(4 - st.humans, st.bots));
  if (st.humans + st.bots < 2) st.bots = 1;
  return st;
}

/** Completează lista cu boți până la `bots`, cu avatare și culori diferite de cele existente. */
export function addBots(players, bots, level, seed) {
  const r = rng(seed ^ 0x51ed);
  const out = players.slice();
  for (let i = 0; i < bots; i++) {
    const free = AVATARS.filter((a) => !out.some((p) => p.avatar === a));
    const av = r.pick(free.length ? free : AVATARS);
    const col = PROFILE_COLORS.find((c) => !out.some((p) => p.color === c)) || PROFILE_COLORS[i];
    out.push({ id: 'b' + i, name: NAMES[av], avatar: av, color: col, bot: true, level });
  }
  return out;
}

/** Meci local: `humans` jucători pe acest dispozitiv (primul = profilul curent). */
export function localConfig(st) {
  st = fixCounts({ ...st });
  const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  const prof = currentProfile() || { name: 'Jucător 1', avatar: 'bear', color: PROFILE_COLORS[0] };
  const humans = [{ id: 'p0', name: prof.name, avatar: prof.avatar, color: prof.color }];
  for (let i = 1; i < st.humans; i++) {
    const av = AVATARS.find((a) => !humans.some((p) => p.avatar === a));
    const col = PROFILE_COLORS.find((c) => !humans.some((p) => p.color === c));
    humans.push({ id: 'p' + i, name: 'Jucător ' + (i + 1), avatar: av, color: col });
  }
  const slots = {};
  humans.forEach((p, i) => { slots[p.id] = i; });
  return { cfg: { arenaId: st.arena, players: addBots(humans, st.bots, st.level, seed), seed, rules: { rounds: st.rounds, gentle: st.gentle } }, slots, humans: st.humans };
}
