# Jocuri Familie pe NAS-ul Synology — ghid pas cu pas

Ghidul e scris pentru un părinte care nu a mai lucrat cu servere. Durează cam o oră, o singură dată.
La final, copiii deschid `https://jocuri.<tailnet>.ts.net` de pe tabletă sau telefon, se loghează cu contul
făcut de tine și au o limită zilnică de timp. Jocurile **nu** sunt pe internet: le văd doar dispozitivele
pe care le-ai pus tu în rețeaua ta privată Tailscale.

> În ghid, `<tailnet>` înseamnă numele rețelei tale Tailscale (ceva de forma `tail1234ab`). Îl vezi în
> consola Tailscale, la **DNS → Tailnet name**.

## Cum arată totul

```
Tableta copilului ──(Tailscale, criptat)──► container „tailscale” (HTTPS) ──► container „jocuri” (aplicația)
                                                  pe NAS                         rețea Docker închisă, date în ./data
```

- Pe NAS nu se deschide niciun port și nu se schimbă nimic în router.
- Containerul `jocuri` nu are acces la internet și nici la rețeaua de acasă (vezi „Ce face izolarea”).
- `watchtower` aduce singur versiunile noi ale jocurilor (verifică la 10 minute).

---

## 1. Tailscale (o singură dată)

Ai nevoie de un cont gratuit pe <https://tailscale.com> (planul Personal e suficient).
Toți pașii de mai jos se fac în **consola de administrare**: <https://login.tailscale.com/admin>.

### 1.1 Pornește MagicDNS și certificatele HTTPS

1. Mergi la **DNS**.
2. La **MagicDNS** apasă **Enable MagicDNS** (dacă nu e deja pornit).
3. Mai jos, la **HTTPS Certificates**, apasă **Enable HTTPS** și confirmă.
4. Notează **Tailnet name** (de ex. `tail1234ab.ts.net`). Adresa jocurilor va fi `https://jocuri.tail1234ab.ts.net`.

### 1.2 Lipește regulile de acces (ACL)

Regulile spun cine pe cine poate contacta. Cu ele:

- serverul de jocuri (`tag:jocuri`) **nu poate iniția nicio conexiune** către nimeni;
- dispozitivele copiilor (`tag:copii`) pot ajunge **doar** la jocuri, pe portul 443 (HTTPS);
- tu (și ceilalți membri ai contului) ajungeți la propriile dispozitive și la jocuri.

1. Mergi la **Access controls** (în unele versiuni: **Access controls → JSON editor**).
2. Șterge tot ce e în editor și lipește exact textul de mai jos.
3. Apasă **Save**. Secțiunea `tests` verifică automat izolarea; dacă o regulă ar fi greșită, salvarea e refuzată.

```json
{
  "tagOwners": {
    "tag:jocuri": ["autogroup:admin"],
    "tag:copii": ["autogroup:admin"]
  },
  "acls": [
    {
      "action": "accept",
      "src": ["autogroup:member"],
      "dst": ["autogroup:self:*"]
    },
    {
      "action": "accept",
      "src": ["autogroup:member", "tag:copii"],
      "dst": ["tag:jocuri:443"]
    }
  ],
  "tests": [
    {
      "src": "tag:copii",
      "accept": ["tag:jocuri:443"],
      "deny": ["tag:jocuri:22", "tag:jocuri:8787"]
    },
    {
      "src": "tag:jocuri",
      "deny": ["tag:copii:443", "tag:copii:22"]
    }
  ]
}
```

> Dacă aveai deja reguli proprii (alte servere, exit node etc.), nu le șterge: adaugă doar cele două
> intrări din `tagOwners`, a doua regulă din `acls` și testele. Important e să **nu existe nicio regulă**
> care are `tag:jocuri` la `src` și nici una de tipul `"dst": ["*:*"]` pentru `tag:copii`.

### 1.3 Creează cheia de autentificare pentru server

