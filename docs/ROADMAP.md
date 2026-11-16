# Roadmap

Plan complet aprobat: faze făcute pe rând, testate pe telefon după fiecare.

- [x] **Faza 0 – Fundație:** repo, Vite + PWA, `shared/engine`, hub cu profiluri locale, Bobo original ca prim joc, GitHub Pages.
- [x] **Faza 1 – Bobo refăcut:** grafică nouă, 10 lumi × 15 niveluri, generator + validator, vieți nelimitate, steluțe, hartă.
- [x] **Faza 2 – Server și NAS:** server Node (camere WebSocket, conturi, progres), Docker, Synology + Tailscale + Watchtower, release automat, Bobo co-op online.
- [x] **Faza 3 – Bum-Bum Arena:** arenă cu bombe 2–4 jucători, local + rețea, boți.
- [x] **Faza 4 – Turbo Curse:** curse 3D low-poly (Three.js), nitro, drift, 8 piste, boți, ecran împărțit, rețea (de verificat pe dispozitive reale și cu serverul).
- [x] **Faza 4b – Bum-Bum mai bogat:** șut, multe bombe, aruncare, telecomandă, linie de bombe, bonus negativ, rețea verificată cu serverul.
- [x] **Faza 6 – Joc de strategie cu trenuri și orașe** (gen tycoon feroviar, original; înainte de Orășelul): construiești căi ferate, gări și trenuri, transporți pasageri și mărfuri, orașele cresc, economie cu concurenți, multiplayer pe PC/telefon/tabletă. Contract: `games/trenuri/README.md`. Etape: [x] 6.1 fundația jucabilă · [x] 6.2 economie și creștere · [x] 6.3 scenarii și ajutor · [x] 6.4 multiplayer + salvări pe NAS · [x] 6.5 mod expert.
- [ ] **Faza 7 – Orașe pe Șine: Insulele:** fiecare jucător/AI cu insula lui și resurse lipsă, port + depozit + vapoare, comerț pe bani sau pe marfă, poduri lungi, bancă, proprietăți la vecini, echipe, meniu pe clic dreapta, 2D/3D, telefoane răcoroase; terminal mare cu linii, service și macara. Etape: [x] 7.0 schimbă vagoanele · [ ] 7.0b terminal mare · [ ] 7.1 insule · [ ] 7.2 port și vapoare · [ ] 7.3 poduri lungi · [ ] 7.4 bancă și proprietăți · [ ] 7.5 echipe și AI pe mare · [ ] 7.6 clic dreapta · [ ] 7.7 2D/3D · [ ] 7.8 telefoane răcoroase.
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
