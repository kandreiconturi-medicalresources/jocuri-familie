// Helperi DOM mici.

export const $ = (sel, root = document) => root.querySelector(sel);

/** h('div', { class: 'x', onclick: fn, style: {color:'red'} }, 'text', altNod) */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (c) => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  };
  children.forEach(add);
  return el;
}

/** Arată/ascunde un element (clasa .hidden din theme.css). */
export function show(el, on = true) {
  el.classList.toggle('hidden', !on);
  return el;
}
