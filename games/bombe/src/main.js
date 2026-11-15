// Bum-Bum Arena: pornire, stări (meniu, alegeri, rețea, joc, pauză, final), buclă la 30 Hz, controale.
import '../../../shared/ui/theme.css';
import './style.css';
import { startLoop } from '../../../shared/engine/loop.js';
import { isMuted, setMuted, unlockAudio } from '../../../shared/engine/audio.js';
import { fitCanvas, needLandscape, toggleFullscreen } from '../../../shared/engine/screen.js';
import { ready } from '../../../shared/engine/profiles.js';
import { startPlaySession, showTimeOverlay } from '../../../shared/engine/session.js';
import { createParticles } from '../../../shared/engine/particles.js';
import { loadAtlas, setAtlasScale } from '../../bobo/src/atlas.js';
import { createMatch, step } from './logic/match.js';
import { addBots } from './setup.js';
import { createPlay } from './play.js';
import { createScene } from './render/scene.js';
import { makeInput, buildTouchpad } from './controls.js';
import { initSfx } from './sfx.js';
import { createMenu } from './screens/menu.js';
import { createPause, createEnd } from './screens/end.js';
import { createLobby } from './net/lobby.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const ctx = canvas.getContext('2d', { alpha: false });
const view = fitCanvas(canvas, { height: 544, minWidth: 800, maxWidth: 1280, onResize: (v) => setAtlasScale(v.scale) });
needLandscape($('rot'));

const app = { state: 'boot', screens: {}, net: null };
let input, touchpad = null, play = null, scene, demo = null, loop, prevStart = false, endT = 0;

function show(name) {
  for (const k in app.screens) app.screens[k].show(k === name);
  $('bPause').classList.toggle('hidden', !(name === 'play' || (name === 'pause')));
  if (touchpad) touchpad.show(name === 'play');
}
app.go = (name) => {
  app.state = name;
  if (name === 'setup') app.screens.setup.paint();
  if (name === 'pause') app.screens.pause.fill();
  if (name === 'title' || name === 'setup' || name === 'lobby') newDemo();
  show(name);
};

function newDemo() {
  const seed = (Math.random() * 1e9) >>> 0;
  const players = addBots([], 4, 'hard', seed).map((p, i) => ({ ...p, id: 'd' + i }));
  demo = createMatch({ arenaId: seed % 8, players, seed, rules: { gentle: true, rounds: 1 } });
  scene.reset();
}

function begin(cfg, slots, humans, net) {
  input.clear(); unlockAudio();
  if (touchpad) touchpad.destroy();
  touchpad = buildTouchpad(input, Math.min(2, humans));
  scene.reset(); demo = null; endT = 0;
  play = createPlay({ input, cfg, slots, net, onEvents: (ev) => scene.fx.handle(ev, play.state) });
  app.net = net ? play : null;
  app.go('play');
}
app.startLocal = ({ cfg, slots, humans }) => begin(cfg, slots, humans, null);
app.startNet = (cfg, net) => begin(cfg, { [net.you]: 0 }, 1, net);
app.endNet = () => { play = null; app.net = null; if (touchpad) { touchpad.destroy(); touchpad = null; } };
app.openLobby = () => app.screens.lobby.open();
app.pause = () => { if (app.state === 'play') { input.clear(); app.go('pause'); } };
app.resume = () => { if (app.state === 'pause') { input.clear(); app.go('play'); } };
app.rematch = () => { if (play) { play.rematch(); endT = 0; app.go('play'); } };
app.quit = () => {
  const over = play && play.state.phase === 'match_end';
  if (app.net) {
    if (over) { if (play.isHost) app.screens.lobby.sendBack(); app.endNet(); app.screens.lobby.back(); } else { app.endNet(); app.screens.lobby.leave(); }
  } else { app.endNet(); app.go('title'); }
};
app.block = (reason) => { app.pause(); if (loop) loop.stop(); input.clear(); showTimeOverlay(reason); };

function update() {
  const st = input.any('start');
  if (st && !prevStart) { if (app.state === 'play') app.pause(); else if (app.state === 'pause' && !app.net) app.resume(); }
  prevStart = st;
  const live = play && (app.state === 'play' || app.state === 'end' || (app.state === 'pause' && app.net));
  if (live) {
    play.update(); scene.fx.update();
    const s = play.state;
    if (s.phase === 'match_end') {
      if (++endT === 70 && app.state === 'play') { app.screens.end.fill(play); app.go('end'); }
    } else { endT = 0; if (app.state === 'end') app.go('play'); }
  } else if (demo) {
    step(demo);
    if (demo.phase !== 'play') newDemo();
  }
}

function render() {
  if (play && app.state !== 'title') scene.draw(play.state, play.ready);
  else if (demo) scene.draw(demo, 0, false);
}

function boot() {
  initSfx();
  input = makeInput();
  scene = createScene({ ctx, view, particles: createParticles(260) });
  app.screens = { ...createMenu(app), lobby: createLobby(app), pause: createPause(app), end: createEnd(app) };
  $('bHome').onclick = () => { location.href = '../../'; };
  $('bPause').onclick = () => { if (app.state === 'play') app.pause(); else if (app.state === 'pause') app.resume(); };
  $('bMute').onclick = () => { unlockAudio(); setMuted(!isMuted()); $('bMute').textContent = isMuted() ? '🔇' : '🔊'; };
  $('bMute').textContent = isMuted() ? '🔇' : '🔊';
  const fsOk = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
  if (fsOk) { $('bFs').classList.remove('hidden'); $('bFs').onclick = () => toggleFullscreen(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) app.pause(); });
  addEventListener('pagehide', () => app.pause());
  addEventListener('pointerdown', unlockAudio, { once: true });
  startPlaySession('bombe', { onBlocked: (reason) => app.block(reason) });
  $('boot').remove();
  app.go('title');
  loop = startLoop({ update, render, hz: 30 });
}

Promise.all([loadAtlas(), ready(['bombe'])]).then(boot).catch((e) => { $('boot').textContent = 'Nu s-a putut încărca jocul: ' + e.message; });
