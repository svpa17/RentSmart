# RĂSCRUCE AI: Plan final de implementare MVP

> **Know before you commit.** „Îți arătăm cât te costă de fapt un apartament, înainte să semnezi.”
> Extensie Chrome (Manifest V3) + dashboard ca pagină a extensiei · React + Vite + Tailwind + JavaScript · un backend serverless pentru AI · fără conturi, fără bază de date.
> **Regula de bază:** motorul face toate calculele; AI-ul doar transformă textul anunțului în date structurate și validate.

**Versiune:** finală, pentru **un singur dezvoltator** (asistat de agenți AI).
**Ramura de lucru:** `feat/rascruce-foundation` (din `main`). Commit și push doar după revizuire.

---

## 0. Stadiul actual

| Etapă | Stare |
|---|---|
| Contracte de date + validare (`extension/src/shared/contracts/`) | ✅ Gata |
| Scenariu demo fictiv unic (`contracts/fixtures/demoScenario.js`) | ✅ Gata |
| Motor: conversie EUR/RON, True Cost, simulare 1–60 luni, furtuni, avertizare buget | ✅ Gata |
| Teste de bază: 40 de teste, toate trec | ✅ Gata |
| Path to Yes (calculul) | ⏳ Urmează (contractul și validatorul există) |
| Extensia, backend-ul AI, interfața, Crossroads, pagina demo | ⏳ Urmează |

Rularea testelor:

```bash
node --test "extension/src/shared/**/*.test.js"
```

---

## 1. Produsul

**Problema:** un tânăr care își caută prima chirie pe OLX sau Storia vede prețul, dar adesea nu are toate informațiile pentru a înțelege costul real și riscurile: întreținerea iarna, garanția, comisionul, durata contractului, reparațiile și cât îi rămâne pentru situații neprevăzute.

**Soluția:** o extensie Chrome care analizează anunțul chiar în momentul deciziei, arată ce lipsește, generează întrebările pentru proprietar, calculează costul real și simulează impactul asupra economiilor.

### Cele 7 funcționalități obligatorii ale MVP-ului
1. **Financial Passport:** profilul financiar personal, salvat doar local.
2. **AI Listing Detective:** analiza anunțului; fiecare informație este „Găsit”, „Neclar” sau „De întrebat”.
3. **Smart Questions:** întrebările și mesajul pentru proprietar.
4. **True Cost Analyzer:** costul real lunar și costurile inițiale, cu sursa fiecărei sume.
5. **Crossroads Simulator:** vizualizarea interactivă a evoluției banilor pe 1–60 de luni, funcționalitatea-semnătură.
6. **Financial Storms:** pierderea venitului, o cheltuială neprevăzută, creșterea chiriei.
7. **Path to Yes:** opțiuni calculate de motor pentru ca decizia să devină sustenabilă.

### Domeniul comparației
RĂSCRUCE compară **doar anunțurile salvate de utilizator**, nu toate ofertele de pe piață.
- Formulări permise: „Dintre anunțurile tale salvate, B are cel mai mic cost total estimat”, „A depășește bugetul tău”.
- Interzise: „cea mai bună ofertă de pe piață”, „A e prea scump față de piață”.
- Orice afirmație despre o variantă mai bună trebuie susținută de datele din anunțurile salvate și din Passport.

### Diferența față de un chatbot
RĂSCRUCE intervine lângă anunț, în momentul deciziei. Utilizatorul nu copiază anunțul într-un chat și nu reface calculele. Datele lui financiare nu părăsesc browserul, iar cifrele vin dintr-un motor determinist, nu dintr-un model de limbaj.

---

## 2. Principii
1. **Calculele le face doar motorul** (`shared/engine`): JavaScript pur, determinist, RON întregi, testat. Prompturile nu cer niciodată calcule.
2. **La AI pleacă doar textul anunțului** (cu telefoanele și e-mailurile ascunse). Passport-ul și calculele rămân în browser.
3. **Dovadă pentru fiecare „Găsit”:** AI-ul returnează fragmentul exact din anunț, iar codul verifică că fragmentul există în text; altfel câmpul devine „De întrebat” (`enforceEvidence`, deja implementat).
4. **Întrebările vin dintr-o bancă de întrebări scrisă de om.** AI-ul doar formulează mesajul, iar dacă nu răspunde se folosește un șablon.
5. **„Nu știm, întreabă proprietarul”** în loc de valori inventate.
6. **Modul demo** funcționează fără internet și fiecare rezultat e etichetat „DATE DEMONSTRATIVE”.
7. **Permisiuni minime:** `activeTab`, `scripting`, `sidePanel`, `storage`. Cheia API stă doar pe server.

