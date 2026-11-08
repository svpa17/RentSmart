import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTrueCost } from '../trueCost.js';
import { simulate } from '../simulate.js';
import { calendarMonth, seasonOf } from '../seasons.js';
import { ContractError, validateSimulationResult } from '../../contracts/schemas.js';
import {
  demoCostReference,
  demoExchangeRate,
  demoExpected,
  demoPassport,
  demoSavedA,
  demoSavedB,
  demoSimulationSettings,
  demoStormJobLoss,
} from '../../contracts/fixtures/demoScenario.js';

const ctx = { passport: demoPassport, costReference: demoCostReference, exchangeRate: demoExchangeRate };
const tcA = computeTrueCost(demoSavedA, ctx);
const tcB = computeTrueCost(demoSavedB, ctx);

const run = (overrides = {}) =>
  simulate({
    passport: demoPassport,
    apartamente: [tcA, tcB],
    furtuni: [],
    ...demoSimulationSettings,
    ...overrides,
  });
const bani = (path) => path.luni.map((m) => m.bani);

test('scenariul demo fără furtuni corespunde calculelor de mână', () => {
  const r = run();
  assert.ok(validateSimulationResult(r).ok, JSON.stringify(validateSimulationResult(r).errors));
  const [a, b] = r.drumuri;
  assert.deepEqual(bani(a), demoExpected.faraFurtuna['demo-a'].bani);
  assert.deepEqual(bani(b), demoExpected.faraFurtuna['demo-b'].bani);
  assert.equal(a.indicatori.sigur, true);
  assert.equal(b.indicatori.sigur, true);
});

test('furtuna „pierderea venitului” duce A pe minus în luna 4; B rămâne sigur', () => {
  const r = run({ furtuni: [demoStormJobLoss] });
  const [a, b] = r.drumuri;
  const ea = demoExpected.cuFurtunaJob['demo-a'];
  const eb = demoExpected.cuFurtunaJob['demo-b'];
  assert.deepEqual(bani(a), ea.bani);
  assert.deepEqual(bani(b), eb.bani);
  assert.equal(a.indicatori.primaLunaNegativa, ea.primaLunaNegativa);
  assert.equal(a.indicatori.soldMinim, ea.soldMinim);
  assert.equal(a.indicatori.sigur, false);
  assert.equal(b.indicatori.primaLunaNegativa, null);
  assert.equal(b.indicatori.soldMinim, eb.soldMinim);
  assert.equal(b.indicatori.sigur, true);
  assert.deepEqual(a.luni[3].furtuniActive, ['furtuna-job']);
});

test('costurile inițiale: garanția iese din banii disponibili, dar apare separat ca blocată', () => {
  const [a] = run().drumuri;
  const mutare = a.luni[2];
  assert.equal(mutare.faza, 'mutare');
  assert.equal(mutare.costuriInitiale, 5875); // 3.500 garanție + 875 comision (50% din chirie) + 1.500 mutare
  assert.equal(mutare.flux, 5200 - 1500 - 2950 - 5875);
  assert.equal(mutare.garantieBlocata, 3500);
  assert.equal(mutare.avereTotala, mutare.bani + 3500);
  assert.equal(a.luni[1].garantieBlocata, 0);
  assert.equal(a.luni[3].costuriInitiale, 0); // plătite o singură dată
});

test('fără dublă numărare: costul actual doar înainte de mutare, costul nou doar după', () => {
  const [a] = run().drumuri;
  assert.equal(a.luni[0].costLocuinta, 400 + 150);
  assert.equal(a.luni[0].chirie, null);
  assert.equal(a.luni[2].costLocuinta, 2950);
  assert.equal(a.luni[3].costLocuinta, 2500);
});

test('mutare amânată: economiile acumulate înainte de mutare', () => {
  const now = run({ passport: { ...demoPassport, lunaMutarii: 0 } });
  assert.equal(now.drumuri[0].luni[0].faza, 'mutare');
  assert.equal(now.drumuri[0].indicatori.economiiPanaLaMutare, 0);

  assert.equal(run().drumuri[0].indicatori.economiiPanaLaMutare, demoExpected.economiiPanaLaMutare);

  const later = run({ passport: { ...demoPassport, lunaMutarii: 6 }, luni: 24 });
  const [a] = later.drumuri;
  assert.equal(a.indicatori.economiiPanaLaMutare, 6 * 3150);
  assert.equal(a.luni[5].faza, 'inainte');
  assert.equal(a.luni[6].faza, 'mutare');
  assert.equal(a.indicatori.mutareInPerioada, true);
});

