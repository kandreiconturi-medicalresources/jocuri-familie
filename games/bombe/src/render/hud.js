// HUD: bara de sus (rundă, timp), cardurile jucătorilor pe margini și bannere mari.
import { ROUND_STEPS, HZ, CORNERS } from '../logic/rules.js';
import { drawAvatar } from '../../../../shared/engine/profiles.js';
import { T, OY } from './arena.js';

const FONT = '"Baloo 2", "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';

export function text(c, str, x, y, size, color = '#fff', align = 'center', stroke = 'rgba(40,10,60,.85)') {
  c.font = `800 ${size}px ${FONT}`; c.textAlign = align; c.lineJoin = 'round';
  c.lineWidth = Math.max(3, size / 6); c.strokeStyle = stroke; c.strokeText(str, x, y);
  c.fillStyle = color; c.fillText(str, x, y);
}

const clip = (str, n) => (str.length > n ? str.slice(0, n - 1) + '…' : str);

function card(c, p, x, y, w, right) {
  const h = 118;
  c.fillStyle = 'rgba(30,10,60,.55)'; c.strokeStyle = p.alive ? p.color : 'rgba(255,255,255,.25)'; c.lineWidth = 4;
  c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, 16) : c.rect(x, y, w, h); c.fill(); c.stroke();
  c.globalAlpha = p.alive ? 1 : 0.4;
  drawAvatar(c, p.avatar, x + w / 2, y + 36, 26, p.color);
  c.globalAlpha = 1;
  text(c, clip(p.name, 9), x + w / 2, y + 84, 17, p.alive ? '#fff' : '#bbb');
  text(c, '★'.repeat(Math.min(p.score, 5)) || '·', x + w / 2, y + 107, 18, '#ffd23f');
  if (!p.alive) text(c, 'Ieșit', x + w / 2, y + 36, 18, '#ffdede');
  else if (p.shield > 0) text(c, '🛡' + (p.shield > 1 ? p.shield : ''), x + (right ? 14 : w - 14), y + 20, 15, '#7ee9ff');
  text(c, String(p.idx + 1), x + (right ? w - 12 : 12), y + 20, 14, p.color);
}

export function drawHud(c, view, s, ready, ox) {
  const aw = 15 * T;
  // sus: runda și timpul
  const left = Math.max(0, Math.ceil((ROUND_STEPS - s.tick) / HZ));
  const warn = left <= 30;
  text(c, `Runda ${s.round} · primul la ${s.rules.rounds}`, ox + 4, 30, 20, '#ffd23f', 'left');
  text(c, `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, ox + aw / 2, 36, 32, warn && (s.tick >> 3) & 1 ? '#ff9aa8' : '#fff');
  // carduri
  const w = Math.min(110, ox - 12);
  s.players.forEach((p, i) => {
    p.idx = i;
    const [cx, cy] = CORNERS[p.corner % 4], right = cx > 7, top = cy < 6;
    const x = right ? ox + aw + 8 : ox - 8 - w;
    card(c, p, x, top ? OY + 4 : OY + 13 * T - 122, w, right);
  });
  // bannere
  const mid = ox + aw / 2, my = OY + 6.5 * T;
  if (s.phase === 'play' && ready > 0) {
    text(c, `Runda ${s.round}`, mid, my - 30, 40, '#ffd23f');
    text(c, 'Pregătiți!', mid, my + 22, 64, '#fff');
  } else if (s.phase === 'play' && s.tick < 40) text(c, 'Hai!', mid, my + 20, 72, '#7be08a');
  else if (s.phase === 'play' && s.tick >= 2700 && s.tick < 2850) text(c, 'Arena se strânge!', mid, OY + 60, 34, '#ff9aa8');
  if (s.phase === 'round_end' || s.phase === 'match_end') {
    const w1 = s.players.find((p) => p.id === s.winner);
    text(c, w1 ? `${clip(w1.name, 12)} câștigă runda!` : 'Egalitate!', mid, my, 44, w1 ? w1.color : '#fff');
  }
}
