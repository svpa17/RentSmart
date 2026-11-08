# RĂSCRUCE AI: reguli pentru agenții AI

Sursa de adevăr: `IMPLEMENTATION_PLAN.md`. Progresul: `DEVELOPMENT_PROGRESS.md` (citește-l la începutul fiecărei sesiuni).

## Reguli (planul, §16)
- Calculele financiare se fac doar în `extension/src/shared/engine`, conform §5; prompturile nu cer niciodată calcule.
- Contractele din `extension/src/shared/contracts` sunt sursa de adevăr; orice modificare a lor vine cu teste actualizate.
- Datele din Passport nu se trimit niciodată la backend.
- Orice răspuns AI trece prin `validateListingAnalysis` și `enforceEvidence`.
- Sumele în EUR se convertesc doar cu un curs explicit și afișat: cursul BNR descărcat automat (`extension/src/rates/bnrRate.js`, salvat în `cursEur`) sau cel introdus de utilizator (are prioritate). Nu există curs scris în cod.
- Cheia API nu apare niciodată în codul extensiei sau în repository.
- Testele (`npm test`) și build-ul (`npm run build`) trebuie să treacă la finalul fiecărei etape.

## Mod de lucru (cerut de utilizator)
- Un singur dezvoltator, doar în acest folder. **Fără comenzi Git / GitHub** de niciun fel.
- O etapă din §12 pe rând; după fiecare etapă se actualizează `DEVELOPMENT_PROGRESS.md` și se așteaptă `CONTINUE`.

## Comenzi
- `npm test`: testele unitare (`node --test`): motor, contracte, `tests/api`, `tests/extension`
- `npm run build`: extensia în `dist/extension` (Load unpacked)
- `npm run lint`: ESLint
- `npm run api`: backend local pe :3000 · `npm run demo-site`: anunțuri fictive pe :5174
- `npm run rehearsal`: repetiția demo-ului fără internet (după build; Chrome/Edge local) · scenariul: `DEMO.md`
- Proiectul e în etapa 7 (înghețare): doar repararea bug-urilor, fiecare cu un test de regresie.

## Structură (abateri de la §11)
- Helperii backend-ului stau în `api/_lib/` (fișierele cu prefix `_` nu devin funcții Vercel). Endpoint-uri: `api/analyze.js`, `api/health.js`, `api/alternatives.js` (căutarea de alternative, fără AI).
- Testele backend-ului și ale extensiei stau în `tests/` (nu în `api/`, ca să nu devină funcții).
- `extension/sidepanel.html` și `extension/dashboard.html` sunt intrările Vite; codul lor e în `extension/src/sidepanel|dashboard`.
- Etichetele câmpurilor: `extension/src/shared/fields.js` (folosite și de prompturile backend-ului). Constructorii ListingAnalysis: `shared/contracts/factories.js`.
- Testele de integrare client ↔ backend: `tests/integration/`. Evaluarea AI reală: `npm run eval -- <URL>` (`tests/eval/`).
- Citirea paginilor (`extension/src/content/`): un singur sistem pentru orice site: date structurate (`structured.js`) → adaptoarele OLX/Storia + profilurile declarative (`profiles.js`: publi24, homezz) → extractorul universal (`universal.js`). Un profil nou se adaugă doar după verificarea pe pagini reale. `listing.js`: „pare anunț”, cheia URL (navigare SPA), cheia analizei (fără analize duble).
- Comisionul de agenție nepomenit în anunț: exact 50% din chirie (`DEFAULT_COMMISSION_PERCENT` în `shared/contracts/constants.js`), fără interval.
- Interfața (RentSmart, design inspirat de Apple): tokenii în `extension/src/ui/styles.css` (`@theme`), componentele de bază în `ui/components.jsx` (Card, Button, Pill, Notice, PageHeader, StatCard, Metric, SegmentedControl, EmptyState, Switch, ListingLink). **Strict fără animații**: regula globală din `styles.css` anulează orice tranziție/animație. Textul folosește variantele închise ale culorilor (contrast AA); #007AFF etc. doar pentru suprafețe, grafice și focus. Numele afișat e RentSmart; identificatorii interni (chei storage, mesaje, `RASCRUCE_PAGE_CHANGED`) rămân neschimbați.
- Alternative (`api/_lib/search/`): furnizori permiși și verificați = Storia, Publi24, HomeZZ (OLX și Imobiliare.ro refuză cererile automate: nu se ocolește). Serverul primește DOAR {oras, camere, pretMinimEUR} (orice altă cheie e respinsă); clasamentul și sumele în motor (`shared/engine/alternatives.js`, `affordability.js`). Orașele și slug-urile: `shared/search/cities.js`. Nu se afișează niciodată anunțuri inventate.
- Analiza automată (`extension/src/auto/`): `sites.js` (site-uri + ce URL e anunț + permisiunile OPȚIONALE), `analyzer.js` (logica, testabilă, fără chrome.*), cablată în `background/index.js`. Aceeași linie ca analiza manuală (readPage → runDetective → întrebări din șablon); starea per tab în `chrome.storage.session` (`stareTaburi`); cache comun în `storage/analysisCache.js` (pe URL 24 h + pe text). Nicio reîncercare automată după 429 (`pauzaAI`).
- Prima utilizare (`dashboard/Onboarding.jsx`, `dashboard/setupForm.js`, `storage/profile.js`, `background/onboarding.js`): bun venit la `onInstalled` reason `install` fără profil (`dashboard.html#bun-venit`); formularul salvează în Passport-ul existent (`passport`), nicio a doua sursă de adevăr; „Încearcă un exemplu” copiază datele reale în `copieDateReale` și le restaurează la ieșire (butonul vechi din Setări rămâne distructiv, intenționat). „Bani rămași lunar” = `monthlyLeftoverNow` (motor) = fluxul simulării înainte de mutare. „Bugetul tău”, #bun-venit și #configurare există doar până la configurare (`dashboard/navigation.js`: `profilConfigurat` sau un `passport` existent, în afara exemplului); apoi totul duce la „Profilul meu financiar”.
- Textele vizibile (UX writing): „Profilul meu financiar” (intern: passport), „Economii în timp” / „Cum evoluează economiile tale” (intern: crossroads), „Cum poți face chiria accesibilă” (pathToYes), „situații neprevăzute” (storms), „Varianta A/B”, „Planul ales”. Lunile: doar `monthLabel` (nume reale, anul doar când perioada trece peste an; niciodată „Luna N”/„L3”). „Total de plătit la mutare” = `totalToMoveIn` (cu prima chirie); `plataLaMutare` rămâne fără ea.
- Scrierea fișierelor: heredoc-urile Bash cu diacritice/ghilimele au eșuat de mai multe ori; folosește uneltele Write/Edit.
