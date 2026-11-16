// Orașe pe Șine: pornire, încărcarea modelelor (cu bară de progres), meniu, buclă la 60 Hz.
import '../../../shared/ui/theme.css';
import './ui/style.css';
import './ui/menus.css';
import './ui/expert.css';
import { startLoop } from '../../../shared/engine/loop.js';
import { perf } from '../../../shared/engine/perf.js';
import { needLandscape } from '../../../shared/engine/screen.js';
import { gameSave } from '../../../shared/engine/profiles.js';
import { startPlaySession, showTimeOverlay } from '../../../shared/engine/session.js';
import { loadModels, missing } from './render/models.js';
import { TRAIN_MODELS } from './render/trains.js';
import { HOUSES, TREES, ROCK } from './render/props.js';
import { EXTRA_MODELS } from './render/industries.js';
import { createStage } from './render/stage.js';
import { createGame } from './game.js';
import { createMenu } from './ui/menu.js';
import { loadMedals } from './sim/index.js';
import { isOnline } from '../../../shared/net/api.js';
import * as api from '../../../shared/net/api.js';
import { createSaves } from './net/saves.js';
import { createLobby } from './ui/lobby.js';

const $ = (id) => document.getElementById(id);
const save = gameSave('trenuri');
needLandscape($('rot'));

const MODEL_LIST = [...TRAIN_MODELS, ...HOUSES, ...TREES, ROCK, ...EXTRA_MODELS];
let game, loop, menu = null, lobby = null, online = false;

function showMenu() {
  if (menu) menu.close();
  game.save();
  const saved = save.get('auto', null);
  game.newWorld('S', true);
  const go = (fn) => () => { closeMenu(); fn(); };
  menu = createMenu($('ui'), {
    hasSave: !!(saved && saved.state && saved.state.version >= 2), medals: loadMedals(save), firstTime: !game.prefs.get('tutorialDone'),
    online, onNet: go(() => lobby.open()),
    onContinue: go(() => game.load(saved)),
    onNew: (size, year, opt) => { closeMenu(); game.newWorld(size, false, year, opt); },
    onScenario: (id) => go(() => game.startScenario(id))(),
    onFree: go(() => game.startFree()),
    onTutorial: go(() => game.startTutorial()),
    onHome: () => { location.href = '../../'; },
  });
}
function closeMenu() { if (menu) { menu.close(); menu = null; } }

function fpsMeter() {
  if (!/[?&]fps/.test(location.search)) return () => {};
  const el = document.createElement('div'); el.className = 'fps'; document.body.append(el);
  let n = 0, t0 = performance.now();
  return () => { n++; const t = performance.now(); if (t - t0 > 1000) { el.textContent = `${Math.round(n * 1000 / (t - t0))} fps · q${perf.quality()}`; n = 0; t0 = t; } };
}

async function boot() {
  const bar = $('bootbar'), pct = $('bootpct');
  const stage = createStage($('c'));
  await loadModels(MODEL_LIST, (p) => { bar.style.width = Math.round(p * 100) + '%'; pct.textContent = Math.round(p * 100) + '%'; });
  if (missing.length) $('bootnote').textContent = `Unele modele lipsesc (${missing.length}); folosesc forme simple.`;
  online = await isOnline();
  const saves = createSaves({ store: save, api: online ? api : null });
  game = createGame({ stage, canvas: $('c'), uiRoot: $('ui'), save, saves, savesWhere: online ? 'NAS' : 'local', onHome: () => { location.href = '../../'; }, onMenu: showMenu, onNetEnd: () => lobby.leave() });
  lobby = createLobby($('ui'), {
    begin: (cfg, o) => { closeMenu(); game.startNet({ cfg, ...o }); },
    setRoom: (players) => game.setRoom(players),
    ended: () => showMenu(),
    blocked: (reason) => { game.save(); showTimeOverlay(reason); },
  });
  if (game.prefs.get('tutorialDone')) showMenu(); else game.startTutorial(); // primul joc: tutorialul pornește singur
  const tick = fpsMeter();
  loop = startLoop({ update: (dt) => game.update(dt), render: () => { game.render(1 / 60); tick(); } });
  $('boot').remove();
  document.addEventListener('visibilitychange', () => { if (document.hidden) game.save(); });
  addEventListener('pagehide', () => game.save());
  startPlaySession('trenuri', { onBlocked: (reason) => { game.save(); loop.stop(); showTimeOverlay(reason); } });
  window.__trenuri = { game, perf, stage };
}
boot();