1. Mergi la **Settings → Keys** și apasă **Generate auth key…**
2. Setări:
   - **Reusable**: oprit;
   - **Expiration**: 7 zile (cheia trebuie doar pentru prima pornire);
   - **Ephemeral**: oprit;
   - **Tags**: pornit → alege `tag:jocuri`;
   - **Pre-approved**: pornit (dacă îl vezi).
3. Apasă **Generate key** și copiază cheia (începe cu `tskey-auth-`). O vei pune în fișierul `.env`.
   Nu o trimite nimănui; după prima pornire nu mai e folosită.

---

## 2. Imaginea Docker pe GitHub (o singură dată)

Imaginea se construiește automat la fiecare actualizare a codului și se publică în
`ghcr.io/kandreiconturi-medicalresources/jocuri-familie`. Ca NAS-ul să o poată descărca fără parolă,
pachetul trebuie să fie public (conține doar codul jocurilor, fără date sau parole).

1. Pe GitHub, deschide organizația **kandreiconturi-medicalresources** → tabul **Packages**.
2. Apasă pe pachetul **jocuri-familie** → în dreapta jos **Package settings**.
3. Jos, la **Danger Zone**, apasă **Change visibility** → **Public** → scrie numele pachetului ca să confirmi.

> Dacă butonul lipsește, organizația nu permite pachete publice: **Settings** (al organizației) →
> **Packages** → bifează **Public** la „Package creation”, apoi reia pașii.
> Pachetul apare abia după prima rulare reușită a acțiunii „Imagine Docker și release” (tabul **Actions**).

---

## 3. Synology DSM 7 (o singură dată)

### 3.1 Instalează Container Manager

**Centrul de pachete** → caută **Container Manager** → **Instalare**. Se creează automat folderul partajat `docker`.

### 3.2 Pregătește folderul proiectului

1. Deschide **File Station** → folderul `docker` → **Creare → Creare folder** → numele `jocuri`.
   Calea completă va fi `/volume1/docker/jocuri`.
2. Din repo-ul de pe GitHub, folderul `deploy/`, descarcă pe calculator:
   - `docker-compose.yml`
   - `serve.json`
   - `.env.example`
3. Pe calculator, redenumește `.env.example` în `.env` (Windows: în Notepad, „Salvare ca…”, tip „Toate
   fișierele”, nume `.env`). Deschide-l și completează:
   - `TS_AUTHKEY=` cheia de la pasul 1.3;
   - `ADMIN_USER=` numele tău de părinte (litere mici, cifre, `.`, `-`, `_`), de ex. `mama`;
   - `ADMIN_PASSWORD=` o parolă de **cel puțin 10 caractere**, doar a ta;
   - `TZ=Europe/Bucharest` (lasă-l așa).
4. Încarcă toate cele trei fișiere (`docker-compose.yml`, `serve.json`, `.env`) în `/docker/jocuri`.
   Dacă `.env` nu se vede în File Station: **Setări** (rotița) → bifează **Afișare fișiere ascunse**.

Folderul `data` se creează singur la prima pornire; acolo stau conturile, timpul și progresul.

### 3.3 Creează proiectul

1. **Container Manager** → **Proiect** → **Creare**.
2. **Nume proiect**: `jocuri`. **Cale**: alege `/docker/jocuri`.
3. **Sursă**: „Utilizați fișierul docker-compose.yml existent” (îl găsește singur).
4. **Următorul** → la „Setări portal web” nu bifa nimic → **Următorul** → **Terminat**.
5. Container Manager descarcă imaginile și pornește 4 containere: `tailscale`, `init-data` (rulează o
   dată și se oprește — e normal), `jocuri` și `watchtower`.

### 3.4 Verifică

1. În consola Tailscale, la **Machines**, apare `jocuri` cu eticheta `tag:jocuri`.
2. De pe calculatorul tău (care are Tailscale pornit) deschide `https://jocuri.<tailnet>.ts.net`.
   Prima deschidere poate dura până la un minut (se emite certificatul HTTPS).
