import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { computeTrueCost } from '../../extension/src/shared/engine/trueCost.js';
import { buildCrossroads, calendarMonthToT, negativeLabel, chartLineName, moveDates, negativeShortLabel, pathStatus, selectPaths } from '../../extension/src/crossroads/model.js';
import { linearScale, monthLabel, monthTicks, moneyDomain, niceStep, spansYears, startYear, tickStep, yearOf } from '../../extension/src/crossroads/scales.js';
import { defaultStormValues, describeStorm, makeStorm, prefillFromClassification } from '../../extension/src/crossroads/storms.js';
import { parseMoveMonth, parsePeriod, QUICK_PERIODS } from '../../extension/src/crossroads/inputs.js';
import { DEMO_STORM_TEXT, findRecordedStorm } from '../../extension/src/demo/index.js';
import { classifyStormText } from '../../extension/src/ai/client.js';
import { addStorm, clearStorms, DATA_KEYS, loadDemoScenario, removeStorm, saveSimSettings } from '../../extension/src/storage/appData.js';
import { ContractError } from '../../extension/src/shared/contracts/schemas.js';
import {
  demoCostReference,
  demoExchangeRate,
  demoExpected,
  demoPassport,
  demoSavedA,
  demoSavedB,
  demoStormJobLoss,
} from '../../extension/src/shared/contracts/fixtures/demoScenario.js';

const ctx = { passport: demoPassport, costReference: demoCostReference, exchangeRate: demoExchangeRate };
const items = [demoSavedA, demoSavedB].map((s) => ({ saved: s, tc: computeTrueCost(s, ctx) }));
const SIM = { luni: 12, lunaStart: 1, drumuri: [] };
const build = (over = {}) => buildCrossroads({ ctx, items, simSettings: SIM, storms: [], ...over });
const bani = (d) => d.luni.map((m) => m.bani);

test('Crossroads demo fără furtuni: ambele drumuri sigure, fără „Planul”; cifrele vin din motor', () => {
  const m = build();
  assert.equal(m.status, 'ok');
  assert.deepEqual(m.paths.map((p) => p.eticheta), ['A', 'B']);
  assert.deepEqual(bani(m.paths[0].drum), demoExpected.faraFurtuna['demo-a'].bani);
  assert.deepEqual(bani(m.paths[1].drum), demoExpected.faraFurtuna['demo-b'].bani);
  assert.ok(m.paths.every((p) => p.pathToYes.sigurDeja));
  assert.equal(m.plan, null);
  assert.equal(m.xLuni, 12);
  assert.equal(m.paths[0].garantie, 3500);
  assert.equal(m.paths[0].plataLaMutare, 5875);
});

test('furtuna demo: A pe minus în mai (−825), B sigur; Path to Yes pentru A și „Planul” implicit = amânarea verificată', () => {
  const m = build({ storms: [demoStormJobLoss] });
  const [a, b] = m.paths;
  assert.deepEqual(bani(a.drum), demoExpected.cuFurtunaJob['demo-a'].bani);
  assert.equal(a.drum.indicatori.primaLunaNegativa, 4);
  assert.equal(negativeLabel(1, 4), 'Din mai, cheltuielile depășesc banii pe care îi ai');
  assert.equal(negativeShortLabel(1, 4), 'Din mai: bani insuficienți');
  assert.deepEqual(pathStatus(a.drum.indicatori), { tone: 'ask', text: 'bani insuficienți' });
  assert.deepEqual(pathStatus(b.drum.indicatori), { tone: 'ok', text: 'în siguranță' });
  assert.equal(b.drum.indicatori.sigur, true);
  assert.deepEqual(a.optiuni.map((o) => o.tip), ['amanare', 'rezervaSuplimentara', 'altApartament', 'reducereCheltuieli']);
  assert.equal(a.optiuni[0].text.titlu, 'Amână mutarea cu 1 lună');
  assert.match(a.optiuni[0].text.detaliu, /^Te muți în aprilie( \d{4})?\. Am verificat 12 luni după mutare\.$/);
  assert.equal(a.optiuni[1].text.titlu, 'Strânge încă 1.825 RON înainte de mutare');
  assert.equal(a.optiuni[2].text.titlu, 'Alege B · Apartament 2 camere Gheorgheni (bloc 2015)');
  assert.match(a.optiuni[2].text.detaliu, /^Dintre anunțurile tale salvate/);
  assert.equal(a.optiuni[3].text.titlu, 'Redu cheltuielile lunare cu 365 RON');
  // Planul implicit: mutarea în luna 3 (aprilie), drum prelungit la 3 + 12 = 15 luni.
  assert.equal(m.plan.listingId, 'demo-a');
  assert.equal(m.plan.lunaMutarii, 3);
  assert.equal(m.plan.drum.luni.length, 15);
  assert.equal(m.plan.luniVerificateDupaMutare, 12);
  assert.equal(Math.min(...bani(m.plan.drum)), 1575);
  assert.equal(m.xLuni, 15);
});

