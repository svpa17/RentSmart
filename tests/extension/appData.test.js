import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  DATA_KEYS,
  MAX_SAVED_LISTINGS,
  getSavedListings,
  loadDemoScenario,
  removeSavedListing,
  saveExchangeRate,
  saveListing,
  savePassport,
  updateSavedAnalysis,
  updateUserCosts,
} from '../../extension/src/storage/appData.js';
import { STORAGE_KEYS, clearAllData, getSettings } from '../../extension/src/storage/index.js';
import { deriveAll, trueCostOf, costContext } from '../../extension/src/app/derive.js';
import { passportFromForm, passportToForm, parseRate, parseWholeRON, userCostsFromForm } from '../../extension/src/dashboard/forms.js';
import { costItemDetails, formatRON } from '../../extension/src/ui/format.js';
import { createListingAnalysis, setUserValue } from '../../extension/src/shared/contracts/factories.js';
import { ContractError } from '../../extension/src/shared/contracts/schemas.js';
import { demoListingA, demoListingB, demoPassport, demoExpected } from '../../extension/src/shared/contracts/fixtures/demoScenario.js';
import { costReferenceRo } from '../../extension/src/shared/costReference.js';

/** chrome.storage.local simulat, cu onChanged. */
function fakeChrome() {
  let data = {};
  const listeners = new Set();
  const emit = (changes) => listeners.forEach((l) => l(changes, 'local'));
  return {
    dump: () => data,
    storage: {
      local: {
        async get(keys) {
          const ks = keys == null ? Object.keys(data) : [].concat(keys);
          return Object.fromEntries(ks.filter((k) => k in data).map((k) => [k, structuredClone(data[k])]));
        },
        async set(obj) {
          const changes = {};
          for (const [k, v] of Object.entries(obj)) {
            changes[k] = { oldValue: data[k], newValue: structuredClone(v) };
            data[k] = structuredClone(v);
          }
          emit(changes);
        },
        async clear() {
          const changes = Object.fromEntries(Object.keys(data).map((k) => [k, { oldValue: data[k] }]));
          data = {};
          emit(changes);
        },
      },
      onChanged: { addListener: (l) => listeners.add(l), removeListener: (l) => listeners.delete(l) },
    },
  };
}

const NOW = new Date('2027-01-05T08:00:00.000Z');
beforeEach(() => {
  globalThis.chrome = fakeChrome();
});

test('Passport și cursul: validate la salvare; nu există curs implicit', async () => {
  await savePassport(demoPassport);
  assert.deepEqual(globalThis.chrome.dump()[DATA_KEYS.PASSPORT], demoPassport);
  await assert.rejects(savePassport({ ...demoPassport, venitNetLunar: -1 }), ContractError);
  await assert.rejects(savePassport({ ...demoPassport, lunaMutarii: 61 }), ContractError);
  assert.equal(globalThis.chrome.dump()[DATA_KEYS.EXCHANGE_RATE], undefined);
  const rate = await saveExchangeRate(4.97, NOW);
  assert.deepEqual(rate, { eurToRon: 4.97, sursa: 'utilizator', actualizatLa: NOW.toISOString() });
  await assert.rejects(saveExchangeRate(0, NOW), ContractError);
});

