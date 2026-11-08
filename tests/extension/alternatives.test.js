// Verdictul financiar, clasamentul alternativelor (motor), imaginea anunțului (contract + extragere).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { computeTrueCost } from '../../extension/src/shared/engine/trueCost.js';
import { VERDICT, affordabilityHorizon, assessAffordability } from '../../extension/src/shared/engine/affordability.js';
import { POTRIVIRE, rankAlternatives } from '../../extension/src/shared/engine/alternatives.js';
import { createListingAnalysis } from '../../extension/src/shared/contracts/factories.js';
import { validateListingAnalysis } from '../../extension/src/shared/contracts/schemas.js';
import { readPage } from '../../extension/src/content/readPage.js';
import { runDetective } from '../../extension/src/ai/detective.js';
import {
  demoCostReference,
  demoExchangeRate,
  demoListingTextA,
  demoPassport,
  demoSavedA,
  demoSavedB,
  demoStormJobLoss,
} from '../../extension/src/shared/contracts/fixtures/demoScenario.js';

const ctx = { passport: demoPassport, costReference: demoCostReference, exchangeRate: demoExchangeRate };
const tcA = computeTrueCost(demoSavedA, ctx);
const tcB = computeTrueCost(demoSavedB, ctx);

test('verdict: din simulare (bani negativi / sub rezervă / peste buget); procentul = cost lunar mediu / venit', () => {
  // Venit 5.200; A: cost mediu 2.688 → 52%; B: 2.392 → 46%. Verificat pe luna mutării + 12 = 14 luni.
  const a = assessAffordability({ passport: demoPassport, trueCost: tcA, lunaStart: 1 });
  assert.deepEqual([a.verdict, a.procentVenit, a.costLunarMediu, a.luni], [VERDICT.PERMIS, 52, 2688, 14]);
  const b = assessAffordability({ passport: demoPassport, trueCost: tcB, lunaStart: 1 });
  assert.deepEqual([b.verdict, b.procentVenit], [VERDICT.PERMIS, 46]);
  // Cu pierderea venitului (scenariul demo): A pe minus în mai → „Nu este recomandată”; B rămâne sigur.
  const aStorm = assessAffordability({ passport: demoPassport, trueCost: tcA, lunaStart: 1, furtuni: [demoStormJobLoss] });
  assert.deepEqual([aStorm.verdict, aStorm.primaLunaNegativa, aStorm.soldMinim], [VERDICT.NERECOMANDAT, 4, -825]);
  assert.equal(assessAffordability({ passport: demoPassport, trueCost: tcB, lunaStart: 1, furtuni: [demoStormJobLoss] }).verdict, VERDICT.PERMIS);
  // Rezervă mai mare decât minimul simulat → tensionat (sub rezervă, dar nu negativ).
  const tight = assessAffordability({ passport: { ...demoPassport, rezervaMinima: 8000 }, trueCost: tcA, lunaStart: 1 });
  assert.equal(tight.verdict, VERDICT.TENSIONAT);
  // Chiria peste bugetul maxim → tensionat.
  const over = assessAffordability({ passport: { ...demoPassport, bugetMaximChirie: 1500 }, trueCost: tcA, lunaStart: 1 });
  assert.deepEqual([over.verdict, over.pesteBuget], [VERDICT.TENSIONAT, true]);
  // Fără Passport sau cost incomplet → nimic (interfața arată ce lipsește).
  assert.equal(assessAffordability({ passport: null, trueCost: tcA, lunaStart: 1 }), null);
  assert.equal(affordabilityHorizon(0), 12);
  assert.equal(affordabilityHorizon(50), 60);
});

const cand = (id, valoare, moneda, camere, suprafataMp, extra = {}) => ({
  id, sursa: 'storia', titlu: `Anunț ${id}`, url: `https://www.storia.ro/ro/oferta/${id}`, pret: { valoare, moneda }, camere, suprafataMp,
  localitate: 'Cluj-Napoca', cartier: null, imagine: null, ...extra,
});
const analyzed = { chirieRON: 1750, camere: 1, suprafataMp: 32 }; // anunțul demo A (garsonieră, 350 EUR × 5)