test('„Planul” urmează opțiunea aleasă: rezerva, alt apartament, reducerea — toate sigure', () => {
  const storms = [demoStormJobLoss];
  const rez = build({ storms, planChoice: { listingId: 'demo-a', index: 1 } });
  assert.equal(Math.min(...bani(rez.plan.drum)), 1000); // −825 + 1.825 = exact pragul
  assert.equal(rez.xLuni, 12);
  const alt = build({ storms, planChoice: { listingId: 'demo-a', index: 2 } });
  assert.deepEqual(bani(alt.plan.drum), demoExpected.cuFurtunaJob['demo-b'].bani);
  const red = build({ storms, planChoice: { listingId: 'demo-a', index: 3 } });
  assert.equal(red.plan.drum.luni[4].bani, 1000); // −825 + 5 × 365
  assert.ok(bani(red.plan.drum).every((v) => v >= 1000));
  // O alegere pentru un drum sigur sau un index prea mare cade pe o valoare validă.
  assert.equal(build({ storms, planChoice: { listingId: 'demo-b', index: 0 } }).plan.listingId, 'demo-a');
  assert.equal(build({ storms, planChoice: { listingId: 'demo-a', index: 99 } }).plan.index, 3);
});

test('perioade 1–60, mutarea după perioadă, creșterea chiriei peste buget, stări fără date', () => {
  assert.equal(build({ simSettings: { ...SIM, luni: 60 } }).xLuni, 60);
  assert.equal(build({ simSettings: { ...SIM, luni: 1 } }).paths[0].drum.luni.length, 1);
  const late = buildCrossroads({ ctx: { ...ctx, passport: { ...demoPassport, lunaMutarii: 12 } }, items, simSettings: { ...SIM, luni: 6 }, storms: [] });
  assert.ok(late.sim.avertizari.some((w) => w.cod === 'MUTARE_DUPA_PERIOADA'));
  const rent = build({ storms: [{ id: 'r', tip: 'crestereChirie', start: 6, procent: 10 }] });
  assert.ok(rent.sim.avertizari.some((w) => w.cod === 'CHIRIE_PESTE_BUGET' && w.luna === 6));
  assert.equal(rent.paths[1].drum.indicatori.primaLunaPesteBuget, 6);
  assert.equal(buildCrossroads({ ctx: null, items, simSettings: SIM, storms: [] }).status, 'fara-passport');
  const noRate = [demoSavedA].map((s) => ({ saved: s, tc: computeTrueCost(s, { ...ctx, exchangeRate: null }) }));
  const empty = buildCrossroads({ ctx, items: noRate, simSettings: SIM, storms: [] });
  assert.equal(empty.status, 'fara-anunturi');
  assert.deepEqual(empty.incomplete[0].motive, ['CURS_LIPSA']);
});

test('alegerea drumurilor: ordinea aleasă, maximum 2, doar complete', () => {
  const extra = { saved: { ...demoSavedB, analiza: { ...demoSavedB.analiza, id: 'c' } }, tc: { ...items[1].tc, listingId: 'c' } };
  const all = [...items, extra];
  assert.deepEqual(selectPaths(all, ['c', 'demo-a']).map((i) => i.saved.analiza.id), ['c', 'demo-a']);
  assert.deepEqual(selectPaths(all, []).map((i) => i.saved.analiza.id), ['demo-a', 'demo-b']);
  assert.deepEqual(selectPaths(all, ['sters', 'c']).map((i) => i.saved.analiza.id), ['c']);
  assert.deepEqual(build({ simSettings: { ...SIM, drumuri: ['demo-b'] } }).paths.map((p) => p.listingId), ['demo-b']);
});

