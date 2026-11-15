// Turbo Curse: pornire, stări (titlu, alegeri, rețea, cursă, pauză, podium), buclă la 60 Hz.
import '../../../shared/ui/theme.css';
import './style.css';
import { startLoop } from '../../../shared/engine/loop.js';
import { perf } from '../../../shared/engine/perf.js';
import { isMuted, setMuted, sfx, unlockAudio } from '../../../shared/engine/audio.js';
import { needLandscape, toggleFullscreen } from '../../../shared/engine/screen.js';
import { currentProfile, gameSave, ready } from '../../../shared/engine/profiles.js';
import { startPlaySession, showTimeOverlay } from '../../../shared/engine/session.js';
import { MODELS } from './tracks/pieces.js';
import { TRACKS, CAR_COLORS } from './tracks/tracks.js';
import { createTrack } from './tracks/track.js';
import { createRace, stepRace, countNumber } from './sim/race.js';
import { loadModels } from './render/models.js';
import { DECOR_MODELS } from './render/decor.js';
import { createStage } from './render/stage.js';
import { createHud } from './screens/hud.js';
import { createMenu, DEFAULTS } from './screens/menu.js';
import { createPodium } from './screens/podium.js';
import { createLobby } from './net/lobby.js';
import { createSync } from './net/sync.js';
import { createControls, buildTouchpad } from './controls.js';
import { initSfx, createEngine } from './sound.js';
import { createFps } from './fps.js';

const $ = (id) => document.getElementById(id);
const BOT_NAMES = ['Fulger', 'Turbo', 'Roby', 'Sprint'];
const save = gameSave('curse');
const app = { state: 'boot', screens: {}, net: null, save, mode: 'solo', cfg: { ...DEFAULTS, ...(save.get('setup', null) || {}) } };
needLandscape($('rot'));

let stage, controls, touchpad = null, loop, fps;
let race = null, sync = null, huds = [], engines = [], humans = [], last = null, trackCache = {}, curTrack = -1;
let lastCount = 99, endT = 0, resultIds = null, resetFlag = [false, false], autoThrottle = false;

function show(name) {
  for (const k in app.screens) app.screens[k].show(k === name);
  const playing = name === 'play' || name === 'pause';
  $('bPause').classList.toggle('hidden', !playing);
  $('hudroot').classList.toggle('hidden', !playing);
  $('count').classList.toggle('hidden', name !== 'play');
  if (touchpad) touchpad.show(name === 'play');
}
app.go = (name) => {
  app.state = name;
  if (name === 'setup') app.screens.setup.paint();
  if (name === 'title' || name === 'setup' || name === 'lobby') idleView();
  show(name);
};
app.openSetup = (mode) => { app.mode = mode; app.go('setup'); };
app.openLobby = () => app.screens.lobby.open();
app.pause = () => { if (app.state === 'play') { controls.clear(); app.go('pause'); } };
app.resume = () => { if (app.state === 'pause') { controls.clear(); last = null; app.go('play'); } };
app.block = (reason) => { app.pause(); if (loop) loop.stop(); showTimeOverlay(reason); };

/** Fundal pentru meniuri: o pistă cu mașinile boților care circulă. */
function idleView() {
  if (race && race.idle) return;
  const idx = Math.floor(Math.random() * TRACKS.length);
  launch({ track: idx, laps: 99, idle: true, entries: [0, 1, 2, 3].map((i) => ({ id: 'd' + i, name: BOT_NAMES[i], color: CAR_COLORS[i].id, bot: true, level: 'hard' })), humans: [], focus: 'd0' });
}

function trackOf(i) { return trackCache[i] || (trackCache[i] = createTrack(TRACKS[i])); }

function launch({ track, laps, entries, seed = (Math.random() * 1e9) >>> 0, humans: hs, net = null, idle = false, focus = null }) {
  cleanup();
  const tr = trackOf(track);
  race = createRace({ track: tr, laps, entries, seed });
  race.idle = idle; race.trackIdx = track; race.netHost = !!(net && net.host);
  humans = hs;
  if (curTrack !== track) { stage.loadTrack(tr); curTrack = track; }
  stage.setCars(race.cars);
  const ids = hs.length ? hs.map((h) => h.id) : [focus];
  stage.setViews(ids.map((id, i) => (ids.length > 1 ? { id, x: i * 0.5, y: 0, w: 0.5, h: 1 } : { id, x: 0, y: 0, w: 1, h: 1 })));
  stage.snapCams(race);
  if (!idle) {
    unlockAudio();
    huds = ids.map((id, i) => ({ id, hud: createHud($('hudroot'), tr, ids.length > 1 ? (i ? 'right' : 'left') : 'full') }));
    huds.forEach((h, i) => { h.hud.reset.onclick = () => { resetFlag[i] = true; }; });
    engines = ids.map(() => createEngine());
    sync = net ? createSync({ rooms: net.rooms, you: net.you, host: net.host, race }) : null;
    app.net = sync;
    if (sync) sync.onResult((order) => { resultIds = order; });
  }
  lastCount = 99; endT = 0; resultIds = null; last = null; controls.clear();
  if (!idle) app.go('play');
}

