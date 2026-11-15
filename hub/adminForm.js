// Panou părinte: formularul de creare / editare utilizator.
import { h as el } from '../shared/ui/dom.js';
import { avatarCanvas } from './avatar.js';
import { AVATARS, AVATAR_NAMES, PROFILE_COLORS } from '../shared/engine/profiles.js';
import { adminCreateUser, adminUpdateUser } from '../shared/net/api.js';

const field = (label, input) => el('label', { class: 'af' }, el('span', { class: 'lbl' }, label), input);

/** `user` = null pentru utilizator nou. `onDone()` după salvare, `onCancel()` la renunțare. */
export function userForm({ user, onDone, onCancel }) {
  const isNew = !user;
  const lim = (user && user.limits) || { minutesPerDay: 60, from: null, to: null };
  let avatar = (user && user.avatar) || AVATARS[0];
  let color = (user && user.color) || PROFILE_COLORS[4];

  const preview = el('div', { class: 'preview' });
  const avBox = el('div', { class: 'choices' });
  const colBox = el('div', { class: 'swatches' });
  const err = el('div', { class: 'aerr', role: 'alert' });
  const inp = (attrs) => el('input', { class: 'name small', autocomplete: 'off', ...attrs });
  const username = inp({ type: 'text', maxlength: '24', value: user ? user.username : '', disabled: !isNew, autocapitalize: 'none' });
  const display = inp({ type: 'text', maxlength: '14', value: user ? user.displayName : '' });
  const pass = inp({ type: 'text', placeholder: isNew ? 'minim 4 caractere' : 'lasă gol = neschimbată', autocomplete: 'new-password' });
  const minutes = inp({ type: 'number', min: '0', max: '600', inputmode: 'numeric', placeholder: 'fără limită', value: lim.minutesPerDay == null ? '' : lim.minutesPerDay });
  const from = inp({ type: 'time', value: lim.from || '' });
  const to = inp({ type: 'time', value: lim.to || '' });
  const disabled = el('input', { type: 'checkbox', class: 'chk' });
  disabled.checked = !!(user && user.disabled);
  const admin = el('input', { type: 'checkbox', class: 'chk' });
  const save = el('button', { class: 'btn' }, 'Salvează');

  function paint() {
    preview.replaceChildren(avatarCanvas(avatar, color, 96));
    avBox.replaceChildren(...AVATARS.map((a) => el('button', {
      type: 'button', class: 'choice' + (a === avatar ? ' sel' : ''), title: AVATAR_NAMES[a], 'aria-label': AVATAR_NAMES[a],
      onclick: () => { avatar = a; paint(); },
    }, avatarCanvas(a, color, 48))));
    colBox.replaceChildren(...PROFILE_COLORS.map((c) => el('button', {
      type: 'button', class: 'swatch' + (c === color ? ' sel' : ''), style: { background: c }, 'aria-label': 'Culoare',
      onclick: () => { color = c; paint(); },
    })));
  }

  save.addEventListener('click', async () => {
    err.textContent = '';
    const name = display.value.trim();
    const limits = {
      minutesPerDay: minutes.value === '' ? null : Math.max(0, Math.min(600, Math.round(Number(minutes.value)))),
      from: from.value && to.value ? from.value : null,
      to: from.value && to.value ? to.value : null,
    };
    if (isNew && !username.value.trim()) { err.textContent = 'Scrie numele de utilizator.'; return; }
    if (!name) { err.textContent = 'Scrie numele afișat.'; return; }
    if (isNew && pass.value.length < (admin.checked ? 10 : 4)) { err.textContent = 'Parola e prea scurtă (copii: 4, părinți: 10).'; return; }
    save.disabled = true;
    try {
      if (isNew) {
        const body = { username: username.value.trim(), password: pass.value, displayName: name, avatar, color, limits };
        if (admin.checked) body.role = 'admin';
        await adminCreateUser(body);
      } else {
        const patch = { displayName: name, avatar, color, limits, disabled: disabled.checked };
        if (pass.value) patch.password = pass.value;
        await adminUpdateUser(user.id, patch);
      }
      onDone();
    } catch (e) {
      err.textContent = e.status === 409 ? 'Numele de utilizator există deja.' : 'Nu s-a putut salva (' + e.message + ').';
      save.disabled = false;
    }
  });
  paint();
  return el('div', { class: 'panel form aform' },
    el('h2', null, isNew ? 'Utilizator nou' : 'Editează: ' + user.displayName),
    preview,
    field('Nume de utilizator', username), field('Nume afișat', display), field(isNew ? 'Parolă' : 'Parolă nouă', pass),
    el('div', { class: 'lbl' }, 'Avatar'), avBox, el('div', { class: 'lbl' }, 'Culoare'), colBox,
    field('Minute pe zi (gol = fără limită)', minutes),
    el('div', { class: 'af2' }, field('Joacă de la', from), field('până la', to)),
    isNew ? el('label', { class: 'af chkrow' }, admin, el('span', null, 'Părinte (administrator, fără limite)')) : null,
    isNew ? null : el('label', { class: 'af chkrow' }, disabled, el('span', null, 'Cont dezactivat')),
    err,
    el('div', { class: 'row' }, el('button', { class: 'btn alt', onclick: onCancel }, '← Înapoi'), save));
}