test('marcaje și scale: lunar ≤12, din 3 în 3 ≤24, din 6 în 6 peste; etichete de lună', () => {
  assert.deepEqual([tickStep(3), tickStep(12), tickStep(13), tickStep(24), tickStep(25), tickStep(60)], [1, 1, 3, 3, 6, 6]);
  assert.equal(monthTicks(12).length, 12);
  assert.deepEqual(monthTicks(24), [0, 3, 6, 9, 12, 15, 18, 21, 23]);
  assert.deepEqual(monthTicks(60).slice(-2), [54, 59]);
  assert.deepEqual(monthTicks(1), [0]);
  // Numele reale ale lunilor, fără „Luna N” / „L3”; anul apare doar când perioada trece peste un an.
  assert.equal(monthLabel(1, 4), 'mai');
  assert.equal(monthLabel(11, 2, { long: false }), 'ian');
  assert.equal(monthLabel(4, 0, { capital: true }), 'Aprilie');
  const now = new Date(2026, 10, 8); // 8 noiembrie 2026
  assert.equal(startYear(11, now), 2026, 'noiembrie: luna curentă → anul acesta');
  assert.equal(startYear(3, now), 2027, 'martie a trecut → anul viitor');
  assert.equal(spansYears(1, 12), false);
  assert.equal(spansYears(11, 2), false);
  assert.equal(spansYears(11, 3), true);
  assert.equal(monthLabel(11, 2, { luni: 3, now }), 'ianuarie 2027');
  assert.equal(monthLabel(11, 0, { luni: 3, now }), 'noiembrie 2026');
  assert.equal(monthLabel(11, 2, { luni: 2, now }), 'ianuarie', 'fără an când nu se trece peste un an');
  assert.equal(yearOf(11, 14, now), 2028);
  assert.equal(calendarMonthToT(4, 1), 3);
  assert.equal(calendarMonthToT(4, 11), 5);
  assert.equal(calendarMonthToT(13, 1), null);
  assert.equal(niceStep(30000), 10000); // 30.000 / 5 = 6.000 → pasul rotund 10.000
  assert.equal(niceStep(12000), 2500); // 2.400 → 2.500
  const d = moneyDomain([-1700, 22050], 1000);
  assert.ok(d.min <= -1700 && d.max >= 22050 && d.ticks.includes(0));
  assert.ok(moneyDomain([5000, 9000], 1000).min <= 0, 'zero apare mereu pe axă');
  const y = linearScale([0, 100], [200, 0]);
  assert.equal(y(50), 100);
});

test('furtunile: construite din formular, validate, descrise; precompletare din clasificarea AI', () => {
  const s = makeStorm('pierdereVenit', { start: 3, durata: 2, procent: 100 }, 'x');
  assert.deepEqual(s, { id: 'x', tip: 'pierdereVenit', start: 3, durata: 2, procent: 100 });
  assert.equal(describeStorm(s, 1), 'Pierzi tot venitul timp de 2 luni, din aprilie');
  assert.equal(describeStorm(makeStorm('cheltuialaNeprevazuta', { luna: 6, suma: 800 }, 'y'), 1), 'Plătești 800 RON neprevăzut în iulie');
  assert.throws(() => makeStorm('pierdereVenit', { start: 3, durata: 2, procent: 0 }, 'z'), ContractError);
  assert.throws(() => makeStorm('cheltuialaNeprevazuta', { luna: 2, suma: 0 }, 'z'), ContractError);
  assert.deepEqual(defaultStormValues('crestereChirie', { luni: 12, lunaMutarii: 2 }), { start: 3, procent: 10 });

  const ctxF = { luni: 12, lunaStart: 1, lunaMutarii: 2 };
  assert.deepEqual(prefillFromClassification({ tip: 'pierdereVenit', start: 4, durata: 2 }, ctxF), { tip: 'pierdereVenit', values: { start: 3, durata: 2, procent: 100 } });
  assert.equal(prefillFromClassification({ tip: 'cheltuialaNeprevazuta', start: 6, durata: null }, ctxF).values.luna, 5);
  assert.equal(prefillFromClassification({ tip: null }, ctxF), null);
  assert.equal(prefillFromClassification({ tip: 'pierdereVenit', start: 12, durata: null }, { ...ctxF, luni: 6 }).values.start, 3, 'luna în afara perioadei → implicit');
});

test('modul demo: furtuna înregistrată reproduce exact scenariul din plan (A pe minus în mai)', () => {
  const c = findRecordedStorm(DEMO_STORM_TEXT);
  assert.deepEqual(c, { tip: 'pierdereVenit', start: 4, durata: 2 });
  assert.equal(findRecordedStorm('Am o reparație la mașină'), null);
  const pre = prefillFromClassification(c, { luni: 12, lunaStart: 1, lunaMutarii: 2 });
  const storm = makeStorm(pre.tip, pre.values, demoStormJobLoss.id);
  assert.deepEqual(storm, demoStormJobLoss);
  const m = build({ storms: [storm] });
  assert.equal(m.paths[0].drum.indicatori.soldMinim, -825);
});

test('textul liber al furtunii pleacă la AI cu sumele mascate', async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ ok: true, data: { tip: 'pierdereVenit', start: 4, durata: 2 } }), { status: 200 });
  };
  const r = await classifyStormText('Pierd jobul 2 luni din aprilie, salariul de 5.200 lei', { baseUrl: 'http://api', fetchImpl, installId: 'i' });
  assert.equal(r.ok, true);
  assert.deepEqual(seen[0], { task: 'storm', text: 'Pierd jobul 2 luni din aprilie, salariul de [SUMĂ]' });
});

