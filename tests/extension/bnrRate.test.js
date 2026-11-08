import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  BNR_RATE_URL,
  RETRY_AFTER_MS,
  expectedPublicationDate,
  isPossiblyOutdated,
  needsRefresh,
  parseBnrResponse,
} from '../../extension/src/rates/bnrRate.js';
import { DATA_KEYS, refreshBnrRate, saveExchangeRate, switchToBnrRate, loadDemoScenario } from '../../extension/src/storage/appData.js';
import { updateSettings } from '../../extension/src/storage/index.js';
import { validateExchangeRate } from '../../extension/src/shared/contracts/schemas.js';
import { fromRON, toRON } from '../../extension/src/shared/engine/currency.js';
import { costContext, trueCostOf } from '../../extension/src/app/derive.js';
import { costItemDetails, describeRate, formatRONWithEUR } from '../../extension/src/ui/format.js';
import { demoPassport, demoSavedA } from '../../extension/src/shared/contracts/fixtures/demoScenario.js';

/** chrome.storage.local simulat (fără onChanged: nu e nevoie aici). */
function fakeChrome() {
  let data = {};
  return {
    dump: () => data,
    storage: {
      local: {
        async get(keys) {
          const ks = keys == null ? Object.keys(data) : [].concat(keys);
          return Object.fromEntries(ks.filter((k) => k in data).map((k) => [k, structuredClone(data[k])]));
        },
        async set(obj) {
          for (const [k, v] of Object.entries(obj)) data[k] = structuredClone(v);
        },
      },
      onChanged: { addListener() {}, removeListener() {} },
    },
  };
}

const BODY = { date: '2026-11-06', quote: 'RON', rates: { EUR: 5.3408 } };
// Sâmbătă 7 nov. 2026, 23:56 la București: ultimul curs publicat e cel de vineri, 6 nov.
const SAT = new Date('2026-11-07T21:56:00Z');
// Luni 9 nov. 2026: 12:00 la București (înainte de publicare) și 14:00 (după).
const MON_NOON = new Date('2026-11-09T10:00:00Z');
const MON_AFTER = new Date('2026-11-09T12:00:00Z');

function fakeFetch(responses) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    const r = responses.shift();
    if (r instanceof Error) throw r;
    return { ok: r.status === undefined || r.status < 400, status: r.status ?? 200, json: async () => r.body };
  };
  return { impl, calls };
}

const bnrRate = (over = {}) => ({ eurToRon: 5.3408, sursa: 'bnr', dataPublicarii: '2026-11-06', actualizatLa: SAT.toISOString(), ...over });

beforeEach(() => {
  globalThis.chrome = fakeChrome();
});

test('parseBnrResponse: acceptă răspunsul cursbnr.ro și respinge orice altceva', () => {
  assert.deepEqual(parseBnrResponse(BODY), { eurToRon: 5.3408, dataPublicarii: '2026-11-06' });
  for (const bad of [null, {}, { ...BODY, rates: {} }, { ...BODY, rates: { EUR: 0 } }, { ...BODY, rates: { EUR: '5.3' } }, { ...BODY, date: '06.11.2026' }, { ...BODY, quote: 'USD' }])
    assert.throws(() => parseBnrResponse(bad), Error, JSON.stringify(bad));
});

test('data publicării așteptate: zilele lucrătoare după 13:30, ora Bucureștiului', () => {
  assert.equal(expectedPublicationDate(SAT), '2026-11-06'); // weekend → vineri
  assert.equal(expectedPublicationDate(new Date('2026-11-08T12:00:00Z')), '2026-11-06'); // duminică
  assert.equal(expectedPublicationDate(MON_NOON), '2026-11-06'); // luni înainte de publicare
  assert.equal(expectedPublicationDate(MON_AFTER), '2026-11-09'); // luni după publicare
  assert.equal(expectedPublicationDate(new Date('2026-11-10T08:00:00Z')), '2026-11-09'); // marți dimineața
});