3. Apare pagina „Jocuri Familie”: intră cu `ADMIN_USER` / `ADMIN_PASSWORD`.
4. După ce merge, deschide din nou `.env` și **șterge valoarea** `ADMIN_PASSWORD` (lasă `ADMIN_PASSWORD=`)
   și `TS_AUTHKEY`. Nu mai sunt necesare: adminul există deja, iar Tailscale și-a salvat identitatea.

Dacă ceva nu merge: **Container Manager → Container** → alege `jocuri-tailscale-1` sau `jocuri-jocuri-1`
→ **Detalii → Jurnal**. Cele mai dese cauze: cheie Tailscale expirată (fă alta), pachetul GHCR nu e public,
parola de admin are sub 10 caractere.

---

## 4. Dispozitivele copiilor

### 4.1 Instalează Tailscale pe tabletă / telefon

1. Instalează aplicația **Tailscale** din App Store / Google Play.
2. Deschide-o și loghează-te cu **contul tău** de Tailscale; acceptă configurarea VPN.
3. În consola Tailscale, la **Machines**, găsește dispozitivul nou → meniul **⋯** → **Edit ACL tags…**
   → adaugă `tag:copii` → **Save**.
   De acum dispozitivul nu mai e „al tău”: poate ajunge **doar** la jocuri, nu și la calculatoarele tale.
4. Pe dispozitiv, în aplicația Tailscale, comutatorul trebuie să fie pornit (**Connected**).
   Pe iPhone/iPad poți activa **VPN On Demand** din setările aplicației, ca să se conecteze singur.

### 4.2 Pune jocul pe ecranul principal

- **iPhone / iPad (Safari)**: deschide `https://jocuri.<tailnet>.ts.net` → butonul **Partajare** (pătratul
  cu săgeată) → **Adaugă pe ecranul principal** → **Adaugă**.
- **Android (Chrome)**: deschide adresa → meniul **⋮** → **Instalează aplicația** (sau **Adaugă pe ecranul
  de pornire**).

Copilul se loghează o dată; sesiunea ține 30 de zile și se prelungește cât timp se joacă.

---

## 5. Conturi și limite (Panou părinte)

1. Intră cu contul de părinte → în meniul principal apasă **👪 Panou părinte**.
2. **Adaugă** un copil: nume de utilizator (fără spații), parolă de cel puțin 4 caractere, numele afișat,
   avatar și culoare.
3. **Limite**:
   - minute pe zi (0–600; gol = fără limită);
   - interval orar, de ex. 16:00–19:30 (opțional; se poate și peste miezul nopții).
   Ziua se socotește după ora României și se resetează la miezul nopții.
4. **+15 min azi**: minute în plus doar pentru ziua de azi.
5. **Cont dezactivat**: copilul nu se mai poate loga, iar dacă e logat, jocul se oprește.
6. Schimbarea parolei unui copil îl delogează de pe toate dispozitivele.

Un al doilea părinte poate primi cont de admin (bifa „Părinte”, parolă de minim 10 caractere).
Nu există înregistrare publică: conturile le faci doar tu.

---

## 6. Backup

Tot ce contează e în `/volume1/docker/jocuri/data` (fișierele `jocuri.db`, `jocuri.db-wal`, `jocuri.db-shm`)
plus fișierele `.env`, `docker-compose.yml`, `serve.json`.

**Varianta simplă (recomandată): Hyper Backup**

1. **Centrul de pachete** → instalează **Hyper Backup**.
2. **Creare → Sarcină de backup a datelor** → alege destinația (disc USB, alt NAS sau cloud).
3. Bifează folderul `docker/jocuri`.
4. Programează backup-ul noaptea (de ex. 03:00), când nu se joacă nimeni.

