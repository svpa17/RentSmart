import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTrueCost } from '../trueCost.js';
import { simulate } from '../simulate.js';
import { computePathToYes, pathToYesHorizons, planSimulationInput } from '../pathToYes.js';
import { ContractError, validatePathToYes } from '../../contracts/schemas.js';
import {
  demoCostReference,
  demoExchangeRate,
  demoPassport,
  demoSavedA,
  demoSavedB,
  demoSimulationSettings,
  demoStormJobLoss,
} from '../../contracts/fixtures/demoScenario.js';

const ctx = { passport: demoPassport, costReference: demoCostReference, exchangeRate: demoExchangeRate };
const tcA = computeTrueCost(demoSavedA, ctx);
const tcB = computeTrueCost(demoSavedB, ctx);

const ptyInput = (overrides = {}) => ({
  passport: demoPassport,
  apartament: tcA,
  apartamenteSalvate: [tcA, tcB],
  furtuni: [],
  ...demoSimulationSettings,
  ...overrides,
});
const pty = (overrides) => computePathToYes(ptyInput(overrides));
const byType = (r, tip) => r.optiuni.filter((o) => o.tip === tip);
const minBani = (sim) => Math.min(...sim.drumuri[0].luni.map((m) => m.bani));

// Scenariu „capcană”: după mutare A pierde bani în fiecare lună de iarnă.
// Înainte de mutare: 4.000 − 1.500 − 400 − 150 = +1.950/lună. După: vara 0, iarna −450, mutarea −5.875.
const trapPassport = { ...demoPassport, venitNetLunar: 4000, economiiDisponibile: 0, rezervaMinima: 0, lunaMutarii: 0 };

test('scenariul demo fără furtuni: ambele apartamente sunt deja sigure, fără opțiuni', () => {
  for (const apartament of [tcA, tcB]) {
    const r = pty({ apartament });
    assert.ok(validatePathToYes(r).ok, JSON.stringify(validatePathToYes(r).errors));
    assert.equal(r.sigurDeja, true);
    assert.deepEqual(r.optiuni, []);
    assert.equal(r.celMaiApropiat, null);
    assert.equal(r.pragSigur, 1000);
  }
});

test('demo cu pierderea venitului: B e sigur; A primește toate cele 4 opțiuni, calculate de mână', () => {
  assert.equal(pty({ apartament: tcB, furtuni: [demoStormJobLoss] }).sigurDeja, true);

  const r = pty({ furtuni: [demoStormJobLoss] });
  assert.equal(r.sigurDeja, false);
  assert.deepEqual(r.optiuni.map((o) => o.tip), ['amanare', 'rezervaSuplimentara', 'altApartament', 'reducereCheltuieli']);
  // Comision estimat 875 (50% din 1.750). m' = 3: mutarea în aprilie → minim 1.575 → sigur. P = max(12 − 2, 12) = 12.
  assert.deepEqual(byType(r, 'amanare')[0], {
    tip: 'amanare', listingId: 'demo-a', lunaMutarii: 3, orizontVerificat: 15, luniVerificateDupaMutare: 12,
  });
  // Soldul minim −825 (mai), prag 1.000 → deficit 1.825.
  assert.equal(byType(r, 'rezervaSuplimentara')[0].sumaRON, 1825);
  assert.deepEqual(byType(r, 'altApartament')[0], { tip: 'altApartament', listingId: 'demo-b', deLaListingId: 'demo-a' });
  // În luna 4: −825 + 5d ≥ 1.000 → d = 365.
  assert.deepEqual(byType(r, 'reducereCheltuieli')[0], {
    tip: 'reducereCheltuieli', listingId: 'demo-a', sumaLunaraRON: 365, doarDacaERealist: true,
  });
  assert.equal(r.celMaiApropiat, null);
});

test('amânarea este verificată pe P luni după noua mutare: varianta care devine negativă după N e respinsă', () => {
  const input = { passport: trapPassport, luni: 6, furtuni: [] };
  // Capcana: verificată doar pe N = 6 luni, mutarea în luna 4 pare sigură…
  const naive = simulate({ ...demoSimulationSettings, ...input, passport: { ...trapPassport, lunaMutarii: 4 }, apartamente: [tcA] });
  assert.equal(naive.drumuri[0].indicatori.sigur, true);
  // …dar pe 4 + 12 luni iarna o duce pe minus (ianuarie, t = 12: −300). Prima variantă sigură: m' = 5.
  const r = pty(input);
  assert.deepEqual(byType(r, 'amanare')[0], {
    tip: 'amanare', listingId: 'demo-a', lunaMutarii: 5, orizontVerificat: 17, luniVerificateDupaMutare: 12,
  });
  // Planul actual: −7.225 după mutarea din ianuarie → deficit 7.225; nicio reducere ≤ E nu ajunge.
  assert.equal(byType(r, 'rezervaSuplimentara')[0].sumaRON, 7225);
  assert.equal(byType(r, 'reducereCheltuieli').length, 0);
  // Mesaj onest: după mutare cheltuielile depășesc venitul.
  assert.match(r.mesaj, /doar amână problema/);
});

