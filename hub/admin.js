// Panou părinte: lista utilizatorilor, timp folosit azi, ștergere, „+15 min azi”.
import './admin.css';
import { h as el } from '../shared/ui/dom.js';
import { avatarCanvas } from './avatar.js';
import { confirmDialog } from './profileScreen.js';
import { userForm } from './adminForm.js';
import { adminListUsers, adminDeleteUser, adminBonus } from '../shared/net/api.js';
import { fmtMinutes } from '../shared/net/util.js';

function limitText(l) {
  if (!l) return 'fără limită';
  const parts = [l.minutesPerDay == null ? 'fără limită de minute' : l.minutesPerDay + ' min/zi'];
  if (l.from && l.to) parts.push(l.from + '–' + l.to);
  return parts.join(', ');
}

export function adminScreen({ onBack }) {
  const root = el('main', { class: 'screen admin' });
  const msg = el('div', { class: 'aerr', role: 'status' });

  async function showList() {
    root.replaceChildren(el('h1', null, 'Panou părinte'), el('p', null, 'Se încarcă…'));
    let users;
    try { users = await adminListUsers(); } catch (e) { root.replaceChildren(el('h1', null, 'Panou părinte'), el('p', { class: 'aerr' }, 'Nu s-a putut încărca lista.'), back()); return; }
    root.replaceChildren(
      el('h1', null, 'Panou părinte'), msg,
      el('div', { class: 'ulist' }, users.map(row)),
      el('div', { class: 'row' }, back(), el('button', { class: 'btn', onclick: () => showForm(null) }, '+ Utilizator nou')));
  }
  const back = () => el('button', { class: 'btn alt', onclick: onBack }, '← Înapoi');
  function showForm(user) { root.replaceChildren(userForm({ user, onDone: showList, onCancel: showList })); window.scrollTo(0, 0); }

  function row(u) {
    const used = u.usedToday != null ? u.usedToday : u.time && u.time.usedToday;
    const act = (label, cls, fn) => el('button', { class: 'btn small ' + cls, onclick: fn }, label);
    return el('div', { class: 'panel urow' + (u.disabled ? ' off' : '') },
      avatarCanvas(u.avatar, u.color, 56),
      el('div', { class: 'uinfo' },
        el('b', null, u.displayName), el('span', { class: 'usub' }, '@' + u.username + (u.role === 'admin' ? ' · părinte' : '') + (u.disabled ? ' · dezactivat' : '')),
        el('span', { class: 'usub' }, 'Azi: ' + fmtMinutes(used) + ' · ' + (u.role === 'admin' ? 'fără limite' : limitText(u.limits)))),
      el('div', { class: 'uact' },
        u.role === 'admin' ? null : act('+15 min azi', '', async () => {
          try { await adminBonus(u.id, 15); msg.textContent = '+15 minute pentru ' + u.displayName + ' ✔'; showList(); } catch (e) { msg.textContent = 'Nu s-a putut adăuga timpul.'; }
        }),
        act('✏️ Editează', 'alt', () => showForm(u)),
        act('🗑 Șterge', 'danger', async () => {
          if (!(await confirmDialog('Ștergi utilizatorul „' + u.displayName + '” și tot progresul lui?', 'Șterge'))) return;
          try { await adminDeleteUser(u.id); msg.textContent = ''; } catch (e) { msg.textContent = 'Nu se poate șterge (ultimul părinte rămâne).'; }
          showList();
        })));
  }

  showList();
  return root;
}