---

## 3. Arhitectura

```
[Pagina anunțului: OLX / Storia / orice site / localhost]
        │ click pe iconița extensiei (activeTab)
        ▼
[content/readPage.js] ── text + date structurate ──► [Panou lateral (React)]
                                                         │ doar textul anunțului (telefoane/e-mailuri ascunse)
                                                         ▼
                                             [Backend: POST /api/analyze]
                                                         │ cheia API stă doar aici
                                                         ▼
                                                    [Furnizor AI]
Panou lateral / Dashboard ◄── chrome.storage.local (Passport, anunțuri, setări, curs EUR)
        │
        └──► [shared/engine]: calcule locale, deterministe ──► True Cost · Crossroads · Path to Yes
```

**Permisiuni** (`manifest.json`): `activeTab`, `scripting`, `sidePanel`, `storage`, plus `host_permissions` doar pentru domeniul backend-ului.

---

## 4. Citirea anunțurilor reale (funcționalitate principală)

La click, `readPage.js` se injectează prin `chrome.scripting.executeScript` în tab-ul activ. Funcționează pe orice pagină `http/https`, inclusiv OLX, Storia și `localhost`.

**Ce extragem, în ordine:**
1. **Date structurate**, dacă există: `script[type="application/ld+json"]`, `og:title`, `og:description`, `og:price`.
2. **Adaptoare ușoare pentru OLX și Storia** (titlu, preț, descriere, caracteristici). Sunt opționale: dacă selectorii nu mai funcționează, se trece automat la pasul 3.
3. **Varianta generică:** `innerText` din `main`/`article`/`body`, curățat, limitat la 15.000 de caractere.

**Anunțurile incomplete nu se resping:**
- Analiza continuă cu ce există; prețul sau orice alt câmp lipsă devine „De întrebat” și generează întrebarea corespunzătoare.
- Sub 300 de caractere citite: analiza rulează oricum, cu sugestia „Deschide descrierea completă («Vezi mai mult»), lipește textul sau completează manual câmpurile”.
- Pagini unde injectarea nu e permisă (`chrome://`, Chrome Web Store, PDF): se deschide direct formularul de text lipit.
- Textul lipit manual și completarea manuală a câmpurilor sunt disponibile oricând.
- Redactare locală: telefoanele și e-mailurile devin `[TELEFON]` / `[EMAIL]` înainte de trimiterea la AI.

**Criteriu de gata:** extragere corectă pe minimum 5 anunțuri reale OLX, 5 reale Storia și pe pagina fictivă de pe localhost.

---

## 5. Modelul financiar

### 5.1 Datele de intrare

**Financial Passport** (`FinancialPassport`, RON întregi ≥ 0):

| Simbol | Câmp | Observație |
|---|---|---|
| `V` | `venitNetLunar` | Suma care intră efectiv în cont; nu calculăm taxe |
| `E` | `cheltuieliEsentialeLunare` | **Fără** locuință și **fără** transport |
| `H0` | `costLocuintaActuala` | De exemplu contribuția la părinți; poate fi 0 |
| `T0` | `transportActualLunar` | |
| `S0` | `economiiDisponibile` | Bani lichizi |
| `Rmin` | `rezervaMinima` | Pragul de siguranță; implicit 0 |
| `Bmax` | `bugetMaximChirie` | Limită personală, separată de `Rmin`, folosită doar pentru avertizări; 0 = nesetat |
| `m` | `lunaMutarii` | Câte luni de acum: 0 = luna aceasta, maximum 60 |
| | `obiectiv` | Text liber, opțional |

**Setări ale simulării** (separate de Passport):
- `luni` (N): întreg 1–60.
- `lunaStart`: luna calendaristică de start (1–12), transmisă motorului pentru sezonalitate.

**Curs de schimb** (`ExchangeRate`): `{ eurToRon > 0, sursa: 'bnr' | 'utilizator' | 'demo', actualizatLa, dataPublicarii? }`.
- **Cursul BNR automat** (decizie ulterioară a utilizatorului, după înghețare): extensia descarcă cursul EUR de pe `https://www.cursbnr.ro/api/v1/rates?currency=EUR` și îl păstrează în `chrome.storage.local` cu data publicării. Se reîmprospătează când BNR ar fi publicat unul mai nou (zilele lucrătoare, după 13:30 ora Bucureștiului; minimum 30 min între încercări). La eșec se păstrează ultimul curs valid, marcat „posibil depășit”. Cursul introdus de utilizator are prioritate și nu e înlocuit automat. Modul demonstrativ nu face cererea.
- **Nu există curs implicit (scris în cod).** Fără curs descărcat sau introdus, regula de mai jos rămâne.
- Fără curs valid, un anunț cu sume în EUR devine „incomplet” (`CURS_LIPSA`) și nu se calculează.
- Conversia: `RON = round(EUR × eurToRon)`. Suma originală în EUR se păstrează lângă cea convertită.

