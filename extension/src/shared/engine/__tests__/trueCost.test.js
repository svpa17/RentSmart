import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTrueCost } from '../trueCost.js';
import { toRON } from '../currency.js';
import { totalToMoveIn } from '../budget.js';
import { validateTrueCost } from '../../contracts/schemas.js';
import {
  demoCostReference,
  demoExchangeRate,
  demoExpected,
  demoPassport,
  demoSavedA,
  demoSavedB,
} from '../../contracts/fixtures/demoScenario.js';

const ctx = { passport: demoPassport, costReference: demoCostReference, exchangeRate: demoExchangeRate };
const clone = (x) => structuredClone(x);
const NOW = '2027-01-05T10:00:00.000Z';

test('costul real al anunțurilor demo corespunde calculelor de mână', () => {
  for (const saved of [demoSavedA, demoSavedB]) {
    const tc = computeTrueCost(saved, ctx);
    const exp = demoExpected.trueCost[saved.analiza.id];
    assert.ok(validateTrueCost(tc).ok, JSON.stringify(validateTrueCost(tc).errors));
    assert.equal(tc.complet, true);
    assert.equal(tc.lunar.chirie.sumaRON, exp.chirie);
    assert.equal(tc.totaluri.lunarVara, exp.lunarVara);
    assert.equal(tc.totaluri.lunarIarna, exp.lunarIarna);
    assert.equal(tc.initial.garantie.sumaRON, exp.garantie);
    assert.equal(tc.initial.comision.sumaRON, exp.comision);
    assert.equal(tc.totaluri.initialDefinitiv, exp.initialDefinitiv);
    assert.equal(tc.totaluri.plataLaMutare, exp.plataLaMutare);
  }
});

test('EUR → RON folosește cursul explicit și păstrează suma originală', () => {
  const tc = computeTrueCost(demoSavedA, ctx);
  assert.equal(tc.lunar.chirie.sumaRON, 1750);
  assert.deepEqual(tc.lunar.chirie.original, { valoare: 350, moneda: 'EUR' });
  assert.equal(toRON(333.33, 'EUR', { ...demoExchangeRate, eurToRon: 4.9771 }), 1659);
  assert.equal(toRON(1950, 'RON', null), 1950);
});

test('fără curs, un anunț în EUR devine incomplet (CURS_LIPSA), nu e calculat greșit', () => {
  const tc = computeTrueCost(demoSavedA, { ...ctx, exchangeRate: null });
  assert.equal(tc.complet, false);
  assert.deepEqual(tc.motiveIncomplet, ['CURS_LIPSA']);
  assert.equal(tc.lunar.chirie, null);
  assert.equal(tc.totaluri.lunarVara, null);
  assert.ok(validateTrueCost(tc).ok);
  assert.equal(toRON(350, 'EUR', null), null);
});

test('un anunț în RON nu are nevoie de curs', () => {
  const tc = computeTrueCost(demoSavedB, { ...ctx, exchangeRate: null });
  assert.equal(tc.complet, true);
});

test('lipsa chiriei → incomplet (CHIRIE_LIPSA); chiria nu se estimează niciodată', () => {
  const s = clone(demoSavedB);
  s.analiza.campuri.chirie = { status: 'lipsa', valoare: null, moneda: null, dovada: null, actualizatLa: null, nota: null };
  const tc = computeTrueCost(s, ctx);
  assert.equal(tc.complet, false);
  assert.deepEqual(tc.motiveIncomplet, ['CHIRIE_LIPSA']);
  assert.equal(tc.lunar.chirie, null);
});

test('chiria presupusă de utilizator face apartamentul complet și e marcată ca atare', () => {
  const s = clone(demoSavedB);
  s.analiza.campuri.chirie = { status: 'presupus', valoare: 2000, moneda: 'RON', dovada: null, actualizatLa: NOW, nota: null };
  const tc = computeTrueCost(s, ctx);
  assert.equal(tc.complet, true);
  assert.equal(tc.lunar.chirie.sursa, 'presupus');
});

test('prima chirie nu este numărată ca și cost inițial', () => {
  const tc = computeTrueCost(demoSavedB, ctx);
  // garanție 1.950 + comision 0 + mutare 1.500 — fără chiria de 1.950 a primei luni.
  assert.equal(tc.totaluri.plataLaMutare, 3450);

  // Afișarea „Total de plătit la mutare” adaugă prima chirie peste plata la mutare (fără formulă nouă).
  assert.equal(totalToMoveIn(tc), 3450 + 1950);
  assert.equal(totalToMoveIn({ ...tc, complet: false }), null);
  assert.equal(totalToMoveIn(null), null);
});

test('utilități incluse în chirie → 0, nu estimare', () => {
  const s = clone(demoSavedA);
  s.analiza.campuri.utilitatiIncluse = { status: 'confirmat', valoare: true, dovada: null, actualizatLa: NOW, nota: null };
  const tc = computeTrueCost(s, ctx);
  assert.equal(tc.lunar.utilitatiVara.sumaRON, 0);
  assert.equal(tc.lunar.utilitatiIarna.sursa, 'inclus_in_chirie');
});

test('o singură valoare de întreținere cunoscută se folosește pentru ambele sezoane', () => {
  const s = clone(demoSavedB);
  s.analiza.campuri.intretinereIarna = { status: 'lipsa', valoare: null, moneda: null, dovada: null, actualizatLa: null, nota: null };
  const tc = computeTrueCost(s, ctx);
  assert.equal(tc.lunar.utilitatiIarna.sumaRON, 250);
  assert.equal(tc.folosesteEstimari, false);
});

