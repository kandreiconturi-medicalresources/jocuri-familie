// Forma comenzilor pe fir: traseul unei șine devine „x,y + șir de direcții” (o cifră pe pas), ca mesajele să rămână mici.
import { DX, DY } from '../sim/consts.js';
import { EXPERT_ALLOWED } from '../sim/expert/index.js';

/** Ce poate trimite un jucător. setSpeed e doar al gazdei; joinCompany e generat doar de gazdă. */
export const ALLOWED = new Set(['buildTrack', 'removeTrack', 'buildStation', 'removeStation', 'buyTrain', 'setRoute', 'sellTrain', 'buildUpgrade', 'executePlan', 'setOrders', 'pauseTrain', 'resumeTrain', 'placeSignal', 'removeSignal', 'setAutoSignals', 'levelTerrain', 'clearArea', 'buildTunnel', 'upgradeStation', 'buildDepot', 'sendToDepot', 'rescueTrain', 'setAutoBlock', 'setCars', 'buildPort', 'buyShip', 'setShipRoute', 'sellShip', 'buildBridge', 'buyLand', 'buyIndustry', 'setAutoRepay', ...EXPERT_ALLOWED]);

export function wire(cmd) {
  if (cmd.type !== 'buildTrack' || !Array.isArray(cmd.path) || !cmd.path.length) return cmd;
  const p = cmd.path;
  let d = '';
  for (let i = 1; i < p.length; i++) {
    const k = DX.findIndex((v, q) => v === p[i][0] - p[i - 1][0] && DY[q] === p[i][1] - p[i - 1][1]);
    if (k < 0) return cmd; // traseu nevalid: trece așa cum e, îl refuză simularea
    d += k;
  }
  return cmd.level ? { type: 'buildTrack', x: p[0][0], y: p[0][1], d, lv: cmd.level } : { type: 'buildTrack', x: p[0][0], y: p[0][1], d };
}

export function unwire(c) {
  if (!c || c.type !== 'buildTrack' || typeof c.d !== 'string') return c;
  const path = [[c.x, c.y]];
  for (const ch of c.d) { const k = +ch, l = path[path.length - 1]; path.push([l[0] + DX[k], l[1] + DY[k]]); }
  return c.lv ? { type: 'buildTrack', path, level: c.lv } : { type: 'buildTrack', path };
}