**Costurile unui apartament** (din anunț, confirmări, estimări sau introduse de utilizator):

| Simbol | Cost | Tip |
|---|---|---|
| `R` | Chiria lunară | lunar; **nu se estimează niciodată** |
| `Uv`, `Ui` | Întreținere + utilități, vara / iarna | lunar |
| `I` | Alte costuri lunare (internet etc.), `alteCosturiLunareRON` | lunar, de la utilizator |
| `Tx` | Transport de la această adresă, `transportLunarRON` | lunar, de la utilizator |
| `G` | Garanția (sumă sau număr de chirii) | **recuperabilă**, o dată la mutare |
| `C` | Comisionul (sumă sau procent din chirie) | **definitiv**, o dată la mutare |
| `M` | Costuri de mutare și dotare, `costuriMutareRON` | **definitiv**, o dată, de la utilizator |

### 5.2 Reguli pentru costuri (True Cost)
- Valorile utilizabile au statusul `gasit`, `confirmat` sau `presupus`. Valorile `neclar` și `lipsa` apar ca „De întrebat”.
- **Chiria lipsă:** apartamentul este marcat „incomplet” (`CHIRIE_LIPSA`). True Cost și Crossroads cer o valoare de la utilizator, confirmată sau presupusă și marcată ca atare. Restul analizei rămâne disponibil.
- **Utilități:**
  - valorile explicite au prioritate;
  - o singură valoare cunoscută se folosește pentru ambele sezoane;
  - fără valori și cu „utilități incluse” = da → 0, sursa „inclus în chirie”;
  - altfel → capătul prudent (maxim) din intervalul de referință, sursa „estimare”.
- **Garanția necunoscută:** capătul prudent din intervalul de referință, marcat „estimare”, cu intervalul afișat.
- **Comisionul de agenție nepomenit în anunț** (decizie ulterioară a utilizatorului): exact 50% din chiria lunară (`DEFAULT_COMMISSION_PERCENT`), fără interval, marcat „Comision agenție · estimat la 50% din chirie”. Procentul, suma (RON/EUR) sau 0% din anunț au prioritate. Se plătește o singură dată, la mutare.
- **Transport necompletat:** presupus egal cu transportul actual (`T0`), marcat „presupus”.
- **Alte costuri și costuri de mutare necompletate:** 0, cu notă.

### 5.3 Reguli contra dublei numărări
- Fiecare cost aparține unei singure categorii; `E` exclude prin definiție locuința și transportul.
- **Înainte de mutare** se folosesc `H0 + T0`; **după mutare** doar `R + U + I + Tx`. Cele două seturi nu se adună niciodată.
- **Prima chirie** se plătește în luna mutării ca orice chirie lunară, nu ca o cheltuială inițială separată.
- Utilitățile incluse în chirie au valoarea 0, nu o estimare.
- Furtunile modifică o singură variabilă (venitul, chiria sau o cheltuială punctuală).

### 5.4 Formulele (luna `t = 0 … N−1`)
- Luna calendaristică: `((lunaStart − 1 + t) mod 12) + 1`. **Iarnă = noiembrie–martie**, vară = restul.
- Venitul: `V(t) = V − round(V × p(t)/100)`, unde `p(t)` este suma procentelor de pierdere active, maximum 100.
- Chiria: `R(t) = round(R × (1 + q(t)/100))`, unde `q(t)` este suma creșterilor cu `start ≤ t`, aplicată doar după mutare.
- Costul lunar al locuinței după mutare: `HX(t) = R(t) + U(t) + I + Tx`.
- Fluxul lunar:
  - `t < m`: `F(t) = V(t) − E − H0 − T0 − Sp(t)`
  - `t = m`: `F(t) = V(t) − E − HX(t) − G − C − M − Sp(t)`
  - `t > m`: `F(t) = V(t) − E − HX(t) − Sp(t)`

  unde `Sp(t)` sunt cheltuielile neprevăzute din furtuni.