test('costurile necunoscute folosesc capătul prudent și sunt marcate „estimare”', () => {
  const tc = computeTrueCost(demoSavedA, ctx);
  assert.equal(tc.lunar.utilitatiIarna.sumaRON, 900);
  assert.equal(tc.lunar.utilitatiIarna.sursa, 'estimare');
  // Comisionul nepomenit: exact 50% din chirie (1.750 → 875), fără interval.
  assert.equal(tc.initial.comision.sumaRON, 875);
  assert.equal(tc.initial.comision.sursa, 'estimare');
  assert.equal(tc.initial.comision.interval, null);
  assert.equal(tc.folosesteEstimari, true);
  assert.ok(tc.avertizari.some((w) => w.cod === 'ESTIMARI_FOLOSITE'));
});

test('confirmarea proprietarului înlocuiește estimarea și schimbă costul real', () => {
  const before = computeTrueCost(demoSavedA, ctx);
  const s = clone(demoSavedA);
  s.analiza.campuri.comision = { status: 'confirmat', valoare: 0, unitate: 'suma', moneda: 'RON', dovada: null, actualizatLa: NOW, nota: 'Fără comision' };
  s.analiza.campuri.intretinereIarna = { status: 'confirmat', valoare: 600, moneda: 'RON', dovada: null, actualizatLa: NOW, nota: null };
  const after = computeTrueCost(s, ctx);
  assert.equal(after.initial.comision.sumaRON, 0);
  assert.equal(after.initial.comision.sursa, 'confirmat');
  assert.equal(after.lunar.utilitatiIarna.sumaRON, 600);
  assert.equal(after.lunar.utilitatiVara.sumaRON, 600); // aceeași valoare pentru ambele sezoane
  assert.equal(after.totaluri.plataLaMutare, before.totaluri.plataLaMutare - 875);
});

test('transportul necompletat este presupus egal cu transportul actual', () => {
  const s = clone(demoSavedB);
  s.costuriUtilizator.transportLunarRON = null;
  const tc = computeTrueCost(s, ctx);
  assert.equal(tc.lunar.transport.sumaRON, demoPassport.transportActualLunar);
  assert.equal(tc.lunar.transport.sursa, 'presupus');
});

test('chiria peste bugetul maxim generează avertizare; bugetul 0 înseamnă nesetat', () => {
  const tight = computeTrueCost(demoSavedB, { ...ctx, passport: { ...demoPassport, bugetMaximChirie: 1800 } });
  const w = tight.avertizari.find((x) => x.cod === 'CHIRIE_PESTE_BUGET');
  assert.ok(w);
  assert.match(w.mesaj, /cu 150 RON/);
  const unset = computeTrueCost(demoSavedB, { ...ctx, passport: { ...demoPassport, bugetMaximChirie: 0 } });
  assert.equal(unset.avertizari.some((x) => x.cod === 'CHIRIE_PESTE_BUGET'), false);
});

// Comisionul de agenție (decizia utilizatorului): implicit exact 50% din chirie; ce spune anunțul are prioritate.
const withCommission = (chirie, comision) => {
  const s = clone(demoSavedA);
  s.analiza.campuri.chirie = { ...s.analiza.campuri.chirie, ...chirie };
  if (comision) s.analiza.campuri.comision = { status: 'gasit', dovada: 'x', actualizatLa: null, nota: null, ...comision };
  return computeTrueCost(s, ctx).initial.comision;
};
const RON2000 = { valoare: 2000, moneda: 'RON' };

test('comision nepomenit: 2.000 RON chirie → 1.000 RON comision estimat, o singură dată', () => {
  const c = withCommission(RON2000, null);
  assert.deepEqual([c.sumaRON, c.sursa, c.interval], [1000, 'estimare', null]);
  // Chirie în EUR: 50% din chiria convertită (350 EUR × 5 = 1.750 → 875).
  assert.equal(withCommission({ valoare: 350, moneda: 'EUR' }, null).sumaRON, 875);
  // Neclar („comision negociabil”) nu e o valoare: tot estimarea de 50%.
  assert.equal(withCommission(RON2000, { status: 'neclar', valoare: null, unitate: null, moneda: null }).sumaRON, 1000);
});

test('comision precizat în anunț: procentul, suma (și în EUR) și 0% se păstrează', () => {
  assert.equal(withCommission(RON2000, { valoare: 100, unitate: 'procent_chirie', moneda: null }).sumaRON, 2000);
  assert.equal(withCommission(RON2000, { valoare: 30, unitate: 'procent_chirie', moneda: null }).sumaRON, 600);
  assert.equal(withCommission(RON2000, { valoare: 1500, unitate: 'suma', moneda: 'RON' }).sumaRON, 1500);
  assert.equal(withCommission(RON2000, { valoare: 200, unitate: 'suma', moneda: 'EUR' }).sumaRON, 1000); // × 5
  const zero = withCommission(RON2000, { valoare: 0, unitate: 'suma', moneda: 'RON' });
  assert.deepEqual([zero.sumaRON, zero.sursa], [0, 'anunt']);
  assert.equal(withCommission(RON2000, { valoare: 0, unitate: 'procent_chirie', moneda: null }).sumaRON, 0);
});
