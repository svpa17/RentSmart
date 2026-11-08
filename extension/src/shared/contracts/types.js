// RĂSCRUCE AI — structurile de date comune (JSDoc).
// Proprietar: Sebi. Orice modificare se face prin PR aprobat de echipă.
// Validarea la rulare se află în ./schemas.js.
//
// Convenții:
// - Sumele interne sunt RON întregi. Sumele în EUR apar doar în ListingAnalysis
//   și se convertesc cu un ExchangeRate explicit înainte de orice calcul.
// - Lunile simulării sunt indexate t = 0 … luni−1; t = 0 este luna de start.
// - Datele sunt șiruri ISO 8601.

/** @typedef {'RON'|'EUR'} Currency */
/** @typedef {'gasit'|'confirmat'|'presupus'|'neclar'|'lipsa'} FieldStatus */

/**
 * Baza oricărui câmp din anunț.
 * - status 'gasit' cere `valoare` și `dovada` (fragment exact din textul anunțului).
 * - status 'confirmat' sau 'presupus' cere `valoare` și `actualizatLa`.
 * - status 'neclar' sau 'lipsa': `valoare` este null.
 * @typedef {Object} FieldBase
 * @property {FieldStatus} status
 * @property {string|null} dovada        Fragmentul exact din anunț (doar pentru 'gasit'/'neclar').
 * @property {string|null} actualizatLa  ISO; data confirmării sau presupunerii.
 * @property {string|null} nota          Notă liberă (ex. răspunsul proprietarului).
 */

/** @typedef {FieldBase & {valoare: number|null, moneda: Currency|null}} MoneyField */
/** @typedef {FieldBase & {valoare: number|null}} NumberField */
/** @typedef {FieldBase & {valoare: boolean|null}} BooleanField */
/** @typedef {FieldBase & {valoare: string|null}} TextField */
/** Garanția: o sumă sau un număr de chirii. @typedef {FieldBase & {valoare: number|null, unitate: 'suma'|'luni_chirie'|null, moneda: Currency|null}} DepositField */
/** Comisionul: o sumă sau un procent din chirie. @typedef {FieldBase & {valoare: number|null, unitate: 'suma'|'procent_chirie'|null, moneda: Currency|null}} CommissionField */

/**
 * Rezultatul analizei unui anunț (AI Listing Detective).
 * Produs de AI (validat + verificarea dovezilor) sau introdus manual.
 * @typedef {Object} ListingAnalysis
 * @property {1} schemaVersion
 * @property {string} id
 * @property {{tip: 'pagina'|'text_lipit'|'demo', url: string|null, analizatLa: string, imagine?: string}} sursa  imagine: poza principală (https), dacă pagina are una
 * @property {string|null} titlu
 * @property {boolean} demonstrativ   true pentru datele din modul demo (eticheta „DATE DEMONSTRATIVE”).
 * @property {{
 *   chirie: MoneyField,
 *   intretinereVara: MoneyField,
 *   intretinereIarna: MoneyField,
 *   utilitatiIncluse: BooleanField,
 *   garantie: DepositField,
 *   comision: CommissionField,
 *   durataContractLuni: NumberField,
 *   reparatii: TextField,
 *   mobilat: BooleanField,
 *   suprafataMp: NumberField,
 *   localitate: TextField
 * }} campuri
 */

/**
 * Costurile introduse de utilizator pentru un apartament (nu vin din anunț).
 * `null` = necompletat; motorul aplică regula documentată în trueCost.js.
 * @typedef {Object} UserApartmentCosts
 * @property {number|null} transportLunarRON    Transportul de la această adresă.
 * @property {number|null} alteCosturiLunareRON Internet și alte costuri lunare neincluse.
 * @property {number|null} costuriMutareRON     Transport mobilă, obiecte (definitiv, o dată).
 */