- **Bani disponibili:** `S(t) = S(t−1) + F(t)`, cu `S(−1) = S0`.
- **Garanția blocată:** `B(t) = G` pentru `t ≥ m`. **Nu se adaugă la `S`.**
- **Avere totală** (informativ): `W(t) = S(t) + B(t)`.
- **Economii acumulate până la mutare:** `S(min(m, N) − 1) − S0`; 0 dacă `m = 0`.
- **Indicatori pe fiecare drum:** soldul minim și luna lui, prima lună cu `S < 0`, prima lună cu `S < Rmin`, prima lună cu chiria peste buget, soldul final, rezerva în luni `S(t) / (E + costul locuinței)` și „sigur” (`S(t) ≥ max(0, Rmin)` în toate lunile).
- **Depășirea bugetului:** dacă `R(t) > Bmax`, apare avertizarea „Chiria (X RON) depășește bugetul tău maxim (Y RON) cu Z RON”, pe cardul anunțului, în True Cost și în Crossroads, inclusiv din luna în care o furtună crește chiria peste buget. Nu modifică formulele.
- Dacă `m ≥ N`: se simulează doar perioada dinaintea mutării, cu mesajul „Mutarea are loc după perioada simulată; mărește perioada.”

### 5.5 Ipoteze (afișate în interfață)
- Costurile sunt constante, cu excepția sezonului și a furtunilor; nu modelăm inflația.
- Garanția nu se recuperează în perioada simulată (ipoteză prudentă).
- Costurile necunoscute folosesc capătul prudent al intervalului de referință și sunt marcate „estimare”.
- Sumele în EUR sunt convertite în RON cu cursul BNR afișat (sau cu cursul introdus de utilizator).
- Toate sumele sunt RON întregi; furtunile se aplică identic pe toate drumurile.
- Prima chirie se plătește în luna mutării, ca orice chirie lunară.
- Peste 12 luni: „După 12 luni estimările devin mai incerte.”

### 5.6 Financial Storms
- `pierdereVenit { id, start, durata, procent }`
- `cheltuialaNeprevazuta { id, luna, suma }`
- `crestereChirie { id, start, procent }`
- **Text liber prin AI:** AI-ul doar clasifică tipul, luna și durata. Sumele vin din formular, local, iar numerele din textul trimis sunt mascate (`[SUMĂ]`).

### 5.7 Path to Yes (calcul determinist; următoarea etapă de implementat)
**Obiectiv:** `S(t) ≥ max(0, Rmin)` în toate lunile verificate. Fiecare opțiune se calculează rulând același motor:
1. **Amânarea mutării:** cel mai mic `m' > m` pentru care obiectivul e îndeplinit **și după noua dată a mutării**.
   - Fiecare candidat se verifică pe orizontul `m' + P`, unde `P = max(N − m, 12)`: aceeași durată de după mutare pe care utilizatorul voia s-o vadă, minimum 12 luni.
   - Se caută doar `m'` cu `m' + P ≤ 60`.
   - **O dată de mutare a cărei perioadă de după mutare nu a fost simulată nu este niciodată considerată sigură.**
   - Dacă `m' + P > N`, Crossroads extinde drumul „Planul” până la `m' + P` și afișează „verificat pe P luni după mutare”.
2. **Rezervă inițială suplimentară:** `deficit = max_t(max(0, Rmin) − S(t))`, adică „îți mai trebuie X RON înainte de mutare”.
3. **Alt apartament dintre cele salvate de utilizator** care îndeplinește obiectivul („Dintre anunțurile tale salvate…”).
4. **Reducerea cheltuielilor:** cel mai mic `d` (căutare binară între 0 și `E`) care îndeplinește obiectivul, marcat „doar dacă e realist”.

Dacă nicio opțiune nu funcționează în limite, se afișează cea mai apropiată variantă, cu un mesaj onest. Nu inventăm soluții. Structura rezultatului este contractul `PathToYes`.

---

## 6. Informațiile confirmate de proprietar
- Orice câmp al anunțului se poate edita în panou și în dashboard. Se salvează cu statusul `confirmat` (răspunsul proprietarului) sau `presupus` (presupunerea utilizatorului) și cu data actualizării.
- Câmpurile „De întrebat” au un formular rapid: „Ce ți-a răspuns proprietarul?”
- **Recalculare automată:** True Cost, Crossroads și Path to Yes sunt valori derivate din `{passport, anunțuri, setări, curs, furtuni}` și nu se salvează. Orice modificare declanșează recalcularea.
- Panoul lateral și dashboard-ul se sincronizează prin `chrome.storage.onChanged`.

---