test('anunțurile salvate: salvare, actualizare fără pierderea costurilor, limită, ștergere', async () => {
  assert.deepEqual(await saveListing(demoListingA, NOW), { ok: true });
  assert.deepEqual(await saveListing(demoListingB, NOW), { ok: true });
  let list = await getSavedListings();
  assert.equal(list.length, 2);
  assert.deepEqual(list[0].costuriUtilizator, { transportLunarRON: null, alteCosturiLunareRON: null, costuriMutareRON: null });
  assert.equal(list[0].salvatLa, NOW.toISOString());

  await updateUserCosts('demo-a', { transportLunarRON: 250, alteCosturiLunareRON: 50, costuriMutareRON: 1500 });
  const confirmed = setUserValue(demoListingA, 'comision', { status: 'confirmat', valoare: 0, moneda: 'RON', unitate: 'suma', actualizatLa: NOW.toISOString() });
  assert.equal(await updateSavedAnalysis(confirmed), true);
  await saveListing(confirmed, NOW); // re-salvarea aceluiași id actualizează, nu dublează
  list = await getSavedListings();
  assert.equal(list.length, 2);
  assert.equal(list[0].analiza.campuri.comision.status, 'confirmat');
  assert.equal(list[0].costuriUtilizator.transportLunarRON, 250, 'costurile utilizatorului rămân');
  await assert.rejects(updateUserCosts('demo-a', { transportLunarRON: -5, alteCosturiLunareRON: null, costuriMutareRON: null }), ContractError);

  const other = createListingAnalysis({ id: 'x', tip: 'text_lipit', analizatLa: NOW.toISOString() });
  assert.equal(await updateSavedAnalysis(other), false, 'o analiză nesalvată nu se adaugă implicit');
  for (let i = 2; i < MAX_SAVED_LISTINGS; i += 1) await saveListing({ ...other, id: `x${i}` }, NOW);
  assert.deepEqual(await saveListing({ ...other, id: 'peste' }, NOW), { ok: false, motiv: 'LIMITA' });

  await removeSavedListing('demo-b');
  assert.ok(!(await getSavedListings()).some((s) => s.analiza.id === 'demo-b'));
});

test('scenariul demo: Passport, curs demo, A și B, mod demonstrativ; costurile reale = calculele de mână', async () => {
  await loadDemoScenario();
  const d = globalThis.chrome.dump();
  assert.equal((await getSettings()).modDemo, true);
  assert.equal(d[DATA_KEYS.EXCHANGE_RATE].sursa, 'demo');
  assert.equal(d[STORAGE_KEYS.CURRENT_ANALYSIS], null);
  const derived = deriveAll({ passport: d[DATA_KEYS.PASSPORT], rate: d[DATA_KEYS.EXCHANGE_RATE], settings: await getSettings(), saved: d[DATA_KEYS.SAVED_LISTINGS] });
  for (const { saved, tc } of derived.items) {
    const exp = demoExpected.trueCost[saved.analiza.id];
    assert.equal(tc.totaluri.lunarVara, exp.lunarVara);
    assert.equal(tc.totaluri.lunarIarna, exp.lunarIarna);
    assert.equal(tc.totaluri.plataLaMutare, exp.plataLaMutare);
  }
  assert.equal(derived.comparatie.celMaiMicCostLunar.listingId, 'demo-b');
});

test('recalculare automată: Passport, curs și confirmări schimbă costul; nimic derivat nu se salvează', async () => {
  await loadDemoScenario();
  const state = async () => {
    const d = globalThis.chrome.dump();
    return deriveAll({ passport: d[DATA_KEYS.PASSPORT], rate: d[DATA_KEYS.EXCHANGE_RATE], settings: await getSettings(), saved: d[DATA_KEYS.SAVED_LISTINGS] });
  };
  // Curs mai mare → chiria A în RON crește.
  await saveExchangeRate(5.1, NOW);
  assert.equal((await state()).items[0].tc.lunar.chirie.sumaRON, 1785);
  // Confirmarea comisionului A = 0 → plata la mutare scade cu estimarea (1.785).
  const a = (await getSavedListings())[0].analiza;
  await updateSavedAnalysis(setUserValue(a, 'comision', { status: 'confirmat', valoare: 0, moneda: 'RON', unitate: 'suma', actualizatLa: NOW.toISOString() }));
  const tcA = (await state()).items[0].tc;
  assert.equal(tcA.initial.comision.sursa, 'confirmat');
  assert.equal(tcA.totaluri.plataLaMutare, 2 * 1785 + 0 + 1500);
  // Buget mai mic → avertizare pe B.
  await savePassport({ ...demoPassport, bugetMaximChirie: 1900 });
  assert.deepEqual((await state()).comparatie.pesteBuget, ['demo-b']);
  // În storage nu apare nicio valoare derivată.
  assert.deepEqual(Object.keys(globalThis.chrome.dump()).sort(), ['analizaCurenta', 'anunturiSalvate', 'cursEur', 'furtuni', 'passport', 'setari', 'setariSimulare']);
  // Fără curs → A devine incomplet (CURS_LIPSA); fără Passport → nu se calculează nimic.
  const noRate = deriveAll({ passport: demoPassport, rate: null, settings: { modDemo: true }, saved: await getSavedListings() });
  assert.deepEqual(noRate.items[0].tc.motiveIncomplet, ['CURS_LIPSA']);
  assert.deepEqual(deriveAll({ passport: null, rate: null, settings: {}, saved: await getSavedListings() }).items.map((i) => i.tc), [null, null]);
});