test('alternative: economii față de anunțul analizat, cost real prin același motor (comision 50%, garanție estimată)', () => {
  const { recomandari } = rankAlternatives({ candidates: [cand('c1', 1400, 'RON', 1, 30)], analyzed, ctx, maxChirieRON: 2000, lunaStart: 1 });
  const r = recomandari[0];
  // −350 RON/lună = 20%; garanție estimată 2 × 1.400 = 2.800; comision implicit 50% = 700; plata la mutare 3.500.
  assert.deepEqual([r.chirieRON, r.economieLunara, r.procentEconomie], [1400, 350, 20]);
  assert.deepEqual([r.garantie, r.comision, r.plataLaMutare], [2800, 700, 3500]);
  // Cost lunar: vara 1.400 + 450 + 150 = 2.000; iarna 1.400 + 900 + 150 = 2.450; media (7 × vara + 5 × iarna) / 12 = 2.188.
  assert.equal(r.costLunarMediu, 2188);
  assert.equal(r.potrivire, POTRIVIRE.EXCELENTA);
  assert.equal(r.verdict, VERDICT.PERMIS);
  // EUR → RON cu cursul afișat (5): 300 EUR = 1.500 RON.
  const eur = rankAlternatives({ candidates: [cand('c2', 300, 'EUR', 1, 30)], analyzed, ctx, maxChirieRON: null, lunaStart: 1 }).recomandari[0];
  assert.deepEqual([eur.chirieRON, eur.economieLunara, eur.procentEconomie], [1500, 250, 14]);
});

test('alternative: filtre (plafon, prag de plauzibilitate, mai ieftin), fără curs, nesigure excluse', () => {
  const r = rankAlternatives({
    candidates: [
      cand('ok', 1400, 'RON', 1, 30),
      cand('scump', 1800, 'RON', 1, 30), // nu e mai ieftin decât 1.750
      cand('pestePlafon', 2500, 'RON', 1, 30),
      cand('prea-ieftin', 800, 'RON', 1, 30), // sub 50% din 1.750 = 875: aproape sigur altceva
    ],
    analyzed,
    ctx,
    maxChirieRON: 2000,
    lunaStart: 1,
  });
  assert.deepEqual(r.recomandari.map((x) => x.id), ['ok']);
  assert.deepEqual(r.excluse, { faraCurs: 0, pestePlafon: 1, subPrag: 1, nuEMaiIeftin: 1, nesigure: 0 });
  assert.equal(r.pragPlauzibilitateRON, 875);
  const noRate = rankAlternatives({ candidates: [cand('e', 300, 'EUR', 1, 30)], analyzed, ctx: { ...ctx, exchangeRate: null }, maxChirieRON: null, lunaStart: 1 });
  assert.equal(noRate.excluse.faraCurs, 1);
  // Fără economii și cu pierderea venitului, o chirie de 1.700 duce banii pe minus → exclusă
  // (nu e „mai bună” doar fiindcă e mai ieftină decât anunțul analizat).
  const poor = { ...ctx, passport: { ...demoPassport, economiiDisponibile: 0 } };
  const storm = rankAlternatives({ candidates: [cand('aproape', 1700, 'RON', 1, 30)], analyzed, ctx: poor, maxChirieRON: null, lunaStart: 1, furtuni: [demoStormJobLoss] });
  assert.deepEqual([storm.recomandari.length, storm.excluse.nesigure], [0, 1]);
});

test('alternative: întâi siguranța și cât de comparabilă e, abia apoi prețul', () => {
  const r = rankAlternatives({
    candidates: [
      cand('mai-ieftin-dar-diferit', 1250, 'RON', 2, 55), // 2 camere, 55 mp: mai ieftin, dar mai puțin comparabil
      cand('comparabil', 1400, 'RON', 1, 30),
    ],
    analyzed,
    ctx,
    maxChirieRON: null,
    lunaStart: 1,
  });
  assert.deepEqual(r.recomandari.map((x) => [x.id, x.potrivire]), [
    ['comparabil', POTRIVIRE.EXCELENTA],
    ['mai-ieftin-dar-diferit', POTRIVIRE.ECONOMICA], // alt număr de camere: mai ieftin, dar mai puțin comparabil
  ]);
  // Determinist: același input → același clasament.
  assert.deepEqual(rankAlternatives({ candidates: [cand('b', 1400, 'RON', 1, 30), cand('a', 1400, 'RON', 1, 30)], analyzed, ctx, maxChirieRON: null, lunaStart: 1 }).recomandari.map((x) => x.id), ['a', 'b']);
});