## 7. Crossroads Simulator (funcționalitate centrală)
- Două drumuri (A și B), desenate exclusiv din `SimulationResult`. Nimic hardcodat.
- **Perioadă:** butoane rapide 3 / 6 / 12 / 18 / 24 luni + câmp numeric 1–60 (validat: întreg între 1 și 60).
- **Luna mutării** marcată pe ambele drumuri („Mutare”), cu costurile inițiale.
- Marcajele de lună se adaptează: lunar până la 12, din 3 în 3 până la 24, din 6 în 6 peste 24.
- **Sub zero:** zonă roșie, marcajul „Luna X: banii disponibili devin negativi” și soldul minim. Sub rezerva minimă: avertizare galbenă.
- Garanția blocată apare ca bandă discretă, separată de banii disponibili.
- Avertizarea de buget apare din luna în care chiria trece de buget.
- **Path to Yes evidențiat:** linie punctată „Planul” plus cardul cu opțiunile.
- Tooltip pe fiecare lună: sold, costuri, furtuni active.
- Actualizare instantanee la schimbarea perioadei, a lunii mutării, a apartamentului, a Passport-ului, a confirmărilor, a cursului sau a furtunilor.
- Design modern și interactiv; animațiile avansate sunt opționale.

---

## 8. Integrarea AI reală (backend securizat)

**Furnizor:** o interfață-adaptor în `api/providers/`, schimbabilă din variabile de mediu. Implementarea inițială este Anthropic API, cu un adaptor compatibil OpenAI ca alternativă.
- **Abonamentele Claude Pro / OpenCode Go nu includ credite API.** Contul API se creează și se plătește separat.
- **Modelul nu este hardcodat.** `AI_MODEL` primește un identificator verificat ca disponibil în contul API folosit. Codul nu are valoare implicită.
- **Verificare la pornire:** `GET /api/health` verifică cheia și modelul (`MODEL_UNAVAILABLE` / `AUTH_ERROR`). Se rulează după fiecare deploy și la deschiderea extensiei. Dacă eșuează, extensia afișează „Analiza AI nu este configurată” și trece la modul manual.

**Backend:** funcții serverless (Vercel), `POST /api/analyze` și `GET /api/health`, publicate cu `vercel deploy --prod`. URL-ul de producție se trece în configurația extensiei; el nu este secret.

**Variabile de mediu** (doar în setările Vercel; în repository există numai `.env.example`, iar `.env` e ignorat):
- `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` (fără valoare implicită), `AI_MAX_OUTPUT_TOKENS`
- `ALLOWED_ORIGINS=chrome-extension://<ID_EXTENSIE>,http://localhost:5174`
- `MAX_INPUT_CHARS=15000`, `AI_TIMEOUT_MS=20000`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `RATE_LIMIT_PER_MINUTE_IP`, `RATE_LIMIT_PER_DAY_INSTALL`, `GLOBAL_DAILY_REQUEST_CAP`

**Protecția backend-ului public.** **CORS nu este autentificare și nu protejează împotriva abuzului.** Protecția reală are mai multe straturi:
- cheia nu ajunge niciodată în extensie;
- **rate limiting persistent** (de ex. `@upstash/ratelimit` cu Redis), pe trei niveluri: per IP, per instalare (ID anonim generat la instalare, trimis în antet) și un **plafon global zilnic**; la depășire răspunde `RATE_LIMITED`, iar extensia trece la modul manual;
- **limită de cheltuieli** în consola furnizorului AI, obligatorie înainte de primul deploy public;
- costul pe cerere e plafonat: `MAX_INPUT_CHARS` la intrare, `AI_MAX_OUTPUT_TOKENS` la ieșire;
- CORS rămâne doar un filtru suplimentar pentru browsere.

**Sarcini acceptate** (`task`):
- `extract`: textul anunțului → `ListingAnalysis`;
- `message`: lista câmpurilor lipsă → mesaj politicos pentru proprietar, fără date personale;
- `storm`: textul scenariului, cu sumele mascate → `{tip, start, durata}`.

**Validare în trei straturi:**
1. Cererea, pe server: `task` permis, text, lungime maximă.
2. Răspunsul AI, pe server: ieșire structurată (JSON schema / tool use) + validare.
3. Pe client: `validateListingAnalysis` + `enforceEvidence` (ambele implementate).

**Erori:**
- Coduri tipizate: `AI_UNAVAILABLE`, `TIMEOUT`, `RATE_LIMITED`, `INVALID_RESPONSE`, `INPUT_TOO_LONG`, `MODEL_UNAVAILABLE`, `AUTH_ERROR`.
- O singură reîncercare, cu pauză, la 429/5xx.
- Dacă AI-ul tot nu răspunde: formular manual cu toate câmpurile „De întrebat”, întrebări din șablon și mesajul „Analiza AI nu este disponibilă acum. Poți completa manual.”
- Serverul nu salvează textul anunțurilor; jurnalele conțin doar tipul sarcinii, durata și codul de eroare.

