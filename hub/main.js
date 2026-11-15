// Hub: profil → grila de jocuri.
import './hub.css';
import { h as el } from '../shared/ui/dom.js';
import { currentProfile, setCurrentProfile, listProfiles } from '../shared/engine/profiles.js';
import { profileScreen } from './profileScreen.js';
import { gamesScreen } from './gamesScreen.js';
import { createBadge, createIosTip } from './status.js';

const app = document.getElementById('app');
const badge = createBadge();
const tip = createIosTip();

function go(screen) {
  app.replaceChildren(...[el('div', { class: 'stars' }), badge, tip, screen].filter(Boolean));
  window.scrollTo(0, 0);
}
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
currentProfile() ? showGames() : showProfiles();