test('needsRefresh: lipsă/depășit → da; la zi, pauză după încercare, curs manual sau demo → nu', () => {
  assert.equal(needsRefresh({ rate: null, status: null, now: SAT }), true);
  assert.equal(needsRefresh({ rate: bnrRate(), status: null, now: SAT }), false); // weekend: cursul de vineri e ultimul
  assert.equal(needsRefresh({ rate: bnrRate(), status: null, now: MON_AFTER }), true);
  const recent = { incercatLa: new Date(MON_AFTER.getTime() - RETRY_AFTER_MS + 60_000).toISOString(), ok: false };
  assert.equal(needsRefresh({ rate: bnrRate(), status: recent, now: MON_AFTER }), false);
  assert.equal(needsRefresh({ rate: { eurToRon: 5, sursa: 'utilizator', actualizatLa: SAT.toISOString() }, status: null, now: MON_AFTER }), false);
  assert.equal(needsRefresh({ rate: { eurToRon: 5, sursa: 'demo', actualizatLa: SAT.toISOString() }, status: null, now: MON_AFTER }), false);
});

test('„posibil depășit” doar dacă actualizarea a eșuat și BNR ar fi publicat între timp (nu în weekend/sărbători)', () => {
  const fail = { incercatLa: MON_AFTER.toISOString(), ok: false };
  assert.equal(isPossiblyOutdated({ rate: bnrRate(), status: fail, now: MON_AFTER }), true);
  assert.equal(isPossiblyOutdated({ rate: bnrRate(), status: fail, now: SAT }), false);
  // Sărbătoare: API-ul a răspuns, dar cu cursul anterior → curs valid, nu e depășit.
  assert.equal(isPossiblyOutdated({ rate: bnrRate(), status: { incercatLa: MON_AFTER.toISOString(), ok: true }, now: MON_AFTER }), false);
});

test('contract: cursul BNR cere data publicării', () => {
  assert.ok(validateExchangeRate(bnrRate()).ok);
  assert.equal(validateExchangeRate(bnrRate({ dataPublicarii: undefined })).ok, false);
  assert.equal(validateExchangeRate(bnrRate({ dataPublicarii: '6.11.2026' })).ok, false);
});

test('refreshBnrRate: descarcă și salvează cursul + data publicării', async () => {
  const f = fakeFetch([{ body: BODY }]);
  assert.equal(await refreshBnrRate({ fetchImpl: f.impl, now: SAT }), 'actualizat');
  assert.equal(f.calls[0].url, BNR_RATE_URL);
  const d = globalThis.chrome.dump();
  assert.deepEqual(d[DATA_KEYS.EXCHANGE_RATE], bnrRate());
  assert.deepEqual(d[DATA_KEYS.RATE_STATUS], { incercatLa: SAT.toISOString(), ok: true });
  // La zi: nicio cerere nouă.
  assert.equal(await refreshBnrRate({ fetchImpl: f.impl, now: new Date(SAT.getTime() + 2 * RETRY_AFTER_MS) }), 'omis');
  assert.equal(f.calls.length, 1);
});

test('refreshBnrRate: la eșec păstrează ultimul curs valid și îl marchează posibil depășit', async () => {
  await globalThis.chrome.storage.local.set({ [DATA_KEYS.EXCHANGE_RATE]: bnrRate() });
  for (const failure of [new TypeError('offline'), { status: 503 }, { body: { error: 'x' } }]) {
    globalThis.chrome.dump()[DATA_KEYS.RATE_STATUS] = undefined;
    const f = fakeFetch([failure]);
    assert.equal(await refreshBnrRate({ fetchImpl: f.impl, now: MON_AFTER }), 'eroare');
    const d = globalThis.chrome.dump();
    assert.deepEqual(d[DATA_KEYS.EXCHANGE_RATE], bnrRate());
    assert.deepEqual(d[DATA_KEYS.RATE_STATUS], { incercatLa: MON_AFTER.toISOString(), ok: false });
    const desc = describeRate(d[DATA_KEYS.EXCHANGE_RATE], d[DATA_KEYS.RATE_STATUS], MON_AFTER);
    assert.equal(desc.outdated, true);
    assert.match(desc.text, /Curs BNR: 1 EUR = 5,3408 RON, publicat 06\.11\.2026/);
  }
});