---

## 9. Confidențialitate
- Financial Passport, anunțurile salvate, cursul și setările stau **doar** în `chrome.storage.local`.
- La AI pleacă doar:
  - textul anunțului, cu telefoanele și e-mailurile ascunse;
  - lista câmpurilor lipsă;
  - textul scenariului de furtună, cu sumele mascate.
- **Niciodată** venitul, economiile, cheltuielile sau alte date din Passport.
- **La prima utilizare,** un ecran explică ce se trimite și ce rămâne local, cu acord explicit (o bifă) înainte de prima analiză AI. Fără acord funcționează doar modul manual.
- Câmpurile de text liber afișează „Nu include date personale; sumele sunt eliminate automat înainte de trimitere.”
- Butonul „Șterge toate datele” golește `chrome.storage.local`.

---

## 10. Configurarea demonstrației
- `demo-site/` este servit pe **`http://localhost:5174`** (`npm run demo-site`), nu prin `file://`. Conține anunțurile fictive A și B, cu design propriu, fără imitarea OLX/Storia.
- **Modul demonstrativ** (comutator în setări):
  - răspunsuri AI înregistrate anterior;
  - nicio cerere de rețea;
  - eticheta vizibilă **„DATE DEMONSTRATIVE”** pe fiecare rezultat.
- **În ziua prezentării:** demo principal pe localhost; analiză live pe un anunț real OLX/Storia, cu modul demo ca rezervă și un video de rezervă.

### Scenariul demo fictiv (deja implementat)
Persoana fictivă:
- venit net 5.200 RON, cheltuieli esențiale 1.500 RON;
- locuința actuală 400 RON, transport 150 RON;
- economii 6.000 RON, rezervă minimă 1.000 RON, buget chirie 2.000 RON;
- mutare peste 2 luni; simulare pe 12 luni din ianuarie; curs fictiv 1 EUR = 5 RON.

| | A · Garsonieră Mănăștur (1978) | B · 2 camere Gheorgheni (2015) |
|---|---|---|
| Chirie | 350 EUR = 1.750 RON | 1.950 RON |
| Întreținere vară / iarnă | lipsește → estimare 450 / 900 | 250 / 350 (din anunț) |
| Transport + alte costuri | 250 + 50 | 100 + 50 |
| Cost lunar vară / iarnă | 2.500 / 2.950 | 2.350 / 2.450 |
| Garanție (recuperabilă) | 2 chirii = 3.500 | 1 chirie = 1.950 |
| Comision | lipsește → estimat 50% = 875 | 0 |
| Plată la mutare (fără prima chirie) | 5.875 | 3.450 |
| Fără furtuni | sigur | sigur |
| Pierderea venitului 2 luni din aprilie | **pe minus în mai (−825)** | sigur (minim 2.400) |

**Mesajul demo-ului:** apartamentul care pare mai ieftin are costuri ascunse și cade la prima furtună. Formularea corectă: „Dintre anunțurile tale salvate, B este mai sigur.”

---

## 11. Structura fișierelor

```
eclipse-vibehack/
├─ IMPLEMENTATION_PLAN.md            # acest document
├─ CLAUDE.md                         # reguli pentru agenții AI (§16)
├─ package.json, vite.config.js
├─ extension/
│  ├─ manifest.json                  # MV3: side_panel, activeTab, scripting, storage
│  └─ src/
│     ├─ background/                 # service worker: deschide panoul, rutează mesaje
│     ├─ content/readPage.js         # citirea paginii (+ adapters/olx.js, adapters/storia.js)
│     ├─ sidepanel/                  # Analiză · Întrebări · Cost real · Crossroads compact
│     ├─ dashboard/                  # Passport · Anunțuri salvate · Comparație · Crossroads complet · Setări
│     ├─ ai/                         # client.js, redact.js, errors.js
│     ├─ demo/                       # mod demo + răspunsuri înregistrate
│     ├─ storage/                    # chrome.storage.local + onChanged
│     ├─ ui/                         # design system, etichete Găsit / Neclar / De întrebat
│     ├─ crossroads/                 # Crossroads.jsx, Path, MoveMarker, DangerZone, PlanPath, scales
│     └─ shared/
│        ├─ contracts/               # ✅ constants, types, schemas (+ enforceEvidence), fixtures/demoScenario
│        ├─ engine/                  # ✅ currency, seasons, trueCost, simulate · ⏳ pathToYes
│        └─ questions/               # câmp lipsă → întrebare, șablonul mesajului
├─ api/                              # analyze.js, health.js, validate.js, rateLimit.js, providers/, .env.example
├─ data/
│  ├─ questions.ro.json              # banca de întrebări
│  ├─ costs.ro.json                  # intervale de referință, cu surse (înlocuiesc valorile fictive din demo)
│  └─ fixtures/listings/             # anunțuri de test (fictive + reale anonimizate) + rezultat așteptat
├─ tests/eval/                       # evaluarea extragerii AI
└─ demo-site/                        # anunțuri fictive pe localhost:5174
```

