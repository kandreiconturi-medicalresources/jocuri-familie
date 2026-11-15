# Roadmap

Plan complet aprobat: faze făcute pe rând, testate pe telefon după fiecare.

- [x] **Faza 0 – Fundație:** repo, Vite + PWA, `shared/engine`, hub cu profiluri locale, Bobo original ca prim joc, GitHub Pages.
- [x] **Faza 1 – Bobo refăcut:** grafică nouă, 10 lumi × 15 niveluri, generator + validator, vieți nelimitate, steluțe, hartă.
- [ ] **Faza 2 – Server și NAS:** server Node (camere WebSocket, conturi, progres), Docker, Synology + Tailscale + Watchtower, release automat, Bobo co-op online.
- [ ] **Faza 3 – Bum-Bum Arena:** arenă cu bombe 2–4 jucători, local + rețea, boți.
- [ ] **Faza 4 – Turbo Curse:** curse 3D low-poly (Three.js), nitro, drift, piste, boți, rețea.
- [ ] **Faza 5 – Orășelul:** joc de tablă cu proprietăți, 2–6 jucători, pe o tabletă sau în rețea, boți.

## Cerințe Faza 2 (de la utilizator)
- Platforma pe NAS e accesibilă **doar cu login** (fără 2FA). Conturile le creează doar adminul (părintele); fără înregistrare publică.
- **Limită de timp per utilizator**, setată de admin (ex. minute pe zi), aplicată de server pe toate jocurile.
- **Izolare:** dacă site-ul e spart, să nu se ajungă la NAS sau în rețea:
  - container fără privilegii, utilizator non-root, sistem de fișiere read-only, fără `docker.sock`, doar un volum de date propriu;
  - rețea Docker separată, iar nodul Tailscale al jocului e restricționat prin ACL (fără acces la NAS sau la alte dispozitive);
  - parole hash-uite (scrypt), sesiuni httpOnly, limită de încercări la login, antete de securitate.
- **De decis:** linkul public de pe GitHub Pages nu poate cere login (n-are server). Când merge NAS-ul, îl oprim sau lăsăm doar o versiune demo.

## Note
- Modele: Opus pentru arhitectură/protocol, Sonnet pentru jocuri, Haiku pentru sarcini mecanice.
