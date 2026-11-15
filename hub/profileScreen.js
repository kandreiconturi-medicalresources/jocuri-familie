// Ecranul 1: alegi profilul, creezi unul nou sau ștergi unul.
import { h as el } from '../shared/ui/dom.js';
import { avatarCanvas } from './avatar.js';
import { AVATARS, AVATAR_NAMES, PROFILE_COLORS, listProfiles, createProfile, deleteProfile } from '../shared/engine/profiles.js';

export function confirmDialog(text, okLabel) {
  return new Promise((resolve) => {
    const done = (v) => { back.remove(); resolve(v); };
    const back = el('div', { class: 'modal', onclick: (e) => { if (e.target === back) done(false); } },
      el('div', { class: 'panel dialog', role: 'dialog', 'aria-modal': 'true' },
        el('p', null, text),
        el('div', { class: 'row' },
          el('button', { class: 'btn alt', onclick: () => done(false) }, 'Anulează'),
          el('button', { class: 'btn danger', onclick: () => done(true) }, okLabel))));
    document.body.append(back);
  });
}

const rnd = (a) => a[Math.floor(Math.random() * a.length)];

export function profileScreen({ onPick, onCancel }) {
  const root = el('main', { class: 'screen' });

  function showList() {
    root.replaceChildren(
      el('h1', null, 'Cine joacă azi?'),
      el('div', { class: 'cards' },
        listProfiles().map((p) => el('div', { class: 'pcard', style: { '--c': p.color } },
          el('button', { class: 'pcard-main', onclick: () => onPick(p.id) },
            avatarCanvas(p.avatar, p.color, 96), el('span', { class: 'pname' }, p.name)),
          el('button', {
            class: 'pcard-del', title: 'Șterge profilul', 'aria-label': 'Șterge ' + p.name,
            onclick: async () => {
              if (!(await confirmDialog('Ștergi profilul „' + p.name + '”?', 'Șterge'))) return;
              deleteProfile(p.id);
              listProfiles().length ? showList() : showForm();
            },
          }, '✕'))),
        el('button', { class: 'pcard add', onclick: showForm }, el('span', { class: 'plus' }, '+'), el('span', { class: 'pname' }, 'Profil nou'))),
      onCancel ? el('button', { class: 'btn alt', onclick: onCancel }, '← Înapoi') : null);
  }

  function showForm() {
    let avatar = rnd(AVATARS);
    let color = rnd(PROFILE_COLORS);
    const preview = el('div', { class: 'preview' });
    const avBox = el('div', { class: 'choices' });
    const colBox = el('div', { class: 'swatches' });
    const input = el('input', { class: 'name', type: 'text', maxlength: '14', placeholder: 'Cum te cheamă?', autocomplete: 'off', 'aria-label': 'Nume' });
    const ok = el('button', { class: 'btn', disabled: true }, 'Gata!');
    function paint() {
      preview.replaceChildren(avatarCanvas(avatar, color, 120));
      avBox.replaceChildren(...AVATARS.map((a) => el('button', {
        class: 'choice' + (a === avatar ? ' sel' : ''), title: AVATAR_NAMES[a], 'aria-label': AVATAR_NAMES[a],
        onclick: () => { avatar = a; paint(); },
      }, avatarCanvas(a, color, 56))));
      colBox.replaceChildren(...PROFILE_COLORS.map((c) => el('button', {
        class: 'swatch' + (c === color ? ' sel' : ''), style: { background: c }, 'aria-label': 'Culoare',
        onclick: () => { color = c; paint(); },
      })));
      ok.disabled = !input.value.trim();
    }
    const submit = () => { if (input.value.trim()) onPick(createProfile({ name: input.value, avatar, color }).id); };
    input.addEventListener('input', () => { ok.disabled = !input.value.trim(); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    ok.addEventListener('click', submit);
    paint();
    root.replaceChildren(
      el('h1', null, 'Profil nou'),
      el('div', { class: 'panel form' },
        preview, input,
        el('div', { class: 'lbl' }, 'Alege-ți prietenul'), avBox,
        el('div', { class: 'lbl' }, 'Culoarea ta'), colBox,
        el('div', { class: 'row' },
          listProfiles().length ? el('button', { class: 'btn alt', onclick: showList }, '← Înapoi') : null, ok)));
  }

  listProfiles().length ? showList() : showForm();
  return root;
}