Aplicația React existentă din `src/` (șablonul inițial) poate fi eliminată sau înlocuită când extensia preia build-ul.

---

## 12. Ordinea construirii pentru o singură persoană

Lucrul e secvențial, așa că ordinea contează. Fiecare etapă se termină cu ceva funcțional și testat. Procentele sunt din timpul total disponibil.

| # | Etapă | Timp | Criteriu de gata |
|---|---|---|---|
| **0** | **Fundație** | 0–10% | ✅ contracte, validare, scenariu demo, motor de bază, 40 de teste · ⏳ script `test` în `package.json` |
| **1** | **Path to Yes** | 10–15% | `pathToYes.js` conform §5.7 + teste (amânare verificată după mutare, deficit, alt apartament, reducere, fără soluție) |
| **2** | **Schelet extensie + backend** | 15–25% | Extensia se încarcă în Chrome („Load unpacked”) și deschide panoul; `/api/analyze` și `/api/health` publicate; rate limiting și limita de cheltuieli active; `demo-site` pe localhost |
| **3** | **Detective + Questions** | 25–45% | Click pe un anunț **real** OLX/Storia și pe cel de pe localhost → citire → AI → validare + dovezi → statusuri → întrebări + mesaj. Text lipit, completare manuală, erori și mod demo funcționale |
| **4** | **Passport + True Cost + confirmări** | 45–60% | Dashboard: Passport (cu luna mutării, bugetul și cursul EUR), salvarea a 2 anunțuri, confirmări editabile, True Cost cu surse și ipoteze, recalculare automată |
| **5** | **Crossroads + Storms** | 60–80% | Crossroads complet conectat la motor, perioadă 1–60, luna mutării, zone de avertizare, furtuni (butoane + text liber), Path to Yes evidențiat, sincronizare între panou și dashboard |
| **6** | **Finisare** | 80–90% | Design, texte, ecranul de acord, testarea celor 10 anunțuri reale, animații opționale |
| **7** | **Înghețare + repetiții** | 90–100% | Doar repararea bug-urilor; demo cronometrat, test fără internet, video de rezervă |

**Sfat pentru o singură persoană:** după etapa 3 există deja un produs demonstrabil (analiză + întrebări). După etapa 5 există MVP-ul complet. Dacă timpul se scurtează, treceți direct la §14.

---

## 13. Riscuri principale

| Risc | Măsuri |
|---|---|
| **Timpul unei singure persoane** | Ordinea strictă din §12; fiecare etapă livrează ceva funcțional; tăieturile din §14 aplicate devreme, nu în ultima oră |
| **AI-ul inventează informații** | Verificarea dovezilor în cod, statusul implicit „De întrebat”, setul de evaluare |
| **Paginile reale se schimbă** | Date structurate → adaptor → text generic → text lipit; testare pe 10 anunțuri reale |
| **Corectitudinea formulelor** | §5 implementat literal; teste pe scenariul calculat de mână (✅ deja) |
| **Calitatea Crossroads** | Construit pe date de test încă înainte de etapa 5; testul de lizibilitate în 2 secunde cu 3 persoane; animații doar la final |
| **Costul și abuzul API** | Rate limiting persistent, limită de cheltuieli, plafoane de intrare și ieșire |
| **Demo live** | Localhost, mod demo offline, video de rezervă |
| **Credibilitatea estimărilor** | Afișate ca „estimare” cu interval și sursă; valorile fictive din demo înlocuite cu `costs.ro.json` cu surse |

---

## 14. Ce tăiem primul dacă nu ajunge timpul
1. Animațiile avansate din Crossroads (rămân tranzițiile simple)
2. Adaptoarele OLX/Storia (rămân datele structurate + textul generic + textul lipit, deci anunțurile reale funcționează în continuare)
3. Formularea mesajului prin AI (rămâne șablonul)
4. Furtunile din text liber (rămân butoanele)
5. Opțiunea „reducerea cheltuielilor” din Path to Yes
6. Mai mult de 2 anunțuri salvate
7. Sincronizarea live între panou și dashboard (recalculare la deschiderea paginii)

