// Ecran: canvas cu înălțime logică fixă, fullscreen, detectare dispozitiv.
import { perf } from './perf.js';

const nav = typeof navigator !== 'undefined' ? navigator : {};
const win = typeof window !== 'undefined' ? window : {};
const ua = nav.userAgent || '';

export const isTouch = ('ontouchstart' in win) || (nav.maxTouchPoints || 0) > 0;
// iPadOS 13+ se declară Mac, dar are touch
export const isIOS = /iPad|iPhone|iPod/.test(ua) || (nav.platform === 'MacIntel' && (nav.maxTouchPoints || 0) > 1);
export const isStandalone = !!nav.standalone ||
  !!(win.matchMedia && win.matchMedia('(display-mode: standalone)').matches);

const DPR_CAP = [1, 1.5, 2]; // plafon după calitate

/** Păstrează înălțimea logică; lățimea se adaptează. Obiectul întors se actualizează pe loc.
 *  `scale` = pixeli canvas per unitate logică. */
export function fitCanvas(canvas, { height = 544, minWidth = 800, maxWidth = 1280, onResize } = {}) {
  const info = { vw: minWidth, vh: height, scale: 1 };
  const fit = () => {
    const iw = innerWidth, ih = innerHeight;
    info.vh = height;
    info.vw = Math.round(Math.max(minWidth, Math.min(maxWidth, height * iw / ih)));
    const s = Math.min(iw / info.vw, ih / info.vh);
    const cw = Math.max(1, Math.floor(info.vw * s));
    const ch = Math.max(1, Math.floor(info.vh * s));
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    const dpr = Math.min(win.devicePixelRatio || 1, DPR_CAP[perf.quality()]);
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    info.scale = canvas.width / info.vw;
    if (onResize) onResize(info);
  };
  addEventListener('resize', fit);
  addEventListener('orientationchange', () => setTimeout(fit, 200));
  perf.onChange(fit);
  fit();
  return info;
}

export async function toggleFullscreen() {
  try {
    const d = document, el = d.documentElement;
    if (!(d.fullscreenElement || d.webkitFullscreenElement)) {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      try { await screen.orientation.lock('landscape'); } catch (e) { /* nu peste tot */ }
    } else if (d.exitFullscreen) await d.exitFullscreen();
    else if (d.webkitExitFullscreen) d.webkitExitFullscreen();
  } catch (e) { /* refuzat de browser */ }
  setTimeout(() => dispatchEvent(new Event('resize')), 250);
}

/** Arată `el` (mesaj „rotește telefonul”) când ecranul tactil e în portret.
 *  Întoarce o funcție care spune dacă e portret acum. */
export function needLandscape(el) {
  const upd = () => { el.classList.toggle('hidden', !portrait()); };
  const portrait = () => isTouch && innerHeight > innerWidth;
  addEventListener('resize', upd);
  addEventListener('orientationchange', () => setTimeout(upd, 200));
  upd();
  return portrait;
}
