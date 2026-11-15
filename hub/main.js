// Hub: local → profil → grila de jocuri. NAS → utilizatorul serverului → grila (+ timp rămas, panou părinte).
import './hub.css';
import { h as el } from '../shared/ui/dom.js';
import { currentProfile, setCurrentProfile, listProfiles, ready, serverInfo, refreshTime } from '../shared/engine/profiles.js';
import { logout } from '../shared/net/api.js';
import { profileScreen } from './profileScreen.js';
import { gamesScreen } from './gamesScreen.js';
import { adminScreen } from './admin.js';
import { createTimeBar } from './timeBar.js';
import { createBadge, createIosTip } from './status.js';

const app = document.getElementById('app');
const badge = createBadge();
const tip = createIosTip();
let refresh = null;

function go(screen) {
  app.replaceChildren(...[el('div', { class: 'stars' }), badge, tip, screen].filter(Boolean));
  window.scrollTo(0, 0);
}

// ---- modul local ----
function showGames() {
  const p = currentProfile();
  if (!p) return showProfiles();
  go(gamesScreen({ profile: p, onSwitch: showProfiles }));
}
function showProfiles() {
  go(profileScreen({
    onPick: (id) => { setCurrentProfile(id); showGames(); },
    onCancel: currentProfile() && listProfiles().length ? showGames : null,
  }));
}

// ---- modul NAS ----
function showNas() {
  const { user, time } = serverInfo();
  const bar = createTimeBar(time);
  const actions = [
    user.role === 'admin' ? el('button', { class: 'btn small', onclick: showAdmin }, '👪 Panou părinte') : null,
    el('button', { class: 'btn small alt', onclick: logout }, '🚪 Ieșire'),
  ];
  go(gamesScreen({ profile: currentProfile(), actions, extra: bar, blocked: time && time.allowedNow === false }));
  clearInterval(refresh);
  refresh = setInterval(async () => { try { await refreshTime(); if (document.querySelector('.timebar')) showNas(); } catch (e) { /* ignorat */ } }, 60000);
}
function showAdmin() {
  clearInterval(refresh);
  go(adminScreen({ onBack: async () => { try { await refreshTime(); } catch (e) { /* ignorat */ } showNas(); } }));
}

ready().then(() => {
  if (serverInfo()) showNas();
  else if (currentProfile()) showGames();
  else showProfiles();
});
