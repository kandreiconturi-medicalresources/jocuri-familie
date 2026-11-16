// Echipe (etapa 7.5): în lumea cu insule, cfg `teams: [[idJucător…]…]` dă câte o companie (și o insulă) fiecărei echipe.
// Toți membrii unei echipe comandă aceeași companie: `s.net.pl[jucător] = companie` (ca în competitiv), `s.net.team = 1`,
// iar `s.net.nm[jucător]` ține numele pentru clasament. Nimic de aici nu intră în hash (e doar maparea rețelei).
import { addNews } from './news.js';

export const TEAMS = [
  { name: 'Echipa Vulpilor', icon: '🦊' },
  { name: 'Echipa Delfinilor', icon: '🐬' },
  { name: 'Echipa Bufnițelor', icon: '🦉' },
  { name: 'Echipa Urșilor', icon: '🐻' },
];

const fail = (err) => ({ ok: false, err });

/** Echipele curate: doar jucători din `pl`, fiecare o singură dată; cei nepuși primesc echipa lor; fără echipe goale (max 4). */
export function normTeams(teams, pl) {
  const ids = pl.map((p) => p.id), used = new Set(), out = [];
  for (const t of Array.isArray(teams) ? teams : []) {
    if (!Array.isArray(t)) continue;
    const m = [];
    for (const id of t) if (ids.includes(id) && !used.has(id)) { used.add(id); m.push(id); }
    if (m.length) out.push(m);
  }
  for (const id of ids) if (!used.has(id)) out.push([id]);
  return out.slice(0, TEAMS.length);
}

/** Numele membrilor companiei `id` (în ordinea intrării), [] fără echipe. */
export function teamMembers(s, id) {
  const n = s.net;
  if (!n || !n.team) return [];
  return Object.keys(n.pl).filter((k) => n.pl[k] === id).map((k) => (n.nm && n.nm[k]) || 'Jucător');
}

/** Jucătorii (id-uri) din compania `id`, pentru UI-ul gazdei. */
export const teamPlayers = (s, id) => (s.net && s.net.team ? Object.keys(s.net.pl).filter((k) => s.net.pl[k] === id) : []);

const humanCo = (s, id) => Number.isInteger(id) && id >= 0 && id < s.companies.length && !s.companies[id].ai && !s.companies[id].dead;

/** Doar gazda: jucătorul `pl` (nou sau deja în joc) intră în echipa companiei `co`. */
function setTeam(s, cmd) {
  const n = s.net;
  if (!n || !n.team || cmd.pl === undefined || cmd.pl === null || !humanCo(s, cmd.co)) return fail('drum');
  if (n.pl[cmd.pl] === cmd.co) return fail('exista');
  if (!n.nm) n.nm = {};
  if (cmd.name) n.nm[cmd.pl] = String(cmd.name).slice(0, 14);
  n.pl[cmd.pl] = cmd.co;
  addNews(s, '👪', `${n.nm[cmd.pl] || 'Un jucător'} joacă acum în ${s.companies[cmd.co].name}.`);
  return { ok: true, cost: 0 };
}

export const TEAM_COMMANDS = { setTeam };
