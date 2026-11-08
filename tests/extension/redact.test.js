import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskAmounts, redactContacts } from '../../extension/src/ai/redact.js';
import { demoListingTextA, demoListingTextB } from '../../extension/src/shared/contracts/fixtures/demoScenario.js';

test('telefoanele în formatele uzuale devin [TELEFON]', () => {
  for (const phone of ['0722 123 456', '0722123456', '+40 722 123 456', '0040722123456', '0722-123-456', '(0264) 123 456', '0264.123.456']) {
    assert.equal(redactContacts(`Sunați la ${phone} după ora 18.`), 'Sunați la [TELEFON] după ora 18.', phone);
  }
});

test('e-mailurile devin [EMAIL]', () => {
  assert.equal(redactContacts('Scrieți la ion.popescu+chirii@exemplu.ro azi'), 'Scrieți la [EMAIL] azi');
});

test('prețurile, suprafețele, anii și duratele nu sunt atinse', () => {
  const text = 'Preț 1.950 lei, 350 EUR, 48 mp, bloc 2015, contract 12 luni, garanție 3500 1750 RON.';
  assert.equal(redactContacts(text), text);
});

test('anunțurile demo: doar telefonul din A este ascuns', () => {
  const a = redactContacts(demoListingTextA);
  assert.ok(a.includes('[TELEFON]'));
  assert.ok(!a.includes('0722'));
  assert.ok(a.includes('Preț: 350 EUR/lună'));
  assert.equal(redactContacts(demoListingTextB), demoListingTextB);
});

test('scenariile de furtună: sumele sunt mascate, duratele și procentele mici rămân', () => {
  assert.equal(maskAmounts('Pierd jobul 2 luni din aprilie, aveam 5.200 lei salariu'), 'Pierd jobul 2 luni din aprilie, aveam [SUMĂ] salariu');
  assert.equal(maskAmounts('Reparație de 800 RON în iunie'), 'Reparație de [SUMĂ] în iunie');
  assert.equal(maskAmounts('o cheltuială de 1500'), 'o cheltuială de [SUMĂ]');
  assert.equal(maskAmounts('chiria crește cu 10% din septembrie'), 'chiria crește cu 10% din septembrie');
  assert.equal(maskAmounts('mașina costă €2,500 și sun la 0722123456'), 'mașina costă [SUMĂ] și sun la [TELEFON]');
  assert.equal(maskAmounts('îmi trebuie 50 lei'), 'îmi trebuie [SUMĂ]');
});