test('contract: imaginea anunțului e opțională, doar https; analizele fără imagine rămân identice', () => {
  const base = { id: 'x', tip: 'pagina', analizatLa: '2026-11-08T10:00:00.000Z' };
  assert.equal('imagine' in createListingAnalysis(base).sursa, false);
  const withImg = createListingAnalysis({ ...base, imagine: 'https://img.example/a.jpg' });
  assert.equal(withImg.sursa.imagine, 'https://img.example/a.jpg');
  assert.ok(validateListingAnalysis(withImg).ok);
  for (const bad of ['http://img.example/a.jpg', 'javascript:alert(1)', 'nu e url', 42])
    assert.equal(validateListingAnalysis({ ...withImg, sursa: { ...withImg.sursa, imagine: bad } }).ok, false, String(bad));
});

function page(html, url) {
  const { document } = parseHTML(html);
  Object.defineProperty(document, 'location', { value: { href: url } });
  return document;
}

test('extragerea imaginii: datele structurate întâi (logo-ul din og:image e ignorat), apoi og:image; doar https', () => {
  const ld = page(
    `<html><head><meta property="og:image" content="https://site.example/build/logo.svg">
     <script type="application/ld+json">{"@type":"RealEstateListing","name":"Ap","image":"https://site.example/media/1.jpg","offers":{"price":"500","priceCurrency":"EUR"}}</script>
     </head><body><main><h1>Apartament de închiriat</h1><p>Chirie 500 € pe lună, 2 camere.</p></main></body></html>`,
    'https://site.example/a',
  );
  assert.equal(readPage(ld).imagine, 'https://site.example/media/1.jpg');
  const og = page('<html><head><meta property="og:image" content="https://cdn.example/p.webp"></head><body><p>Chirie 400 € pe lună</p></body></html>', 'https://x.example/');
  assert.equal(readPage(og).imagine, 'https://cdn.example/p.webp');
  const none = page('<html><head><meta property="og:image" content="http://insecure.example/p.jpg"></head><body><p>x</p></body></html>', 'https://x.example/');
  assert.equal(readPage(none).imagine, null);
});

test('detective: imaginea paginii ajunge în analiză (inclusiv în modul demonstrativ și manual)', async () => {
  const img = 'https://img.example/a.jpg';
  const demo = await runDetective({ text: demoListingTextA, tip: 'pagina', url: 'http://localhost:5174/anunt-a.html', imagine: img, setari: { modDemo: true, acordAI: false } });
  assert.equal(demo.analiza.sursa.imagine, img);
  const manual = await runDetective({ text: 'x', tip: 'pagina', imagine: img, setari: { modDemo: false, acordAI: false } });
  assert.equal(manual.analiza.sursa.imagine, img);
});

test('„Potrivire excelentă” cere comparabilitate dovedită: aceleași camere și suprafață ±25% (cunoscute)', () => {
  const r = rankAlternatives({
    candidates: [cand('fara-suprafata', 1400, 'RON', 1, null), cand('alta-suprafata', 1400, 'RON', 1, 60), cand('dovedit', 1450, 'RON', 1, 34)],
    analyzed,
    ctx,
    maxChirieRON: null,
    lunaStart: 1,
  });
  assert.deepEqual(r.recomandari.map((x) => [x.id, x.potrivire]), [
    ['dovedit', POTRIVIRE.EXCELENTA],
    ['fara-suprafata', POTRIVIRE.BUNA],
    ['alta-suprafata', POTRIVIRE.BUNA],
  ]);
});
