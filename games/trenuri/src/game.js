// Jocul în sine: lumea curentă, pașii simulării (cu viteză), comenzi, unelte, salvare locală, scenarii, tutorial și Ajutorul.
import { createWorld, applyCommand, stepWorld, serialize, deserialize, ERR_TEXT, SIM_HZ, SCENARIOS, scenarioById, createScenarioWorld, createFreeWorld, recordMedal, MEDAL_ICONS, MEDAL_NAMES } from './sim/index.js';
import { createView } from './render/view.js';
import { createCamera } from './input/camera.js';
import { bindPointer } from './input/pointer.js';
import { createTools } from './input/tools.js';
import { createHud } from './ui/hud.js';
import { createPanels } from './ui/panels.js';
import { sfx, unlock, trainSounds, resetSounds, setAmbient } from './audio.js';
import { createHelper } from './ui/helper.js';
import { findTip } from './ui/tips.js';
import { createTutorial } from './ui/tutorial.js';
import { createGoals, goalChip } from './ui/goalsPanel.js';
import { showEnd } from './ui/endScreen.js';
import { createPrefs, openSettings } from './ui/settings.js';

const TUTORIAL_SEED = 11;

export function createGame({ stage, canvas, uiRoot, save, onHome, onMenu }) {
  let lastNews = null, s = null, view = null, speed = 1, simAcc = 0, follow = null, orbit = false, saveT = 0, lastCash = 0, clock = 0;
  let mode = 'normal', shown = new Set(), tipT = 0, lastBest = 0, endShown = true, lastMonth = -1, endUi = null;
  const prefs = createPrefs(save);
  const camera = createCamera(stage, { w: 64, h: 64 });
  const exec = (cmd) => {
    const r = applyCommand(s, { by: 0, ...cmd });
    if (r.ok) sfx('build'); else { sfx('nope'); hud.hint(ERR_TEXT[r.err] || 'Nu merge asta.', true); }
    return r;
  };
  const panels = createPanels(uiRoot, {
    sell: (id) => exec({ type: 'sellTrain', trainId: id }),
    orders: (id, orders) => exec({ type: 'setOrders', trainId: id, orders }),
    upgrade: (id, kind) => exec({ type: 'buildUpgrade', stationId: id, kind }).ok,
  });
  const goals = createGoals(panels.card);
  const helper = createHelper(uiRoot, { enabled: () => prefs.get('tips') });
  const scn = () => (s && s.scn ? scenarioById(s.scn.id) : null);
  const setSpeed = (v) => { speed = v; hud.setSpeed(v); };
  const hud = createHud(uiRoot, {
    speed: setSpeed,
    tool: (id) => tools.setTool(id),
    news: () => panels.news(s),
    layer: () => {
      const on = !view.links.visible;
      view.links.show(on); hud.setLayer(on);
      if (on) panels.layer(s); else panels.close();
    },
    goals: () => { const sc = scn(); if (sc) goals.progress(s, sc); },
    menu: () => openSettings(panels.card, prefs, { tutorial: () => game.startTutorial(), restart: scn() ? () => game.startScenario(s.scn.id) : null, home: () => { game.save(); onMenu(); } }),
  });
  const tools = createTools({
    state: () => s, view: () => view, hud, panels, exec, errText: (k) => ERR_TEXT[k],
    canAfford: (c) => s.sandbox || s.companies[0].cash >= c,
    follow: (id) => { follow = { id, until: clock + 5 }; },
  });
  const tutorial = createTutorial({
    root: uiRoot, hud, helper, camera, state: () => s, setTool: (id) => tools.setTool(id),
    onDone: () => { prefs.set('tutorialDone', true); mode = 'normal'; }, onSkip: () => { prefs.set('tutorialDone', true); mode = 'normal'; },
  });
  const pickTile = (p) => {
    const x = Math.floor(p.fx), y = Math.floor(p.fz);
    return x < 0 || y < 0 || x >= s.w || y >= s.h ? null : { x, y, fx: p.fx, fz: p.fz };
  };
  bindPointer(canvas, camera, pickTile, {
    groundAt: (x, z) => (view ? view.ground.at(x, z) : 0),
    wantsDrag: () => !orbit && tools.wantsDrag(), tap: (t) => { if (!orbit) tools.tap(t); }, hover: (t) => { if (!orbit) tools.hover(t); },
    dragStart: (t) => tools.dragStart(t), dragMove: (t) => tools.dragMove(t), dragEnd: (t, m) => tools.dragEnd(t, m), dragCancel: () => tools.dragCancel(),
  });
  // tap în afara panoului (pe hartă) închide cardul deschis
  canvas.addEventListener('pointerdown', () => { follow = null; unlock(); if (panels.isOpen()) panels.close(); });
  setAmbient(prefs.get('ambient'));

  const BIG = ['🚂', '🏙️', '🏗️', '🌽', '🏆', '🤷', '🔧', '↩️', '🏅'];
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
      const i = SCENARIOS.indexOf(sc), nx = SCENARIOS[i + 1];
      endUi = showEnd(uiRoot, { sc, s, best: sn.best, act: { again: () => game.startScenario(sc.id), menu: onMenu, keep: () => setSpeed(1), next: nx ? () => game.startScenario(nx.id) : null } });
    }
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
    setWorld(state, { demo = false, kind = 'normal' } = {}) {
      if (view) view.dispose();
      if (endUi) { endUi.close(); endUi = null; }
      tutorial.stop(true);
      s = state; view = createView(stage, s); mode = demo ? 'demo' : kind;
      camera.setWorld(s.w, s.h);
      camera.focus(s.w / 2, s.h / 2, Math.max(s.w, s.h) * (demo ? 0.7 : 0.5));
      orbit = demo; simAcc = 0; lastCash = s.companies[0].cash; shown = new Set(); tipT = -3; resetSounds();
      lastBest = s.scn ? s.scn.best : 0; endShown = !s.scn || s.scn.done; lastMonth = -1;
      uiRoot.classList.toggle('demo', demo);
      helper.show(!demo); hud.setGoal(null);
      panels.close(); tools.setTool('track'); hud.setLayer(false); lastNews = s.news[s.news.length - 1];
      for (const e of hud.el) e.classList.toggle('hidden', demo); // după setTool, ca mesajul lui să nu apară în meniu
      if (!demo) { setSpeed(1); hud.setDate(s.date); hud.setMoney(s.companies[0].cash, s.sandbox); }
      else speed = 1;
      view.trains.onStep();
      if (s.scn) { const sc = scn(); if (sc) hud.setGoal(goalChip(s, sc)); }
    },
    newWorld(size, demo, year = 1950) { game.setWorld(createWorld({ seed: (Math.random() * 4294967295) >>> 0, size, year }), { demo }); },
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
    save() { if (s && !orbit && mode !== 'tutorial') save.set('auto', { v: 1, state: serialize(s), speed }); },
    update(dt) {
      if (!s) return;
      clock += dt;
      saveT += dt;
      if (saveT > 30) { saveT = 0; game.save(); }
      camera.update(dt);
      if (orbit) camera.rotate(dt * 0.06);
      simAcc += dt * speed * SIM_HZ;
      let n = 0;
      while (simAcc >= 1 && n++ < 8) { stepWorld(s); view.trains.onStep(); simAcc -= 1; }
      if (simAcc > 1) simAcc = 0;
      if (!orbit) { trainSounds(s, clock); watchScenario(); tutorial.update(dt); tips(dt); }
    },
    render(dt) {
      if (!s) return;
      if (follow) {
        const p = view.trains.positionOf(follow.id);
        if (p && clock < follow.until) { camera.cam.x += (p.x - camera.cam.x) * 0.06; camera.cam.z += (p.z - camera.cam.z) * 0.06; camera.apply(); } else follow = null;
      }
      stage.setFog(camera.cam.dist * 1.15, camera.cam.dist * 3.2);
      view.frame(speed ? simAcc : 1, dt, clock);
      const c = s.companies[0].cash;
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
