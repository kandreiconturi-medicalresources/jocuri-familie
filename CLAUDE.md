# Jocuri Familie — hartă rapidă

Colecție de jocuri web (PWA) pentru familie: merge pe iPhone SE 1 / iPad 5 (Safari 15), Android, PC.
Citește întâi fișierul relevant de mai jos, nu tot repo-ul.

| Unde | Ce e |
|---|---|
| `docs/ROADMAP.md` | faze + ce e gata (actualizează la final de fază) |
| `docs/ARCHITECTURE.md` | contractul modulelor comune + reguli tehnice |
| `index.html`, `hub/` | meniul principal: profil → alegi jocul |
| `shared/engine/` | buclă, input, audio, ecran, salvări, profiluri, rng, perf, particule |
| `shared/ui/` | temă CSS, butoane tactile, helperi DOM |
| `shared/net/` | client rețea (Faza 2) |
| `games/<joc>/` | câte un folder per joc, cu propriul `index.html` (detectat automat de Vite) |
| `server/` | server Node pentru NAS (Faza 2) |
| `deploy/` | Docker + compose Synology/Tailscale |
| `tools/` | scripturi (iconițe, import asset-uri) |
| `tests/` | `npm test` (node:test) |
| `Bob - ca si Mario nintendo/` | originalul, doar referință, ignorat de git |

## Comenzi
- `npm run dev` · `npm run build` · `npm test` · `npm run icons`

## Reguli
- Un fișier = un rol, ideal < 300 rânduri. Folosește modulele din `shared/` în loc să le rescrii.
- Fizică la pas fix 60 Hz; nimic mai nou decât Safari 15.
- Grafică: Bobo și Mimi desenați în cod; restul din pachete CC0 kenney.nl (descărcări doar cu acordul utilizatorului).
- Nume, personaje și grafică originale (fără mărci: Mario, Bomberman, Monopoly, Asphalt etc.).
- Text pentru jucători în română.