test('„Șterge toate datele” golește tot', async () => {
  await loadDemoScenario();
  await clearAllData();
  assert.deepEqual(globalThis.chrome.dump(), {});
});

test('costul real în panou pentru o analiză nesalvată și modul normal (costs.ro.json)', () => {
  const ctx = costContext({ passport: demoPassport, rate: null, settings: { modDemo: false } });
  assert.equal(ctx.costReference, costReferenceRo);
  const tcB = trueCostOf(demoListingB, ctx);
  assert.equal(tcB.complet, true);
  assert.equal(tcB.lunar.transport.sumaRON, demoPassport.transportActualLunar); // presupus, fără costurile utilizatorului
  assert.equal(tcB.lunar.transport.sursa, 'presupus');
  assert.equal(trueCostOf(demoListingB, null), null);
});

test('formularele dashboard-ului: lei întregi, luna mutării 0–60, curs zecimal, costuri opționale', () => {
  const values = passportToForm(demoPassport);
  assert.deepEqual(passportFromForm(values), { ok: true, passport: demoPassport });
  assert.deepEqual(passportToForm(null).lunaMutarii, '0');
  const bad = passportFromForm({ ...values, venitNetLunar: '5200,50', lunaMutarii: '61' });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.venitNetLunar && bad.errors.lunaMutarii);
  assert.equal(passportFromForm({ ...values, economiiDisponibile: '12.000', obiectiv: '  ' }).passport.economiiDisponibile, 12000);
  assert.equal(passportFromForm({ ...values, obiectiv: '  ' }).passport.obiectiv, null);
  assert.equal(parseWholeRON('1 500'), 1500);
  assert.equal(parseWholeRON('-3'), null);
  assert.equal(parseRate('4,97'), 4.97);
  assert.equal(parseRate('0'), null);
  assert.equal(parseRate('abc'), null);
  assert.deepEqual(userCostsFromForm({ transportLunarRON: '250', alteCosturiLunareRON: '', costuriMutareRON: '1.500' }), {
    ok: true,
    costuri: { transportLunarRON: 250, alteCosturiLunareRON: null, costuriMutareRON: 1500 },
  });
  assert.equal(userCostsFromForm({ transportLunarRON: 'x' }).ok, false);
});

test('afișarea sumelor: RON, conversia EUR și intervalul estimării', () => {
  assert.equal(formatRON(1750), '1.750 RON');
  assert.equal(formatRON(null), '—');
  assert.deepEqual(costItemDetails({ sumaRON: 1750, original: { valoare: 350, moneda: 'EUR' }, interval: null, nota: null }, { eurToRon: 5 }), ['350 EUR × 5']);
  assert.deepEqual(costItemDetails({ sumaRON: 900, original: null, interval: { min: 500, max: 900 }, nota: 'x' }, null), ['interval 500–900 RON', 'x']);
});