**Backup manual**: **Container Manager → Proiect → jocuri → Oprire**, copiază folderul `data` în altă parte,
apoi **Pornire**.

**Restaurare**: oprește proiectul, înlocuiește conținutul folderului `data` cu cel din backup, pornește
proiectul (containerul `init-data` repară singur drepturile fișierelor).

---

## 7. Actualizări

- Versiunile noi ale jocurilor ajung singure: `watchtower` verifică la 10 minute și repornește doar
  containerul `jocuri`. Datele din `data/` rămân.
- Imaginile `tailscale` și `watchtower` nu se actualizează singure. O dată la câteva luni deschide
  **Container Manager → Imagine**; la cele marcate „Actualizare disponibilă” apasă **Actualizare**.
- Ține DSM-ul la zi (**Panou de control → Actualizare și restaurare**).

---

## 8. Ce face și ce nu face izolarea

**Ce face**

- Jocurile nu sunt pe internet: niciun port deschis pe NAS sau în router, Funnel e oprit în `serve.json`.
  Ajung la ele doar dispozitivele din rețeaua ta Tailscale cărora le permit regulile (`tag:copii` și
  membrii contului), și doar pe HTTPS (443).
- Serverul de jocuri (`tag:jocuri`) nu poate deschide conexiuni către niciun dispozitiv din Tailscale.
- Containerul aplicației e într-o rețea Docker **internă**: nu poate ieși pe internet și nu poate ajunge la
  calculatoarele, telefoanele sau routerul din casă. Singurul vecin e containerul `tailscale`, care nu
  oferă proxy spre exterior.
- Aplicația rulează ca utilizator obișnuit (1000), fără nicio capabilitate Linux, cu sistemul de fișiere
  doar-citire; poate scrie numai în `data/` și într-un `/tmp` mic. Are limite de memorie, CPU și procese.
- Totul cere login (conturi făcute doar de admin), parolele sunt stocate cu scrypt, după 5 parole greșite
  contul e blocat 15 minute pentru acel dispozitiv, sesiunile sunt cookie-uri `HttpOnly; Secure; SameSite=Strict`.
- Un dispozitiv al copilului, chiar dacă ar fi compromis, vede din rețeaua ta doar pagina de jocuri.

**Ce NU face**

- Nu protejează datele **din** aplicație: cine ar sparge aplicația ar putea citi sau schimba conturile,
  timpul și progresul (parolele rămân totuși protejate de scrypt). Folosește pentru copii parole care nu
  sunt folosite și în altă parte.
- NAS-ul însuși rămâne accesibil din rețelele Docker la adresa „porții” rețelei (de ex. `172.x.x.1`), pe
  porturile pe care DSM ascultă pe toate interfețele (5000/5001, SSH dacă e pornit). Apără-l cu: parolă
  puternică pentru contul de administrator DSM, **verificare în 2 pași** pentru el, SSH oprit când nu-l
  folosești, DSM actualizat.
- Containerul `tailscale` are acces la internet (îi trebuie ca să funcționeze), iar `watchtower` are acces
  la Docker pe NAS (îi trebuie ca să actualizeze). Niciunul nu e accesibil din rețea sau din aplicație.
- Nu există verificare în 2 pași la login-ul jocurilor (e o platformă pentru copii).
- Nu oprește pe cineva care are fizic tableta deblocată a copilului: ține-o cu cod de blocare.
- Limita de timp e calculată pe server, dar contorul pornește doar când jocul trimite „bătăi” (la 30 s).
  Un copil nu o poate ocoli tăind internetul (jocul se oprește după 2 bătăi ratate), dar o versiune
  modificată a jocului, scrisă special, ar putea-o ocoli; camerele multiplayer sunt oricum refuzate
  când timpul s-a terminat.
- Nu modifica `docker-compose.yml` adăugând `ports:`, `network_mode: host`, `privileged: true` sau rețele
  noi pentru `jocuri`: fiecare dintre acestea strică izolarea.
