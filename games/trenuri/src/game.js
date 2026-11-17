// Jocul în sine: lumea curentă, pașii simulării (cu viteză), comenzi, unelte, salvare locală, scenarii, tutorial și Ajutorul.
import { createWorld, applyCommand, stepWorld, serialize, deserialize, ERR_TEXT, SIM_HZ, SCENARIOS, scenarioById, createScenarioWorld, createFreeWorld, recordMedal, MEDAL_ICONS, MEDAL_NAMES, viewer } from './sim/index.js';
import { createView } from './render/view.js';
import { createCamera } from './input/camera.js';
import { bindPointer } from './input/pointer.js';
import { createTools } from './input/tools.js';
import { createHud } from './ui/hud.js';
import { createPanels } from './ui/panels.js';
import { sfx, unlock, trainSounds, resetSounds, setAmbient, configureTrainSounds } from './audio.js';
import { createHelper } from './ui/helper.js';
import { findTip } from './ui/tips.js';
import { createTutorial } from './ui/tutorial.js';
import { createGoals, goalChip } from './ui/goalsPanel.js';
import { showEnd } from './ui/endScreen.js';
import { createPrefs, openSettings } from './ui/settings.js';
import { openSaves } from './ui/saves.js';
import { createNetPlay } from './net/play.js';
import { createExpertUi } from './ui/exHub.js';
import { showOver } from './ui/exOver.js';
import { createExtras } from './ui/extras.js';
import { mountExtraTools } from './ui/tools-extra.js';
import { mountMobileControls } from './ui/mobileControls.js';
import { createIslandUi } from './ui/islandUi.js';
import { createContextRun } from './input/contextRun.js';
import { createPendingRun } from './input/pendingRun.js';
import { createFlatIcons } from './ui/flatIcons.js';
import { look, setLook, onLook, MODES, ultraOn } from './render/look.js';
import { simStepCap, renderNeeded } from '../../../shared/engine/pace.js';

const TUTORIAL_SEED = 11;

