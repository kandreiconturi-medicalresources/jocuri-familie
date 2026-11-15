// Aventura lui Bobo și Mimi: pornire, stări (titlu, hartă, joc, pauză, final, setări), buclă, touchpad.
import '../../../shared/ui/theme.css';
import './style.css';
import { startLoop } from '../../../shared/engine/loop.js';
import { createInput } from '../../../shared/engine/input.js';
import { defineSfx, BOBO_SFX, isMuted, setMuted, unlockAudio } from '../../../shared/engine/audio.js';
import { fitCanvas, needLandscape, toggleFullscreen, isTouch } from '../../../shared/engine/screen.js';
import { ready } from '../../../shared/engine/profiles.js';
import { startPlaySession, showTimeOverlay } from '../../../shared/engine/session.js';
import { createParticles } from '../../../shared/engine/particles.js';
import { createTouchpad } from '../../../shared/ui/touchpad.js';
import { loadAtlas, setAtlasScale } from './atlas.js';
import { createGame } from './game.js';
import { renderScene } from './render/scene.js';
import { createBackdrop } from './render/backdrop.js';
import { snapshot } from './render/interp.js';
import { saveResult } from './progress.js';
import { createTitle } from './screens/title.js';
import { createMap } from './screens/map.js';
import { createDone } from './screens/done.js';
import { createPause } from './screens/pause.js';
import { createSettings } from './screens/settings.js';
import { createLobby } from './net/lobby.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const ctx = canvas.getContext('2d', { alpha: false });
const view = fitCanvas(canvas, { height: 544, minWidth: 800, maxWidth: 1280, onResize: (v) => setAtlasScale(v.scale) });
needLandscape($('rot'));

const app = { state: 'boot', prev: 'title', n: 1, net: null, view, screens: {}, finishT: 0, tick: 0, result: null, info: null };
let input, game, loop, touchpad = null, prevStart = false;
const backdrop = createBackdrop();
app.setBackdrop = (k) => backdrop.set(k);

const SCENE_STATES = ['play', 'pause', 'done'];

function show(name) {
  for (const k in app.screens) app.screens[k].show(k === name);
  $('bPause').classList.toggle('hidden', name !== 'play');
  if (touchpad) touchpad.show(name === 'play');
}
app.go = (name) => {
  app.state = name;
  if (name === 'title') { app.screens.title.refresh(); backdrop.set('meadow'); }
  show(name);
};
app.openMap = (focus) => { app.screens.map.refresh(focus); app.go('map'); };
app.openSettings = (from) => { app.prev = from; app.screens.settings.refresh(); app.state = 'settings'; show('settings'); };
app.closeSettings = () => { if (app.prev === 'map') app.openMap(); else app.go(app.prev); };
app.syncMute = () => { $('bMute').textContent = isMuted() ? '🔇' : '🔊'; };

function buildTouchpad(n) {
  if (touchpad) touchpad.destroy();
  const L = (player, btn, side, label) => ({ player, btn, side, label });
  // pe PC nu există butoane tactile: apare doar ★ (mouse), și doar cât jucătorul are baghetă
  const layout = !isTouch
    ? (n === 1 ? [L(0, 'b', 'right', '★')] : [L(0, 'b', 'left', '★'), L(1, 'b', 'right', '★')])
    : n === 1
    ? [L(0, 'left', 'left', '◀'), L(0, 'right', 'left', '▶'), L(0, 'b', 'right', '★'), L(0, 'a', 'right', '⬆')]
    : [L(0, 'left', 'left', '◀'), L(0, 'right', 'left', '▶'), L(0, 'b', 'left', '★'), L(0, 'a', 'left', '⬆'),
      L(1, 'left', 'right', '◀'), L(1, 'right', 'right', '▶'), L(1, 'b', 'right', '★'), L(1, 'a', 'right', '⬆')];
  touchpad = createTouchpad(input, layout, { force: !isTouch });
  const root = document.querySelector('.tp');
  if (root && n > 1) root.classList.add('two');
  touchpad.show(false);
  document.querySelectorAll('.tp-btn.b').forEach((el) => { el.style.visibility = 'hidden'; });
}