**Nu tăiem niciodată:**
- cele 7 funcționalități obligatorii;
- citirea anunțurilor reale + textul lipit;
- verificarea dovezilor;
- confirmările cu recalculare;
- Crossroads cu perioadă 1–60 și luna mutării;
- suportul EUR/RON cu curs explicit;
- confidențialitatea Passport-ului;
- modul demo.

---

## 15. Testare

**Teste unitare pentru motor și contracte.** Acum rulează cu `node --test`, fără dependențe; ulterior se poate adăuga un script `test` în `package.json`.
- ✅ `contracts/__tests__/schemas.test.js`:
  - scenariul demo valid;
  - dovezi existente, inventate și fără diacritice;
  - anunț fără preț acceptat;
  - reguli pentru statusuri;
  - Passport, curs, perioadă și furtuni invalide;
  - contractul PathToYes.
- ✅ `engine/__tests__/trueCost.test.js`:
  - totalurile demo;
  - EUR → RON cu curs explicit; lipsa cursului → `CURS_LIPSA`;
  - chiria lipsă → `CHIRIE_LIPSA`; chiria presupusă;
  - prima chirie nenumărată de două ori;
  - utilități incluse = 0; o singură valoare sezonieră;
  - estimări prudente;
  - confirmări care schimbă costul;
  - transport presupus;
  - avertizarea de buget.
- ✅ `engine/__tests__/simulate.test.js`:
  - scenariul demo cu și fără furtună;
  - costurile inițiale și garanția blocată;
  - fără dublă numărare;
  - mutare amânată (0, 2, 6 luni) și mutare după perioadă;
  - solduri negative și rezerva minimă;
  - perioade 1–60 și valori invalide;
  - sezoane;
  - furtuni identice pe ambele drumuri;
  - creșterea chiriei peste buget;
  - apartament incomplet respins;
  - determinism.
- ⏳ `engine/__tests__/pathToYes.test.js`:
  - amânare, inclusiv dincolo de `N`, verificată pe `P` luni după noua mutare (o variantă care devine negativă după mutare e respinsă);
  - `m' + P > 60` exclus;
  - deficit, alt apartament, reducere, caz fără soluție.

**Backend:**
- validarea cererilor și a răspunsurilor cu furnizor simulat;
- maparea erorilor (timeout, 429, JSON invalid);
- redactarea telefoanelor și a e-mailurilor; sumele mascate;
- rate limiting (per IP, per instalare, plafon global; cerere fără ID de instalare respinsă);
- `/api/health` (model inexistent, cheie invalidă).

**Extragerea reală prin AI** (`tests/eval/`): un script trimite 10–15 texte de test la backend-ul real și compară cu rezultatul așteptat. Ținta: **zero câmpuri „găsit” fără dovadă validă.**

**Modul demo și scenariile fără AI:** `fetch` care eșuează → modul manual sau demo, cu eticheta corectă. Manual: Wi-Fi oprit + modul demo → tot fluxul funcționează.

**Verificare manuală de la cap la coadă:**
1. Extensia se încarcă nearhivată („Load unpacked”).
2. Anunț real OLX → analiză → confirmare câmpuri → salvare.
3. Anunț real Storia → același flux.
4. Anunț în EUR fără curs → mesaj; cu curs → calcul.
5. Passport cu mutare peste 6 luni, simulare pe 24 de luni.
6. Furtună → Crossroads și Path to Yes se actualizează.
7. „Șterge toate datele”.
8. Demo complet pe localhost, cronometrat.

---

## 16. Reguli pentru agenții AI (`CLAUDE.md`)
- Calculele financiare se fac doar în `extension/src/shared/engine`, conform §5; prompturile nu cer niciodată calcule.
- Contractele din `shared/contracts` sunt sursa de adevăr; orice modificare a lor vine cu teste actualizate.
- Datele din Passport nu se trimit niciodată la backend.
- Orice răspuns AI trece prin `validateListingAnalysis` și `enforceEvidence`.
- Sumele în EUR se convertesc doar cu un curs explicit și afișat (BNR descărcat sau introdus de utilizator); nu există curs scris în cod.
- Cheia API nu apare niciodată în codul extensiei sau în repository.
- Testele trebuie să treacă înainte de orice commit.

## 17. Lucrul cu Git
- Fiecare etapă pe o ramură `feat/...` creată din `main`.
- Commit după revizuire; push și pull request doar cu aprobare.
- Nu se modifică fișierele altor proiecte sau ramuri.
- Testele și build-ul rulează înainte de fiecare commit.
