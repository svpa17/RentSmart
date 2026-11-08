import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  enforceEvidence,
  validateCostReference,
  validateExchangeRate,
  validateFinancialPassport,
  validateHorizon,
  validateListingAnalysis,
  validatePathToYes,
  validateSavedListing,
  validateStorm,
} from '../schemas.js';
import {
  demoCostReference,
  demoExchangeRate,
  demoListingA,
  demoListingB,
  demoListingTextA,
  demoListingTextB,
  demoPassport,
  demoSavedA,
  demoSavedB,
  demoStormJobLoss,
} from '../fixtures/demoScenario.js';

const clone = (x) => structuredClone(x);

test('scenariul demo respectă toate contractele', () => {
  for (const [name, r] of [
    ['passport', validateFinancialPassport(demoPassport)],
    ['curs', validateExchangeRate(demoExchangeRate)],
    ['referință costuri', validateCostReference(demoCostReference)],
    ['anunț A', validateListingAnalysis(demoListingA)],
    ['anunț B', validateListingAnalysis(demoListingB)],
    ['salvat A', validateSavedListing(demoSavedA)],
    ['salvat B', validateSavedListing(demoSavedB)],
    ['furtună', validateStorm(demoStormJobLoss)],
  ]) {
    assert.ok(r.ok, `${name}: ${JSON.stringify(r.errors)}`);
  }
});

test('dovezile din scenariul demo există în textele anunțurilor', () => {
  assert.deepEqual(enforceEvidence(demoListingA, demoListingTextA).downgraded, []);
  assert.deepEqual(enforceEvidence(demoListingB, demoListingTextB).downgraded, []);
});

test('un câmp „gasit” fără dovadă este invalid', () => {
  const a = clone(demoListingA);
  a.campuri.chirie.dovada = null;
  const r = validateListingAnalysis(a);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.path === 'campuri.chirie.dovada'));
});

test('verificarea dovezilor retrogradează un fragment inventat la „lipsa”', () => {
  const a = clone(demoListingA);
  a.campuri.comision = { status: 'gasit', valoare: 0, unitate: 'suma', moneda: 'RON', dovada: 'Fără comision', actualizatLa: null, nota: null };
  const { analysis, downgraded } = enforceEvidence(a, demoListingTextA);
  assert.deepEqual(downgraded, ['comision']);
  assert.equal(analysis.campuri.comision.status, 'lipsa');
  assert.equal(analysis.campuri.comision.valoare, null);
  assert.ok(validateListingAnalysis(analysis).ok);
  // Originalul nu este modificat.
  assert.equal(a.campuri.comision.status, 'gasit');
});

test('verificarea dovezilor ignoră diacriticele, majusculele și spațiile', () => {
  const a = clone(demoListingA);
  a.campuri.chirie.dovada = 'pret:   350 eur/luna';
  assert.deepEqual(enforceEvidence(a, demoListingTextA).downgraded, []);
});

test('un anunț fără preț este valid (chiria rămâne „De întrebat”)', () => {
  const a = clone(demoListingA);
  a.campuri.chirie = { status: 'lipsa', valoare: null, moneda: null, dovada: null, actualizatLa: null, nota: null };
  assert.ok(validateListingAnalysis(a).ok);
});

test('un câmp confirmat cere valoare și dată', () => {
  const a = clone(demoListingA);
  a.campuri.comision = { status: 'confirmat', valoare: 0, unitate: 'suma', moneda: 'RON', dovada: null, actualizatLa: null, nota: null };
  assert.equal(validateListingAnalysis(a).ok, false);
  a.campuri.comision.actualizatLa = '2027-01-05T10:00:00.000Z';
  assert.ok(validateListingAnalysis(a).ok);
});

test('un câmp „lipsa” nu poate avea valoare', () => {
  const a = clone(demoListingA);
  a.campuri.reparatii = { status: 'lipsa', valoare: 'ceva', dovada: null, actualizatLa: null, nota: null };
  assert.equal(validateListingAnalysis(a).ok, false);
});

test('suma în EUR cere monedă; comisionul procentual are maximum 100', () => {
  const a = clone(demoListingA);
  a.campuri.chirie.moneda = null;
  assert.equal(validateListingAnalysis(a).ok, false);
  const b = clone(demoListingB);
  b.campuri.comision = { ...b.campuri.comision, unitate: 'procent_chirie', valoare: 150, moneda: null };
  assert.equal(validateListingAnalysis(b).ok, false);
});

test('Passport respinge valori negative, zecimale și luna mutării > 60', () => {
  for (const patch of [{ venitNetLunar: -1 }, { economiiDisponibile: 10.5 }, { lunaMutarii: 61 }, { bugetMaximChirie: '2000' }]) {
    assert.equal(validateFinancialPassport({ ...demoPassport, ...patch }).ok, false, JSON.stringify(patch));
  }
});

test('cursul de schimb trebuie să fie pozitiv și explicit', () => {
  assert.equal(validateExchangeRate({ ...demoExchangeRate, eurToRon: 0 }).ok, false);
  assert.equal(validateExchangeRate({ ...demoExchangeRate, eurToRon: Number.NaN }).ok, false);
  assert.equal(validateExchangeRate({ ...demoExchangeRate, sursa: 'automat' }).ok, false);
});

test('perioada simulată acceptă doar întregi 1–60', () => {
  for (const ok of [1, 3, 12, 24, 60]) assert.ok(validateHorizon(ok).ok, String(ok));
  for (const bad of [0, 61, 2.5, -3, '12', null, Number.NaN]) assert.equal(validateHorizon(bad).ok, false, String(bad));
});

test('furtunile invalide sunt respinse', () => {
  assert.equal(validateStorm({ id: 'x', tip: 'pierdereVenit', start: 0, durata: 0, procent: 100 }).ok, false);
  assert.equal(validateStorm({ id: 'x', tip: 'cheltuialaNeprevazuta', luna: 2, suma: 0 }).ok, false);
  assert.equal(validateStorm({ id: 'x', tip: 'cutremur', start: 0 }).ok, false);
});

test('contractul PathToYes: amânarea trebuie să aibă orizontul verificat consecvent', () => {
  const base = { listingId: 'demo-a', pragSigur: 1000, sigurDeja: false, celMaiApropiat: null, mesaj: 'Planul tău' };
  const ok = validatePathToYes({
    ...base,
    optiuni: [
      { tip: 'amanare', listingId: 'demo-a', lunaMutarii: 5, orizontVerificat: 17, luniVerificateDupaMutare: 12 },
      { tip: 'rezervaSuplimentara', listingId: 'demo-a', sumaRON: 2700 },
      { tip: 'altApartament', listingId: 'demo-b', deLaListingId: 'demo-a' },
      { tip: 'reducereCheltuieli', listingId: 'demo-a', sumaLunaraRON: 300, doarDacaERealist: true },
    ],
  });
  assert.ok(ok.ok, JSON.stringify(ok.errors));
  const bad = validatePathToYes({
    ...base,
    optiuni: [{ tip: 'amanare', listingId: 'demo-a', lunaMutarii: 5, orizontVerificat: 12, luniVerificateDupaMutare: 12 }],
  });
  assert.equal(bad.ok, false);
  assert.equal(validatePathToYes({ ...base, sigurDeja: true, optiuni: [{ tip: 'rezervaSuplimentara', listingId: 'demo-a', sumaRON: 1 }] }).ok, false);
});