export function createGame({ stage, canvas, uiRoot, save, saves, savesWhere = 'local', onHome, onMenu, onNetEnd = () => {} }) {
  let lastNews = null, s = null, view = null, speed = 1, simAcc = 0, follow = null, orbit = false, saveT = 0, lastCash = 0, clock = 0;
  let mode = 'normal', shown = new Set(), tipT = 0, lastBest = 0, endShown = true, lastMonth = -1, endUi = null, overUi = null, exMonth = -1;
  const prefs = createPrefs(save);
  const camera = createCamera(stage, { w: 64, h: 64 });
  stage.classic.bind(camera.cam);
  let wokeAt = -1e9, drawnAt = 0, lastCam = [0, 0, 0, 0, 0];
  const myCo = () => s.companies[viewer.co] || s.companies[0];
  const exec = (cmd) => {
    if (np.active) { const r = np.submit(cmd); if (!r.ok) { sfx('nope'); hud.hint(ERR_TEXT[r.err] || 'Nu merge asta.', true); } return r; } // în rețea: răspunsul vine când gazda aplică comanda
    const r = applyCommand(s, { by: 0, ...cmd });
    if (r.ok) { sfx('build'); extras.log(cmd); } else { sfx('nope'); hud.hint(r.text || ERR_TEXT[r.err] || 'Nu merge asta.', true, r.text ? 7000 : 3500); }
    return r;
  };
  const waits = []; // „Fă tot” în rețea: promisiunea se închide când gazda aplică comanda și răspunde
  const execWait = (cmd) => {
    const r = exec(cmd);
    if (!np.active || !r.ok) return r;
    return new Promise((res) => { const w = { res, t: setTimeout(() => { waits.splice(waits.indexOf(w), 1); res({ ok: false, err: 'timp' }); }, 20000) }; waits.push(w); });
  };
  const gotResult = (e, r) => { if (e.cmd.type !== 'executePlan') return; const w = waits.shift(); if (w) { clearTimeout(w.t); w.res(r); } };
  const panels = createPanels(uiRoot, {
    sell: (id) => exec({ type: 'sellTrain', trainId: id }),
    orders: (id, orders) => exec({ type: 'setOrders', trainId: id, orders }),
    cars: (id, kinds) => exec({ type: 'setCars', trainId: id, kinds }),
    upgrade: (id, kind) => exec({ type: 'buildUpgrade', stationId: id, kind }).ok,
    thru: (id, n) => exec({ type: 'setThruTracks', id, n }).ok,
    toThru: (x, y, n) => exec({ type: 'buildThru', x, y, n }).ok,
    pause: (id, on) => exec({ type: on ? 'pauseTrain' : 'resumeTrain', trainId: id }),
    route: (id, route) => exec({ type: 'setRoute', trainId: id, route }),
    depot: (id) => exec({ type: 'sendToDepot', trainId: id }),
    rescue: (id) => exec({ type: 'rescueTrain', trainId: id }),
    show: (x, y) => extras.show(x, y),
    makeRoute: (preset) => extras.buy(preset),
    plan: (preset) => extras.planner(preset),
    buyIndustry: (id) => exec({ type: 'buyIndustry', id }).ok,
    me: () => viewer.co,
  });
  const ex = createExpertUi({ card: panels.card, state: () => s, me: () => viewer.co, exec: (c) => exec(c) });
  const goals = createGoals(panels.card);
  const helper = createHelper(uiRoot, { enabled: () => prefs.get('tips'), onOpen: () => extras.conductor() });
  const scn = () => (s && s.scn ? scenarioById(s.scn.id) : null);
  const setSpeed = (v) => { speed = v; hud.setSpeed(v); };
  const hud = createHud(uiRoot, {
    speed: (v) => (np.active ? np.setSpeed(v) : setSpeed(v)),
    tool: (id) => (pend.cancel(), id === 'train' && s && s.stations.length >= 2 && !tutorial.active ? extras.buy() : tools.setTool(id)),
    news: () => panels.news(s),
    layer: () => {
      const on = !view.links.visible;
      view.links.show(on); hud.setLayer(on);
      if (on) panels.layer(s); else panels.close();
    },
    goals: () => { const sc = scn(); if (sc) goals.progress(s, sc); },
    expert: () => ex.show(), islands: () => isl.open(), bank: () => isl.bank(),
    todo: () => extras.todo(), planner: () => extras.planner(), catalog: () => extras.catalog(), trains: () => extras.trains(),
    view: () => setView(MODES[(MODES.indexOf(look.mode) + 1) % MODES.length], true),
    menu: () => openSettings(panels.card, prefs, { ultra: look.phone ? null : { get: () => look.ultra, set: (v) => { prefs.set('ultra', v); setLook({ ultra: v }); hud.hint(v ? (ultraOn() ? '✨ Grafică Ultra pornită.' : '✨ Ultra pornește când calitatea e maximă și Modul răcoros e oprit.') : 'Grafică Ultra oprită.', false, 3000); } }, cool: { get: () => look.cool, set: (v) => { prefs.set('cool', v); setLook({ cool: v }); hud.hint(v ? '🔋 Mod răcoros: mai puține cadre, fără umbre și iarbă.' : 'Mod răcoros oprit.', false, 3000); } }, tutorial: () => game.startTutorial(), restart: scn() && !np.active ? () => game.startScenario(s.scn.id) : null, saves: openSavesMenu, home: () => { game.save(); onMenu(); } }),
  });
  const tools = createTools({
    state: () => s, view: () => view, hud, panels, exec, errText: (k) => ERR_TEXT[k],
    canAfford: (c) => s.sandbox || myCo().cash >= c,
    follow: (id) => { follow = { id, until: clock + 5 }; },
    assist: { open: () => extras.assistOpen(), tap: (t) => extras.assistTap(t) },
  });
  const extras = createExtras({ stage, uiRoot, panels, camera, helper, exec, execWait, state: () => s, view: () => view, hud, tools, pause: (id, on) => exec({ type: on ? 'pauseTrain' : 'resumeTrain', trainId: id }), depot: (id) => exec({ type: 'sendToDepot', trainId: id }), rescue: (id) => exec({ type: 'rescueTrain', trainId: id }) });
  mountExtraTools(hud, tools);
  const isl = createIslandUi({ card: panels.card, state: () => s, me: () => viewer.co, exec, hud, tools, show: (x, y) => extras.show(x, y) });
  Object.assign(panels, { port: isl.port, ship: isl.ship, shipNear: isl.shipNear }); // Info pe port / vapor
  mountMobileControls(uiRoot, camera);
  const flat = createFlatIcons(uiRoot, { camera: stage.camera, state: () => s, view: () => view, zoom: () => camera.cam.dist });
  const VIEWS = { '3d': ['3D', 'Vedere 3D'], '2d': ['2D', '🗺️ Vedere 2D: de sus, cu iconițe mari'], classic: ['🏛️', '🏛️ Vedere clasică: izometrică, se rotește cu ↶ ↷'] };
  /** 3D · 2D · clasic: pornește vederea, o ține minte și arată butonul potrivit. */
  function setView(m, say) {
    setLook({ mode: m });
    stage.classic.setMode(m === 'classic' ? 'classic' : m === '2d' ? 'flat' : 'off');
    camera.apply(); flat.show(m === '2d');
    prefs.set('view', m); hud.setView(VIEWS[m][0], VIEWS[m][1]);
    if (say) hud.hint(VIEWS[m][1], false, 3500);
  }
  onLook(() => { wokeAt = performance.now(); });
  const pend = createPendingRun({ root: uiRoot, state: () => s, view: () => view, tools, hud, exec });
  const ctxRun = createContextRun({ root: uiRoot, state: () => s, view: () => view, tools, panels, exec, extras, isl, hud, pending: pend });
  /** „Confirmă construcțiile” (☰): unealta normală cere confirmare înainte să construiască. */
  const confirmTap = (t) => {
    if (!prefs.get('confirmBuild') || tutorial.active || mode === 'demo') return false;
    const k = tools.state.tool, kind = k === 'station' ? (tools.state.size === 2 ? 'terminal' : 'station') : ['depot', 'port', 'land'].includes(k) ? k : null;
    return !!kind && pend.start(kind, t);
  };
  const np = createNetPlay({
    root: uiRoot, hint: (t, warn, ms) => hud.hint(t, warn, ms), sfx, onResult: gotResult, setSpeedUi: (v) => setSpeed(v),
    setWorld: (w, o) => game.setWorld(w, o), onStop: () => onNetEnd(),
  });
  function openSavesMenu() {
    if (!saves) return;
    const kindOf = (w) => (w.scn ? 'scenario' : w.sandbox ? 'free' : 'normal');
    openSaves(panels.card, {
      saves, where: savesWhere, canUse: !np.active || np.host, why: 'Doar gazda poate salva sau încărca.', state: () => s, speed: () => speed,
      onLoad: (r) => { if (np.active) np.load(r); else { game.setWorld(r.state, { kind: kindOf(r.state) }); setSpeed(r.speed); } },
    });
  }
  const tutorial = createTutorial({
    root: uiRoot, hud, helper, camera, state: () => s, setTool: (id) => tools.setTool(id),
    onDone: () => { prefs.set('tutorialDone', true); mode = 'normal'; }, onSkip: () => { prefs.set('tutorialDone', true); mode = 'normal'; },
  });
  const pickTile = (p, clamp = false) => { // clamp: în tragere, pointerul în afara hărții dă placa de pe margine
    let x = Math.floor(p.fx), y = Math.floor(p.fz);
    if (clamp) { x = Math.max(0, Math.min(s.w - 1, x)); y = Math.max(0, Math.min(s.h - 1, y)); }
    return x < 0 || y < 0 || x >= s.w || y >= s.h ? null : { x, y, fx: p.fx, fz: p.fz };
  };
  addEventListener('keydown', (e) => { if (e.target.tagName !== 'INPUT' && s && !orbit && (pend.key(e) || tools.key(e))) e.preventDefault(); });
  bindPointer(canvas, camera, pickTile, {
    groundAt: (x, z) => (view ? view.ground.at(x, z) : 0),
    wantsDrag: () => !orbit && !pend.active() && tools.wantsDrag(), tap: (t) => { if (orbit || ctxRun.swallow()) return; if (pend.active()) pend.tap(t); else if (!confirmTap(t)) tools.tap(t); }, context: (t, x, y) => { if (!orbit) ctxRun.open(t, x, y); }, hover: (t) => { if (orbit) return; if (pend.active()) pend.hover(t); else tools.hover(t); },
    dragStart: (t) => tools.dragStart(t), dragMove: (t, m) => tools.dragMove(t, m), dragFlush: () => tools.dragFlush(), dragAbort: () => tools.dragAbort(), touchMode: () => tools.touchMode(), isAnchor: (t) => tools.isAnchor(t), holdRing: (t) => tools.holdRing(t), rightClick: () => !orbit && (pend.cancel() || tools.rightClick()), dragEnd: (t, m) => tools.dragEnd(t, m), dragCancel: () => tools.dragCancel(),
  });
  // tap în afara panoului (pe hartă) închide cardul deschis
  canvas.addEventListener('pointerdown', () => { follow = null; unlock(); if (panels.isOpen()) panels.close(); });
  setAmbient(prefs.get('ambient'));
  configureTrainSounds({ on: prefs.get('trainSnd'), vol: prefs.get('trainVol') });
  const sndEnv = { cam: camera.cam, pos: (id) => (view ? view.trains.posOf(id) : null), get paused() { return speed <= 0; } };
  setView(look.mode, false);

  const BIG = ['🚂', '🏙️', '🏗️', '🌽', '🏆', '🤷', '🔧', '↩️', '🏅', '🚑', '🚨', '🏭', '🧱', '⚓'];
  function toastNews() {
    const n = s.news, k = n.indexOf(lastNews);
    if (k === n.length - 1) return;
    let ding = false;
    for (let i = k + 1; i < n.length; i++) { ding = true; if (BIG.includes(n[i].icon) && !orbit) hud.hint(n[i].icon + ' ' + n[i].text, false, 5000); }
    if (ding && !orbit) sfx('ding');
    lastNews = n[n.length - 1];
  }

  /** Scenariu: medalii noi (salvate), chip de obiectiv lunar, ecranul de final. */
  function watchScenario() {
    const sn = s.scn, sc = scn();
    if (!sn || !sc || orbit) return;
    const key = s.date.y * 12 + s.date.m;
    if (key !== lastMonth) { lastMonth = key; hud.setGoal(goalChip(s, sc)); }
    if (sn.best > lastBest) {
      lastBest = sn.best; recordMedal(save, sn.id, sn.best);
      sfx('fanfare'); hud.hint(`${MEDAL_ICONS[sn.best]} ${MEDAL_NAMES[sn.best]}! Bravo!`, false, 5000);
      helper.say(`Ai câștigat medalia de ${MEDAL_NAMES[sn.best].toLowerCase()}! ${MEDAL_ICONS[sn.best]}`, { force: true });
    }
    if (sn.done && !endShown) {
      endShown = true; setSpeed(0); panels.close(); helper.hide();
      const i = SCENARIOS.indexOf(sc), nx = i >= 0 ? SCENARIOS[i + 1] : null;
      endUi = showEnd(uiRoot, { sc, s, best: sn.best, act: { again: () => game.startScenario(sc.id), menu: onMenu, keep: () => setSpeed(1), next: nx ? () => game.startScenario(nx.id) : null } });
    }
  }

  /** Expert: panoul deschis se reîmprospătează lunar; la faliment apare ecranul blând (singur: jocul se oprește). */
  function watchExpert() {
    if (s.mode !== 'expert') { if (overUi) { overUi.close(); overUi = null; } hud.setExpert(false); return; }
    const key = s.date.y * 12 + s.date.m;
    if (key !== exMonth) { exMonth = key; ex.refresh(); }
    if (s.over && s.over.co === viewer.co && !overUi && !orbit) {
      if (!np.active) setSpeed(0);
      panels.close();
      overUi = showOver(uiRoot, s.companies[viewer.co], { simple: () => { exec({ type: 'continueSimple' }); overUi = null; if (!np.active) setSpeed(1); hud.setExpert(false); }, menu: () => { overUi = null; onMenu(); } });
    } else if (!s.over && overUi) { overUi.close(); overUi = null; }
  }

  function tips(dt) {
    tipT += dt;
    if (tipT < 7 || tutorial.active || orbit || helper.busy() || !prefs.get('tips') || (s.scn && s.scn.done)) return;
    tipT = 0;
    const t = findTip(s, shown, clock);
    if (t && helper.say(t.text)) { shown.add(t.key); tipT = -15; }
  }

  const game = {
    camera, get state() { return s; }, get view() { return view; }, hud, helper, prefs, get mode() { return mode; },
    setWorld(state, { demo = false, kind = 'normal', keep = false, resync = false } = {}) {
      if (!keep) np.stop();
      pend.cancel();
      if (view) view.dispose();
      if (endUi) { endUi.close(); endUi = null; }
      tutorial.stop(true);
      s = state; view = createView(stage, s); mode = demo ? 'demo' : kind;
      camera.setWorld(s.w, s.h);
      if (!resync) camera.focus(s.w / 2, s.h / 2, Math.max(s.w, s.h) * (demo ? 0.7 : 0.5));
      orbit = demo; simAcc = 0; lastCash = myCo().cash; shown = new Set(); tipT = -3; resetSounds();
      lastBest = s.scn ? s.scn.best : 0; endShown = !s.scn || s.scn.done; lastMonth = -1;
      if (overUi) { overUi.close(); overUi = null; }
      exMonth = -1; hud.setExpert(s.mode === 'expert' && !demo); hud.setIslands(!!s.islands && !demo); isl.setWorld(s, demo);
      uiRoot.classList.toggle('demo', demo);
      helper.show(!demo); hud.setGoal(null);
      if (!resync) { panels.close(); tools.setTool('track'); }
      extras.enable(!demo);
      hud.setLayer(false); lastNews = s.news[s.news.length - 1];
      for (const e of hud.el) e.classList.toggle('hidden', demo); // după setTool, ca mesajul lui să nu apară în meniu
      if (!demo) { if (!keep) setSpeed(1); hud.setDate(s.date); hud.setMoney(myCo().cash, s.sandbox); }
      else speed = 1;
      view.trains.onStep();
      if (s.scn) { const sc = scn(); if (sc) hud.setGoal(goalChip(s, sc)); }
    },
    newWorld(size, demo, year = 1950, opt = null) {
      const w = createWorld({ seed: (Math.random() * 4294967295) >>> 0, size, year, mode: opt && opt.expert ? 'expert' : 'simple', ai: opt && opt.ai ? opt.ai : [], map: opt && opt.islands ? 'islands' : 'normal' });
      game.setWorld(w, { demo });
      if (opt && opt.islands) helper.say('Lumea cu insule! Insula ta nu are toate resursele. Atinge 🗺️ sus ca să vezi ce-ți lipsește, apoi fă un port ⚓ (🧰 Mai mult) și un vapor 🚢.', { force: true });
      else if (opt && opt.expert) helper.say('Mod expert! Deschide 💼 sus: împrumuturi, bursă, raport anual. Atinge ⓘ ca să afli ce înseamnă.', { force: true });
    },
    startScenario(id) {
      const sc = scenarioById(id);
      if (!sc) return;
      game.setWorld(createScenarioWorld(sc), { kind: 'scenario' });
      goals.intro(sc);
    },
    startFree() {
      game.setWorld(createFreeWorld((Math.random() * 4294967295) >>> 0, 'M'), { kind: 'free' });
      helper.say('Construiește liber! Banii nu se termină și ai toate locomotivele.', { force: true });
    },
    startTutorial() {
      const w = createWorld({ seed: TUTORIAL_SEED, size: 'S', year: 1900 });
      w.companies[0].cash = 60000;
      game.setWorld(w, { kind: 'tutorial' });
      tutorial.start();
    },
    load(saved) {
      if (!saved.state || saved.state.version < 2) return game.newWorld('S', false, 1840);
      game.setWorld(deserialize(saved.state), { kind: saved.state.scn ? 'scenario' : saved.state.sandbox ? 'free' : 'normal' });
      setSpeed(saved.speed || 1);
    },
    startNet(o) { return np.start(o); },
    setRoom(list) { np.setRoom(list); },
    save() { if (s && !orbit && mode !== 'tutorial' && !np.active) save.set('auto', { v: 1, state: serialize(s), speed }); },
    update(dt) {
      if (!s) return;
      clock += dt;
      saveT += dt;
      if (saveT > 30) { saveT = 0; game.save(); }
      camera.update(dt);
      if (orbit) camera.rotate(dt * 0.06);
      if (!np.update(dt, () => view.trains.onStep())) {
        simAcc += dt * speed * SIM_HZ;
        let n = 0;
        const cap = simStepCap(look);
        while (simAcc >= 1 && n++ < cap) { stepWorld(s); view.trains.onStep(); simAcc -= 1; }
        if (simAcc > 1) simAcc = 0;
      }
      if (!orbit) { extras.update(dt); trainSounds(s, clock, sndEnv); watchScenario(); watchExpert(); tutorial.update(dt); tips(dt); }
    },
    /** Atingere sau schimbare din afară: următoarele cadre se desenează. */
    wake() { wokeAt = performance.now(); },
    /** Cadrul acesta trebuie desenat? Nu dacă jocul e pe pauză și camera stă (cu o bătaie rară). */
    needsRender(now) {
      if (!s) return false;
      const c = camera.cam, moved = c.x !== lastCam[0] || c.z !== lastCam[1] || c.dist !== lastCam[2] || c.yaw !== lastCam[3] || c.pitch !== lastCam[4];
      return renderNeeded({ now, drawnAt, running: orbit || np.active || speed > 0 || !!follow, camMoved: moved, wokeAt });
    },
    render(dt) {
      if (!s) return;
      drawnAt = performance.now(); { const c = camera.cam; lastCam = [c.x, c.z, c.dist, c.yaw, c.pitch]; }
      if (follow) {
        const p = view.trains.positionOf(follow.id);
        if (p && clock < follow.until) { camera.cam.x += (p.x - camera.cam.x) * 0.06; camera.cam.z += (p.z - camera.cam.z) * 0.06; camera.apply(); } else follow = null;
      }
      stage.setFog(camera.cam.dist * 1.15, camera.cam.dist * 3.2);
      view.frame(np.active ? np.alpha : speed ? simAcc : 1, dt, clock);
      extras.frame(dt); flat.frame();
      const c = myCo().cash;
      hud.setMoney(c, s.sandbox);
      if (c > lastCash + 50 && !orbit) sfx('cash');
      lastCash = c;
      hud.setDate(s.date);
      toastNews();
      stage.render();
    },
  };
  return game;
}