test('refreshBnrRate: nu înlocuiește cursul introdus de utilizator și nu face cereri în modul demo', async () => {
  const f = fakeFetch([{ body: BODY }, { body: BODY }]);
  await saveExchangeRate(4.97, SAT);
  assert.equal(await refreshBnrRate({ fetchImpl: f.impl, now: MON_AFTER, force: true }), 'omis');
  assert.equal(globalThis.chrome.dump()[DATA_KEYS.EXCHANGE_RATE].eurToRon, 4.97);

  globalThis.chrome = fakeChrome();
  await updateSettings({ modDemo: true });
  assert.equal(await refreshBnrRate({ fetchImpl: f.impl, now: MON_AFTER, force: true }), 'omis');
  await loadDemoScenario();
  assert.equal(await switchToBnrRate({ fetchImpl: f.impl, now: MON_AFTER }), 'omis');
  assert.equal(f.calls.length, 0);
});

test('switchToBnrRate: renunță la cursul manual și descarcă cursul BNR', async () => {
  await saveExchangeRate(4.97, SAT);
  const f = fakeFetch([{ body: BODY }]);
  assert.equal(await switchToBnrRate({ fetchImpl: f.impl, now: SAT }), 'actualizat');
  assert.deepEqual(globalThis.chrome.dump()[DATA_KEYS.EXCHANGE_RATE], bnrRate());
});

test('calculele folosesc cursul BNR: chiria și garanția în EUR devin RON', () => {
  const rate = bnrRate();
  const ctx = costContext({ passport: demoPassport, rate, rateStatus: null, settings: { modDemo: true } });
  const tc = trueCostOf(demoSavedA, ctx); // anunțul A: 350 EUR/lună, garanție 2 chirii
  const chirie = toRON(350, 'EUR', rate);
  assert.equal(chirie, 1869);
  assert.equal(tc.lunar.chirie.sumaRON, chirie);
  assert.equal(tc.initial.garantie.sumaRON, 2 * chirie);
  assert.deepEqual(costItemDetails(tc.lunar.chirie, rate, { showEur: true }), ['350 EUR × 5,3408']);
  // Fără curs: tot incomplet, nu există curs implicit.
  assert.equal(trueCostOf(demoSavedA, costContext({ passport: demoPassport, rate: null, settings: { modDemo: true } })).complet, false);
});

test('afișare: sumele în RON primesc echivalentul în EUR', () => {
  const rate = bnrRate();
  assert.equal(fromRON(1950, rate), 365);
  assert.equal(fromRON(1950, null), null);
  assert.equal(formatRONWithEUR(1950, rate), '1.950 RON (≈ 365 EUR)');
  assert.equal(formatRONWithEUR(1950, null), '1.950 RON');
  assert.deepEqual(costItemDetails({ sumaRON: 1950, original: null, interval: null, nota: null }, rate, { showEur: true }), ['≈ 365 EUR']);
  assert.deepEqual(costItemDetails({ sumaRON: 1950, original: null, interval: null, nota: null }, rate), []);
});

test('eticheta comisionului: precizat în anunț sau estimat la 50%', async () => {
  const { commissionHint } = await import('../../extension/src/ui/format.js');
  assert.equal(commissionHint({ sumaRON: 1000, sursa: 'estimare' }), 'estimat la 50% din chirie');
  assert.equal(commissionHint({ sumaRON: 1500, sursa: 'anunt' }), 'specificat în anunț');
  assert.equal(commissionHint({ sumaRON: 0, sursa: 'anunt' }), 'fără comision, conform anunțului');
  assert.equal(commissionHint({ sumaRON: 0, sursa: 'confirmat' }), 'confirmat de proprietar');
});