test('mutarea după perioada simulată nu e considerată sigură fără verificarea perioadei de după mutare', () => {
  const passport = { ...trapPassport, lunaMutarii: 3 };
  const naive = simulate({ passport, apartamente: [tcA], luni: 3, lunaStart: 1, furtuni: [] });
  assert.equal(naive.drumuri[0].indicatori.sigur, true); // doar luni „înainte”
  const r = pty({ passport, luni: 3 });
  assert.equal(r.sigurDeja, false); // pe 3 + 12 luni: −900 în luna mutării
  assert.equal(byType(r, 'amanare')[0].lunaMutarii, 5);

  // Demo, mutare în luna 12, perioadă 6: verificat pe 24 de luni → sigur.
  const ok = pty({ passport: { ...demoPassport, lunaMutarii: 12 }, luni: 6 });
  assert.equal(ok.sigurDeja, true);
  assert.match(ok.mesaj, /24 luni/);
  assert.deepEqual(pathToYesHorizons(12, 6), { P: 12, orizontPlan: 24, verificabil: true });
});

test('m\' + P > 60 este exclus', () => {
  // N = 60, m = 2 → P = 58 → orice m' ≥ 3 depășește 60: nicio amânare.
  const r60 = pty({ furtuni: [demoStormJobLoss], luni: 60 });
  assert.equal(r60.sigurDeja, false);
  assert.equal(byType(r60, 'amanare').length, 0);
  assert.equal(byType(r60, 'rezervaSuplimentara').length, 1);
  // Oricare ar fi perioada, orizontul verificat nu trece de 60.
  for (const luni of [1, 6, 12, 24, 36, 48, 50]) {
    for (const o of byType(pty({ furtuni: [demoStormJobLoss], luni }), 'amanare')) {
      assert.ok(o.orizontVerificat <= 60, `${luni}: ${o.orizontVerificat}`);
      assert.equal(o.luniVerificateDupaMutare, Math.max(luni - 2, 12));
    }
  }
});

test('fără soluție: mutarea prea departe pentru a fi verificată → fără opțiuni, mesaj onest', () => {
  const r = pty({ passport: { ...demoPassport, lunaMutarii: 50 }, luni: 12 });
  assert.ok(validatePathToYes(r).ok);
  assert.equal(r.sigurDeja, false);
  assert.deepEqual(r.optiuni, []);
  assert.equal(r.celMaiApropiat, null);
  assert.match(r.mesaj, /nu putem spune încă dacă îți permiți chiria/);
});

test('alt apartament: doar dintre cele salvate, complete, diferite de cel analizat și sigure', () => {
  const tcAFaraCurs = { ...computeTrueCost(demoSavedA, { ...ctx, exchangeRate: null }), listingId: 'a-fara-curs' };
  assert.equal(tcAFaraCurs.complet, false);
  const r = pty({ furtuni: [demoStormJobLoss], apartamenteSalvate: [tcA, tcAFaraCurs] });
  assert.equal(byType(r, 'altApartament').length, 0);
  // B nu e sigur când pierderea venitului durează 3 luni → nu e propus.
  const lung = { ...demoStormJobLoss, durata: 3 };
  assert.equal(pty({ apartament: tcB, furtuni: [lung] }).sigurDeja, false);
  assert.equal(byType(pty({ furtuni: [lung] }), 'altApartament').length, 0);
});

test('fiecare opțiune, rulată prin același motor, face planul sigur; valorile sunt minime', () => {
  const input = ptyInput({ furtuni: [demoStormJobLoss] });
  const r = computePathToYes(input);
  for (const o of r.optiuni) {
    const sim = simulate(planSimulationInput(o, input));
    assert.ok(minBani(sim) >= r.pragSigur, `${o.tip}: ${minBani(sim)}`);
  }
  // Minimalitate: cu 1 RON mai puțin, rezerva și reducerea nu mai ajung.
  const rez = byType(r, 'rezervaSuplimentara')[0];
  assert.ok(minBani(simulate(planSimulationInput({ ...rez, sumaRON: rez.sumaRON - 1 }, input))) < r.pragSigur);
  const red = byType(r, 'reducereCheltuieli')[0];
  assert.ok(minBani(simulate(planSimulationInput({ ...red, sumaLunaraRON: red.sumaLunaraRON - 1 }, input))) < r.pragSigur);
  // Amânarea din „Planul” extinde drumul până la orizontul verificat.
  assert.equal(planSimulationInput(byType(r, 'amanare')[0], input).luni, 15);
});

test('apartamentul incomplet este respins; rezultatul este determinist și valid', () => {
  const tcIncomplet = computeTrueCost(demoSavedA, { ...ctx, exchangeRate: null });
  assert.throws(() => pty({ apartament: tcIncomplet }), ContractError);
  assert.throws(() => pty({ luni: 0 }), ContractError);
  const input = { furtuni: [demoStormJobLoss, { id: 'chirie', tip: 'crestereChirie', start: 6, procent: 15 }], luni: 24 };
  const a = pty(input);
  assert.deepEqual(a, pty(input));
  assert.ok(validatePathToYes(a).ok, JSON.stringify(validatePathToYes(a).errors));
});