app.startLevel = (i) => {
  app.net = null;
  input.clear(); unlockAudio();
  buildTouchpad(app.n);
  game.start(i, app.n);
  app.finishT = 0; app.result = null;
  app.go('play');
};
// joc în rețea: un singur jucător pe acest dispozitiv (controale ca la 1 jucător), ceilalți vin din cameră
app.startNetLevel = (i, count, net) => {
  app.net = net;
  input.clear(); unlockAudio();
  buildTouchpad(1);
  game.start(i, count, net);
  app.finishT = 0; app.result = null;
  app.go('play');
};
app.openLobby = () => app.screens.lobby.open();
app.netBack = () => { app.net = null; app.screens.lobby.back(); };
app.netLeave = () => { app.net = null; app.screens.lobby.leave(); };
app.block = (reason) => { app.pause(); if (loop) loop.stop(); input.clear(); showTimeOverlay(reason); };
app.pause = () => { if (app.state !== 'play') return; input.clear(); app.go('pause'); };
app.resume = () => { if (app.state === 'pause') { input.clear(); app.go('play'); } };
app.quit = () => { if (touchpad) { touchpad.destroy(); touchpad = null; } };

function onFinish(res) {
  app.result = res;
  app.info = saveResult(res.index, res.stars, res.fruits);
  app.finishT = 100;
}

function update() {
  app.tick++;
  const st = input.any('start');
  if (st && !prevStart) { if (app.state === 'play') app.pause(); else if (app.state === 'pause') app.resume(); }
  prevStart = st;
  if (app.state !== 'play' && !(app.net && app.state === 'pause')) return; // în rețea, jocul merge și în pauză
  snapshot(game);
  game.update();
  if (touchpad && (game.tick & 3) === 0) {
    document.querySelectorAll('.tp-btn.b').forEach((el) => {
      const i = el.classList.contains('p1') ? 1 : 0;
      const p = game.local || game.players[i];
      el.style.visibility = p && p.wand ? 'visible' : 'hidden';
    });
  }
  if (app.finishT > 0 && --app.finishT === 0) {
    app.screens.done.fill(app.result, app.info);
    app.go('done');
  }
}

function render(alpha = 1) {
  // simularea merge doar în „play” (și în pauză, în rețea); altfel desenăm starea curentă, fără interpolare
  const live = app.state === 'play' || (app.net && app.state === 'pause');
  if (SCENE_STATES.includes(app.state) || (app.state === 'settings' && app.prev === 'pause')) renderScene(ctx, game, live ? alpha : 1);
  else backdrop.draw(ctx, view, app.tick);
}

function boot() {
  defineSfx(BOBO_SFX);
  input = createInput({ players: 2 });
  const particles = createParticles(300);
  game = createGame({ input, view, particles, onFinish });
  app.game = game; app.input = input;
  if (import.meta.env && import.meta.env.DEV) window.__bobo = app; // doar în dev, pentru verificări în browser
  app.screens = { title: createTitle(app), map: createMap(app), done: createDone(app), pause: createPause(app), settings: createSettings(app), lobby: createLobby(app) };
  $('bHome').onclick = () => { location.href = '../../'; };
  $('bPause').onclick = () => app.pause();
  $('bMute').onclick = () => { unlockAudio(); setMuted(!isMuted()); app.syncMute(); };
  const fsOk = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
  if (fsOk) { $('bFs').classList.remove('hidden'); $('bFs').onclick = () => toggleFullscreen(); }
  app.syncMute();
  // pauză automată când pagina se ascunde (bucla se oprește singură prin visibilitychange)
  document.addEventListener('visibilitychange', () => { if (document.hidden) app.pause(); });
  addEventListener('pagehide', () => app.pause());
  addEventListener('pointerdown', unlockAudio, { once: true });
  // modul NAS: limita de timp; la blocare jocul se oprește și apare overlay-ul
  startPlaySession('bobo', {
    onBlocked: (reason) => app.block(reason),
  });
  $('boot').remove();
  app.go('title');
  loop = startLoop({ update, render, hz: 60 });
}

Promise.all([loadAtlas(), ready(['bobo'])]).then(boot).catch((e) => { $('boot').textContent = 'Nu s-a putut încărca jocul: ' + e.message; });
