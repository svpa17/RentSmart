import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askedFields, questionBank, questionsFor, templateMessage } from '../../extension/src/shared/questions/index.js';
import { createListingAnalysis, setUserValue } from '../../extension/src/shared/contracts/factories.js';
import { LISTING_FIELDS } from '../../extension/src/shared/contracts/constants.js';
import { demoListingA, demoListingB } from '../../extension/src/shared/contracts/fixtures/demoScenario.js';

const NOW = '2027-01-02T10:00:00.000Z';

test('banca de întrebări acoperă fiecare câmp, pentru „lipsa” și „neclar”', () => {
  for (const name of LISTING_FIELDS) {
    const e = questionBank.intrebari[name];
    assert.ok(e, name);
    assert.ok(e.lipsa?.endsWith('?') && e.neclar?.endsWith('?'), name);
  }
  assert.deepEqual(Object.keys(questionBank.intrebari).sort(), [...LISTING_FIELDS].sort());
});

test('anunțul demo A: întrebări pentru câmpurile „De întrebat”; întreținerea vară/iarnă = o singură întrebare', () => {
  const q = questionsFor(demoListingA);
  assert.deepEqual(q.map((x) => x.campuri), [['intretinereVara', 'intretinereIarna'], ['utilitatiIncluse'], ['comision'], ['reparatii']]);
  assert.equal(q[0].intrebare, questionBank.intrebari.intretinereVara.lipsa);
  assert.deepEqual(askedFields(q), ['intretinereVara', 'intretinereIarna', 'utilitatiIncluse', 'comision', 'reparatii']);
  // B are doar „utilitățile incluse” de întrebat.
  assert.deepEqual(questionsFor(demoListingB).map((x) => x.campuri), [['utilitatiIncluse']]);
});

test('„neclar” are formularea proprie; confirmările scot întrebarea din listă', () => {
  const a = structuredClone(demoListingA);
  a.campuri.comision = { ...a.campuri.comision, status: 'neclar', dovada: 'Disponibilă imediat' };
  assert.equal(questionsFor(a).find((x) => x.campuri[0] === 'comision').intrebare, questionBank.intrebari.comision.neclar);
  const confirmed = setUserValue(demoListingA, 'comision', { status: 'confirmat', valoare: 0, moneda: 'RON', unitate: 'suma', actualizatLa: NOW });
  assert.ok(!askedFields(questionsFor(confirmed)).includes('comision'));
});

test('mesajul-șablon: salut, întrebări numerotate, încheiere; gol când nu e nimic de întrebat', () => {
  const msg = templateMessage(questionsFor(demoListingA));
  const lines = msg.split('\n');
  assert.equal(lines[0], 'Bună ziua!');
  assert.match(lines[2], /^1\. /);
  assert.match(lines[5], /^4\. /);
  assert.equal(lines.at(-1), questionBank.sablonMesaj.incheiere);
  assert.ok(!/\d{3,}/.test(msg), 'fără sume în mesaj');
  assert.equal(templateMessage([]), '');
  // Completare manuală: toate cele 10 întrebări (11 câmpuri, întreținerea grupată).
  const manual = createListingAnalysis({ id: 'm', tip: 'text_lipit', analizatLa: NOW });
  assert.equal(questionsFor(manual).length, 10);
});