test('mutarea după perioada simulată: doar luni „înainte” și avertizare', () => {
  const r = run({ passport: { ...demoPassport, lunaMutarii: 12 }, luni: 6 });
  const [a] = r.drumuri;
  assert.ok(a.luni.every((m) => m.faza === 'inainte'));
  assert.equal(a.indicatori.mutareInPerioada, false);
  assert.equal(a.indicatori.economiiPanaLaMutare, 6 * 3150);
  assert.ok(r.avertizari.some((w) => w.cod === 'MUTARE_DUPA_PERIOADA'));
});

test('solduri negative: prima lună, soldul minim și rezerva minimă', () => {
  const r = run({ furtuni: [demoStormJobLoss] });
  const [a] = r.drumuri;
  assert.equal(a.luni[4].subZero, true);
  assert.equal(a.luni[3].subZero, false);
  assert.equal(a.indicatori.primaLunaSubRezerva, 4);
  assert.equal(a.indicatori.lunaSoldMinim, 4);
  assert.equal(r.pragSigur, 1000);
});

test('perioade de 1 până la 60 de luni; valorile invalide sunt respinse', () => {
  for (const luni of [1, 3, 12, 18, 24, 60]) {
    const r = run({ luni });
    assert.equal(r.drumuri[0].luni.length, luni);
    assert.ok(validateSimulationResult(r).ok, String(luni));
  }
  for (const luni of [0, 61, 2.5, '12']) {
    assert.throws(() => run({ luni }), ContractError, String(luni));
  }
  assert.ok(run({ luni: 24 }).avertizari.some((w) => w.cod === 'ORIZONT_LUNG'));
});

test('sezonul urmează luna calendaristică de start (iarna = noiembrie–martie)', () => {
  assert.equal(calendarMonth(11, 2), 1);
  assert.equal(calendarMonth(1, 12), 1);
  assert.equal(seasonOf(3), 'iarna');
  assert.equal(seasonOf(4), 'vara');
  assert.equal(seasonOf(11), 'iarna');
  const [b] = run({ lunaStart: 6, passport: { ...demoPassport, lunaMutarii: 0 } }).drumuri.slice(1);
  assert.equal(b.luni[0].sezon, 'vara'); // iunie
  assert.equal(b.luni[5].sezon, 'iarna'); // noiembrie
  assert.equal(b.luni[5].costLocuinta, 2450);
});

test('furtunile se aplică identic pe ambele drumuri', () => {
  const storms = [
    demoStormJobLoss,
    { id: 'reparatie', tip: 'cheltuialaNeprevazuta', luna: 6, suma: 800 },
  ];
  const [a, b] = run({ furtuni: storms }).drumuri;
  for (let t = 0; t < 12; t += 1) {
    assert.equal(a.luni[t].venit, b.luni[t].venit);
    assert.equal(a.luni[t].cheltuieliNeprevazute, b.luni[t].cheltuieliNeprevazute);
  }
  assert.equal(a.luni[6].cheltuieliNeprevazute, 800);
});

test('creșterea chiriei peste buget declanșează avertizarea din luna respectivă', () => {
  const r = run({ furtuni: [{ id: 'chirie-10', tip: 'crestereChirie', start: 6, procent: 10 }] });
  const [a, b] = r.drumuri;
  assert.equal(b.luni[6].chirie, 2145);
  assert.equal(b.luni[5].chiriePesteBuget, false);
  assert.equal(b.luni[6].chiriePesteBuget, true);
  assert.equal(b.indicatori.primaLunaPesteBuget, 6);
  assert.equal(a.indicatori.primaLunaPesteBuget, null); // 1.750 × 1,1 = 1.925 ≤ 2.000
  assert.ok(r.avertizari.some((w) => w.cod === 'CHIRIE_PESTE_BUGET' && w.luna === 6));
  // Bugetul nu schimbă soldurile.
  const fara = run({ passport: { ...demoPassport, bugetMaximChirie: 0 }, furtuni: [{ id: 'chirie-10', tip: 'crestereChirie', start: 6, procent: 10 }] });
  assert.deepEqual(bani(fara.drumuri[1]), bani(b));
});

test('un apartament incomplet nu poate intra în simulare', () => {
  const tcIncomplet = computeTrueCost(demoSavedA, { ...ctx, exchangeRate: null });
  assert.throws(() => run({ apartamente: [tcIncomplet] }), ContractError);
});

test('motorul este determinist', () => {
  const input = { furtuni: [demoStormJobLoss], luni: 60 };
  assert.deepEqual(run(input), run(input));
});
