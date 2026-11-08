import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTrueCost } from '../trueCost.js';
import { averageMonthlyCost, compareSavedListings } from '../compare.js';
import { costReferenceFor, costReferenceRo } from '../../costReference.js';
import { validateCostReference } from '../../contracts/schemas.js';
import { demoCostReference, demoExchangeRate, demoPassport, demoSavedA, demoSavedB } from '../../contracts/fixtures/demoScenario.js';

const ctx = { passport: demoPassport, costReference: demoCostReference, exchangeRate: demoExchangeRate };
const tcA = computeTrueCost(demoSavedA, ctx);
const tcB = computeTrueCost(demoSavedB, ctx);

test('costul lunar mediu: 7 luni de vară + 5 de iarnă (calculat de mână)', () => {
  assert.equal(averageMonthlyCost(tcA), 2688); // (7 × 2.500 + 5 × 2.950) / 12 = 2.687,5
  assert.equal(averageMonthlyCost(tcB), 2392); // (7 × 2.350 + 5 × 2.450) / 12 = 2.391,67
  assert.equal(averageMonthlyCost(computeTrueCost(demoSavedA, { ...ctx, exchangeRate: null })), null);
});

test('scenariul demo: B are cel mai mic cost lunar și cea mai mică plată la mutare, doar „dintre anunțurile tale salvate”', () => {
  const c = compareSavedListings([tcA, tcB]);
  assert.deepEqual(c.celMaiMicCostLunar, { listingId: 'demo-b', valoare: 2392 });
  assert.deepEqual(c.ceaMaiMicaPlataLaMutare, { listingId: 'demo-b', valoare: 3450 });
  assert.deepEqual(c.pesteBuget, []);
  assert.equal(c.mesaje.length, 2);
  for (const m of c.mesaje) {
    assert.match(m, /^Dintre anunțurile tale salvate, B · Apartament 2 camere Gheorgheni/);
    assert.ok(!/piaț/i.test(m), 'fără comparații cu piața');
  }
  assert.match(c.mesaje[0], /2\.392 RON în medie pe lună/);
});

test('bugetul depășit, apartamentele incomplete și egalitățile', () => {
  const tight = { ...demoPassport, bugetMaximChirie: 1800 };
  const b = computeTrueCost(demoSavedB, { ...ctx, passport: tight });
  const a = computeTrueCost(demoSavedA, { ...ctx, passport: tight });
  const c = compareSavedListings([a, b]);
  assert.deepEqual(c.pesteBuget, ['demo-b']);
  assert.ok(c.mesaje.includes('B · Apartament 2 camere Gheorgheni (bloc 2015): chiria e peste bugetul tău pentru chirie.'));

  const incompleteA = computeTrueCost(demoSavedA, { ...ctx, exchangeRate: null });
  const ci = compareSavedListings([incompleteA, tcB]);
  assert.equal(ci.celMaiMicCostLunar, null);
  assert.deepEqual(ci.incomplete, [{ listingId: 'demo-a', motive: ['CURS_LIPSA'] }]);
  assert.match(ci.mesaje.at(-1), /cel puțin două anunțuri/);

  const twin = { ...tcB, listingId: 'twin', titlu: 'Geamăn' };
  assert.equal(compareSavedListings([tcB, twin]).celMaiMicCostLunar, null);
  assert.equal(compareSavedListings([tcB]).celMaiMicCostLunar, null);
  assert.deepEqual(compareSavedListings([]).mesaje, []);
});

test('intervalele de referință: costs.ro.json e valid, cu surse; modul demo folosește valorile fictive', () => {
  assert.ok(validateCostReference(costReferenceRo).ok);
  assert.equal(costReferenceRo.verificat, false);
  assert.ok(costReferenceRo.surse.length >= 3 && costReferenceRo.surse.every((s) => s.includes('https://')));
  assert.equal(costReferenceFor({ modDemo: true }), demoCostReference);
  assert.equal(costReferenceFor({ modDemo: false }), costReferenceRo);
  // Cu intervalele reale, estimarea prudentă pentru A folosește maximul din costs.ro.json.
  const real = computeTrueCost(demoSavedA, { ...ctx, costReference: costReferenceRo });
  assert.equal(real.lunar.utilitatiVara.sumaRON, 550);
  assert.equal(real.lunar.utilitatiIarna.sumaRON, 900);
  assert.deepEqual(real.lunar.utilitatiVara.interval, { min: 250, max: 550 });
});
