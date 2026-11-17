// Meniul de clic dreapta / apăsare lungă (7.6), partea lipită de joc: ce e la placă → meniu → aceleași unelte, panouri și comenzi ca altfel.
import { resolveHit, contextOptions } from './contextTool.js';
import { createContextMenu } from '../ui/contextMenu.js';
import { INDUSTRIES } from '../sim/goods.js';
import { viewer } from '../sim/viewer.js';
import { decorate, KINDS } from './pendingBuild.js';
import { lei } from '../ui/hud.js';

const TOOL_OF = { port: 'port', depot: 'depot', level: 'level', platform: 'platform', land: 'land' };

/** env: { root, state(), view(), tools, panels, exec(cmd), extras, isl, hud, pending } — construcțiile pornesc o „construcție în așteptare” cu bară de confirmare (7.8). */
export function createContextRun(env) {
  const menu = createContextMenu(env.root), { tools, panels } = env;
  const find = {
    train: (fx, fz) => env.view().trains.pickAt(fx, fz),
    ship: (s, fx, fz) => (panels.shipNear ? panels.shipNear(s, fx, fz) : null),
    industry: (s, x, y) => panels.industryNear(s, x, y),
    city: (s, x, y) => panels.cityNear(s, x, y),
  };
  const titleOf = (s, t, hit) => hit.train ? '🚂 Trenul ' + hit.train.id : hit.ship ? '🚢 Vapor' : hit.depot ? '🏭 Depou' : hit.station ? (hit.station.port ? '⚓ ' : '🚉 ') + hit.station.name
    : hit.industry ? INDUSTRIES[hit.industry.type].icon + ' ' + hit.industry.name : hit.city ? '🏙️ ' + hit.city.name : '📍 Placa ' + t.x + ',' + t.y;

  function run(id, t, hit) {
    const s = env.state();
    if (KINDS.includes(id) && env.pending) { env.pending.start(id, t); return; }
    if (TOOL_OF[id]) { tools.setTool(TOOL_OF[id]); tools.tap(t); return; }
    switch (id) {
      case 'track': tools.startTrack(t); break;
      case 'station': tools.choose({ tool: 'station', size: tools.state.size === 2 ? 1 : tools.state.size }); tools.tap(t); break;
      case 'thru': tools.setTool('thru'); env.hud && env.hud.hint('🏙️ Alege câte linii (jos), apoi atinge orașul: auriu = locul găsit, atinge din nou ca să construiești.', false, 7000); break;
      case 'terminal': tools.choose({ tool: 'station', size: 2 }); tools.tap(t); break;
      case 'infoTrain': case 'infoShip': case 'infoDepot': case 'infoStation': case 'infoIndustry': case 'infoCity': tools.infoAt(t); break;
      case 'trainFrom': env.extras.buy({ stops: [hit.station.id] }); break;
      case 'shipFrom': env.isl.wizard({ from: hit.station.id }); break;
      case 'pause': case 'resume': env.exec({ type: id === 'pause' ? 'pauseTrain' : 'resumeTrain', trainId: hit.train.id }); break;
      case 'toDepot': env.exec({ type: 'sendToDepot', trainId: hit.train.id }); break;
      case 'sell': if (env.exec({ type: 'sellTrain', trainId: hit.train.id }).ok) panels.close(); break;
      case 'sellShip': if (env.exec({ type: 'sellShip', shipId: hit.ship.id }).ok) panels.close(); break;
      case 'cars': { // panoul trenului, cu editorul de vagoane deja desfăcut
        panels.train(s, hit.train);
        const box = env.root.querySelector('.cars-ed'), b = box && box.querySelector('button');
        if (b) { b.click(); if (box.scrollIntoView) box.scrollIntoView({ block: 'center' }); }
        break;
      }
      case 'plan': env.extras.planner(hit.city ? { city: hit.city.id } : { industry: hit.industry.id, g: INDUSTRIES[hit.industry.type].out }); break;
      default: break;
    }
  }
  return {
    close: menu.close, isOpen: menu.isOpen, swallow: menu.swallow,
    /** t = placa, (px, py) = unde pe ecran. Întoarce true dacă s-a deschis un meniu. */
    open(t, px, py) {
      const s = env.state(), v = env.view();
      if (!s || !v || !t) return false;
      const hit = resolveHit(s, t, find), opts = decorate(s, viewer.co, t, contextOptions(s, t, hit, viewer.co), lei);
      panels.close();
      return menu.open(px, py, titleOf(s, t, hit), opts, (id) => run(id, t, hit));
    },
  };
}
