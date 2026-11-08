// RĂSCRUCE AI — scenariul demo FICTIV, unic și consecvent.
// Proprietar: Sebi. Folosit de teste, de componentele Crossroads (date de test) și de modul demo.
// Toate datele sunt inventate: persoana, anunțurile, cursul și intervalele de cost.
// Intervalele de cost NU sunt verificate; data/costs.ro.json (Iura) le va înlocui cu surse reale.
//
// Povestea:
// - A pare mai ieftin (350 EUR ≈ 1.750 RON), dar întreținerea și comisionul lipsesc din anunț,
//   iar transportul e mai scump. B costă 1.950 RON, cu costuri clare și fără comision.
// - Fără furtuni, ambele drumuri rămân pozitive.
// - Cu furtuna „pierderea venitului 2 luni” (din aprilie), A ajunge pe minus în mai; B rămâne sigur.

export const DEMO_DATE = '2027-01-01T09:00:00.000Z';

/** @type {import('../types.js').FinancialPassport} */
export const demoPassport = Object.freeze({
  schemaVersion: 1,
  venitNetLunar: 5200,
  cheltuieliEsentialeLunare: 1500,
  costLocuintaActuala: 400,
  transportActualLunar: 150,
  economiiDisponibile: 6000,
  rezervaMinima: 1000,
  bugetMaximChirie: 2000,
  lunaMutarii: 2,
  obiectiv: 'Vreau să mă mut în următoarele 2 luni.',
});

/** Curs FICTIV, doar pentru demo. În aplicație cursul îl introduce utilizatorul. */
/** @type {import('../types.js').ExchangeRate} */
export const demoExchangeRate = Object.freeze({
  eurToRon: 5,
  sursa: 'demo',
  actualizatLa: DEMO_DATE,
});

/** Intervale FICTIVE, neverificate. */
/** @type {import('../types.js').CostReference} */
export const demoCostReference = Object.freeze({
  utilitatiLunareRON: { vara: { min: 250, max: 450 }, iarna: { min: 500, max: 900 } },
  garantieLuniChirie: { min: 1, max: 2 },
  verificat: false,
  surse: ['Valori fictive pentru demo — de înlocuit cu data/costs.ro.json.'],
});

const missing = (extra = {}) => ({ status: 'lipsa', valoare: null, dovada: null, actualizatLa: null, nota: null, ...extra });
const found = (valoare, dovada, extra = {}) => ({ status: 'gasit', valoare, dovada, actualizatLa: null, nota: null, ...extra });

/** Textul anunțului fictiv A (pagina demo / text lipit). */
export const demoListingTextA = `Garsonieră de închiriat, zona Mănăștur, Cluj-Napoca.
Preț: 350 EUR/lună. Bloc din 1978, etajul 4 din 4, mobilată și utilată.
Suprafață 32 mp. Se cer 2 chirii garanție. Contract minim 12 luni.
Disponibilă imediat. Pentru detalii sunați la 0722 123 456.`;

/** Textul anunțului fictiv B. */
export const demoListingTextB = `Apartament 2 camere, bloc nou (2015), zona Gheorgheni, Cluj-Napoca.
Chirie 1.950 lei/lună. Întreținere aproximativ 250 lei vara și 350 lei iarna, centrală proprie.
Suprafață 48 mp, nemobilat. Garanție o chirie. Fără comision, direct de la proprietar.
Contract pe minimum 12 luni. Reparațiile majore sunt suportate de proprietar.`;

/** @type {import('../types.js').ListingAnalysis} */
export const demoListingA = Object.freeze({
  schemaVersion: 1,
  id: 'demo-a',
  sursa: { tip: 'demo', url: 'http://localhost:5174/anunt-a.html', analizatLa: DEMO_DATE },
  titlu: 'A · Garsonieră Mănăștur (bloc 1978)',
  demonstrativ: true,
  campuri: {
    chirie: found(350, 'Preț: 350 EUR/lună', { moneda: 'EUR' }),
    intretinereVara: missing({ moneda: null }),
    intretinereIarna: missing({ moneda: null }),
    utilitatiIncluse: missing(),
    garantie: found(2, 'Se cer 2 chirii garanție', { unitate: 'luni_chirie', moneda: null }),
    comision: missing({ unitate: null, moneda: null }),
    durataContractLuni: found(12, 'Contract minim 12 luni'),
    reparatii: missing(),
    mobilat: found(true, 'mobilată și utilată'),
    suprafataMp: found(32, 'Suprafață 32 mp'),
    localitate: found('Cluj-Napoca', 'zona Mănăștur, Cluj-Napoca'),
  },
});