function cleanup() {
  huds.forEach((h) => h.hud.destroy()); huds = [];
  engines.forEach((e) => e.stop()); engines = [];
  sync = null;
}

app.startSolo = () => {
  const c = app.cfg;
  save.set('setup', c);
  const duo = app.mode === 'duo';
  const prof = currentProfile();
  const entries = [{ id: 'p1', name: prof ? prof.name : 'Tu', color: c.color }];
  if (duo) entries.push({ id: 'p2', name: 'Jucător 2', color: c.color2 });
  const used = new Set(entries.map((e) => e.color));
  const free = CAR_COLORS.filter((k) => !used.has(k.id));
  const nb = Math.min(c.bots, 4 - entries.length);
  for (let i = 0; i < nb; i++) entries.push({ id: 'b' + i, name: BOT_NAMES[i], color: free[i % free.length].id, bot: true, level: c.level });
  if (touchpad) touchpad.destroy();
  touchpad = null;
  if (c.tilt) controls.enableTilt(); else controls.disableTilt();
  autoThrottle = !!c.auto;
  if (!duo && 'ontouchstart' in window) touchpad = buildTouchpad(controls);
  app.last = { track: c.track, laps: c.laps, entries, humans: entries.filter((e) => !e.bot).map((e) => ({ id: e.id })) };
  launch(app.last);
};
app.startNet = (cfg, net) => {
  const entries = cfg.entries.map((e) => ({ ...e, remote: e.bot ? !net.host : e.id !== net.you }));
  if (touchpad) touchpad.destroy();
  touchpad = 'ontouchstart' in window ? buildTouchpad(controls) : null;
  autoThrottle = !!app.cfg.auto;
  launch({ track: cfg.track, laps: cfg.laps, entries, seed: cfg.seed, humans: [{ id: net.you }], net });
};
app.endNet = () => { cleanup(); app.net = null; if (touchpad) { touchpad.destroy(); touchpad = null; } idleReset(); };
const idleReset = () => { race = null; curTrack = -1; };
app.restart = () => { if (app.net) app.quit(); else if (app.last) launch(app.last); };
app.quit = () => {
  const over = race && race.done;
  if (app.net) {
    const lobby = app.screens.lobby;
    if (over) { if (app.net.host) lobby.sendBack(); app.endNet(); lobby.back(); } else { app.endNet(); lobby.leave(); }
  } else { cleanup(); if (touchpad) { touchpad.destroy(); touchpad = null; } idleReset(); app.go('title'); }
};

function finishRace() {
  const list = race.order.map((id) => race.byId[id]);
  if (resultIds) list.sort((a, b) => resultIds.indexOf(a.id) - resultIds.indexOf(b.id));
  const mine = humans.map((h) => h.id), info = {};
  const me = race.byId[mine[0]];
  if (!app.net && me && me.finished) {
    const tid = TRACKS[race.trackIdx].id, ms = Math.round(me.finishT * 1000), best = save.get('best', {}) || {};
    if (!best[tid] || ms < best[tid]) { best[tid] = ms; save.set('best', best); info.record = ms; }
    const place = list.indexOf(me) + 1, unl = save.get('unlocked', 1);
    if (place <= 3) {
      const wins = save.get('wins', {}) || {}; wins[tid] = (wins[tid] || 0) + (place === 1 ? 1 : 0); save.set('wins', wins);
      if (race.trackIdx === unl - 1 && unl < TRACKS.length) { save.set('unlocked', unl + 1); info.unlocked = true; }
    }
  }
  app.screens.end.fill(list, mine, info);
  sfx('finish'); app.go('end');
}

function handleEvents(ev) {
  for (const e of ev) {
    const mine = humans.some((h) => h.id === e.id);
    if (e.t === 'start') { sfx('go'); showCount('START!'); }
    else if (e.t === 'nitro') { if (mine) sfx('nitro'); }
    else if (e.t === 'bump') sfx('bump');
    else if (e.t === 'lap') { if (mine) { sfx('lap'); const i = humans.findIndex((h) => h.id === e.id); huds[i] && huds[i].hud.flash(e.lap === race.laps - 1 ? 'Ultima tură!' : 'Tura ' + (e.lap + 1) + '!', 1200); } }
    else if (e.t === 'finish') { if (mine) { const i = humans.findIndex((h) => h.id === e.id); huds[i] && huds[i].hud.flash('🏁 Locul ' + e.place + '!', 2500, 'gold'); sfx('finish'); } }
    else if (e.t === 'done' && sync && sync.sendResult) sync.sendResult();
  }
}

