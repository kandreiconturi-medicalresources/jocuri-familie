// Legătura interfeței lumii cu insule cu jocul: 🗺️ Insulele, ⚓ port, 🚢 vapor, panourile de port și vapor.
import { h } from '../../../../shared/ui/dom.js';
import { openIslandsInfo } from './islandsInfo.js';
import { openPortPanel, openShipPanel } from './portPanel.js';
import { openShipWizard } from './shipWizard.js';
import { openBankPanel } from './bankPanel.js';
import { shipXY } from '../render/ships.js';

/** ctx = { card, state(), me(), exec(cmd), hud, tools, show(x,y) } */
export function createIslandUi(ctx) {
  const c = { card: ctx.card, state: ctx.state, me: ctx.me, exec: ctx.exec, show: ctx.show, hint: (t, w) => ctx.hud.hint(t, w, 6000) };
  const api = {
    open: () => openIslandsInfo({ ...c, portTool: () => { ctx.card.close(); ctx.tools.setTool('port'); }, shipWizard: () => api.wizard(), port: (st) => api.port(st) }),
    port: (st) => openPortPanel({ ...c, wizard: (p) => api.wizard(p), ship: (sh) => api.ship(sh) }, st),
    ship: (sh) => openShipPanel({ ...c, wizard: (p) => api.wizard(p) }, sh),
    wizard: (preset) => openShipWizard(c, preset),
    bank: () => openBankPanel(c),
    /** Vaporul de lângă punctul atins (fx, fz în plăci), dacă există. */
    shipNear(s, fx, fz) {
      let best = null, bd = 1.2;
      for (const sh of s.ships || []) { const p = shipXY(s, sh, 0); const d = Math.hypot(p.x - fx, p.z - fz); if (d < bd) { bd = d; best = sh; } }
      return best;
    },
  };
  const btn = h('button', { class: 'tool hidden', 'aria-label': 'Vapor', onclick: () => api.wizard() }, h('span', { class: 'e' }, '🚢'), 'Vapor');
  ctx.hud.el[3].append(btn);
  api.setWorld = (s, demo) => { btn.classList.toggle('hidden', !s.islands || demo); };
  return api;
}