test('comenzile: perioada 1–60 întreagă, luna mutării 0–60', () => {
  assert.deepEqual(QUICK_PERIODS, [3, 6, 12, 18, 24]);
  assert.deepEqual(['1', '12', '60', ' 24 '].map(parsePeriod), [1, 12, 60, 24]);
  assert.deepEqual(['0', '61', '2.5', '-3', 'abc', ''].map(parsePeriod), [null, null, null, null, null, null]);
  assert.deepEqual(['0', '60', '61', '1,5'].map(parseMoveMonth), [0, 60, null, null]);
});

// ---------------------------------------------------------------------------
// Stocarea setărilor simulării și a furtunilor (chrome.storage simulat)

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
        async clear() {
          data = {};
        },
      },
      onChanged: { addListener() {}, removeListener() {} },
    },
  };
}

beforeEach(() => {
  globalThis.chrome = fakeChrome();
});

test('setările simulării și furtunile: validate la salvare; scenariul demo = 12 luni din ianuarie, A și B', async () => {
  const s = await saveSimSettings({ luni: 24, lunaStart: 3 });
  assert.equal(s.luni, 24);
  await assert.rejects(saveSimSettings({ luni: 61 }), RangeError);
  await assert.rejects(saveSimSettings({ lunaStart: 0 }), RangeError);
  await assert.rejects(saveSimSettings({ drumuri: ['a', 'b', 'c'] }), RangeError);

  await addStorm(demoStormJobLoss);
  await addStorm({ id: 'r', tip: 'crestereChirie', start: 6, procent: 10 });
  await assert.rejects(addStorm({ id: 'bad', tip: 'pierdereVenit', start: 99, durata: 1, procent: 50 }), ContractError);
  assert.equal(globalThis.chrome.dump()[DATA_KEYS.STORMS].length, 2);
  await removeStorm('r');
  assert.deepEqual(globalThis.chrome.dump()[DATA_KEYS.STORMS], [demoStormJobLoss]);
  await clearStorms();
  assert.deepEqual(globalThis.chrome.dump()[DATA_KEYS.STORMS], []);

  await addStorm(demoStormJobLoss);
  await loadDemoScenario();
  assert.deepEqual(globalThis.chrome.dump()[DATA_KEYS.SIM_SETTINGS], { luni: 12, lunaStart: 1, drumuri: ['demo-a', 'demo-b'] });
  assert.deepEqual(globalThis.chrome.dump()[DATA_KEYS.STORMS], []);
});

test('graficul: datele de mutare vin doar din calcule (planificată vs recomandată), fără date inventate', () => {
  const storms = [demoStormJobLoss];
  // Fără probleme: nicio recomandare inventată; data planificată e suficientă.
  const safe = moveDates(build());
  assert.deepEqual(safe.planificata, { t: 2, inPerioada: true });
  assert.equal(safe.recomandata.status, 'nu-e-nevoie');
  assert.equal(safe.recomandata.t, null);

  // Cu furtuna: varianta implicită e amânarea → mutarea recomandată e luna următoare (aprilie), pentru A.
  const m = build({ storms });
  const d = moveDates(m);
  assert.equal(d.planificata.t, 2);
  assert.deepEqual(
    { status: d.recomandata.status, t: d.recomandata.t, pentru: d.recomandata.pentru, actiune: d.recomandata.actiune },
    { status: 'diferita', t: m.plan.lunaMutarii, pentru: 'A', actiune: 'Amână mutarea cu 1 lună' },
  );
  assert.equal(d.recomandata.t, 3);

  // Varianta aleasă nu mută data (strângi bani în plus): recomandarea păstrează luna planificată.
  const rez = moveDates(build({ storms, planChoice: { listingId: 'demo-a', index: 1 } }));
  assert.equal(rez.recomandata.status, 'aceeasi');
  assert.equal(rez.recomandata.t, 2);

  // Problemă fără nicio variantă calculată: „nu am găsit”, fără lună.
  const none = moveDates({ sim: { lunaMutarii: 2, luni: 12 }, xLuni: 12, plan: null, paths: [{ drum: { indicatori: { sigur: false } } }] });
  assert.deepEqual(none.recomandata, { status: 'negasita', t: null, inPerioada: false, pentru: null, actiune: null });

  // Numele liniilor: unul singur → „Dacă alegi acest apartament”; mai multe → cu litera și titlul.
  assert.equal(chartLineName(m.paths[0], 1), 'Dacă alegi acest apartament');
  assert.match(chartLineName(m.paths[1], 2), /^Dacă alegi B · /);
});