/** @type {import('../types.js').ListingAnalysis} */
export const demoListingB = Object.freeze({
  schemaVersion: 1,
  id: 'demo-b',
  sursa: { tip: 'demo', url: 'http://localhost:5174/anunt-b.html', analizatLa: DEMO_DATE },
  titlu: 'B · Apartament 2 camere Gheorgheni (bloc 2015)',
  demonstrativ: true,
  campuri: {
    chirie: found(1950, 'Chirie 1.950 lei/lună', { moneda: 'RON' }),
    intretinereVara: found(250, 'aproximativ 250 lei vara', { moneda: 'RON' }),
    intretinereIarna: found(350, '350 lei iarna', { moneda: 'RON' }),
    utilitatiIncluse: missing(),
    garantie: found(1, 'Garanție o chirie', { unitate: 'luni_chirie', moneda: null }),
    comision: found(0, 'Fără comision', { unitate: 'suma', moneda: 'RON' }),
    durataContractLuni: found(12, 'Contract pe minimum 12 luni'),
    reparatii: found('Reparațiile majore sunt suportate de proprietar', 'Reparațiile majore sunt suportate de proprietar'),
    mobilat: found(false, 'nemobilat'),
    suprafataMp: found(48, 'Suprafață 48 mp'),
    localitate: found('Cluj-Napoca', 'zona Gheorgheni, Cluj-Napoca'),
  },
});

/** @type {import('../types.js').SavedListing} */
export const demoSavedA = Object.freeze({
  analiza: demoListingA,
  costuriUtilizator: { transportLunarRON: 250, alteCosturiLunareRON: 50, costuriMutareRON: 1500 },
  salvatLa: DEMO_DATE,
});

/** @type {import('../types.js').SavedListing} */
export const demoSavedB = Object.freeze({
  analiza: demoListingB,
  costuriUtilizator: { transportLunarRON: 100, alteCosturiLunareRON: 50, costuriMutareRON: 1500 },
  salvatLa: DEMO_DATE,
});

/** Setările simulării demo: 12 luni, de la ianuarie (fix, pentru rezultate deterministe). */
export const demoSimulationSettings = Object.freeze({ luni: 12, lunaStart: 1 });

/** Furtuna-erou a demo-ului: pierderea venitului 2 luni, din aprilie (t = 3). */
/** @type {import('../types.js').Storm} */
export const demoStormJobLoss = Object.freeze({
  id: 'furtuna-job',
  tip: 'pierdereVenit',
  start: 3,
  durata: 2,
  procent: 100,
});

/**
 * Rezultatele așteptate (calculate de mână din formulele din simulate.js).
 * Testele verifică motorul față de aceste cifre.
 */
export const demoExpected = Object.freeze({
  trueCost: {
    'demo-a': { chirie: 1750, lunarVara: 2500, lunarIarna: 2950, garantie: 3500, comision: 875, initialDefinitiv: 2375, plataLaMutare: 5875 },
    'demo-b': { chirie: 1950, lunarVara: 2350, lunarIarna: 2450, garantie: 1950, comision: 0, initialDefinitiv: 1500, plataLaMutare: 3450 },
  },
  faraFurtuna: {
    'demo-a': { bani: [9150, 12300, 7175, 8375, 9575, 10775, 11975, 13175, 14375, 15575, 16325, 17075], sigur: true },
    'demo-b': { bani: [9150, 12300, 10100, 11450, 12800, 14150, 15500, 16850, 18200, 19550, 20800, 22050], sigur: true },
  },
  cuFurtunaJob: {
    'demo-a': { bani: [9150, 12300, 7175, 3175, -825, 375, 1575, 2775, 3975, 5175, 5925, 6675], primaLunaNegativa: 4, soldMinim: -825, sigur: false },
    'demo-b': { bani: [9150, 12300, 10100, 6250, 2400, 3750, 5100, 6450, 7800, 9150, 10400, 11650], primaLunaNegativa: null, soldMinim: 2400, sigur: true },
  },
  economiiPanaLaMutare: 6300,
});
