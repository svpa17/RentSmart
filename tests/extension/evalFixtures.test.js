import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadEvalCases } from '../eval/cases.js';
import { AI_FIELD_STATUSES, CURRENCIES, LISTING_FIELD_TYPES } from '../../extension/src/shared/contracts/constants.js';

const cases = loadEvalCases(path.resolve(import.meta.dirname, '..', '..'));

test('setul de evaluare: 10–15 anunțuri, id-uri unice, câmpuri și statusuri valide', () => {
  assert.ok(cases.length >= 10 && cases.length <= 15, String(cases.length));
  assert.equal(new Set(cases.map((c) => c.id)).size, cases.length);
  for (const c of cases) {
    assert.ok(c.text.length > 0 && c.text.length <= 15000, c.id);
    for (const [name, exp] of Object.entries(c.asteptat)) {
      assert.ok(name in LISTING_FIELD_TYPES, `${c.id}.${name}`);
      assert.ok(AI_FIELD_STATUSES.includes(exp.status), `${c.id}.${name}`);
      if (exp.moneda) assert.ok(CURRENCIES.includes(exp.moneda), `${c.id}.${name}`);
      if (exp.status !== 'gasit') assert.equal(exp.valoare, undefined, `${c.id}.${name}: doar „gasit” are valoare`);
    }
  }
});

test('setul de evaluare: sumele „gasit” apar efectiv în textul anunțului', () => {
  for (const c of cases) {
    const digits = c.text.replace(/(\d)[.\s](?=\d{3}\b)/g, '$1');
    for (const [name, exp] of Object.entries(c.asteptat)) {
      const type = LISTING_FIELD_TYPES[name];
      const isAmount = type === 'money' || ((type === 'deposit' || type === 'commission') && exp.unitate === 'suma');
      if (exp.status !== 'gasit' || !isAmount || exp.valoare === 0) continue;
      assert.ok(new RegExp(`\\b${exp.valoare}\\b`).test(digits), `${c.id}.${name}: ${exp.valoare}`);
    }
  }
});
