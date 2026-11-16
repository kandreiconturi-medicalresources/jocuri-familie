# Server (NAS) — contract Faza 2

Node 24, `server/` separat de build-ul web (propriul `package.json`, singura dependență: `ws`). Baza de date `node:sqlite` în `/data/jocuri.db`. Ascultă pe `0.0.0.0:8787` doar în rețeaua containerului; din afară se ajunge numai prin Tailscale (HTTPS de la `tailscale serve`).

## Reguli de securitate (obligatorii)
- **Totul cere login**, cu excepția `GET /login`, a fișierelor ei (`/login.css`, `/login.js`), `POST /api/auth/login`, `GET /api/health`, plus `/manifest.webmanifest` și `/icons/*.png` (browserul le cere fără cookie la „Adaugă pe ecranul principal”). Cererile HTML fără sesiune → 302 la `/login`; restul → 401 JSON.
- Conturile le creează **doar adminul**; nu există înregistrare publică. Fără 2FA. Primul admin vine din `ADMIN_USER` / `ADMIN_PASSWORD` (env), creat doar dacă nu există niciun admin.
- Parole: `crypto.scrypt` (N=16384, r=8, p=1, 64 B) + sare de 16 B, comparare cu `timingSafeEqual`. Minimum 4 caractere pentru copii, 10 pentru admin.
- Sesiuni: token aleator de 32 B în cookie `jf_sid` (`HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=30 zile`). În baza de date se ține doar SHA-256 al token-ului. Logout și ștergerea contului invalidează sesiunile.
- Login: limită de 5 eșecuri pe IP+utilizator, apoi blocare 15 min; mesaj de eroare generic; întârziere fixă ~300 ms.
- CSRF: `SameSite=Strict` + toate cererile care modifică cer `Content-Type: application/json` și `Origin` egal cu host-ul.
- Antete pe tot: `Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` minimal, `Cross-Origin-Opener-Policy: same-origin`.
- Corp JSON maxim 16 KB; validare strictă a câmpurilor; fără căi construite din input (static servit doar din `dist/` cu `path.resolve` + verificare de prefix).
- WebSocket: doar cu sesiune validă (cookie la upgrade) și `Origin` corect; mesaje de cel mult 4 KB; maxim 30 de mesaje/s per conexiune; camere de cel mult 4 jucători.
- Procesul rulează ca utilizator non-root; nu are acces la nimic în afară de `/data` și `dist/`.

## API (JSON, prefix `/api`)
| Metodă și cale | Cine | Ce face |
|---|---|---|
| `GET health` | oricine | `{ ok: true, app: 'jocuri-familie' }` |
| `POST auth/login` `{username,password}` | oricine | setează cookie; `{ user }` |
| `POST auth/logout` | logat | șterge sesiunea |
| `GET me` | logat | `{ user: {id, username, displayName, avatar, color, role}, time: {...} }` |
| `GET admin/users` | admin | lista utilizatorilor + timpul folosit azi |
| `POST admin/users` `{username,password,displayName,avatar,color,role?,limits}` | admin | creează |
| `PATCH admin/users/:id` | admin | modifică nume, parolă, avatar, limite, `disabled` |
| `DELETE admin/users/:id` | admin | șterge (nu și ultimul admin) |
| `POST admin/users/:id/bonus` `{minutes}` | admin | minute în plus doar azi |
| `POST time/heartbeat` `{game}` | logat | numără timpul de joc; `{ time }` |
| `GET progress/:game` / `PUT progress/:game` `{data}` | logat | progresul propriu (JSON ≤ 64 KB); la PUT serverul face îmbinare pentru `bobo` (max pe nivel/steluțe) |
| `GET saves/:game` | logat | lista salvărilor proprii: `[{ slot, name, size, updatedAt }]` |
| `GET saves/:game/:slot` | logat | `{ slot, name, data, updatedAt }` (doar ale tale) |
| `PUT saves/:game/:slot` `{name, data}` | logat | `slot` 1–3, `game` `^[a-z]{2,16}$`, `name` ≤ 40 caractere, `data` = string base64 ≤ 1 MB (corp ≤ 1,5 MB doar pe această rută) |
| `DELETE saves/:game/:slot` | logat | șterge salvarea proprie |

`limits = { minutesPerDay: 0–600 | null (fără limită), from: 'HH:MM' | null, to: 'HH:MM' | null }`. Adminul nu are limite.

`time = { usedToday, minutesPerDay, bonusToday, remainingSec, allowedNow, reason: null | 'limit' | 'hours' | 'disabled' }`. Ziua se calculează în fusul `Europe/Bucharest`.

## Limita de timp
- Clientul trimite `heartbeat` la fiecare 30 s cât timp un joc e vizibil și pornit. Serverul adaugă cel mult 35 s per bătaie, față de bătaia anterioară a aceluiași utilizator (nu dublează pe mai multe dispozitive).
- Când `allowedNow` e fals, clientul oprește jocul și arată ecranul „Gata timpul de joc pe azi” (sau „Acum nu e ora de joc”). Serverul refuză intrarea în camere WebSocket pentru acel utilizator și închide camerele active cu motivul `time`.
- Dacă serverul nu răspunde, în modul NAS jocul se oprește după 2 bătăi ratate (nu se poate ocoli tăind rețeaua).

## WebSocket `/ws` (mesaje JSON `{t, ...}`)
- Client → server:
  - `{t:'create', game}` → `{t:'room', code, players, you}` (cod de 4 litere fără litere ambigue);
  - `{t:'join', code}`;
  - `{t:'leave'}`;
  - `{t:'msg', d}` (relay către ceilalți din cameră, cu `from`);
  - `{t:'to', id, d}` (către un singur jucător).
- Server → client:
  - `{t:'room', code, players:[{id, name, avatar, color, host}], you}` la orice schimbare;
  - `{t:'msg', from, d}`;
  - `{t:'closed', reason}`;
  - `{t:'error', code}`.
- Gazda e primul jucător; dacă pleacă, gazda devine următorul.

## Deploy
- `deploy/Dockerfile`: multi-stage (build web cu Vite → imagine `node:24-alpine` cu `dist/` + `server/`), `USER node`.
- `deploy/docker-compose.yml`:
  - `tailscale`: imaginea `tailscale/tailscale`, hostname `jocuri`, `TS_AUTHKEY` din `.env`, `TS_USERSPACE=true`, `TS_SERVE_CONFIG` → HTTPS 443 către `http://jocuri:8787`, stare în volum propriu; e singurul container prezent atât în rețeaua `egress` (internet), cât și în `intern`;
  - `jocuri`: doar în rețeaua Docker `intern` (`internal: true`: fără internet și fără LAN; `TRUST_PROXY=1` pentru X-Forwarded-* de la tailscale), `read_only: true`, `tmpfs: /tmp`, `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`, `user: 1000:1000`, limite de memorie și CPU, volum doar `./data:/data`, **fără porturi publicate**;
  - `watchtower`: urmărește doar containerul `jocuri` (după etichetă), verifică la 10 minute.
- ACL Tailscale: nodul `tag:jocuri` nu poate iniția conexiuni; membrii familiei au acces doar pe portul 443 al lui `tag:jocuri`.
