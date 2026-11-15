// Sesiune de joc în modul NAS: bătăi de inimă la 30 s (doar cât pagina e vizibilă) și oprirea la depășirea limitei.
import { isOnline, onlineNow, heartbeat, siteUrl } from '../net/api.js';
import { beatOutcome } from '../net/util.js';
import { h } from '../ui/dom.js';

const BEAT_MS = 30000;

const MESSAGES = {
  limit: ['🌙', 'Gata timpul de joc pe azi!', 'Ne vedem mâine 🌙'],
  hours: ['⏰', 'Acum nu e ora de joc', 'Revino în intervalul stabilit de părinți.'],
  disabled: ['🔒', 'Contul e oprit', 'Întreabă un părinte.'],
  offline: ['📡', 'Nu mă pot conecta la server', 'Verifică internetul și încearcă din nou.'],
};

/** Overlay mare și prietenos peste tot ecranul. `opts.home === false` ascunde butonul spre hub. */
export function showTimeOverlay(reason, opts = {}) {
  const [icon, title, sub] = MESSAGES[reason] || MESSAGES.limit;
  const old = document.getElementById('time-overlay');
  if (old) old.remove();
  const box = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', textAlign: 'center', maxWidth: '420px' };
  const el = h('div', {
    id: 'time-overlay', role: 'alertdialog', 'aria-modal': 'true',
    style: {
      position: 'fixed', inset: '0', zIndex: '99999', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      background: 'radial-gradient(ellipse at 50% 20%, #5a2ba0, #1b1530)', color: '#fff',
      fontFamily: '"Baloo 2","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif',
    },
  }, h('div', { style: box },
    h('div', { style: { fontSize: '88px', lineHeight: '1' } }, icon),
    h('div', { style: { fontSize: '34px', fontWeight: '800', color: '#ffd23f', lineHeight: '1.1' } }, title),
    h('div', { style: { fontSize: '22px' } }, sub),
    opts.home === false ? null : h('button', {
      style: {
        font: 'inherit', fontWeight: '800', fontSize: '24px', padding: '12px 32px', border: '0', borderRadius: '18px', marginTop: '10px',
        cursor: 'pointer', color: '#3a1d00', background: 'linear-gradient(#ffe680,#ffb703)', boxShadow: '0 5px 0 #c77d00', minHeight: '52px',
      },
      onclick: () => { location.href = siteUrl(''); },
    }, '🏠 La meniu')));
  document.body.append(el);
  return el;
}

/** Pornește măsurarea timpului. Întoarce { stop() }. În modul local nu face nimic. */
export function startPlaySession(gameId, { onBlocked, onTick } = {}) {
  let timer = null, missed = 0, stopped = false, blocked = false, busy = false;

  async function beat() {
    if (stopped || blocked || busy || document.hidden) return;
    busy = true;
    let res = null;
    try { res = await heartbeat(gameId); } catch (e) { res = null; }
    busy = false;
    if (stopped) return;
    const out = beatOutcome(missed, res);
    missed = out.missed;
    if (res && res.time && onTick) onTick(res.time);
    if (out.blocked) {
      blocked = true;
      stop();
      if (onBlocked) onBlocked(out.blocked);
    }
  }
  function onVis() { if (!document.hidden) beat(); }
  function stop() {
    stopped = true;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVis);
  }

  isOnline().then(() => {
    if (!onlineNow() || stopped) return;
    document.addEventListener('visibilitychange', onVis);
    timer = setInterval(beat, BEAT_MS);
    beat();
  });
  return { stop };
}
