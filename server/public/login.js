// Pagina de login (fără scripturi inline, din cauza CSP). Safari 15: fără sintaxă nouă.
(function () {
  'use strict';
  var form = document.getElementById('login');
  var user = document.getElementById('username');
  var pass = document.getElementById('password');
  var peek = document.getElementById('peek');
  var msg = document.getElementById('msg');
  var go = document.getElementById('go');
  var card = document.querySelector('.card');

  var MESSAGES = {
    empty: 'Scrie numele și parola. ✏️',
    invalid: 'Numele sau parola nu sunt bune. Mai încearcă! 🙂',
    blocked: 'Prea multe încercări. Mai încearcă peste 15 minute. ⏳',
    network: 'Nu ajung la server. Verifică internetul și mai încearcă. 📡',
  };

  function say(text, ok) {
    msg.textContent = text;
    msg.className = ok ? 'msg ok' : 'msg';
    if (!ok) {
      card.classList.remove('shake');
      void card.offsetWidth; // repornește animația
      card.classList.add('shake');
    }
  }

  peek.addEventListener('click', function () {
    var show = pass.type === 'password';
    pass.type = show ? 'text' : 'password';
    peek.setAttribute('aria-pressed', show ? 'true' : 'false');
    peek.setAttribute('aria-label', show ? 'Ascunde parola' : 'Arată parola');
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var u = user.value.trim();
    var p = pass.value;
    if (!u || !p) { say(MESSAGES.empty); return; }
    go.disabled = true;
    say('Verific… 🔎', true);
    fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p }),
    }).then(function (r) {
      if (r.ok) {
        say('Bine ai venit! 🎉', true);
        window.location.replace('/');
        return;
      }
      go.disabled = false;
      pass.value = '';
      pass.focus();
      say(r.status === 429 ? MESSAGES.blocked : MESSAGES.invalid);
    }).catch(function () {
      go.disabled = false;
      say(MESSAGES.network);
    });
  });

  user.focus();
}());