function showCount(text) {
  const el = $('count');
  el.textContent = text; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  if (text === 'START!') setTimeout(() => { if ($('count').textContent === 'START!') $('count').textContent = ''; }, 900);
}

const STEP = 1 / 60;
function update(dt) {
  if (!race) return;
  const run = app.state === 'play' || app.state === 'end' || app.state === 'title' || app.state === 'setup' || app.state === 'lobby' || (app.state === 'pause' && app.net);
  if (!run) return;
  race.cars.forEach((c) => { c.px = c.x; c.pz = c.z; c.py = c.y; c.pa = c.angle; });
  const ctls = {};
  humans.forEach((h, i) => {
    const c = controls.read(i, autoThrottle && i === 0);
    c.reset = c.reset || resetFlag[i]; resetFlag[i] = false;
    ctls[h.id] = c;
  });
  if (race.idle && race.done) { launch({ track: Math.floor(Math.random() * TRACKS.length), laps: 99, idle: true, entries: race.cars.map((c) => ({ id: c.id, name: c.name, color: c.color, bot: true, level: 'hard' })), humans: [], focus: 'd0' }); return; }
  stepRace(race, ctls, dt);
  if (sync) sync.tick(dt);
  if (race.idle) return;
  handleEvents(race.events);
  if (race.phase === 'count') {
    const n = countNumber(race);
    if (n !== lastCount && n > 0) { lastCount = n; sfx('beep'); showCount(String(n)); }
  }
  if (race.done && app.state === 'play') {
    endT += dt;
    if (endT > (app.net && !race.netHost && !resultIds ? 4 : 2.4)) finishRace();
  }
}

function render(alpha) {
  const now = performance.now(), dt = last === null ? STEP : Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!race) return;
  stage.render(race, alpha, dt);
  fps.frame(dt, stage);
  if (race.idle) return;
  humans.forEach((h, i) => {
    const car = race.byId[h.id];
    if (!car) return;
    if (huds[i] && app.state !== 'end') huds[i].hud.update(race, car, dt);
    if (engines[i]) engines[i].set(Math.min(1, Math.abs(car.speed) / 36), race.phase !== 'count' && !car.finished, car.boost > 0, car.drift);
  });
}

function boot() {
  initSfx();
  controls = createControls();
  controls.onStart(() => { if (app.state === 'play') app.pause(); else if (app.state === 'pause') app.resume(); });
  stage = createStage($('c'));
  fps = createFps($('fps'));
  app.screens = { ...createMenu(app), lobby: createLobby(app), end: createPodium(app) };
  $('bHome').onclick = () => { location.href = '../../'; };
  $('bPause').onclick = () => { if (app.state === 'play') app.pause(); else if (app.state === 'pause') app.resume(); };
  const mute = () => { $('bMute').textContent = isMuted() ? '🔇' : '🔊'; };
  $('bMute').onclick = () => { unlockAudio(); setMuted(!isMuted()); mute(); };
  mute();
  if (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen) { $('bFs').classList.remove('hidden'); $('bFs').onclick = () => toggleFullscreen(); }
  addEventListener('keydown', (e) => { if (e.code === 'F3') { e.preventDefault(); fps.toggle(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) app.pause(); });
  addEventListener('pagehide', () => app.pause());
  addEventListener('pointerdown', unlockAudio, { once: true });
  startPlaySession('curse', { onBlocked: (reason) => app.block(reason) });
  $('boot').remove();
  app.go('title');
  loop = startLoop({ update, render, hz: 60 });
  if (import.meta.env && import.meta.env.DEV) window.__curse = { app, get race() { return race; }, stage, perf }; // doar pentru verificări în dev
}

const names = [...new Set([...MODELS, ...DECOR_MODELS, ...CAR_COLORS.map((c) => 'raceCar' + c.id)])];
const bar = $('bootbar');
Promise.all([loadModels(names, (p) => { bar.style.width = Math.round(p * 100) + '%'; $('bootpct').textContent = Math.round(p * 100) + '%'; }), ready(['curse'])])
  .then(boot).catch((e) => { $('boot').textContent = 'Nu s-a putut încărca jocul: ' + e.message; console.error(e); });