/**
 * Anunț salvat în chrome.storage.local.
 * @typedef {Object} SavedListing
 * @property {ListingAnalysis} analiza
 * @property {UserApartmentCosts} costuriUtilizator
 * @property {string} salvatLa
 */

/**
 * Financial Passport — rămâne doar în chrome.storage.local; nu se trimite niciodată la AI.
 * Toate sumele sunt RON întregi ≥ 0.
 * @typedef {Object} FinancialPassport
 * @property {1} schemaVersion
 * @property {number} venitNetLunar              V
 * @property {number} cheltuieliEsentialeLunare  E — fără locuință și fără transport
 * @property {number} costLocuintaActuala        H0
 * @property {number} transportActualLunar       T0
 * @property {number} economiiDisponibile        S0
 * @property {number} rezervaMinima              Rmin
 * @property {number} bugetMaximChirie           Bmax — doar pentru avertizări
 * @property {number} lunaMutarii                m, 0…60 (0 = luna aceasta)
 * @property {string|null} obiectiv
 */

/**
 * Curs de schimb explicit: cursul BNR descărcat automat, cel introdus de utilizator sau cel demo.
 * Nu există curs implicit (scris în cod) în motor.
 * @typedef {Object} ExchangeRate
 * @property {number} eurToRon      > 0
 * @property {'utilizator'|'demo'|'bnr'} sursa
 * @property {string} actualizatLa  ISO: când a fost salvat (pentru BNR: ultima descărcare reușită)
 * @property {string} [dataPublicarii]  AAAA-LL-ZZ, obligatoriu pentru sursa „bnr”
 */

/**
 * Interval de referință pentru estimări prudente (furnizat de data/costs.ro.json).
 * Motorul folosește întotdeauna `max`. Comisionul nu are interval: implicit 50% (DEFAULT_COMMISSION_PERCENT).
 * @typedef {Object} CostReference
 * @property {{vara: {min: number, max: number}, iarna: {min: number, max: number}}} utilitatiLunareRON
 * @property {{min: number, max: number}} garantieLuniChirie
 * @property {boolean} verificat   false până când Iura confirmă sursele.
 * @property {string[]} surse
 */

/**
 * O sumă din TrueCost, cu proveniența ei.
 * @typedef {Object} CostItem
 * @property {number} sumaRON
 * @property {'anunt'|'confirmat'|'presupus'|'utilizator'|'estimare'|'inclus_in_chirie'} sursa
 * @property {{min: number, max: number}|null} interval   Pentru estimări.
 * @property {{valoare: number, moneda: Currency}|null} original  Suma înainte de conversie.
 * @property {string|null} nota
 */

/**
 * True Cost Analyzer — costul real al unui apartament.
 * @typedef {Object} TrueCost
 * @property {string} listingId
 * @property {string|null} titlu
 * @property {boolean} complet                   false → nu poate intra în simulare
 * @property {Array<'CHIRIE_LIPSA'|'CURS_LIPSA'>} motiveIncomplet
 * @property {{
 *   chirie: CostItem|null,
 *   utilitatiVara: CostItem,
 *   utilitatiIarna: CostItem,
 *   alteCosturi: CostItem,
 *   transport: CostItem
 * }} lunar
 * @property {{
 *   garantie: CostItem|null,   recuperabilă; nu se adaugă la banii disponibili
 *   comision: CostItem|null,   definitiv
 *   mutare: CostItem           definitiv
 * }} initial
 * @property {{
 *   lunarVara: number|null,
 *   lunarIarna: number|null,
 *   initialDefinitiv: number|null,   comision + mutare
 *   garantieRecuperabila: number|null,
 *   plataLaMutare: number|null       garanție + comision + mutare (fără prima chirie)
 * }} totaluri
 * @property {Warning[]} avertizari
 * @property {boolean} folosesteEstimari
 */

/**
 * @typedef {Object} Warning
 * @property {string} cod
 * @property {string} mesaj
 * @property {number|null} luna
 */

