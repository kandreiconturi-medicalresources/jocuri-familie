// HUD: bara de sus (vieți, timp), cardurile jucătorilor pe margini și bannere mari.
import { W, H, MATCH_STEPS, SHRINK_AT, HZ, CORNERS } from '../logic/rules.js';
import { drawAvatar } from '../../../../shared/engine/profiles.js';
import { T, OY } from './arena.js';
import { drawBonusIcon } from './icons.js';

const FONT = '"Baloo 2", "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';

export function text(c, str, x, y, size, color = '#fff', align = 'center', stroke = 'rgba(40,10,60,.85)') {
  c.font = `800 ${size}px ${FONT}`; c.textAlign = align; c.lineJoin = 'round';
  c.lineWidth = Math.max(3, size / 6); c.strokeStyle = stroke; c.strokeText(str, x, y);
  c.fillStyle = color; c.fillText(str, x, y);
}

const clip = (str, n) => (str.length > n ? str.slice(0, n - 1) + '…' : str);

function card(c, p, x, y, w, right) {
  const h = 160;
  c.fillStyle = 'rgba(30,10,60,.55)'; c.strokeStyle = p.lives > 0 ? p.color : 'rgba(255,255,255,.25)'; c.lineWidth = 4;
  c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, 16) : c.rect(x, y, w, h); c.fill(); c.stroke();
  c.globalAlpha = p.lives > 0 ? 1 : 0.4;
  drawAvatar(c, p.avatar, x + w / 2, y + 36, 26, p.color);
  c.globalAlpha = 1;
  text(c, clip(p.name, 9), x + w / 2, y + 84, 17, p.lives > 0 ? '#fff' : '#bbb');
  text(c, '♥'.repeat(Math.max(0, p.lives)) || '·', x + w / 2, y + 107, p.lives > 4 ? 15 : 19, '#ff6b81');
  if (p.lives <= 0) text(c, 'Ieșit', x + w / 2, y + 36, 18, '#ffdede');
  else if (!p.alive) text(c, 'Revine…', x + w / 2, y + 36, 16, '#ffdede');
  text(c, String(p.idx + 1), x + (right ? w - 12 : 12), y + 20, 14, p.color);
  c.globalAlpha = p.lives > 0 ? 1 : 0.4; // câte bombe, ce rază și ce puteri are
  const mini = (k, px, py, r) => { c.save(); c.translate(px, py); drawBonusIcon(c, k, r); c.restore(); };
  mini(1, x + w * 0.2, y + 133, 8); text(c, String(p.maxBombs), x + w * 0.2 + 16, y + 139, 16, '#fff', 'left');
  mini(2, x + w * 0.58, y + 133, 8); text(c, String(p.range), x + w * 0.58 + 16, y + 139, 16, '#fff', 'left');
  const own = [p.glove && 6, p.remote && 7, p.cu && 8].filter(Boolean);
  own.forEach((k, i) => mini(k, x + w / 2 + (i - (own.length - 1) / 2) * 24, y + 152, 8));
  c.globalAlpha = 1;
}

export function drawHud(c, view, s, ready, ox) {
  const aw = W * T;
  // sus: vieți și timp
  const left = Math.max(0, Math.ceil((MATCH_STEPS - s.tick) / HZ));
  const warn = left <= 30;
  text(c, `Meci: ${s.rules.lives} ${s.rules.lives === 1 ? 'viață' : 'vieți'}`, ox + 4, 30, 20, '#ffd23f', 'left');
  text(c, `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, ox + aw / 2, 36, 32, warn && (s.tick >> 3) & 1 ? '#ff9aa8' : '#fff');
  // carduri
  const w = Math.min(110, ox - 12);
  s.players.forEach((p, i) => {
    p.idx = i;
    const [cx, cy] = CORNERS[p.corner % 4], right = cx > W / 2, top = cy < H / 2;
    const x = right ? ox + aw + 8 : ox - 8 - w;
    card(c, p, x, top ? OY + 4 : OY + H * T - 164, w, right);
  });
  // bannere
  const mid = ox + aw / 2, my = OY + (H / 2) * T;
  if (s.phase === 'play' && ready > 0) {
    text(c, 'Ultimul cu vieți câștigă', mid, my - 30, 30, '#ffd23f');
    text(c, 'Pregătiți!', mid, my + 22, 64, '#fff');
  } else if (s.phase === 'play' && s.tick < 40) text(c, 'Hai!', mid, my + 20, 72, '#7be08a');
  else if (s.phase === 'play' && s.tick >= SHRINK_AT && s.tick < SHRINK_AT + 150) text(c, 'Arena se strânge!', mid, OY + 60, 34, '#ff9aa8');
  if (s.phase === 'match_end') {
    const w1 = s.players.find((p) => p.id === s.matchWinner);
    text(c, w1 ? `${clip(w1.name, 12)} câștigă!` : 'Egalitate!', mid, my, 44, w1 ? w1.color : '#fff');
  }
}