/**
 * Financial Storm. Lunile sunt indici t ai simulării.
 * @typedef {
 *   {id: string, tip: 'pierdereVenit', start: number, durata: number, procent: number} |
 *   {id: string, tip: 'cheltuialaNeprevazuta', luna: number, suma: number} |
 *   {id: string, tip: 'crestereChirie', start: number, procent: number}
 * } Storm
 */

/**
 * Intrarea motorului de simulare.
 * @typedef {Object} SimulationInput
 * @property {FinancialPassport} passport
 * @property {TrueCost[]} apartamente   1–2, toate cu `complet: true`
 * @property {number} luni              N, întreg 1…60
 * @property {number} lunaStart         luna calendaristică de start, 1…12
 * @property {Storm[]} furtuni
 */

/**
 * O lună din simulare pentru un drum.
 * @typedef {Object} MonthRow
 * @property {number} t
 * @property {number} lunaCalendaristica   1…12
 * @property {'iarna'|'vara'} sezon
 * @property {'inainte'|'mutare'|'dupa'} faza
 * @property {number} venit                V(t)
 * @property {number} cheltuieliEsentiale  E
 * @property {number} costLocuinta         H0+T0 înainte; HX(t) din luna mutării
 * @property {number|null} chirie          R(t) din luna mutării, altfel null
 * @property {number} costuriInitiale      G+C+M doar în luna mutării
 * @property {number} cheltuieliNeprevazute Sp(t)
 * @property {number} flux                 F(t)
 * @property {number} bani                 S(t) — bani disponibili
 * @property {number} garantieBlocata      B(t)
 * @property {number} avereTotala          W(t) = S(t) + B(t)
 * @property {number|null} rezervaLuni     S(t) / costurile lunare, o zecimală
 * @property {boolean} subZero
 * @property {boolean} subRezerva
 * @property {boolean} chiriePesteBuget
 * @property {string[]} furtuniActive      id-urile furtunilor active
 */

/**
 * @typedef {Object} PathIndicators
 * @property {number} soldMinim
 * @property {number} lunaSoldMinim
 * @property {number|null} primaLunaNegativa
 * @property {number|null} primaLunaSubRezerva
 * @property {number|null} primaLunaPesteBuget
 * @property {number} soldFinal
 * @property {number} economiiPanaLaMutare   S(m−1) − S0; 0 dacă m = 0
 * @property {boolean} mutareInPerioada
 * @property {boolean} sigur                 S(t) ≥ max(0, Rmin) pe toată perioada
 */

/**
 * Rezultatul simulării (Crossroads).
 * @typedef {Object} SimulationResult
 * @property {number} luni
 * @property {number} lunaStart
 * @property {number} lunaMutarii
 * @property {number} pragSigur    max(0, Rmin)
 * @property {Array<{listingId: string, titlu: string|null, luni: MonthRow[], indicatori: PathIndicators}>} drumuri
 * @property {Warning[]} avertizari
 * @property {readonly string[]} ipoteze
 */

/**
 * @typedef {
 *   {tip: 'amanare', listingId: string, lunaMutarii: number, orizontVerificat: number, luniVerificateDupaMutare: number} |
 *   {tip: 'rezervaSuplimentara', listingId: string, sumaRON: number} |
 *   {tip: 'altApartament', listingId: string, deLaListingId: string} |
 *   {tip: 'reducereCheltuieli', listingId: string, sumaLunaraRON: number, doarDacaERealist: true}
 * } PathToYesOption
 */

/**
 * Path to Yes pentru un apartament (calculat de engine/pathToYes.js).
 * @typedef {Object} PathToYes
 * @property {string} listingId
 * @property {number} pragSigur
 * @property {boolean} sigurDeja
 * @property {PathToYesOption[]} optiuni
 * @property {PathToYesOption|null} celMaiApropiat   când nicio opțiune nu e în limite
 * @property {string} mesaj
 */

export {};
